import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe, ServiceConfigError } from '@/shared/lib/supabase-safe';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { logger } from '@/shared/lib/logger';


export const runtime = 'nodejs';

/**
 * Supabase 테이블 존재 여부 검증 API
 * GET /api/test/supabase-tables
 */
export async function GET(req: NextRequest) {
  const traceId = getTraceId(req);
  logger.info(`[Tables Test ${traceId}] 📋 Supabase 테이블 검증 시작`);

  try {
    // getSupabaseClientSafe를 사용한 안전한 클라이언트 초기화
    let supabase;
    try {
      supabase = await getSupabaseClientSafe('anon');
    } catch (error) {
      const errorMessage = error instanceof ServiceConfigError ? error.message : 'Supabase client initialization failed';
      console.error(`[Tables Test ${traceId}] ❌ Supabase client error:`, errorMessage);
      return NextResponse.json(
        failure(
          'SUPABASE_CONFIG_ERROR',
          errorMessage,
          503,
          undefined,
          traceId
        ),
        { status: 503 }
      );
    }

    const requiredTables = ['users', 'projects', 'stories', 'templates', 'video_assets'];
    const tableStatus: Record<string, { exists: boolean; count?: number; error?: string }> = {};

    for (const tableName of requiredTables) {
      try {
        logger.info(`[Tables Test ${traceId}] 🔍 테이블 ${tableName} 확인 중...`);

        // 테이블 존재 여부 및 레코드 수 확인
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (error) {
          tableStatus[tableName] = {
            exists: false,
            error: error.message
          };
          logger.info(`[Tables Test ${traceId}] ❌ 테이블 ${tableName}: ${error.message}`);
        } else {
          tableStatus[tableName] = {
            exists: true,
            count: count || 0
          };
          logger.info(`[Tables Test ${traceId}] ✅ 테이블 ${tableName}: ${count || 0}개 레코드`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        tableStatus[tableName] = {
          exists: false,
          error: errorMessage
        };
        logger.info(`[Tables Test ${traceId}] ❌ 테이블 ${tableName} 오류: ${errorMessage}`);
      }
    }

    // 통계 계산
    const existingTables = Object.values(tableStatus).filter(status => status.exists).length;
    const totalTables = requiredTables.length;
    const migrationComplete = existingTables === totalTables;

    const result = {
      migration: {
        complete: migrationComplete,
        progress: `${existingTables}/${totalTables}`,
        percentage: Math.round((existingTables / totalTables) * 100)
      },
      tables: tableStatus,
      summary: {
        existing: existingTables,
        missing: totalTables - existingTables,
        total: totalTables
      },
      nextSteps: migrationComplete
        ? ['모든 테이블이 생성됨', '시드 데이터 삽입 시작']
        : [`Supabase Dashboard에서 SQL 수동 실행`, `${totalTables - existingTables}개 테이블 생성 필요`]
    };

    logger.info(`[Tables Test ${traceId}] 📊 검증 완료: ${existingTables}/${totalTables} 테이블 존재`);

    return NextResponse.json(
      success(result, 200, traceId),
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Tables Test ${traceId}] ❌ 테이블 검증 실패:`, errorMessage);

    return NextResponse.json(
      failure(
        'TABLE_VALIDATION_FAILED',
        `테이블 검증 중 오류가 발생했습니다: ${errorMessage}`,
        500,
        undefined,
        traceId
      ),
      { status: 500 }
    );
  }
}

/**
 * OPTIONS 요청 처리 (CORS)
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}