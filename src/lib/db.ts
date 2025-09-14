import { PrismaClient } from '@prisma/client';

// 빌드 환경 감지 - Next.js 빌드 중인지 확인
const isBuildTime = () => {
  // 명시적인 빌드 환경 변수들 체크
  if (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-development-build' ||
    process.env.__NEXT_PROCESSED_ENV === 'true'
  ) {
    return true;
  }

  // 빌드 명령어 감지 (pnpm build, next build, npm run build 등)
  const buildCommands = ['build', 'next'];
  if (process.argv.some(arg => buildCommands.includes(arg))) {
    return true;
  }

  // Vercel/Docker 빌드 환경에서 DATABASE_URL 없는 경우
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.DATABASE_URL &&
    (
      process.env.VERCEL === '1' ||  // Vercel 빌드
      process.env.CI === 'true' ||   // CI 환경
      process.env.DOCKER === 'true'  // Docker 빌드
    )
  ) {
    return true;
  }

  return false;
};

// 환경 변수 검증 (명확한 에러 발생)
const validateDatabaseUrl = (url?: string): string => {
  if (!url) {
    const errorMessage = 'DATABASE_URL 환경 변수가 설정되지 않았습니다. 데이터베이스 연결이 불가능합니다.';
    console.error('❌', errorMessage);
    throw new Error(errorMessage);
  }

  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    const errorMessage = `유효하지 않은 DATABASE_URL 형식입니다: ${url}. postgresql:// 또는 postgres:// 형식이어야 합니다.`;
    console.error('❌', errorMessage);
    throw new Error(errorMessage);
  }

  return url;
};

// Prisma 클라이언트 싱글톤 생성 함수
const prismaClientSingleton = (): PrismaClient => {
  // 빌드 시간에는 에러 발생 (이 함수는 런타임에만 호출됨)
  if (isBuildTime()) {
    console.log('🔄 Build time detected - Prisma initialization blocked');
    throw new Error('Prisma client should not be initialized during build time');
  }

  // 환경 변수 검증 및 URL 가져오기
  const databaseUrl = validateDatabaseUrl(process.env.DATABASE_URL);

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],

    // 에러 포맷팅
    errorFormat: 'pretty',
  });
};

declare global {

  var prisma: undefined | PrismaClient;
}

// Lazy loading을 위한 Prisma 클라이언트 getter
let _prismaClient: PrismaClient | null = null;

const getPrismaClient = (): PrismaClient => {
  // 빌드 시간에는 에러 발생
  if (isBuildTime()) {
    throw new Error('Prisma client cannot be used during build time');
  }

  // 이미 초기화된 클라이언트가 있으면 반환
  if (_prismaClient) {
    return _prismaClient;
  }

  // 글로벌 캐시 확인
  if (globalThis.prisma && globalThis.prisma !== null) {
    _prismaClient = globalThis.prisma;
    return _prismaClient;
  }

  // 새로운 클라이언트 생성
  try {
    _prismaClient = prismaClientSingleton();

    // 개발 환경에서만 글로벌 캐싱
    if (process.env.NODE_ENV !== 'production') {
      globalThis.prisma = _prismaClient;
    }

    return _prismaClient;
  } catch (error) {
    console.error('❌ Prisma 클라이언트 초기화 실패:', error);

    // DATABASE_URL 관련 오류는 즉시 재발생 (명확한 에러 메시지 제공)
    if (error instanceof Error && error.message.includes('DATABASE_URL')) {
      throw error;
    }

    // 기타 초기화 오류는 재발생하되 더 명확한 메시지로
    throw new Error(`데이터베이스 초기화 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Proxy를 사용하여 prisma 객체의 속성 접근을 lazy loading으로 처리
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    // 빌드 시간에는 모든 접근을 차단
    if (isBuildTime()) {
      console.warn(`⚠️ Prisma access attempted during build time: ${String(prop)}`);
      return undefined;
    }

    const client = getPrismaClient();
    const value = client[prop as keyof PrismaClient];

    // 함수인 경우 this 바인딩 유지
    if (typeof value === 'function') {
      return value.bind(client);
    }

    return value;
  },

  has(target, prop) {
    if (isBuildTime()) return false;
    const client = getPrismaClient();
    return prop in client;
  },

  ownKeys(target) {
    if (isBuildTime()) return [];
    const client = getPrismaClient();
    return Reflect.ownKeys(client);
  }
});

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
