import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

declare global {
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

// 데이터베이스 연결 헬스 체크 (기존 기능 유지)
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
