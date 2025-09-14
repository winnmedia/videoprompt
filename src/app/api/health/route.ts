import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/shared/lib/logger';

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    // 환경변수 체크
    const envCheck = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      NODE_ENV: process.env.NODE_ENV || 'unknown'
    };

    // 기본 앱 상태
    const appStatus = {
      status: 'healthy',
      timestamp,
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: envCheck
    };

    // DB 연결 체크 (싱글톤 prisma 사용)
    let dbStatus = 'healthy';
    let dbError = null;

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      dbStatus = 'unhealthy';
      dbError = error instanceof Error ? error.message : String(error);
      logger.error('DB health check failed', { error: dbError });
    }

    const healthData = {
      ...appStatus,
      services: {
        database: {
          status: dbStatus,
          ...(dbError && { error: dbError })
        },
        app: 'healthy'
      }
    };

    // DB 문제나 환경변수 문제가 있으면 503, 없으면 200
    const hasIssues = dbStatus === 'unhealthy' || !envCheck.DATABASE_URL;
    const statusCode = hasIssues ? 503 : 200;

    return NextResponse.json(healthData, { status: statusCode });

  } catch (error) {
    logger.error('Health check error', { error });
    
    return NextResponse.json({
      status: 'error',
      timestamp,
      error: 'Health check failed'
    }, { status: 500 });
  }
}
