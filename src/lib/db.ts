import { PrismaClient } from '@prisma/client';

// 빌드 환경 감지 - Next.js 빌드 중인지 확인 (수정된 버전)
const isBuildTime = () => {
  // 명시적인 빌드 환경 변수들만 체크 (엄격한 조건)
  if (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-development-build'
  ) {
    return true;
  }

  // 빌드 명령어 감지 (더 엄격한 조건)
  const argv = process.argv.join(' ');
  if (
    argv.includes('next build') ||
    argv.includes('pnpm build') ||
    argv.includes('npm run build') ||
    (argv.includes('build') && !argv.includes('runtime'))
  ) {
    return true;
  }

  // 런타임 환경에서는 절대 true 반환하지 않음
  // (DATABASE_URL이 있고 Vercel 런타임인 경우는 빌드 시간이 아님)
  if (
    process.env.VERCEL === '1' &&
    process.env.DATABASE_URL &&
    process.env.VERCEL_ENV === 'production'
  ) {
    return false; // 명시적으로 런타임임을 표시
  }

  return false; // 기본값은 런타임으로 간주
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

  // 이미 초기화된 클라이언트가 있으면 연결 상태 검증 후 반환
  if (_prismaClient) {
    // 연결이 끊어졌을 수 있으므로 간단한 검증
    try {
      // 클라이언트가 여전히 유효한지 확인 (메서드 존재 여부만 확인)
      if (typeof _prismaClient.$connect === 'function') {
        return _prismaClient;
      }
    } catch (error) {
      console.warn('⚠️ 기존 Prisma 클라이언트 연결 상태 확인 실패, 재초기화:', error);
      _prismaClient = null;
    }
  }

  // 글로벌 캐시 확인
  if (globalThis.prisma && globalThis.prisma !== null) {
    _prismaClient = globalThis.prisma;
    return _prismaClient;
  }

  // 새로운 클라이언트 생성
  try {
    console.log('🔄 새로운 Prisma 클라이언트 초기화 중...');
    _prismaClient = prismaClientSingleton();

    // 개발 환경에서만 글로벌 캐싱
    if (process.env.NODE_ENV !== 'production') {
      globalThis.prisma = _prismaClient;
    }

    console.log('✅ Prisma 클라이언트 초기화 완료');
    return _prismaClient;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Prisma 클라이언트 초기화 실패:', errorMessage);

    // 환경 변수 관련 오류는 즉시 재발생 (명확한 에러 메시지 제공)
    if (errorMessage.includes('DATABASE_URL') || errorMessage.includes('환경 변수')) {
      throw new Error(`데이터베이스 연결 설정 오류: ${errorMessage}`);
    }

    // 연결 관련 오류
    if (errorMessage.includes('connect') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('timeout')) {
      throw new Error(`데이터베이스 연결 실패: ${errorMessage}. 네트워크 연결과 데이터베이스 서버 상태를 확인해주세요.`);
    }

    // 인증 관련 오류
    if (errorMessage.includes('authentication') || errorMessage.includes('password') || errorMessage.includes('SASL')) {
      throw new Error(`데이터베이스 인증 실패: ${errorMessage}. 데이터베이스 자격 증명을 확인해주세요.`);
    }

    // 기타 초기화 오류는 재발생하되 더 명확한 메시지로
    throw new Error(`데이터베이스 초기화 실패: ${errorMessage}`);
  }
};

