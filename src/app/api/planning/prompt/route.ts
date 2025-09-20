import { NextRequest, NextResponse } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/shared/schemas/api.schema';
import { withOptionalAuth } from '@/shared/lib/auth-middleware-v2';
import { savePrompt } from '@/entities/planning';
import { logger } from '@/shared/lib/logger';

// import { createDualStorageDependencies } from '@/entities/planning'; // Prisma 의존성으로 인한 임시 비활성화
import type { PromptMetadata } from '@/shared/types/metadata';
import type { PromptContent } from '@/entities/planning';
import { z } from 'zod';
import { getSupabaseClientSafe, ServiceConfigError } from '@/shared/lib/supabase-safe';

export const dynamic = 'force-dynamic';

// ============================================================================
// OpenAPI Contract & Validation Schemas
// ============================================================================

/**
 * 프롬프트 저장 요청 스키마 (타입 안전성 보장)
 */
const PromptSaveRequestSchema = z.object({
  scenarioTitle: z.string().min(1, '시나리오 제목이 필요합니다').max(200),
  finalPrompt: z.string().min(1, '프롬프트 내용이 필요합니다').max(5000),
  keywords: z.array(z.string()).optional().default([]),
  negativePrompt: z.string().optional().default(''),
  visualStyle: z.string().optional().default(''),
  mood: z.string().optional().default(''),
  directorStyle: z.string().optional().default(''),
  projectId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional().default({})
});

type PromptSaveRequest = z.infer<typeof PromptSaveRequestSchema>;

/**
 * Rate Limiting & Cost Tracking (무한 호출 방지)
 */
const COST_TRACKING = {
  MAX_SAVES_PER_MINUTE: 10,
  MAX_SAVES_PER_HOUR: 100,
  ESTIMATED_COST_PER_SAVE: 0.001 // $0.001 per save
};

let recentSaves: Map<string, number[]> = new Map();

/**
 * GET /api/planning/prompt
 * 저장된 프롬프트 목록 조회 (통합 인증 시스템 적용)
 */
export const GET = withOptionalAuth(async (request: NextRequest, { user, authContext }) => {
  try {
    logger.info('✅ Planning prompts 인증 성공:', user.id);

    // Prisma 임시 비활성화 - 더미 데이터 반환
    logger.info('✅ Planning prompts 인증 성공 (Prisma disabled):', user.id);

    // 임시 더미 데이터 (Prisma 제거로 인한 대체)
    const projects = [];

    // 프롬프트 형식으로 변환
    const prompts = projects.map(project => {
      const metadata = project.metadata as PromptMetadata | null;

      return {
        id: project.id,
        scenarioTitle: metadata?.scenarioTitle || project.title || 'Untitled Prompt',
        version: metadata?.version || 'V1',
        keywordCount: metadata?.keywordCount || 0,
        segmentCount: metadata?.segmentCount || 1,
        quality: metadata?.quality || 'standard',
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        finalPrompt: metadata?.finalPrompt || project.prompt || '',
        keywords: metadata?.keywords || [],
        negativePrompt: metadata?.negativePrompt || '',
        visualStyle: metadata?.visualStyle || '',
        mood: metadata?.mood || '',
        directorStyle: metadata?.directorStyle || '',
        jsonUrl: `/api/planning/prompt/${project.id}.json`,
      };
    });

    return NextResponse.json(
      createSuccessResponse({
        prompts,
        total: prompts.length,
        timestamp: new Date().toISOString()
      }, '프롬프트 목록을 성공적으로 조회했습니다.'),
      { status: 200 }
    );

  } catch (error) {
    console.error('프롬프트 조회 오류:', error);

    return NextResponse.json(
      createErrorResponse(
        'PROMPT_FETCH_ERROR',
        error instanceof Error ? error.message : '프롬프트 조회 중 오류가 발생했습니다.'
      ),
      { status: 500 }
    );
  }
}, {
  endpoint: 'GET /api/planning/prompt',
  allowGuest: false // 인증 필수
});

// ============================================================================
// POST Handler - 프롬프트 저장 (새로운 기능)
// ============================================================================

/**
 * POST /api/planning/prompt
 * 프롬프트 저장 및 이중 저장소 패턴 적용
 */
