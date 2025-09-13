import { PrismaClient } from '@prisma/client';

// Next.js + Prisma 공식 베스트 프랙티스 적용
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
};

// Prisma 클라이언트 싱글톤 생성
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
  errorFormat: 'pretty',
});

// 개발 환경에서만 글로벌 캐싱 (핫 리로딩 시 다중 인스턴스 방지)
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// 데이터베이스 연결 헬스 체크 함수
export const checkDatabaseConnection = async (
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
      await prisma.$queryRaw`SELECT 1`;

      const latency = Date.now() - startTime;

      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Database connection successful (${latency}ms)`);
      }

      return {
        success: true,
        latency
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';

      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️  Database connection attempt ${i + 1}/${retries} failed:`, errorMessage);
      }

      if (i === retries - 1) {
        console.error('❌ Database connection failed after all retries');
        return {
          success: false,
          error: errorMessage
        };
      }

      // 재시도 전 지수 백오프 대기
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }

  return {
    success: false,
    error: '모든 재시도 실패'
  };
};

// Graceful shutdown (프로덕션 환경용)
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}