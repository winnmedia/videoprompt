import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe, ServiceConfigError } from '@/shared/lib/supabase-safe';
import { failure, success, getTraceId, supabaseErrors } from '@/shared/lib/api-response';
import { logger } from '@/shared/lib/logger';


export const runtime = 'nodejs';

// Template response type definition
interface Template {
  id: string;
  title: string;
  description?: string;
  category: string;
  tags: string[];
  scenario?: {
    genre?: string;
    tone?: string;
    target?: string;
    structure?: string[];
    format?: string;
  };
  prompt?: {
    visualStyle?: string;
    mood?: string;
    quality?: string;
    keywords?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

// CORS headers for preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
}

// Get templates list
export async function GET(req: NextRequest) {
  const traceId = getTraceId(req);
  logger.info(`[Templates ${traceId}] 📋 템플릿 목록 조회`);

  try {
    // Get query parameters
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100); // Max 100 items per page

    logger.info(`[Templates ${traceId}] 📋 조회 조건: category=${category}, page=${page}, limit=${limit}`);

    // Supabase에서 템플릿 데이터 조회
    let templates: Template[] = [];
    let total = 0;

    try {
      logger.info(`[Templates ${traceId}] 🔍 Supabase에서 템플릿 조회 시작`);

      // getSupabaseClientSafe를 사용한 안전한 클라이언트 초기화
      let supabase;
      try {
        supabase = await getSupabaseClientSafe('anon');
      } catch (error) {
        if (error instanceof ServiceConfigError) {
          console.error(`[Templates ${traceId}] ❌ Supabase client initialization failed:`, error.message);
          return supabaseErrors.configError(traceId, error.message);
        }

        console.error(`[Templates ${traceId}] ❌ Unexpected Supabase client error:`, error);

        // 네트워크 관련 오류 감지
        const errorMessage = String(error);
        if (errorMessage.includes('fetch') ||
            errorMessage.includes('network') ||
            errorMessage.includes('ENOTFOUND')) {
          return supabaseErrors.unavailable(traceId, errorMessage);
        }

        return supabaseErrors.configError(traceId, errorMessage);
      }

      // 기본 쿼리 구성
      let query = supabase
        .from('templates')
        .select('*', { count: 'exact' });

      // 카테고리 필터 적용
      if (category) {
        query = query.eq('category', category);
      }

      // 공개 템플릿만 조회 (인증되지 않은 사용자)
      query = query.eq('is_public', true);

      // 페이지네이션 적용
      const offset = (page - 1) * limit;
      query = query
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        // Supabase 쿼리 실패 시 에러 반환
        console.error(`[Templates ${traceId}] ❌ Supabase 쿼리 실패:`, error.message);

        return NextResponse.json(
          failure(
            'DATABASE_QUERY_FAILED',
            `템플릿 조회 중 데이터베이스 오류가 발생했습니다: ${error.message}`,
            500,
            error.code,
            traceId
          ),
          { status: 500 }
        );
      }

      // Supabase 데이터 성공적으로 조회됨
      logger.info(`[Templates ${traceId}] ✅ Supabase에서 ${data?.length || 0}개 템플릿 조회`);

      templates = (data || []).map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        tags: Array.isArray(item.tags) ? item.tags : [],
        scenario: item.scenario || undefined,
        prompt: item.prompt || undefined,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));

      total = count || 0;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Templates ${traceId}] ❌ Supabase 연결 오류:`, errorMessage);

      return NextResponse.json(
        failure(
          'DATABASE_CONNECTION_FAILED',
          `템플릿 조회 중 연결 오류가 발생했습니다: ${errorMessage}`,
          500,
          undefined,
          traceId
        ),
        { status: 500 }
      );
    }

    const response = {
      templates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      filters: {
        category: category || null,
        availableCategories: [
          'business',
          'education',
          'entertainment',
          'marketing',
          'social',
          'creative',
        ],
      },
    };

    logger.info(`[Templates ${traceId}] ✅ 템플릿 ${templates.length}개 조회 완료`);

    // Set cache headers for performance
    const headers = new Headers();
    headers.set('Cache-Control', 'public, max-age=300, s-maxage=600'); // 5 min browser, 10 min CDN
    headers.set('Vary', 'Accept-Encoding');
    headers.set('Access-Control-Allow-Origin', '*');

    return new NextResponse(
      JSON.stringify({
        ok: true,
        data: response,
        timestamp: new Date().toISOString(),
        traceId,
      }),
      {
        status: 200,
        headers,
      }
    );

  } catch (error: unknown) {
    console.error(`[Templates ${traceId}] ❌ 템플릿 조회 실패:`, error);

    return failure(
      'INTERNAL_ERROR',
      '템플릿 조회 중 오류가 발생했습니다.',
      500,
      error instanceof Error ? error.message : '알 수 없는 오류',
      traceId
    );
  }
}

// Health check endpoint for monitoring
export async function HEAD(req: NextRequest) {
  const traceId = getTraceId(req);

  try {
    logger.info(`[Templates ${traceId}] 🏥 Health check`);

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error(`[Templates ${traceId}] ❌ Health check 실패:`, error);
    return new NextResponse(null, { status: 503 });
  }
}

