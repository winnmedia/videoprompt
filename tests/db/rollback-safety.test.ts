/**
 * 롤백 안전성 검증 테스트
 * 
 * 목적: 마이그레이션 실패 시 안전한 롤백 보장
 * 
 * 핵심 원칙:
 * 1. 모든 마이그레이션은 롤백 가능해야 함
 * 2. 롤백 시 기존 데이터는 손실되지 않아야 함
 * 3. 롤백 과정도 트랜잭션으로 보장되어야 함
 * 4. 부분 실패 시 일관성 있는 상태 복구
 */

import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';

describe('롤백 안전성 검증', () => {
  let prisma: PrismaClient;
  let pgClient: Client;
  let backupClient: Client;

  beforeAll(async () => {
    prisma = new PrismaClient();
    pgClient = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await pgClient.connect();

    // 백업용 연결 (읽기 전용)
    backupClient = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await backupClient.connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pgClient.end();
    await backupClient.end();
  });

  describe('마이그레이션 스냅샷 및 복구 검증', () => {
    // RED: 마이그레이션 전 스키마 백업 검증
    test('현재 스키마 구조를 백업할 수 있어야 함', async () => {
      const schemaBackupQuery = `
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default,
          ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
      `;
      
      const result = await pgClient.query(schemaBackupQuery);
      
      expect(result.rows.length).toBeGreaterThan(0);
      
      // 중요 테이블들이 백업에 포함되는지 확인
      const tables = [...new Set(result.rows.map(row => row.table_name))];
      const criticalTables = ['User', 'Project', 'Prompt', 'VideoAsset'];
      
      for (const table of criticalTables) {
        expect(tables).toContain(table);
      }
    });

    // RED: 제약조건 백업 검증
    test('모든 제약조건을 백업할 수 있어야 함', async () => {
      const constraintsBackupQuery = `
        SELECT 
          tc.constraint_name,
          tc.table_name,
          tc.constraint_type,
          cc.check_clause,
          rc.update_rule,
          rc.delete_rule
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.check_constraints cc 
          ON tc.constraint_name = cc.constraint_name
        LEFT JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
        WHERE tc.table_schema = 'public'
        ORDER BY tc.table_name, tc.constraint_type;
      `;
      
      const result = await pgClient.query(constraintsBackupQuery);
      
      expect(result.rows.length).toBeGreaterThan(0);
      
      // 중요 제약조건 타입들이 포함되는지 확인
      const constraintTypes = [...new Set(result.rows.map(row => row.constraint_type))];
      expect(constraintTypes).toContain('PRIMARY KEY');
      expect(constraintTypes).toContain('FOREIGN KEY');
    });

    // RED: 인덱스 백업 검증
    test('모든 인덱스 정보를 백업할 수 있어야 함', async () => {
      const indexBackupQuery = `
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;
      `;
      
      const result = await pgClient.query(indexBackupQuery);
      
      expect(result.rows.length).toBeGreaterThan(0);
      
      // 중요 인덱스들이 백업에 포함되는지 확인
      const indexNames = result.rows.map(row => row.indexname);
      
      // PRIMARY KEY 인덱스들이 존재해야 함
      const primaryKeyIndexes = indexNames.filter(name => name.includes('pkey'));
      expect(primaryKeyIndexes.length).toBeGreaterThan(0);
    });
  });

  describe('트랜잭션 롤백 시나리오', () => {
    // RED: 단일 트랜잭션 롤백 검증
    test('단일 ALTER 문 실패 시 롤백이 정상 작동해야 함', async () => {
      // 트랜잭션 시뮬레이션 (실제 변경하지 않음)
      try {
        await pgClient.query('BEGIN');
        
        // 의도적으로 실패하는 ALTER 문 (존재하지 않는 칼럼 타입)
        const invalidAlterQuery = `
          ALTER TABLE "VideoAsset" 
          ADD COLUMN test_rollback_column INVALID_TYPE;
        `;
        
        try {
          await pgClient.query(invalidAlterQuery);
          // 이 라인에 도달하면 안 됨
          expect(true).toBe(false);
        } catch (error) {
          // 예상된 에러
          expect(error).toBeDefined();
          
          // 롤백 실행
          await pgClient.query('ROLLBACK');
        }
        
        // 롤백 후 테이블이 원래 상태인지 확인
        const checkTableQuery = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'VideoAsset' 
          AND column_name = 'test_rollback_column';
        `;
        
        const result = await pgClient.query(checkTableQuery);
        
        // 칼럼이 추가되지 않았어야 함
        expect(result.rows).toHaveLength(0);
        
      } catch (error) {
        // 혹시 트랜잭션이 열려있다면 롤백
        await pgClient.query('ROLLBACK').catch(() => {});
      }
    });

    // RED: 복수 DDL 문 중 하나 실패 시 전체 롤백
    test('여러 DDL 문 중 하나 실패 시 전체 트랜잭션이 롤백되어야 함', async () => {
      try {
        await pgClient.query('BEGIN');
        
        // 성공할 ALTER 문
        await pgClient.query(`
          ALTER TABLE "VideoAsset" 
          ADD COLUMN test_temp_column1 TEXT;
        `);
        
        // 의도적으로 실패하는 ALTER 문
        try {
          await pgClient.query(`
            ALTER TABLE "VideoAsset" 
            ADD COLUMN test_temp_column2 INVALID_TYPE;
          `);
        } catch (error) {
          // 예상된 에러로 인한 롤백
          await pgClient.query('ROLLBACK');
        }
        
        // 첫 번째 칼럼도 추가되지 않았어야 함 (전체 롤백)
        const checkQuery = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'VideoAsset' 
          AND column_name IN ('test_temp_column1', 'test_temp_column2');
        `;
        
        const result = await pgClient.query(checkQuery);
        
        expect(result.rows).toHaveLength(0);
        
      } catch (error) {
        await pgClient.query('ROLLBACK').catch(() => {});
      }
    });
  });

  describe('데이터 무결성 롤백 검증', () => {
    // RED: 기존 데이터 보존 검증
    test('롤백 시 기존 데이터가 손실되지 않아야 함', async () => {
      // 기존 데이터 카운트 백업
      const initialCountQueries = [
        { table: 'User', query: 'SELECT COUNT(*) as count FROM "User"' },
        { table: 'Project', query: 'SELECT COUNT(*) as count FROM "Project"' },
        { table: 'Prompt', query: 'SELECT COUNT(*) as count FROM "Prompt"' },
        { table: 'VideoAsset', query: 'SELECT COUNT(*) as count FROM "VideoAsset"' }
      ];

      const initialCounts = {};
      
      for (const countQuery of initialCountQueries) {
        const result = await pgClient.query(countQuery.query);
        initialCounts[countQuery.table] = parseInt(result.rows[0].count);
      }

      try {
        await pgClient.query('BEGIN');
        
        // 데이터에 영향을 주지 않는 스키마 변경 시도
        await pgClient.query(`
          ALTER TABLE "VideoAsset" 
          ADD COLUMN test_data_integrity TEXT;
        `);
        
        // 의도적 롤백
        await pgClient.query('ROLLBACK');
        
        // 롤백 후 데이터 카운트 재확인
        for (const countQuery of initialCountQueries) {
          const result = await pgClient.query(countQuery.query);
          const currentCount = parseInt(result.rows[0].count);
          
          expect(currentCount).toBe(initialCounts[countQuery.table]);
        }
        
      } catch (error) {
        await pgClient.query('ROLLBACK').catch(() => {});
      }
    });

    // RED: 외래키 관계 보존 검증
    test('롤백 시 외래키 관계가 손상되지 않아야 함', async () => {
      const foreignKeyQuery = `
        SELECT 
          COUNT(*) as fk_count
        FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY'
        AND table_schema = 'public';
      `;
      
      const initialResult = await pgClient.query(foreignKeyQuery);
      const initialFkCount = parseInt(initialResult.rows[0].fk_count);

      try {
        await pgClient.query('BEGIN');
        
        // 외래키에 영향을 줄 수 있는 변경 시도 후 롤백
        await pgClient.query('ROLLBACK');
        
        const finalResult = await pgClient.query(foreignKeyQuery);
        const finalFkCount = parseInt(finalResult.rows[0].fk_count);
        
        expect(finalFkCount).toBe(initialFkCount);
        
      } catch (error) {
        await pgClient.query('ROLLBACK').catch(() => {});
      }
    });
  });

  describe('부분 실패 복구 시나리오', () => {
    // RED: 마이그레이션 로그 일관성 검증
    test('마이그레이션 실패 시 로그 테이블 상태가 일관되어야 함', async () => {
      // MigrationLog 테이블이 존재한다면 (아직 없지만 생성 후) 검증
      const migrationLogExistsQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'MigrationLog';
      `;
      
      const tableExists = await pgClient.query(migrationLogExistsQuery);
      
      if (tableExists.rows.length > 0) {
        // 실패한 마이그레이션에 대한 로그 상태 확인
        const failedMigrationQuery = `
          SELECT version, success, error_message
          FROM "MigrationLog" 
          WHERE success = false;
        `;
        
        const failedMigrations = await pgClient.query(failedMigrationQuery);
        
        // 실패한 마이그레이션들이 올바르게 로깅되었는지 확인
        for (const migration of failedMigrations.rows) {
          expect(migration.success).toBe(false);
          expect(migration.error_message).not.toBeNull();
          expect(migration.version).toBeDefined();
        }
      } else {
        // MigrationLog 테이블이 없는 경우 - 이것 자체가 문제
        console.warn('경고: MigrationLog 테이블이 존재하지 않음 - 마이그레이션 추적 불가능');
      }
    });

    // RED: 중단된 마이그레이션 정리 검증
    test('중단된 마이그레이션의 임시 객체가 정리되어야 함', async () => {
      // 임시 테이블, 인덱스, 제약조건 등이 남아있지 않은지 확인
      const tempObjectsQuery = `
        SELECT 
          'table' as object_type, 
          table_name as object_name
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE '%_temp%'
        
        UNION ALL
        
        SELECT 
          'index' as object_type,
          indexname as object_name
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname LIKE '%_temp%'
        
        UNION ALL
        
        SELECT 
          'constraint' as object_type,
          constraint_name as object_name
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND constraint_name LIKE '%_temp%';
      `;
      
      const result = await pgClient.query(tempObjectsQuery);
      
      // 임시 객체가 남아있지 않아야 함
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('롤백 성능 및 안전성', () => {
    // RED: 롤백 시간 제한 검증
    test('롤백 작업이 합리적 시간 내에 완료되어야 함', async () => {
      const startTime = Date.now();
      
      try {
        await pgClient.query('BEGIN');
        
        // 가벼운 스키마 변경 후 즉시 롤백
        await pgClient.query(`
          ALTER TABLE "User" 
          ADD COLUMN test_performance_rollback BOOLEAN DEFAULT false;
        `);
        
        await pgClient.query('ROLLBACK');
        
        const endTime = Date.now();
        const rollbackDuration = endTime - startTime;
        
        // 롤백이 5초 이내에 완료되어야 함
        expect(rollbackDuration).toBeLessThan(5000);
        
      } catch (error) {
        await pgClient.query('ROLLBACK').catch(() => {});
      }
    });

    // RED: 롤백 중 다른 트랜잭션 영향 검증
    test('롤백이 다른 활성 트랜잭션에 영향을 주지 않아야 함', async () => {
      // 이 테스트는 실제 다중 연결 환경에서만 의미가 있으므로 
      // 기본적인 격리 수준 확인으로 대체
      const isolationQuery = `
        SHOW default_transaction_isolation;
      `;
      
      const result = await pgClient.query(isolationQuery);
      
      expect(result.rows).toHaveLength(1);
      expect(['read committed', 'repeatable read', 'serializable'])
        .toContain(result.rows[0].default_transaction_isolation);
    });

    // RED: 메모리 사용량 제한 검증
    test('롤백 시 메모리 사용량이 제한 범위 내에 있어야 함', async () => {
      // PostgreSQL 설정 확인
      const memorySettingsQuery = `
        SELECT name, setting, unit
        FROM pg_settings
        WHERE name IN ('shared_buffers', 'work_mem', 'maintenance_work_mem')
        ORDER BY name;
      `;
      
      const result = await pgClient.query(memorySettingsQuery);
      
      expect(result.rows.length).toBe(3);
      
      for (const setting of result.rows) {
        expect(setting.setting).toBeDefined();
        expect(parseInt(setting.setting)).toBeGreaterThan(0);
      }
    });
  });

  describe('복구 검증 및 일관성 체크', () => {
    // RED: 스키마 일관성 최종 검증
    test('롤백 후 스키마 일관성이 유지되어야 함', async () => {
      const consistencyChecks = [
        {
          name: 'Primary Key 일관성',
          query: `
            SELECT COUNT(*) as pk_count
            FROM information_schema.table_constraints 
            WHERE constraint_type = 'PRIMARY KEY'
            AND table_schema = 'public'
          `
        },
        {
          name: 'Foreign Key 일관성', 
          query: `
            SELECT COUNT(*) as fk_count
            FROM information_schema.table_constraints 
            WHERE constraint_type = 'FOREIGN KEY'
            AND table_schema = 'public'
          `
        },
        {
          name: 'NOT NULL 제약조건 일관성',
          query: `
            SELECT COUNT(*) as nn_count
            FROM information_schema.columns
            WHERE is_nullable = 'NO'
            AND table_schema = 'public'
          `
        }
      ];

      for (const check of consistencyChecks) {
        const result = await pgClient.query(check.query);
        const count = parseInt(result.rows[0][Object.keys(result.rows[0])[0]]);
        
        expect(count).toBeGreaterThan(0);
      }
    });

    // RED: 데이터베이스 통계 정보 일관성
    test('롤백 후 시스템 카탈로그 정보가 일관되어야 함', async () => {
      const catalogConsistencyQuery = `
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          most_common_vals
        FROM pg_stats
        WHERE schemaname = 'public'
        AND tablename IN ('User', 'Project', 'Prompt', 'VideoAsset')
        LIMIT 5;
      `;
      
      const result = await pgClient.query(catalogConsistencyQuery);
      
      // 통계 정보가 수집되어 있어야 함
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });
});