import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';


export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
//     const { prisma, checkDatabaseConnection } = await import('@/lib/prisma');

    // 1. 환경 변수 확인
    const env = {
      NODE_ENV: process.env.NODE_ENV,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasSendgridKey: !!process.env.SENDGRID_API_KEY,
      hasDefaultEmail: !!process.env.DEFAULT_FROM_EMAIL,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 20) + '...',
      timestamp: new Date().toISOString(),
    };

    // 2. 데이터베이스 연결 테스트
    const connectionStatus = await checkDatabaseConnection(2);

    // 3. 간단한 쿼리 테스트 (연결 성공 시에만)
    let queryResults = null;
    if (connectionStatus.success) {
      try {
        const userCount = await prisma.user.count();
        const projectCount = await prisma.project.count();
        queryResults = { users: userCount, projects: projectCount };
      } catch (queryError) {
        queryResults = {
          error: queryError instanceof Error ? queryError.message : String(queryError)
        };
      }
    }

    return NextResponse.json({
      env,
      database: {
        connection: connectionStatus,
        queries: queryResults
      },
      message: 'Full diagnostic complete'
    });

  } catch (error) {
    return NextResponse.json({
      env: {
        NODE_ENV: process.env.NODE_ENV,
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        timestamp: new Date().toISOString(),
      },
      error: error instanceof Error ? error.message : String(error),
      message: 'Diagnostic failed'
    }, { status: 500 });
  }
}

export async function POST() {
  try {
//     const { prisma, checkDatabaseConnection } = await import('@/lib/prisma');

    // 연결 검증
    const connectionStatus = await checkDatabaseConnection(2);
    if (!connectionStatus.success) {
      return NextResponse.json({
        success: false,
        step: 'connection',
        error: connectionStatus.error
      }, { status: 503 });
    }

    // 테스트 프로젝트 생성 시도
    const testId = `debug-test-${Date.now()}`;
    const testData = {
      id: testId,
      title: '디버그 테스트',
      description: 'API 디버깅용 테스트 데이터',
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      },
      status: 'active',
      userId: 'system-debug',
      tags: ['debug', 'test']
    };

    logger.info('🔍 테스트 데이터 생성 시도:', testId);

    const savedItem = await prisma.project.create({
      data: testData,
    });

    logger.info('✅ 테스트 데이터 생성 성공:', savedItem.id);

    // 생성된 데이터 즉시 삭제
    await prisma.project.delete({
      where: { id: savedItem.id }
    });

    logger.info('🗑️ 테스트 데이터 삭제 완료');

    return NextResponse.json({
      success: true,
      message: 'Project creation/deletion test successful',
      data: {
        id: savedItem.id,
        title: savedItem.title,
        createdAt: savedItem.createdAt
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ 디버그 POST 오류:', errorMessage);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}