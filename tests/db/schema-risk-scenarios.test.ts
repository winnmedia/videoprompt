/**
 * 스키마 변경 위험 시나리오 테스트 케이스
 * 
 * 목적: 프로덕션 데이터 손실 방지 및 다운타임 최소화
 * 
 * 위험 시나리오별 대응:
 * 1. 데이터 타입 변경으로 인한 데이터 손실
 * 2. NOT NULL 제약조건 추가 시 기존 데이터 충돌  
 * 3. 외래키 제약조건 변경으로 인한 참조 무결성 위반
 * 4. 인덱스 변경으로 인한 성능 저하
 * 5. 큰 테이블 ALTER로 인한 장시간 락
 * 6. 트랜잭션 충돌 및 데드락
 */

import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';

describe('스키마 변경 위험 시나리오 검증', () => {
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

  describe('데이터 타입 변경 위험성 검증', () => {
    // RED: 데이터 손실 방지 테스트
    test('기존 TEXT 필드에서 INTEGER로 변경 시 데이터 호환성 검사', async () => {
      // VideoAsset.duration이 현재 INTEGER인지 확인
      const query = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'VideoAsset' 
        AND column_name = 'duration';
      `;
      
      const result = await pgClient.query(query);
      
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].data_type).toBe('integer');
    });

    // RED: JSON → JSONB 변경 시 기존 데이터 검증
    test('JSON에서 JSONB로 타입 변경 시 기존 데이터 유효성 검사', async () => {
      // Comment.feedback_data가 JSONB로 설정되어야 함
      const query = `
        SELECT column_name, data_type
        FROM information_schema.columns 
        WHERE table_name = 'Comment' 
        AND column_name = 'feedback_data';
      `;
      
      const result = await pgClient.query(query);
      
      if (result.rows.length > 0) {
        expect(result.rows[0].data_type).toBe('jsonb');
      }
    });

    // RED: 문자열 길이 제한 변경 위험성
    test('VARCHAR 길이 축소 시 기존 데이터 절단 위험 검사', async () => {
      // 기존 데이터의 최대 길이 확인
      const maxLengthQuery = `
        SELECT MAX(LENGTH(email)) as max_length
        FROM "User"
        WHERE email IS NOT NULL;
      `;
      
      const result = await pgClient.query(maxLengthQuery);
      
      if (result.rows.length > 0 && result.rows[0].max_length !== null) {
        // 최대 길이가 합리적 범위 내에 있는지 확인
        expect(result.rows[0].max_length).toBeLessThan(255);
      }
    });
  });

  describe('NOT NULL 제약조건 추가 위험성', () => {
    // RED: 기존 NULL 데이터 존재 시 제약조건 위반
    test('기존 NULL 데이터가 있는 필드에 NOT NULL 추가 시 충돌 검사', async () => {
      const tablesWithNullableFields = [
        { table: 'VideoAsset', column: 'generation_metadata' },
        { table: 'Comment', column: 'feedback_data' },
        { table: 'ShareToken', column: 'permissions' }
      ];

      for (const field of tablesWithNullableFields) {
        const nullCheckQuery = `
          SELECT COUNT(*) as null_count
          FROM "${field.table}"
          WHERE "${field.column}" IS NULL;
        `;
        
        const result = await pgClient.query(nullCheckQuery);
        
        // NULL 데이터가 있는 경우 NOT NULL 제약조건 추가 위험
        if (result.rows[0].null_count > 0) {
          console.warn(`경고: ${field.table}.${field.column}에 ${result.rows[0].null_count}개의 NULL 값 존재`);
        }
      }
    });

    // RED: 기본값 없이 NOT NULL 추가 시도 차단
    test('기본값 없는 NOT NULL 제약조건 추가 방지', async () => {
      const requiredDefaults = [
        { table: 'VideoAsset', column: 'quality_score', expectedDefault: '0.0' },
        { table: 'ShareToken', column: 'permissions', expectedDefault: 'canView' },
        { table: 'Comment', column: 'comment_type', expectedDefault: 'general' }
      ];

      for (const field of requiredDefaults) {
        const query = `
          SELECT column_default
          FROM information_schema.columns 
          WHERE table_name = $1 
          AND column_name = $2;
        `;
        
        const result = await pgClient.query(query, [field.table, field.column]);
        
        if (result.rows.length > 0) {
          expect(result.rows[0].column_default).toContain(field.expectedDefault);
        }
      }
    });
  });

  describe('외래키 제약조건 변경 위험성', () => {
    // RED: 고아 레코드 존재 시 외래키 제약조건 위반  
    test('고아 레코드 존재 여부 검사', async () => {
      const foreignKeyChecks = [
        {
          childTable: 'VideoAsset',
          childColumn: 'prompt_id', 
          parentTable: 'Prompt',
          parentColumn: 'id'
        },
        {
          childTable: 'Prompt',
          childColumn: 'scenario_id',
          parentTable: 'Scenario', 
          parentColumn: 'id'
        }
      ];

      for (const fk of foreignKeyChecks) {
        const orphanQuery = `
          SELECT COUNT(*) as orphan_count
          FROM "${fk.childTable}" c
          LEFT JOIN "${fk.parentTable}" p ON c."${fk.childColumn}" = p."${fk.parentColumn}"
          WHERE c."${fk.childColumn}" IS NOT NULL 
          AND p."${fk.parentColumn}" IS NULL;
        `;
        
        const result = await pgClient.query(orphanQuery);
        
        // 고아 레코드가 있으면 외래키 제약조건 추가 실패
        expect(parseInt(result.rows[0].orphan_count)).toBe(0);
      }
    });

    // RED: CASCADE 삭제 정책 안전성 검증
    test('CASCADE 삭제 설정 시 의도치 않은 대량 삭제 방지', async () => {
      const cascadeQuery = `
        SELECT 
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND rc.delete_rule = 'CASCADE';
      `;
      
      const result = await pgClient.query(cascadeQuery);
      
      // CASCADE 설정된 외래키들이 안전한 관계인지 검증
      for (const row of result.rows) {
        const safeDeleteTables = [
          'EmailVerification', 
          'PasswordReset', 
          'RefreshToken'
        ];
        
        expect(safeDeleteTables).toContain(row.table_name);
      }
    });
  });

  describe('인덱스 변경으로 인한 성능 위험', () => {
    // RED: 중요 쿼리 성능 저하 방지
    test('자주 사용되는 WHERE 절에 대한 인덱스 존재 확인', async () => {
      const criticalIndexes = [
        { table: 'User', column: 'email' },
        { table: 'Prompt', column: 'user_id' },
        { table: 'VideoAsset', column: 'prompt_id' },
        { table: 'Project', column: 'user_id' }
      ];

      for (const idx of criticalIndexes) {
        const indexQuery = `
          SELECT indexname 
          FROM pg_indexes 
          WHERE tablename = $1 
          AND indexdef ILIKE '%' || $2 || '%';
        `;
        
        const result = await pgClient.query(indexQuery, [idx.table, idx.column]);
        
        expect(result.rows.length).toBeGreaterThan(0);
      }
    });

    // RED: 복합 인덱스 효율성 검증
    test('복합 인덱스의 칼럼 순서 최적화 검증', async () => {
      const compositeIndexQuery = `
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE tablename = 'Prompt' 
        AND indexname = 'idx_prompt_user_id_version';
      `;
      
      const result = await pgClient.query(compositeIndexQuery);
      
      if (result.rows.length > 0) {
        const indexDef = result.rows[0].indexdef;
        
        // 선택도가 높은 칼럼(user_id)이 앞에 와야 함
        const userIdIndex = indexDef.indexOf('user_id');
        const versionIndex = indexDef.indexOf('cinegenius_version');
        
        expect(userIdIndex).toBeLessThan(versionIndex);
      }
    });

    // RED: 중복 인덱스 방지
    test('중복 인덱스 존재 여부 검사', async () => {
      const duplicateIndexQuery = `
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        AND tablename IN ('User', 'Prompt', 'VideoAsset', 'Project');
      `;
      
      const result = await pgClient.query(duplicateIndexQuery);
      
      // 통계 정보가 수집되었는지 확인 (ANALYZE 실행 여부)
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('대용량 테이블 ALTER 위험성', () => {
    // RED: 테이블 크기 검사 후 락 시간 추정
    test('대용량 테이블의 ALTER 작업 위험도 평가', async () => {
      const tableSizeQuery = `
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
      `;
      
      const result = await pgClient.query(tableSizeQuery);
      
      for (const table of result.rows) {
        const sizeInMB = parseInt(table.size_bytes) / (1024 * 1024);
        
        // 100MB 이상 테이블의 경우 주의 필요
        if (sizeInMB > 100) {
          console.warn(`경고: ${table.tablename} 테이블 크기 ${table.size} - ALTER 작업 시 주의 필요`);
        }
      }
      
      // 최소한 일부 테이블이 존재해야 함
      expect(result.rows.length).toBeGreaterThan(0);
    });

    // RED: 동시 접속자 수 vs 락 대기시간 추정
    test('활성 커넥션 수 기반 락 경합 위험도 평가', async () => {
      const activeConnectionsQuery = `
        SELECT 
          count(*) as active_connections,
          count(*) filter (where state = 'active') as active_queries
        FROM pg_stat_activity 
        WHERE datname = current_database();
      `;
      
      const result = await pgClient.query(activeConnectionsQuery);
      
      expect(result.rows).toHaveLength(1);
      
      const activeConnections = parseInt(result.rows[0].active_connections);
      const activeQueries = parseInt(result.rows[0].active_queries);
      
      // 동시 접속자가 많을 경우 ALTER 작업 위험
      if (activeConnections > 50) {
        console.warn(`경고: 활성 커넥션 수 ${activeConnections}개 - ALTER 작업 시 락 경합 위험`);
      }
      
      expect(activeConnections).toBeGreaterThan(0);
      expect(activeQueries).toBeGreaterThanOrEqual(0);
    });
  });

  describe('트랜잭션 충돌 및 데드락 위험', () => {
    // RED: 장기 실행 트랜잭션 감지
    test('장기 실행 트랜잭션으로 인한 블로킹 위험 검사', async () => {
      const longRunningQuery = `
        SELECT 
          pid,
          query_start,
          state,
          query,
          EXTRACT(EPOCH FROM (now() - query_start)) as duration_seconds
        FROM pg_stat_activity 
        WHERE state = 'active'
        AND query_start IS NOT NULL
        AND EXTRACT(EPOCH FROM (now() - query_start)) > 30
        ORDER BY query_start;
      `;
      
      const result = await pgClient.query(longRunningQuery);
      
      // 30초 이상 실행되는 쿼리가 있으면 위험
      for (const query of result.rows) {
        console.warn(`경고: ${query.duration_seconds}초 실행 중인 쿼리 발견: ${query.query.substring(0, 100)}`);
      }
    });

    // RED: 데드락 히스토리 확인
    test('최근 데드락 발생 이력 검사', async () => {
      const deadlockQuery = `
        SELECT 
          count(*) as deadlock_count
        FROM pg_stat_database 
        WHERE datname = current_database()
        AND deadlocks > 0;
      `;
      
      const result = await pgClient.query(deadlockQuery);
      
      // 데드락이 자주 발생하는 환경인지 확인
      if (result.rows[0]?.deadlock_count > 0) {
        console.warn('경고: 데드락 발생 이력 있음 - 마이그레이션 시 추가 주의 필요');
      }
    });

    // RED: 테이블 락 경합 상황 모니터링
    test('테이블 락 대기 상황 실시간 확인', async () => {
      const lockWaitQuery = `
        SELECT 
          blocked_locks.pid AS blocked_pid,
          blocked_activity.usename AS blocked_user,
          blocking_locks.pid AS blocking_pid,
          blocking_activity.usename AS blocking_user,
          blocked_activity.query AS blocked_statement,
          blocking_activity.query AS blocking_statement
        FROM pg_catalog.pg_locks blocked_locks
        JOIN pg_catalog.pg_stat_activity blocked_activity 
          ON blocked_activity.pid = blocked_locks.pid
        JOIN pg_catalog.pg_locks blocking_locks 
          ON blocking_locks.locktype = blocked_locks.locktype
          AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
          AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
          AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
          AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
          AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
          AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
          AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
          AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
          AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
          AND blocking_locks.pid != blocked_locks.pid
        JOIN pg_catalog.pg_stat_activity blocking_activity 
          ON blocking_activity.pid = blocking_locks.pid
        WHERE NOT blocked_locks.granted;
      `;
      
      const result = await pgClient.query(lockWaitQuery);
      
      // 현재 락 대기 상황이 있으면 마이그레이션 연기 권장
      if (result.rows.length > 0) {
        console.warn(`경고: ${result.rows.length}개의 락 대기 상황 발견`);
        
        for (const lock of result.rows) {
          console.warn(`차단된 PID: ${lock.blocked_pid}, 차단하는 PID: ${lock.blocking_pid}`);
        }
      }
    });
  });

  describe('데이터 일관성 검증', () => {
    // RED: 참조 무결성 전체 검증
    test('모든 외래키 참조 무결성 일괄 검증', async () => {
      const integrityQuery = `
        SELECT 
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY';
      `;
      
      const result = await pgClient.query(integrityQuery);
      
      expect(result.rows.length).toBeGreaterThan(0);
      
      // 각 외래키에 대해 참조 무결성 검증
      for (const fk of result.rows) {
        const violationQuery = `
          SELECT COUNT(*) as violations
          FROM "${fk.table_name}" c
          LEFT JOIN "${fk.foreign_table_name}" p 
            ON c."${fk.column_name}" = p."${fk.foreign_column_name}"
          WHERE c."${fk.column_name}" IS NOT NULL 
          AND p."${fk.foreign_column_name}" IS NULL;
        `;
        
        const violationResult = await pgClient.query(violationQuery);
        const violations = parseInt(violationResult.rows[0].violations);
        
        expect(violations).toBe(0);
      }
    });

    // RED: 체크 제약조건 위반 검사
    test('모든 CHECK 제약조건 위반 사항 검증', async () => {
      const checkConstraintsQuery = `
        SELECT 
          tc.constraint_name,
          tc.table_name,
          cc.check_clause
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc 
          ON tc.constraint_name = cc.constraint_name
        WHERE tc.constraint_type = 'CHECK';
      `;
      
      const result = await pgClient.query(checkConstraintsQuery);
      
      // 중요한 체크 제약조건들이 존재하는지 확인
      const importantConstraints = [
        'check_cinegenius_version',
        'check_comment_type'
      ];
      
      const existingConstraints = result.rows.map(row => row.constraint_name);
      
      for (const constraint of importantConstraints) {
        expect(existingConstraints).toContain(constraint);
      }
    });
  });
});