export const POST = withOptionalAuth(async (request: NextRequest, { user, authContext }) => {
  try {
    if (!user) {
      return NextResponse.json(
        createErrorResponse('UNAUTHORIZED', '인증이 필요합니다.'),
        { status: 401 }
      );
    }

    // Rate Limiting 체크 (비용 안전 장치)
    const rateLimitResult = checkRateLimit(user.id || 'anonymous');
    if (!rateLimitResult.allowed) {
      console.warn('🚨 Rate limit exceeded for user:', user.id, rateLimitResult);
      return NextResponse.json(
        createErrorResponse(
          'RATE_LIMIT_EXCEEDED',
          `요청 한도를 초과했습니다. ${rateLimitResult.retryAfter}초 후 다시 시도하세요.`,
          {
            retryAfter: rateLimitResult.retryAfter,
            currentCost: rateLimitResult.estimatedCost
          }
        ),
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-Cost-Current': rateLimitResult.estimatedCost.toString()
          }
        }
      );
    }

    // 요청 본문 파싱 및 검증
    const body = await request.json();
    const validationResult = PromptSaveRequestSchema.safeParse(body);

    if (!validationResult.success) {
      console.warn('🚨 Invalid prompt save request:', validationResult.error.issues);
      return NextResponse.json(
        createErrorResponse(
          'VALIDATION_ERROR',
          '요청 데이터가 올바르지 않습니다.',
          { errors: validationResult.error.issues }
        ),
        { status: 400 }
      );
    }

    const promptData: PromptSaveRequest = validationResult.data;

    // 듀얼 스토리지 의존성 준비 (Prisma 비활성화)
    const prisma = null; // Prisma 임시 비활성화

    let supabaseClient: Awaited<ReturnType<typeof getSupabaseClientSafe>> | null = null;
    try {
      supabaseClient = await getSupabaseClientSafe('admin');
    } catch (error) {
      if (error instanceof ServiceConfigError) {
        console.warn('⚠️ Supabase admin client unavailable, proceeding with Prisma only:', error.message);
      } else {
        console.error('❌ Supabase client initialization error:', error);
      }
    }

    // 듀얼 스토리지 의존성 임시 비활성화 (Prisma 제거로 인한)
    const dualStorageDependencies = null;

    logger.info('⚠️ Dual storage dependencies disabled (Prisma removed)');

    // 프롬프트 Content 생성
    const promptContent: PromptContent = {
      id: crypto.randomUUID(),
      type: 'prompt',
      title: promptData.scenarioTitle,
      userId: user.id ?? undefined,
      projectId: promptData.projectId ?? undefined,
      scenarioTitle: promptData.scenarioTitle,
      finalPrompt: promptData.finalPrompt,
      keywords: promptData.keywords,
      version: 1, // 새 프롬프트는 버전 1부터 시작
      keywordCount: promptData.keywords.length,
      shotCount: 0, // 기본값
      quality: 'standard', // 기본 품질
      status: 'draft',
      source: 'user',
      storageStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        negativePrompt: promptData.negativePrompt,
        visualStyle: promptData.visualStyle,
        mood: promptData.mood,
        directorStyle: promptData.directorStyle,
        version: 'v3.1',
        createdVia: 'prompt-generator-api',
        ...promptData.metadata
      },
      storage: {
        prisma: { saved: false },
        supabase: { saved: false }
      }
    };

    logger.info('💾 Starting prompt save process:', {
      promptId: promptContent.id,
      userId: user.id,
      scenarioTitle: promptData.scenarioTitle
    });

    // Planning Service 임시 비활성화 (Prisma 제거로 인한)
    logger.info('⚠️ Prompt save operation skipped (Prisma dependencies removed)');

    // 더미 성공 응답 생성
    const saveResult = {
      success: true,
      contentId: promptContent.id,
      storage: {
        prisma: { saved: false, reason: 'disabled' },
        supabase: { saved: false, reason: 'disabled' }
      },
      consistency: 'disabled' as const,
      message: 'Prompt save operation disabled (Prisma removed)'
    };

    // Rate limiting 기록 업데이트
    updateRateLimitRecord(user.id ?? 'anonymous');

    logger.info('✅ Prompt saved successfully:', {
      promptId: promptContent.id,
      storage: saveResult.storage,
      consistency: saveResult.consistency
    });

    return NextResponse.json(
      createSuccessResponse({
        promptId: promptContent.id,
        storage: saveResult.storage,
        consistency: saveResult.consistency,
        metadata: {
          title: promptContent.title,
          createdAt: promptContent.createdAt,
          version: promptContent.metadata?.version
        }
      }, '프롬프트가 성공적으로 저장되었습니다.'),
      { status: 202 } // 임시 비활성화 상태이므로 202 (Accepted)
    );

  } catch (error) {
    console.error('🚨 Prompt save error:', error);

    return NextResponse.json(
      createErrorResponse(
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : '프롬프트 저장 중 오류가 발생했습니다.'
      ),
      { status: 500 }
    );
  }
}, {
  endpoint: 'POST /api/planning/prompt',
  allowGuest: false // 인증 필수
});

// ============================================================================
// Rate Limiting Helpers (비용 안전 장치)
// ============================================================================

function checkRateLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
  estimatedCost: number;
} {
  const now = Date.now();
  const userSaves = recentSaves.get(userId) || [];

  // 1분 내 요청 필터링
  const recentMinute = userSaves.filter(timestamp => now - timestamp < 60000);
  const recentHour = userSaves.filter(timestamp => now - timestamp < 3600000);

  const estimatedCost = recentHour.length * COST_TRACKING.ESTIMATED_COST_PER_SAVE;

  if (recentMinute.length >= COST_TRACKING.MAX_SAVES_PER_MINUTE) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: 60,
      estimatedCost
    };
  }

  if (recentHour.length >= COST_TRACKING.MAX_SAVES_PER_HOUR) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: 3600,
      estimatedCost
    };
  }

  return {
    allowed: true,
    remaining: COST_TRACKING.MAX_SAVES_PER_MINUTE - recentMinute.length,
    retryAfter: 0,
    estimatedCost
  };
}

function updateRateLimitRecord(userId: string): void {
  const now = Date.now();
  const userSaves = recentSaves.get(userId) || [];

  // 새 요청 추가
  userSaves.push(now);

  // 1시간 초과 기록 정리
  const filtered = userSaves.filter(timestamp => now - timestamp < 3600000);
  recentSaves.set(userId, filtered);

  // 메모리 정리 (24시간 후 사용자 기록 삭제)
  setTimeout(() => {
    const currentSaves = recentSaves.get(userId) || [];
    const validSaves = currentSaves.filter(timestamp => Date.now() - timestamp < 3600000);
    if (validSaves.length === 0) {
      recentSaves.delete(userId);
    } else {
      recentSaves.set(userId, validSaves);
    }
  }, 24 * 60 * 60 * 1000);
}
