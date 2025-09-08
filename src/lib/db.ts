import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// 연결 재시도 설정
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
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

export const prisma: PrismaClient = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

// 프로세스 종료 시 연결 정리
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
