import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/shared/lib/logger';

export async function GET() {
  const timestamp = new Date().toISOString();
  
  try {
    // 기본 앱 상태
    const appStatus = {
      status: 'healthy',
      timestamp,
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0'
    };

    // DB 연결 체크 (간단하게)
    let dbStatus = 'healthy';
    try {
      const prisma = new PrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
    } catch (error) {
      dbStatus = 'unhealthy';
      logger.error('DB health check failed', { error });
    }

    const healthData = {
      ...appStatus,
      services: {
        database: dbStatus,
        app: 'healthy'
      }
    };

    // DB 문제 있으면 503, 없으면 200
    const statusCode = dbStatus === 'unhealthy' ? 503 : 200;
    
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
