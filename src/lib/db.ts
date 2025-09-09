import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// 연결 재시도 설정
const createPrismaClient = () => {
  // 빌드 시에는 DATABASE_URL이 없을 수 있으므로 체크를 런타임으로 미룸
  const databaseUrl = process.env.DATABASE_URL;
  
  // 런타임에만 에러를 발생시킴 (빌드 타임에는 체크하지 않음)
  if (typeof window === 'undefined' && !databaseUrl && process.env.NODE_ENV === 'production') {
    console.error('DATABASE_URL environment variable is not set in production');
    // Graceful degradation - 빌드는 계속 진행
  }
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl || 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
      },
    },
  });
};

// 데이터베이스 연결 헬스 체크
export const checkDatabaseConnection = async (client: PrismaClient, retries = 3): Promise<boolean> => {
  for (let i = 0; i < retries; i++) {
    try {
      await client.$queryRaw`SELECT 1`;
      console.log('✅ Database connection successful');
      return true;
    } catch (error) {
      console.warn(`⚠️  Database connection attempt ${i + 1}/${retries} failed:`, error);
      if (i === retries - 1) {
        console.error('❌ Database connection failed after all retries');
        return false;
      }
      // 재시도 전 대기 (지수 백오프)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  return false;
};

// Lazy initialization으로 런타임에만 Prisma 클라이언트 생성
export const getPrismaClient = (): PrismaClient => {
  if (global.__prisma) {
    return global.__prisma;
  }
  
  const client = createPrismaClient();
  
  if (process.env.NODE_ENV !== 'production') {
    global.__prisma = client;
  }
  
  return client;
};

// 편의성을 위한 prisma 인스턴스 (lazy evaluation)
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    const client = getPrismaClient();
    return client[prop as keyof PrismaClient];
  }
});

// 프로세스 종료 시 연결 정리
process.on('beforeExit', async () => {
  if (global.__prisma) {
    await global.__prisma.$disconnect();
  }
});
