import { NextRequest, NextResponse } from 'next/server';
import { failure, success, getTraceId } from '@/shared/lib/api-response';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { logger } from '@/shared/lib/logger';


export const runtime = 'nodejs';


// CORS headers for preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
}

// Seed templates data
export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);
  logger.info(`[Seed Templates ${traceId}] 🌱 템플릿 시드 데이터 삽입 시작`);

  try {
    // Template seed data
    const seedTemplates = [
      {
        title: '기업 홍보 영상',
        description: '전문적인 기업 소개 영상 템플릿',
        category: 'business',
        tags: ['corporate', 'professional'],
        is_public: true,
        user_id: null,
        scenario: {
          genre: 'corporate',
          tone: 'professional',
          target: 'business',
          structure: ['opening', 'company_intro', 'services', 'achievements', 'closing'],
          format: 'presentation'
        },
        prompt: {
          visualStyle: 'corporate',
          mood: 'professional',
          quality: 'high',
          keywords: ['business', 'corporate', 'professional', 'trust']
        }
      },
      {
        title: '제품 리뷰',
        description: '제품 상세 리뷰 영상 템플릿',
        category: 'review',
        tags: ['product', 'review'],
        is_public: true,
        user_id: null,
        scenario: {
          genre: 'review',
          tone: 'informative',
          target: 'consumers',
          structure: ['intro', 'unboxing', 'features', 'testing', 'verdict'],
          format: 'review'
        },
        prompt: {
          visualStyle: 'clean',
          mood: 'informative',
          quality: 'high',
          keywords: ['product', 'review', 'comparison', 'demo']
        }
      },
      {
        title: '튜토리얼',
        description: '교육용 튜토리얼 영상 템플릿',
        category: 'education',
        tags: ['tutorial', 'howto'],
        is_public: true,
        user_id: null,
        scenario: {
          genre: 'educational',
          tone: 'friendly',
          target: 'learners',
          structure: ['intro', 'setup', 'step_by_step', 'tips', 'summary'],
          format: 'tutorial'
        },
        prompt: {
          visualStyle: 'clear',
          mood: 'educational',
          quality: 'high',
          keywords: ['tutorial', 'learn', 'step-by-step', 'guide']
        }
      },
      {
        title: '이벤트 홍보',
        description: '이벤트 및 행사 홍보 영상',
        category: 'marketing',
        tags: ['event', 'promotion'],
        is_public: true,
        user_id: null,
        scenario: {
          genre: 'promotional',
          tone: 'exciting',
          target: 'attendees',
          structure: ['teaser', 'event_info', 'highlights', 'call_to_action'],
          format: 'promotional'
        },
        prompt: {
          visualStyle: 'dynamic',
          mood: 'exciting',
          quality: 'high',
          keywords: ['event', 'exciting', 'join', 'experience']
        }
      },
      {
        title: '소셜 미디어 광고',
        description: 'SNS 광고용 짧은 영상',
        category: 'social',
        tags: ['sns', 'ads'],
        is_public: true,
        user_id: null,
        scenario: {
          genre: 'advertisement',
          tone: 'catchy',
          target: 'social_users',
          structure: ['hook', 'product_showcase', 'benefits', 'cta'],
          format: 'short_form'
        },
        prompt: {
          visualStyle: 'trendy',
          mood: 'catchy',
          quality: 'high',
          keywords: ['social', 'viral', 'trendy', 'engaging']
        }
      },
      {
        title: '브랜드 스토리',
        description: '브랜드 철학과 가치를 전달하는 영상',
        category: 'brand',
        tags: ['brand', 'story'],
        is_public: true,
        user_id: null,
        scenario: {
          genre: 'narrative',
          tone: 'emotional',
          target: 'customers',
          structure: ['origin', 'mission', 'values', 'vision', 'community'],
          format: 'storytelling'
        },
        prompt: {
          visualStyle: 'cinematic',
          mood: 'emotional',
          quality: 'high',
          keywords: ['brand', 'story', 'values', 'authentic']
        }
      },
      {
        title: '제품 런칭',
        description: '신제품 출시 홍보 영상',
        category: 'product',
        tags: ['launch', 'product'],
        is_public: true,
        user_id: null,
        scenario: {
          genre: 'launch',
          tone: 'exciting',
          target: 'customers',
          structure: ['buildup', 'reveal', 'features', 'availability', 'cta'],
          format: 'launch'
        },
        prompt: {
          visualStyle: 'modern',
          mood: 'exciting',
          quality: 'high',
          keywords: ['new', 'launch', 'innovative', 'revolutionary']
        }
      },
      {
        title: '고객 인터뷰',
        description: '고객 후기 및 인터뷰 영상',
        category: 'testimonial',
        tags: ['customer', 'interview'],
        is_public: true,
        user_id: null,
        scenario: {
          genre: 'testimonial',
          tone: 'authentic',
          target: 'prospects',
          structure: ['intro', 'problem', 'solution', 'results', 'recommendation'],
          format: 'interview'
        },
        prompt: {
          visualStyle: 'natural',
          mood: 'authentic',
          quality: 'high',
          keywords: ['testimonial', 'genuine', 'satisfied', 'recommend']
        }
      }
    ];

    logger.info(`[Seed Templates ${traceId}] 📝 ${seedTemplates.length}개 템플릿 삽입 시작`);

    // Insert seed data using Supabase Admin Client - one by one
    let supabaseAdmin;
    try {
      supabaseAdmin = await getSupabaseClientSafe('admin');
    } catch (envError) {
      logger.debug(`[Seed Templates ${traceId}] ❌ Supabase 클라이언트 초기화 실패:`, envError);
      return failure('SUPABASE_CONFIG_ERROR', 'Supabase 설정이 올바르지 않습니다.', 500, envError instanceof Error ? envError.message : 'Supabase configuration error', traceId);
    }

    logger.info(`[Seed Templates ${traceId}] 🔑 Service Role로 개별 삽입 시작`);

    const insertedTemplates = [];
    let successCount = 0;

    for (const template of seedTemplates) {
      try {
        logger.info(`[Seed Templates ${traceId}] 📝 템플릿 "${template.title}" 삽입 중...`);

        const { data, error } = await supabaseAdmin
          .from('templates')
          .insert([template])
          .select('id, title, category');

        if (error) {
          logger.debug(`[Seed Templates ${traceId}] ❌ "${template.title}" 삽입 실패:`, error.message);
          // Continue with next template instead of failing completely
          continue;
        }

        if (data && data.length > 0) {
          insertedTemplates.push(data[0]);
          successCount++;
          logger.info(`[Seed Templates ${traceId}] ✅ 템플릿 "${template.title}" 삽입 완료`);
        }

      } catch (templateError) {
        logger.debug(`[Seed Templates ${traceId}] ❌ 템플릿 "${template.title}" 삽입 중 오류:`, templateError);
        continue;
      }
    }

    logger.info(`[Seed Templates ${traceId}] ✅ ${successCount}개 템플릿 삽입 완료`);

    // Count total templates
    let totalCount = 0;
    try {
      const { count } = await supabaseAdmin
        .from('templates')
        .select('*', { count: 'exact', head: true });
      totalCount = count || 0;
    } catch (countError) {
      logger.debug(`[Seed Templates ${traceId}] ⚠️ 카운트 조회 실패:`, countError);
      totalCount = successCount; // fallback to inserted count
    }

    return success({
      message: `템플릿 시드 데이터 ${successCount}개가 성공적으로 삽입되었습니다.`,
      inserted: successCount,
      totalTemplates: totalCount,
      templates: insertedTemplates
    }, 200, traceId);

  } catch (error) {
    logger.error(`[Seed Templates ${traceId}] 💥 시드 데이터 삽입 중 오류:`, error instanceof Error ? error : new Error(String(error)));
    return failure('INTERNAL_ERROR', '시드 데이터 삽입 중 오류가 발생했습니다.', 500, error instanceof Error ? error.message : 'Unknown error', traceId);
  }
}

