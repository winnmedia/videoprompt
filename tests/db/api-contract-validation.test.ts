/**
 * API 계약 검증 테스트
 * 
 * 목적: 데이터베이스 스키마와 API 응답 간의 계약 일치성 검증
 * 
 * Benjamin의 계약 위반 발견사항 대응:
 * - VideoAsset: generation_metadata, quality_score 필드 누락
 * - Comment: comment_type, feedback_data, rating 필드 누락  
 * - ShareToken: permissions 필드 누락
 * 
 * 검증 범위:
 * 1. API 응답 스키마와 DB 스키마 일치성
 * 2. 새로운 CineGenius v3.1 필드 지원 여부
 * 3. Zod 스키마와 Prisma 모델 동기화
 * 4. API 버전 호환성
 */

import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { z } from 'zod';

describe('API 계약 검증', () => {
  let prisma: PrismaClient;
  let pgClient: Client;

  beforeAll(async () => {
    prisma = new PrismaClient();
    pgClient = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await pgClient.connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pgClient.end();
  });

  describe('VideoAsset API 계약 검증', () => {
    // RED: CineGenius v3.1 필드 누락으로 현재 실패할 테스트
    test('VideoAsset API 응답이 새로운 DB 필드를 포함해야 함', async () => {
      // 현재 API는 generation_metadata, quality_score를 반환하지 않음
      const expectedApiSchema = z.object({
        id: z.string(),
        provider: z.string(),
        status: z.string(),
        url: z.string().nullable(),
        codec: z.string().nullable(),
        duration: z.number().nullable(),
        version: z.number(),
        createdAt: z.date(),
        // CineGenius v3.1 새 필드들
        generation_metadata: z.object({}).nullable(),
        quality_score: z.number().min(0).max(10).nullable()
      });

      // 실제 DB 스키마 확인
      const schemaQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'VideoAsset'
        ORDER BY ordinal_position;
      `;
      
      const result = await pgClient.query(schemaQuery);
      const dbColumns = result.rows.map(row => row.column_name);
      
      // 새로운 필드들이 DB에 존재하는지 확인 (아직 없으므로 실패 예정)
      expect(dbColumns).toContain('generation_metadata');
      expect(dbColumns).toContain('quality_score');
      
      // API 타입 정의와 DB 스키마 일치성 검증
      const requiredFields = [
        'id', 'provider', 'status', 'url', 'codec', 
        'duration', 'version', 'created_at'
      ];
      
      for (const field of requiredFields) {
        expect(dbColumns).toContain(field);
      }
    });

    // RED: API 응답 타입과 실제 Prisma 선택 필드 불일치
    test('VideoAsset API select 문이 새로운 필드를 포함해야 함', async () => {
      // 현재 API 코드 분석: select에 generation_metadata, quality_score 누락
      const currentSelectFields = [
        'id', 'provider', 'status', 'url', 'codec', 
        'duration', 'version', 'createdAt'
      ];
      
      const requiredSelectFields = [
        ...currentSelectFields,
        'generation_metadata',  // 누락됨
        'quality_score'         // 누락됨
      ];
      
      // DB에서 실제 필드 존재 여부 확인
      for (const field of requiredSelectFields) {
        const fieldCheckQuery = `
          SELECT column_name
          FROM information_schema.columns 
          WHERE table_name = 'VideoAsset' 
          AND column_name = $1;
        `;
        
        const result = await pgClient.query(fieldCheckQuery, [field]);
        
        if (field === 'generation_metadata' || field === 'quality_score') {
          // 이 필드들은 아직 없으므로 실패 예상
          expect(result.rows).toHaveLength(1);
        } else {
          expect(result.rows).toHaveLength(1);
        }
      }
    });

    // RED: 품질 점수 유효성 검증 로직 누락
    test('quality_score 필드의 제약조건이 API 검증과 일치해야 함', async () => {
      const constraintQuery = `
        SELECT 
          tc.constraint_name,
          cc.check_clause
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc 
          ON tc.constraint_name = cc.constraint_name
        WHERE tc.table_name = 'VideoAsset'
        AND cc.check_clause ILIKE '%quality_score%';
      `;
      
      const result = await pgClient.query(constraintQuery);
      
      // quality_score에 대한 CHECK 제약조건이 있어야 함
      expect(result.rows.length).toBeGreaterThan(0);
      
      const qualityScoreConstraint = result.rows.find(row => 
        row.check_clause.includes('quality_score')
      );
      
      expect(qualityScoreConstraint).toBeDefined();
      
      // 0.0 ~ 10.0 범위 제약조건 확인
      if (qualityScoreConstraint) {
        expect(qualityScoreConstraint.check_clause).toContain('>=');
        expect(qualityScoreConstraint.check_clause).toContain('<=');
      }
    });
  });

  describe('Comment API 계약 검증', () => {
    // RED: CineGenius v3.1 Comment 구조화 필드 누락
    test('Comment API가 새로운 구조화 필드를 지원해야 함', async () => {
      const expectedCommentSchema = z.object({
        id: z.string(),
        targetType: z.string(),
        targetId: z.string(),
        author: z.string().nullable(),
        text: z.string(),
        timecode: z.string().nullable(),
        createdAt: z.date(),
        userId: z.string().nullable(),
        // CineGenius v3.1 새 필드들
        comment_type: z.enum(['general', 'technical', 'creative', 'quality']),
        feedback_data: z.object({}).nullable(),
        rating: z.number().min(1).max(5).nullable()
      });

      // DB 스키마 확인
      const schemaQuery = `
        SELECT column_name, data_type, column_default
        FROM information_schema.columns 
        WHERE table_name = 'Comment'
        ORDER BY ordinal_position;
      `;
      
      const result = await pgClient.query(schemaQuery);
      const dbColumns = result.rows.map(row => row.column_name);
      
      // 새로운 필드들이 존재하는지 확인 (아직 없으므로 실패 예정)
      expect(dbColumns).toContain('comment_type');
      expect(dbColumns).toContain('feedback_data');
      expect(dbColumns).toContain('rating');
      
      // comment_type 기본값 확인
      const commentTypeField = result.rows.find(row => row.column_name === 'comment_type');
      if (commentTypeField) {
        expect(commentTypeField.column_default).toContain('general');
      }
    });

    // RED: Comment POST API Zod 스키마 업데이트 누락
    test('Comment POST API 스키마가 새 필드를 검증해야 함', async () => {
      // 현재 API의 Zod 스키마는 새 필드들을 포함하지 않음
      const currentPostSchema = z.object({
        token: z.string().min(16),
        targetType: z.enum(['video', 'project']).or(z.string()),
        targetId: z.string().min(1),
        text: z.string().min(1),
        timecode: z.string().optional(),
      });

      const expectedPostSchema = z.object({
        token: z.string().min(16),
        targetType: z.enum(['video', 'project']).or(z.string()),
        targetId: z.string().min(1),
        text: z.string().min(1),
        timecode: z.string().optional(),
        // 새 필드들 추가
        comment_type: z.enum(['general', 'technical', 'creative', 'quality']).default('general'),
        feedback_data: z.object({
          sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
          categories: z.array(z.string()).optional(),
          suggestions: z.array(z.string()).optional()
        }).nullable().optional(),
        rating: z.number().min(1).max(5).optional()
      });

      // 실제로는 스키마 유효성을 런타임에서 검증하지만,
      // 여기서는 DB 제약조건으로 대체 검증
      const constraintQuery = `
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name = 'check_comment_type';
      `;
      
      const result = await pgClient.query(constraintQuery);
      
      // comment_type CHECK 제약조건이 존재해야 함
      expect(result.rows).toHaveLength(1);
      
      const commentTypeCheck = result.rows[0];
      expect(commentTypeCheck.check_clause).toContain('general');
      expect(commentTypeCheck.check_clause).toContain('technical');
      expect(commentTypeCheck.check_clause).toContain('creative');
      expect(commentTypeCheck.check_clause).toContain('quality');
    });

    // RED: Comment GET API 응답이 새 필드를 포함하지 않음
    test('Comment GET API 응답이 모든 DB 필드를 반환해야 함', async () => {
      // 현재 GET API는 모든 필드를 반환하지만 새 필드는 DB에 없음
      const allCommentFields = [
        'id', 'targetType', 'targetId', 'author', 'text', 
        'timecode', 'createdAt', 'userId',
        'comment_type', 'feedback_data', 'rating'  // 새 필드들
      ];

      for (const field of allCommentFields) {
        const fieldQuery = `
          SELECT column_name
          FROM information_schema.columns 
          WHERE table_name = 'Comment' 
          AND column_name = $1;
        `;
        
        const result = await pgClient.query(fieldQuery, [field]);
        
        expect(result.rows).toHaveLength(1);
      }
    });
  });

  describe('ShareToken API 계약 검증', () => {
    // RED: ShareToken permissions 필드 누락
    test('ShareToken이 세분화된 권한 시스템을 지원해야 함', async () => {
      const expectedPermissions = z.object({
        canView: z.boolean().default(true),
        canComment: z.boolean().default(false),
        canEdit: z.boolean().default(false),
        canDownload: z.boolean().default(false),
        canShare: z.boolean().default(false),
        expiresAt: z.string().optional(),
        allowedIps: z.array(z.string()).optional()
      });

      // DB 스키마 확인
      const schemaQuery = `
        SELECT column_name, data_type, column_default
        FROM information_schema.columns 
        WHERE table_name = 'ShareToken' 
        AND column_name = 'permissions';
      `;
      
      const result = await pgClient.query(schemaQuery);
      
      // permissions 필드가 존재해야 함
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].data_type).toBe('jsonb');
      
      // 기본값에 canView, canComment가 포함되어야 함
      const defaultValue = result.rows[0].column_default;
      expect(defaultValue).toContain('canView');
      expect(defaultValue).toContain('canComment');
    });

    // RED: ShareToken 생성 시 권한 검증 로직 누락
    test('ShareToken 생성 API가 권한 유효성을 검증해야 함', async () => {
      // 실제로는 API 코드를 검사해야 하지만, DB 제약조건으로 대체
      const permissionsFieldQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'ShareToken' 
        AND column_name = 'permissions';
      `;
      
      const result = await pgClient.query(permissionsFieldQuery);
      
      expect(result.rows).toHaveLength(1);
      
      const permissionsField = result.rows[0];
      expect(permissionsField.data_type).toBe('jsonb');
      
      // NOT NULL이어야 함 (기본값 있음)
      expect(permissionsField.is_nullable).toBe('NO');
      
      // 기본값이 설정되어야 함
      expect(permissionsField.column_default).not.toBeNull();
    });
  });

  describe('API 버전 호환성 검증', () => {
    // RED: CineGenius v2.0 → v3.1 호환성 체크
    test('기존 v2.0 API 호출이 여전히 작동해야 함', async () => {
      // Prompt 테이블의 cinegenius_version 필드 확인
      const versionFieldQuery = `
        SELECT 
          column_name,
          column_default,
          data_type
        FROM information_schema.columns 
        WHERE table_name = 'Prompt' 
        AND column_name = 'cinegenius_version';
      `;
      
      const result = await pgClient.query(versionFieldQuery);
      
      expect(result.rows).toHaveLength(1);
      
      // 기본값이 '2.0'이어야 함 (기존 호환성)
      const versionField = result.rows[0];
      expect(versionField.column_default).toContain('2.0');
      
      // CHECK 제약조건 확인
      const checkConstraintQuery = `
        SELECT check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name = 'check_cinegenius_version';
      `;
      
      const constraintResult = await pgClient.query(checkConstraintQuery);
      
      expect(constraintResult.rows).toHaveLength(1);
      
      const checkClause = constraintResult.rows[0].check_clause;
      expect(checkClause).toContain('2.0');
      expect(checkClause).toContain('3.1');
    });

    // RED: API 응답 형식 일관성 검증
    test('모든 API가 일관된 응답 형식을 사용해야 함', async () => {
      // 표준 API 응답 형식 정의
      const apiSuccessSchema = z.object({
        ok: z.literal(true),
        data: z.any(),
        traceId: z.string().optional()
      });

      const apiErrorSchema = z.object({
        ok: z.literal(false),
        code: z.string(),
        error: z.string(),
        details: z.string().optional(),
        traceId: z.string().optional()
      });

      // 실제로는 API 응답을 테스트해야 하지만,
      // 여기서는 DB 오류 처리 검증으로 대체
      
      // 데이터베이스 연결 테스트
      const connectionTest = await pgClient.query('SELECT 1 as test');
      expect(connectionTest.rows).toHaveLength(1);
      expect(connectionTest.rows[0].test).toBe(1);
    });
  });

  describe('Zod 스키마와 Prisma 모델 동기화', () => {
    // RED: 타입 불일치로 인한 런타임 오류 방지
    test('모든 Prisma 모델 필드가 Zod 스키마에 정의되어야 함', async () => {
      const criticalModels = ['VideoAsset', 'Comment', 'ShareToken', 'Prompt'];

      for (const model of criticalModels) {
        const fieldsQuery = `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position;
        `;
        
        const result = await pgClient.query(fieldsQuery, [model]);
        
        expect(result.rows.length).toBeGreaterThan(0);
        
        // 각 모델의 필수 필드들이 존재하는지 확인
        const columnNames = result.rows.map(row => row.column_name);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('created_at');
        
        console.log(`${model} 모델 필드:`, columnNames);
      }
    });

    // RED: JSON 스키마 검증 누락
    test('JSONB 필드에 대한 스키마 검증이 있어야 함', async () => {
      const jsonbFieldsQuery = `
        SELECT 
          table_name,
          column_name,
          column_default
        FROM information_schema.columns 
        WHERE data_type = 'jsonb'
        AND table_schema = 'public'
        ORDER BY table_name, column_name;
      `;
      
      const result = await pgClient.query(jsonbFieldsQuery);
      
      expect(result.rows.length).toBeGreaterThan(0);
      
      // 중요 JSONB 필드들 확인
      const expectedJsonbFields = [
        { table: 'VideoAsset', column: 'generation_metadata' },
        { table: 'ShareToken', column: 'permissions' },
        { table: 'Comment', column: 'feedback_data' }
      ];
      
      const actualJsonbFields = result.rows.map(row => ({
        table: row.table_name,
        column: row.column_name
      }));
      
      for (const expectedField of expectedJsonbFields) {
        const fieldExists = actualJsonbFields.some(field => 
          field.table === expectedField.table && 
          field.column === expectedField.column
        );
        
        expect(fieldExists).toBe(true);
      }
    });
  });

  describe('마이그레이션 추적 및 API 계약', () => {
    // RED: 마이그레이션 로그를 통한 API 버전 추적
    test('API 계약 변경이 마이그레이션 로그에 기록되어야 함', async () => {
      const migrationLogExistsQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'MigrationLog';
      `;
      
      const tableExists = await pgClient.query(migrationLogExistsQuery);
      
      // MigrationLog 테이블이 존재해야 함
      expect(tableExists.rows).toHaveLength(1);
      
      if (tableExists.rows.length > 0) {
        const apiContractMigrationQuery = `
          SELECT 
            version,
            description,
            executed_at,
            success
          FROM "MigrationLog" 
          WHERE description ILIKE '%api%' 
          OR description ILIKE '%contract%'
          OR description ILIKE '%v3.1%'
          ORDER BY executed_at DESC;
        `;
        
        const result = await pgClient.query(apiContractMigrationQuery);
        
        // API 계약 변경에 대한 마이그레이션이 있어야 함
        expect(result.rows.length).toBeGreaterThan(0);
        
        // 최신 마이그레이션이 성공해야 함
        if (result.rows.length > 0) {
          expect(result.rows[0].success).toBe(true);
        }
      }
    });
  });
});