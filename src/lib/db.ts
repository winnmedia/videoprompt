import { PrismaClient } from '@prisma/client';

// 환경 변수 검증
const validateDatabaseUrl = (url?: string): void => {
  if (!url) {
    throw new Error('DATABASE_URL 환경 변수가 설정되지 않았습니다.');
  }
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    throw new Error('유효하지 않은 DATABASE_URL 형식입니다. PostgreSQL URL이 필요합니다.');
  }
};

// Prisma 클라이언트 싱글톤 생성 함수
const prismaClientSingleton = () => {
  // 환경 변수 검증
  validateDatabaseUrl(process.env.DATABASE_URL);

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    
    // 에러 포맷팅
    errorFormat: 'pretty',
  });
};

declare global {
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

// 글로벌 싱글톤 인스턴스 생성 또는 재사용
export const prisma = (() => {
  try {
    return globalThis.prisma ?? prismaClientSingleton();
  } catch (error) {
    console.error('Prisma 클라이언트 초기화 실패:', error);
    throw error;
  }
})();

// 개발 환경에서만 글로벌 캐싱
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// 데이터베이스 연결 헬스 체크 (향상된 버전)
export const checkDatabaseConnection = async (
  client: PrismaClient = prisma, 
  retries = 3
): Promise<{
  success: boolean;
  latency?: number;
  error?: string;
}> => {
  for (let i = 0; i < retries; i++) {
    const startTime = Date.now();
    try {
      // 기본 연결 테스트
      await client.$queryRaw`SELECT 1`;
      
      const latency = Date.now() - startTime;
      console.log(`✅ Database connection successful (${latency}ms)`);
      
      return {
        success: true,
        latency
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      console.warn(`⚠️  Database connection attempt ${i + 1}/${retries} failed:`, errorMessage);
      
      if (i === retries - 1) {
        console.error('❌ Database connection failed after all retries');
        return {
          success: false,
          error: errorMessage
        };
      }
      
      // 재시도 전 대기 (지수 백오프)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  
  return {
    success: false,
    error: '모든 재시도 실패'
  };
};

// 데이터베이스 스키마 검증
export const validateDatabaseSchema = async (
  client: PrismaClient = prisma
): Promise<{
  isValid: boolean;
  missingTables: string[];
  error?: string;
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

    const isValid = missingTables.length === 0;
    
    if (!isValid) {
      console.warn('❌ 누락된 테이블들:', missingTables);
    } else {
      console.log('✅ 데이터베이스 스키마 검증 완료');
    }

    return {
      isValid,
      missingTables
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('❌ 스키마 검증 실패:', errorMessage);
    return {
      isValid: false,
      missingTables: requiredTables,
      error: errorMessage
    };
  }
};

// 데이터베이스 초기화 및 헬스 체크 (API 라우트에서 사용)
export const initializeDatabase = async (): Promise<{
  initialized: boolean;
  connectionStatus: boolean;
  schemaValid: boolean;
  error?: string;
}> => {
  try {
    // 1. 연결 테스트
    const connectionResult = await checkDatabaseConnection(prisma, 2);
    
    if (!connectionResult.success) {
      return {
        initialized: false,
        connectionStatus: false,
        schemaValid: false,
        error: connectionResult.error
      };
    }

    // 2. 스키마 검증
    const schemaResult = await validateDatabaseSchema(prisma);
    
    return {
      initialized: true,
      connectionStatus: true,
      schemaValid: schemaResult.isValid,
      error: schemaResult.error
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('❌ 데이터베이스 초기화 실패:', errorMessage);
    
    return {
      initialized: false,
      connectionStatus: false,
      schemaValid: false,
      error: errorMessage
    };
  }
};

// Graceful shutdown (프로덕션 환경용)
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    console.log('🔄 Prisma 연결 정리 중...');
    await prisma.$disconnect();
    console.log('✅ Prisma 연결 정리 완료');
  });
}
