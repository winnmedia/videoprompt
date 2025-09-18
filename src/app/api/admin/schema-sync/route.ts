import { NextRequest, NextResponse } from 'next/server';
import { createMissingTables, checkAllRequiredTables } from '@/shared/lib/supabase-schema-sync';
import { createSuccessResponse, createErrorResponse } from '@/shared/schemas/api.schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 스키마 동기화 API
 * Prisma 스키마와 Supabase 테이블을 동기화하는 관리자 전용 엔드포인트
 */
export async function POST(req: NextRequest) {
  try {
    console.log('🔧 스키마 동기화 시작...');

    // 1. 현재 테이블 상태 확인
    const tableStatus = await checkAllRequiredTables();
    console.log('📊 현재 테이블 상태:', tableStatus);

    // 2. 누락된 테이블 생성
    const syncResult = await createMissingTables();

    if (!syncResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'SCHEMA_SYNC_FAILED',
          '스키마 동기화에 실패했습니다.',
          {
            errors: syncResult.errors,
            tablesCreated: syncResult.tablesCreated
          }
        ),
        { status: 500 }
      );
    }

    // 3. 동기화 후 테이블 상태 재확인
    const finalTableStatus = await checkAllRequiredTables();

    console.log('✅ 스키마 동기화 완료:', {
      tablesCreated: syncResult.tablesCreated,
      beforeSync: tableStatus,
      afterSync: finalTableStatus
    });

    return NextResponse.json(
      createSuccessResponse({
        message: '스키마 동기화가 완료되었습니다.',
        tablesCreated: syncResult.tablesCreated,
        tableStatus: {
          before: tableStatus,
          after: finalTableStatus
        },
        summary: {
          totalTablesCreated: syncResult.tablesCreated.length,
          allTablesExist: Object.values(finalTableStatus).every(exists => exists)
        }
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ 스키마 동기화 API 오류:', error);

    return NextResponse.json(
      createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        '스키마 동기화 중 예상치 못한 오류가 발생했습니다.',
        {
          error: error instanceof Error ? error.message : String(error)
        }
      ),
      { status: 500 }
    );
  }
}

/**
 * 현재 테이블 상태 조회
 */
export async function GET(req: NextRequest) {
  try {
    const tableStatus = await checkAllRequiredTables();

    return NextResponse.json(
      createSuccessResponse({
        tableStatus,
        summary: {
          totalTables: Object.keys(tableStatus).length,
          existingTables: Object.values(tableStatus).filter(exists => exists).length,
          missingTables: Object.entries(tableStatus)
            .filter(([_, exists]) => !exists)
            .map(([table]) => table)
        }
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ 테이블 상태 조회 오류:', error);

    return NextResponse.json(
      createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        '테이블 상태 조회 중 오류가 발생했습니다.',
        {
          error: error instanceof Error ? error.message : String(error)
        }
      ),
      { status: 500 }
    );
  }
}