// Proxy를 사용하여 prisma 객체의 속성 접근을 lazy loading으로 처리
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    // 빌드 시간에는 명확한 에러 발생 (undefined 반환 금지)
    if (isBuildTime()) {
      const errorMessage = `빌드 시간에는 Prisma 데이터베이스 접근이 불가능합니다. 접근 시도된 속성: ${String(prop)}`;
      console.error('❌', errorMessage);
      throw new Error(errorMessage);
    }

    try {
      const client = getPrismaClient();

      // 클라이언트가 정상적으로 초기화되었는지 검증
      if (!client) {
        throw new Error('Prisma 클라이언트가 초기화되지 않았습니다.');
      }

      const value = client[prop as keyof PrismaClient];

      // 존재하지 않는 속성에 대한 명확한 에러
      if (value === undefined && prop !== 'then' && prop !== 'catch' && prop !== Symbol.toStringTag) {
        throw new Error(`Prisma 클라이언트에서 '${String(prop)}' 속성을 찾을 수 없습니다.`);
      }

      // 함수인 경우: 반환 전에 미리 바인딩하여 안정성 확보
      if (typeof value === 'function') {
        const boundMethod = value.bind(client);
        return boundMethod;
      }

      return value;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Prisma Proxy 접근 실패 (${String(prop)}):`, errorMessage);

      // 사용자에게 더 명확한 컨텍스트 제공
      if (errorMessage.includes('DATABASE_URL')) {
        throw new Error(`데이터베이스 설정 오류: ${errorMessage}`);
      }

      throw new Error(`데이터베이스 접근 실패: ${errorMessage}`);
    }
  },

  has(target, prop) {
    if (isBuildTime()) {
      throw new Error(`빌드 시간에는 Prisma 속성 확인이 불가능합니다. 확인 시도된 속성: ${String(prop)}`);
    }

    try {
      const client = getPrismaClient();
      return prop in client;
    } catch (error) {
      console.error(`❌ Prisma 속성 확인 실패 (${String(prop)}):`, error);
      return false;
    }
  },

  ownKeys(target) {
    if (isBuildTime()) {
      throw new Error('빌드 시간에는 Prisma 키 목록 조회가 불가능합니다.');
    }

    try {
      const client = getPrismaClient();
      return Reflect.ownKeys(client);
    } catch (error) {
      console.error('❌ Prisma 키 목록 조회 실패:', error);
      return [];
    }
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

// 프로덕션 안전 데이터베이스 연결 검증
export const validatePrismaConnection = async (client: PrismaClient): Promise<boolean> => {
  try {
    // 간단한 연결 테스트 쿼리
    await client.$queryRaw`SELECT 1 as test`;
    return true;
  } catch (error) {
    console.error('❌ Prisma 연결 검증 실패:', error);
    return false;
  }
};

// 프로덕션용 안전한 데이터베이스 접근 래퍼
export const withDatabaseConnection = async <T>(
  operation: (client: PrismaClient) => Promise<T>
): Promise<T> => {
  try {
    // 클라이언트 확보
    const client = getPrismaClient();

    // 연결 상태 검증
    const isConnected = await validatePrismaConnection(client);
    if (!isConnected) {
      throw new Error('데이터베이스 연결이 불가능합니다.');
    }

    // 작업 실행
    return await operation(client);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ 데이터베이스 작업 실패:', errorMessage);

    // 에러 타입별 구체적인 메시지 제공
    if (errorMessage.includes('DATABASE_URL')) {
      throw new Error(`데이터베이스 설정 오류: ${errorMessage}`);
    }

    if (errorMessage.includes('connect') || errorMessage.includes('ENOTFOUND')) {
      throw new Error(`데이터베이스 연결 실패: ${errorMessage}. 네트워크 연결과 데이터베이스 서버 상태를 확인해주세요.`);
    }

    if (errorMessage.includes('authentication') || errorMessage.includes('password')) {
      throw new Error(`데이터베이스 인증 실패: ${errorMessage}. 데이터베이스 자격 증명을 확인해주세요.`);
    }

    // 원본 에러 재발생
    throw error;
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
    // 1. 안전한 연결 테스트
    const connectionResult = await withDatabaseConnection(async () => {
      return await checkDatabaseConnection(prisma, 2);
    });

    if (!connectionResult.success) {
      return {
        initialized: false,
        connectionStatus: false,
        schemaValid: false,
        error: connectionResult.error
      };
    }

    // 2. 스키마 검증
    const schemaResult = await withDatabaseConnection(async () => {
      return await validateDatabaseSchema(prisma);
    });

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
if (typeof process !== 'undefined' && !isBuildTime()) {
  process.on('beforeExit', async () => {
    console.log('🔄 Prisma 연결 정리 중...');
    try {
      if (_prismaClient) {
        await _prismaClient.$disconnect();
        console.log('✅ Prisma 연결 정리 완료');
      }
    } catch (error) {
      console.warn('⚠️ Prisma 연결 정리 중 오류 (무시됨):', error);
    }
  });
}
