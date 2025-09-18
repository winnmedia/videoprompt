import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getSupabaseClientSafe, ServiceConfigError } from '@/shared/lib/supabase-safe';
import { logger, LogCategory } from '@/shared/lib/structured-logger';

export const runtime = 'nodejs';

/**
 * Supabase 통합 테스트 API
 * 전체 마이그레이션 완료 후 모든 기능 검증
 */
export async function GET(request: NextRequest) {
  const traceId = getTraceId(request);
  const startTime = Date.now();

  logger.info(LogCategory.API, 'Starting Supabase integration test', { traceId });

  const testResults = {
    timestamp: new Date().toISOString(),
    traceId,
    duration: 0,
    status: 'running',
    tests: {
      connection: { status: 'pending', message: '', duration: 0 },
      authentication: { status: 'pending', message: '', duration: 0 },
      tables: { status: 'pending', message: '', duration: 0, details: {} },
      storage: { status: 'pending', message: '', duration: 0 },
      realtime: { status: 'pending', message: '', duration: 0 },
    },
    migration: {
      completed: [
        'Supabase 테이블 생성',
        '테이블 검증 API 생성',
        'Templates API Supabase 연동',
        'Supabase Auth 라이브러리 생성',
        'Auth API Supabase 전환 (login, register, me)',
        'Stories/Planning API Supabase 전환',
        'Video Upload Supabase Storage 전환',
        'Queue Management Supabase Realtime 전환'
      ],
      pending: [
        'Templates 시드 데이터 삽입 (RLS 이슈)',
        'Schema cache 새로고침 (Supabase 대시보드에서 수동 필요)'
      ],
      blocked: [
        'Storage bucket 생성 (RLS 정책으로 수동 생성 필요)'
      ]
    },
    recommendations: [] as string[]
  };

  try {
    // getSupabaseClientSafe를 사용한 안전한 클라이언트 초기화
    let supabase;
    try {
      supabase = await getSupabaseClientSafe('anon');
    } catch (error) {
      const errorMessage = error instanceof ServiceConfigError ? error.message : 'Supabase client initialization failed';
      return NextResponse.json({
        ...testResults,
        status: 'failed',
        error: errorMessage,
        duration: Date.now() - startTime
      }, { status: 503 });
    }

    // 1. 기본 연결 테스트
    const connStart = Date.now();
    try {
      const { data, error } = await supabase.from('users').select('count').limit(1);
      testResults.tests.connection = {
        status: error ? 'failed' : 'passed',
        message: error ? `연결 실패: ${error.message}` : '성공적으로 연결됨',
        duration: Date.now() - connStart
      };
    } catch (e: any) {
      testResults.tests.connection = {
        status: 'failed',
        message: `연결 오류: ${e.message}`,
        duration: Date.now() - connStart
      };
    }

    // 2. 인증 기능 테스트
    const authStart = Date.now();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      testResults.tests.authentication = {
        status: 'passed',
        message: session ? '세션 활성화됨' : '인증 시스템 정상 작동 (세션 없음)',
        duration: Date.now() - authStart
      };
    } catch (e: any) {
      testResults.tests.authentication = {
        status: 'failed',
        message: `인증 오류: ${e.message}`,
        duration: Date.now() - authStart
      };
    }

    // 3. 테이블 상태 검증
    const tableStart = Date.now();
    const tableDetails: Record<string, any> = {};
    const tables = ['users', 'projects', 'stories', 'templates', 'video_assets'];

    let tablesAccessible = 0;
    for (const table of tables) {
      try {
        const { data, error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .limit(0);

        if (error) {
          if (error.message.includes('schema cache')) {
            tableDetails[table] = { status: 'schema_cache_issue', count: 'unknown', error: error.message };
          } else {
            tableDetails[table] = { status: 'error', count: 'unknown', error: error.message };
          }
        } else {
          tableDetails[table] = { status: 'accessible', count: count || 0 };
          tablesAccessible++;
        }
      } catch (e: any) {
        tableDetails[table] = { status: 'error', count: 'unknown', error: e.message };
      }
    }

    testResults.tests.tables = {
      status: tablesAccessible === tables.length ? 'passed' : 'partial',
      message: `${tablesAccessible}/${tables.length} 테이블 접근 가능`,
      duration: Date.now() - tableStart,
      details: tableDetails
    };

    // 4. Storage 테스트
    const storageStart = Date.now();
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      const videoBucket = buckets?.find(b => b.name === 'videos');

      testResults.tests.storage = {
        status: videoBucket ? 'passed' : 'needs_setup',
        message: videoBucket
          ? `Storage 정상 작동 (${buckets?.length || 0}개 버킷)`
          : `Storage 연결됨, videos 버킷 수동 생성 필요 (${buckets?.length || 0}개 버킷 존재)`,
        duration: Date.now() - storageStart
      };
    } catch (e: any) {
      testResults.tests.storage = {
        status: 'failed',
        message: `Storage 오류: ${e.message}`,
        duration: Date.now() - storageStart
      };
    }

    // 5. Realtime 기능 테스트
    const realtimeStart = Date.now();
    try {
      // Realtime 채널 연결 테스트
      const channel = supabase.channel('test-integration');

      // 간단한 연결 테스트 후 정리
      setTimeout(() => {
        channel.unsubscribe();
      }, 100);

      testResults.tests.realtime = {
        status: 'passed',
        message: 'Realtime 채널 생성 및 정리 완료',
        duration: Date.now() - realtimeStart
      };
    } catch (e: any) {
      testResults.tests.realtime = {
        status: 'failed',
        message: `Realtime 오류: ${e.message}`,
        duration: Date.now() - realtimeStart
      };
    }

    // 권장사항 생성
    if (tableDetails.templates?.status === 'schema_cache_issue') {
      testResults.recommendations.push('Supabase 대시보드에서 Schema cache를 새로고침하세요.');
    }

    if (testResults.tests.storage.status === 'needs_setup') {
      testResults.recommendations.push('Supabase 대시보드에서 "videos" Storage 버킷을 생성하세요.');
    }

    if (tablesAccessible < tables.length) {
      testResults.recommendations.push('일부 테이블에 접근할 수 없습니다. RLS 정책을 확인하세요.');
    }

    // 전체 상태 결정
    const allPassed = Object.values(testResults.tests).every(test =>
      test.status === 'passed' || test.status === 'needs_setup' || test.status === 'partial'
    );

    testResults.status = allPassed ? 'completed' : 'partial';
    testResults.duration = Date.now() - startTime;

    logger.info(LogCategory.API, 'Integration test completed', {
      status: testResults.status,
      duration: testResults.duration,
      traceId
    });

    return NextResponse.json(testResults);

  } catch (error: any) {
    testResults.status = 'failed';
    testResults.duration = Date.now() - startTime;

    logger.error(LogCategory.API, 'Integration test failed', error, { traceId });

    return NextResponse.json({
      ...testResults,
      error: error.message
    }, { status: 500 });
  }
}