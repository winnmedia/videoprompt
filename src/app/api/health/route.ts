import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/shared/lib/supabase-client';
// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화
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

    // DB 연결 체크 (Supabase)
    let dbStatus = 'healthy';
    let dbError = null;

    try {
      const { client, error, canProceed } = await getSupabaseClient({
        throwOnError: false,
        serviceName: 'health-check'
      });

      if (!canProceed || error) {
        dbStatus = 'degraded';
        dbError = error || 'Supabase connection unavailable';
      }
    } catch (error) {
      dbStatus = 'unhealthy';
      dbError = error instanceof Error ? error.message : String(error);
      logger.error('Supabase health check failed', error instanceof Error ? error : new Error(String(error)));
    }

    const healthData = {
      ...appStatus,
      services: {
        database: {
          status: dbStatus,
          type: 'supabase',
          ...(dbError && { error: dbError })
        },
        app: 'healthy'
      }
    };

    // DB 문제나 환경변수 문제가 있으면 503, degraded면 207, 정상이면 200
    const hasIssues = dbStatus === 'unhealthy' || !envCheck.DATABASE_URL;
    const isDegraded = dbStatus === 'degraded';
    const statusCode = hasIssues ? 503 : isDegraded ? 207 : 200;

    return NextResponse.json(healthData, { status: statusCode });

  } catch (error) {
    logger.error('Health check error', error instanceof Error ? error : new Error(String(error)));
    
    return NextResponse.json({
      status: 'error',
      timestamp,
      error: 'Health check failed'
    }, { status: 500 });
  }
}