// Get current template count (for verification)
export async function GET(req: NextRequest) {
  const traceId = getTraceId(req);
  logger.info(`[Seed Templates ${traceId}] 🔍 템플릿 현황 확인`);

  try {
    let supabaseAdmin;
    try {
      supabaseAdmin = await getSupabaseClientSafe('admin');
    } catch (envError) {
      logger.debug(`[Seed Templates ${traceId}] ❌ Supabase 클라이언트 초기화 실패:`, envError);
      return failure('SUPABASE_CONFIG_ERROR', 'Supabase 설정이 올바르지 않습니다.', 500, envError instanceof Error ? envError.message : 'Supabase configuration error', traceId);
    }

    const { count, error } = await supabaseAdmin
      .from('templates')
      .select('*', { count: 'exact', head: true });

    if (error) {
      logger.error(`[Seed Templates ${traceId}] ❌ 템플릿 수 조회 실패:`, error instanceof Error ? error : new Error(String(error)));
      return failure('DATABASE_QUERY_FAILED', '템플릿 현황 조회에 실패했습니다.', 500, error.message, traceId);
    }

    return success({
      totalTemplates: count || 0,
      message: (count || 0) === 0 ? '시드 데이터가 필요합니다.' : '시드 데이터가 존재합니다.'
    }, 200, traceId);

  } catch (error) {
    logger.error(`[Seed Templates ${traceId}] 💥 템플릿 현황 확인 중 오류:`, error instanceof Error ? error : new Error(String(error)));
    return failure('INTERNAL_ERROR', '현황 확인 중 오류가 발생했습니다.', 500, error instanceof Error ? error.message : 'Unknown error', traceId);
  }
}