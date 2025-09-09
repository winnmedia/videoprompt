// Database connection test module
// TDD 접근 방식으로 먼저 테스트 작성

import { PrismaClient } from '@prisma/client';

export interface DatabaseTestResult {
  isConnected: boolean;
  latency: number;
  error?: string;
  schemaValid?: boolean;
  missingTables?: string[];
}

export interface DatabaseConnectionConfig {
  url: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * 데이터베이스 연결 테스트 (단위 테스트용)
 */
export const testDatabaseConnection = async (
  config: DatabaseConnectionConfig
): Promise<DatabaseTestResult> => {
  const startTime = Date.now();
  let client: PrismaClient | undefined;

  try {
    // 환경 변수 검증
    if (!config.url || !config.url.startsWith('postgresql://')) {
      throw new Error('유효하지 않은 DATABASE_URL 형식입니다.');
    }

    // Prisma 클라이언트 생성 (테스트용)
    client = new PrismaClient({
      datasources: {
        db: {
          url: config.url
        }
      },
      log: ['error']
    });

    // 기본 연결 테스트
    await client.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;

    // 스키마 검증 (필수 테이블 확인)
    const schemaValidation = await validateDatabaseSchema(client);

    await client.$disconnect();

    return {
      isConnected: true,
      latency,
      schemaValid: schemaValidation.isValid,
      missingTables: schemaValidation.missingTables
    };

  } catch (error) {
    const latency = Date.now() - startTime;
    
    if (client) {
      try {
        await client.$disconnect();
      } catch (disconnectError) {
        console.warn('클라이언트 연결 해제 실패:', disconnectError);
      }
    }

    return {
      isConnected: false,
      latency,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      schemaValid: false
    };
  }
};

/**
 * 데이터베이스 스키마 검증
 */
const validateDatabaseSchema = async (client: PrismaClient): Promise<{
  isValid: boolean;
  missingTables: string[];
}> => {
  const requiredTables = [
    'User', 'Project', 'Scene', 'Preset', 'Timeline',
    'Scenario', 'Prompt', 'VideoAsset', 'ShareToken',
    'Comment', 'Story', 'Upload', 'EmailVerification', 'PasswordReset'
  ];

  try {
    // PostgreSQL 테이블 목록 조회
    const tables = await client.$queryRaw<{ tablename: string }[]>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `;

    const existingTables = tables.map(t => t.tablename);
    const missingTables = requiredTables.filter(
      table => !existingTables.includes(table)
    );

    return {
      isValid: missingTables.length === 0,
      missingTables
    };

  } catch (error) {
    console.error('스키마 검증 실패:', error);
    return {
      isValid: false,
      missingTables: requiredTables
    };
  }
};