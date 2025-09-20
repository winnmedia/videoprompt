import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
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
        // PRISMA_DISABLED: const userCount = awaitprisma.user.count();
        // PRISMA_DISABLED: const projectCount = awaitprisma.project.count();
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

  // ORPHANED_CATCH: } catch (error) {
    // ORPHANED_CATCH: return NextResponse.json({
      // ORPHANED_CATCH: env: {
        // ORPHANED_CATCH: NODE_ENV: process.env.NODE_ENV,
        // ORPHANED_CATCH: hasJwtSecret: !!process.env.JWT_SECRET,
        // ORPHANED_CATCH: hasDatabaseUrl: !!process.env.DATABASE_URL,
        // ORPHANED_CATCH: timestamp: new Date().toISOString(),
      // ORPHANED_CATCH: },
      // ORPHANED_CATCH: error: error instanceof Error ? error.message : String(error),
      // ORPHANED_CATCH: message: 'Diagnostic failed'
    // ORPHANED_CATCH: }, { status: 500 });
  // ORPHANED_CATCH: }
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

    // PRISMA_DISABLED: const savedItem = awaitprisma.project.create({
      // PRISMA_CONTINUATION: data: testData,
    // PRISMA_CONTINUATION: });

    logger.info('✅ 테스트 데이터 생성 성공:', savedItem.id);

    // 생성된 데이터 즉시 삭제
    // PRISMA_DISABLED: awaitprisma.project.delete({
      // PRISMA_CONTINUATION: where: { id: savedItem.id }
    // PRISMA_CONTINUATION: });

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

  // ORPHANED_CATCH: } catch (error) {
    // ORPHANED_CATCH: const errorMessage = error instanceof Error ? error.message : String(error);
    // ORPHANED_CATCH: console.error('❌ 디버그 POST 오류:', errorMessage);
// ORPHANED_CATCH: 
    // ORPHANED_CATCH: return NextResponse.json({
      // ORPHANED_CATCH: success: false,
      // ORPHANED_CATCH: error: errorMessage,
      // ORPHANED_CATCH: timestamp: new Date().toISOString()
    // ORPHANED_CATCH: }, { status: 500 });
  // ORPHANED_CATCH: }
}