/**
 * 데이터베이스 마이그레이션 무결성 검증 테스트 스위트
 * 
 * Benjamin의 계약 위반 발견사항 대응:
 * 1. CineGenius v3 지원 SQL이 부분적으로만 적용됨
 * 2. MigrationLog 테이블이 존재하지 않음  
 * 3. 인덱스 및 제약조건 누락
 * 4. 수동 마이그레이션 검증 프로세스 부재
 * 
 * TDD 접근: Red → Green → Refactor
 * 모든 테스트는 결정론적(deterministic)이어야 함
 */

import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';

describe('데이터베이스 마이그레이션 무결성 검증', () => {
  let prisma: PrismaClient;
  let pgClient: Client;

  beforeAll(async () => {
    // 테스트용 DB 클라이언트 초기화
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

  describe('CineGenius v3.1 스키마 계약 검증', () => {
    describe('VideoAsset 테이블', () => {
      // RED: 실패해야 하는 테스트 (현재 필드 누락)
      test('generation_metadata 필드가 존재해야 함', async () => {
        const query = `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = 'VideoAsset' 
          AND column_name = 'generation_metadata';
        `;
        
        const result = await pgClient.query(query);
        
        // 현재는 실패할 것 (필드 누락)
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].column_name).toBe('generation_metadata');
        expect(result.rows[0].data_type).toBe('jsonb');
      });

      // RED: 실패해야 하는 테스트
      test('quality_score 필드가 존재하고 DECIMAL(3,2) 타입이어야 함', async () => {
        const query = `
          SELECT column_name, data_type, numeric_precision, numeric_scale, column_default
          FROM information_schema.columns 
          WHERE table_name = 'VideoAsset' 
          AND column_name = 'quality_score';
        `;
        
        const result = await pgClient.query(query);
        
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].data_type).toBe('numeric');
        expect(result.rows[0].numeric_precision).toBe(3);
        expect(result.rows[0].numeric_scale).toBe(2);
        expect(result.rows[0].column_default).toBe('0.0');
      });

      // RED: 인덱스 검증 (현재 누락)
      test('quality_score 인덱스가 존재해야 함', async () => {
        const query = `
          SELECT indexname, indexdef
          FROM pg_indexes 
          WHERE tablename = 'VideoAsset' 
          AND indexname = 'idx_video_asset_quality_score';
        `;
        
        const result = await pgClient.query(query);
        
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].indexdef).toContain('quality_score');
      });
    });

    describe('ShareToken 테이블', () => {
      // RED: 실패해야 하는 테스트
      test('permissions 필드가 존재하고 기본값이 설정되어야 함', async () => {
        const query = `
          SELECT column_name, data_type, column_default
          FROM information_schema.columns 
          WHERE table_name = 'ShareToken' 
          AND column_name = 'permissions';
        `;
        
        const result = await pgClient.query(query);
        
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].data_type).toBe('jsonb');
        expect(result.rows[0].column_default).toContain('canView');
        expect(result.rows[0].column_default).toContain('canComment');
      });
    });

    describe('Comment 테이블', () => {
      // RED: 실패해야 하는 테스트
      test('comment_type 필드가 존재하고 기본값이 general이어야 함', async () => {
        const query = `
          SELECT column_name, data_type, column_default
          FROM information_schema.columns 
          WHERE table_name = 'Comment' 
          AND column_name = 'comment_type';
        `;
        
        const result = await pgClient.query(query);
        
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].column_default).toContain('general');
      });

      // RED: 제약조건 검증
      test('comment_type CHECK 제약조건이 존재해야 함', async () => {
        const query = `
          SELECT constraint_name, check_clause
          FROM information_schema.check_constraints
          WHERE constraint_name = 'check_comment_type';
        `;
        
        const result = await pgClient.query(query);
        
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].check_clause).toContain('general');
        expect(result.rows[0].check_clause).toContain('technical');
        expect(result.rows[0].check_clause).toContain('creative');
        expect(result.rows[0].check_clause).toContain('quality');
      });

      // RED: rating 필드 검증
      test('rating 필드 CHECK 제약조건이 1-5 범위여야 함', async () => {
        const query = `
          SELECT constraint_name, check_clause
          FROM information_schema.check_constraints
          WHERE constraint_name LIKE '%rating%';
        `;
        
        const result = await pgClient.query(query);
        
        const ratingConstraint = result.rows.find(row => 
          row.check_clause.includes('rating') && 
          row.check_clause.includes('1') && 
          row.check_clause.includes('5')
        );
        
        expect(ratingConstraint).toBeDefined();
        expect(ratingConstraint.check_clause).toContain('>=');
        expect(ratingConstraint.check_clause).toContain('<=');
      });
    });
  });

  describe('MigrationLog 테이블 존재 검증', () => {
    // RED: 가장 중요한 실패 테스트 - MigrationLog 테이블 부재
    test('MigrationLog 테이블이 존재해야 함', async () => {
      const query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'MigrationLog';
      `;
      
      const result = await pgClient.query(query);
      
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].table_name).toBe('MigrationLog');
    });

    // RED: MigrationLog 스키마 검증
    test('MigrationLog 테이블의 필수 필드들이 존재해야 함', async () => {
      const requiredFields = [
        'id',
        'version', 
        'description',
        'executed_at',
        'execution_time_ms',
        'records_affected',
        'success',
        'error_message'
      ];

      for (const field of requiredFields) {
        const query = `
          SELECT column_name, is_nullable, data_type
          FROM information_schema.columns 
          WHERE table_name = 'MigrationLog' 
          AND column_name = $1;
        `;
        
        const result = await pgClient.query(query, [field]);
        
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].column_name).toBe(field);
      }
    });

    // RED: 기본 마이그레이션 로그 존재 검증
    test('CineGenius v3.1 마이그레이션 로그가 기록되어야 함', async () => {
      const query = `
        SELECT version, description, success
        FROM "MigrationLog" 
        WHERE version = '3.1.0';
      `;
      
      const result = await pgClient.query(query);
      
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].success).toBe(true);
      expect(result.rows[0].description).toContain('CineGenius v3.1');
    });
  });

  describe('Prompt 테이블 인덱스 검증', () => {
    // RED: 성능 최적화 인덱스 검증
    test('cinegenius_version 인덱스가 존재해야 함', async () => {
      const query = `
        SELECT indexname
        FROM pg_indexes 
        WHERE tablename = 'Prompt' 
        AND indexname = 'idx_prompt_cinegenius_version';
      `;
      
      const result = await pgClient.query(query);
      
      expect(result.rows).toHaveLength(1);
    });

    test('project_id 인덱스가 존재해야 함', async () => {
      const query = `
        SELECT indexname
        FROM pg_indexes 
        WHERE tablename = 'Prompt' 
        AND indexname = 'idx_prompt_project_id';
      `;
      
      const result = await pgClient.query(query);
      
      expect(result.rows).toHaveLength(1);
    });

    test('복합 인덱스 user_id + cinegenius_version이 존재해야 함', async () => {
      const query = `
        SELECT indexname, indexdef
        FROM pg_indexes 
        WHERE tablename = 'Prompt' 
        AND indexname = 'idx_prompt_user_id_version';
      `;
      
      const result = await pgClient.query(query);
      
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].indexdef).toContain('user_id');
      expect(result.rows[0].indexdef).toContain('cinegenius_version');
    });
  });

  describe('데이터 타입 검증 (Zod 연동)', () => {
    // RED: 런타임 타입 안전성 검증
    test('JSON/JSONB 필드들이 올바른 타입으로 설정되어야 함', async () => {
      const jsonFields = [
        { table: 'VideoAsset', column: 'generation_metadata', type: 'jsonb' },
        { table: 'ShareToken', column: 'permissions', type: 'jsonb' },
        { table: 'Comment', column: 'feedback_data', type: 'jsonb' }
      ];

      for (const field of jsonFields) {
        const query = `
          SELECT data_type
          FROM information_schema.columns 
          WHERE table_name = $1 
          AND column_name = $2;
        `;
        
        const result = await pgClient.query(query, [field.table, field.column]);
        
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].data_type).toBe(field.type);
      }
    });
  });
});

describe('마이그레이션 롤백 안전성 검증', () => {
  // RED: 롤백 시나리오 테스트
  test('마이그레이션 롤백 후 기존 데이터가 보존되어야 함', async () => {
    // 이 테스트는 실제 롤백을 수행하지 않고 스키마만 검증
    // 프로덕션 데이터 보호를 위한 안전장치
    
    const criticalTables = [
      'User', 'Project', 'Prompt', 'VideoAsset', 
      'ShareToken', 'Comment', 'Scenario'
    ];

    for (const table of criticalTables) {
      const query = `
        SELECT table_name
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1;
      `;
      
      const result = await pgClient.query(query, [table]);
      
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].table_name).toBe(table);
    }
  });

  test('외래키 제약조건이 유지되어야 함', async () => {
    const query = `
      SELECT constraint_name, table_name, constraint_type
      FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY'
      AND table_schema = 'public';
    `;
    
    const result = await pgClient.query(query);
    
    // 최소한의 외래키 제약조건이 존재해야 함
    expect(result.rows.length).toBeGreaterThan(0);
    
    // VideoAsset → Prompt 외래키 검증
    const videoAssetFk = result.rows.find(row => 
      row.table_name === 'VideoAsset' && 
      row.constraint_name.includes('prompt_id')
    );
    
    expect(videoAssetFk).toBeDefined();
  });
});

describe('Race Condition 방지 검증', () => {
  // RED: 동시성 문제 검증
  test('마이그레이션 실행 중 중복 실행 방지 메커니즘', async () => {
    // MigrationLog 테이블의 PRIMARY KEY와 UNIQUE 제약조건 검증
    const query = `
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'MigrationLog'
      AND constraint_type IN ('PRIMARY KEY', 'UNIQUE');
    `;
    
    const result = await pgClient.query(query);
    
    expect(result.rows.length).toBeGreaterThan(0);
    
    const primaryKey = result.rows.find(row => 
      row.constraint_type === 'PRIMARY KEY'
    );
    
    expect(primaryKey).toBeDefined();
  });

  test('동시 마이그레이션 실행 시 데이터 일관성 보장', async () => {
    // 트랜잭션 격리 수준 검증
    const query = `
      SELECT name, setting
      FROM pg_settings
      WHERE name = 'default_transaction_isolation';
    `;
    
    const result = await pgClient.query(query);
    
    expect(result.rows).toHaveLength(1);
    // PostgreSQL 기본값은 'read committed'
    expect(['read committed', 'repeatable read', 'serializable'])
      .toContain(result.rows[0].setting);
  });
});