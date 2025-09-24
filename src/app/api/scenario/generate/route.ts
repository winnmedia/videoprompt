/**
 * 시나리오 생성 API 라우트
 * UserJourneyMap 3-4단계 백엔드 구현
 * Zod 검증 + Cost Safety + MSW 지원
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ScenarioService } from '../../../../features/scenario.feature';
import type { ScenarioGenerationRequest } from '../../../../entities/scenario';

// Zod 검증 스키마
const ScenarioGenerationSchema = z.object({
  title: z
    .string()
    .min(1, '제목은 필수입니다')
    .max(100, '제목은 100자를 초과할 수 없습니다')
    .trim(),
  content: z
    .string()
    .min(50, '내용은 최소 50자 이상이어야 합니다')
    .max(5000, '내용은 5000자를 초과할 수 없습니다')
    .trim(),
  genre: z.enum([
    'drama',
    'comedy',
    'romance',
    'thriller',
    'horror',
    'fantasy',
    'sci-fi',
    'action',
    'mystery',
    'slice-of-life',
    'documentary',
    'animation',
  ]),
  style: z.enum([
    'realistic',
    'stylized',
    'minimalist',
    'dramatic',
    'comedic',
    'poetic',
    'raw',
    'polished',
    'experimental',
    'commercial',
    'artistic',
    'documentary',
  ]),
  target: z.enum([
    'children',
    'teens',
    'young-adults',
    'adults',
    'seniors',
    'family',
    'general',
    'niche',
    'professional',
    'international',
  ]),
  structure: z.enum([
    'traditional',
    'three-act',
    'free-form',
    'episodic',
    'circular',
    'non-linear',
    'montage',
    'vignette',
  ]),
  intensity: z.enum(['low', 'medium', 'high']),
});

// 사용자 인증 확인 (임시 - 게스트 지원)
function getUserId(request: NextRequest): string {
  // TODO: 실제 인증 시스템 연동
  const authorization = request.headers.get('Authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice(7); // JWT 토큰에서 userId 추출
  }

  // 게스트 모드: IP 기반 임시 ID
  const clientIp = request.headers.get('x-forwarded-for') ||
                  request.headers.get('x-real-ip') ||
                  'unknown';
  return `guest_${Buffer.from(clientIp).toString('base64').slice(0, 10)}`;
}

// Rate Limiting 체크
async function checkRateLimit(userId: string): Promise<boolean> {
  // TODO: Redis 또는 메모리 기반 Rate Limiting 구현
  // 현재는 간단한 메모리 캐시 사용
  const key = `scenario_generation_${userId}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1분
  const maxRequests = 5; // 분당 5회

  // 간단한 메모리 캐시 (프로덕션에서는 Redis 사용)
  if (!global.rateLimitCache) {
    global.rateLimitCache = new Map();
  }

  const userRequests = global.rateLimitCache.get(key) || [];
  const recentRequests = userRequests.filter((timestamp: number) => now - timestamp < windowMs);

  if (recentRequests.length >= maxRequests) {
    return false;
  }

  recentRequests.push(now);
  global.rateLimitCache.set(key, recentRequests);
  return true;
}

// 에러 응답 생성
function createErrorResponse(message: string, status: number = 400) {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

// 성공 응답 생성
function createSuccessResponse(data: any) {
  return NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/scenario/generate
 * 시나리오 생성 요청 처리
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 사용자 인증 확인
    const userId = getUserId(request);
    if (!userId) {
      return createErrorResponse('인증이 필요합니다', 401);
    }

    // 2. Rate Limiting 체크
    const isAllowed = await checkRateLimit(userId);
    if (!isAllowed) {
      return createErrorResponse('요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.', 429);
    }

    // 3. 요청 본문 파싱
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return createErrorResponse('잘못된 JSON 형식입니다');
    }

    // 4. Zod 검증
    let validatedData: ScenarioGenerationRequest;
    try {
      validatedData = ScenarioGenerationSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join(', ');
        return createErrorResponse(`입력 검증 실패: ${errorMessage}`);
      }
      return createErrorResponse('입력 데이터 검증 중 오류가 발생했습니다');
    }

    // 5. 비즈니스 로직 실행
    try {
      const result = await ScenarioService.generateScenario(validatedData, userId);

      // 6. 성공 응답
      return createSuccessResponse({
        scenario: result.scenario,
        feedback: result.feedback,
        suggestions: result.suggestions,
        alternatives: result.alternatives,
        meta: {
          generationTime: Date.now(),
          userId,
          requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        },
      });

    } catch (error) {
      console.error('[API] 시나리오 생성 실패:', error);

      // 비용 관련 오류는 별도 처리
      if (error instanceof Error && error.message.includes('비용')) {
        return createErrorResponse(error.message, 402); // Payment Required
      }

      return createErrorResponse(
        error instanceof Error ? error.message : '시나리오 생성 중 오류가 발생했습니다',
        500
      );
    }

  } catch (error) {
    console.error('[API] 예상치 못한 오류:', error);
    return createErrorResponse('서버 내부 오류가 발생했습니다', 500);
  }
}

/**
 * GET /api/scenario/generate
 * API 상태 확인
 */
export async function GET() {
  return NextResponse.json({
    service: 'scenario-generation',
    status: 'healthy',
    version: '1.0.0',
    features: {
      geminiIntegration: true,
      costSafety: true,
      rateLimiting: true,
      zodValidation: true,
    },
    limits: {
      requestsPerMinute: 5,
      maxTitleLength: 100,
      maxContentLength: 5000,
      minContentLength: 50,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * OPTIONS /api/scenario/generate
 * CORS 헤더 설정
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// TypeScript 글로벌 타입 확장 (Rate Limiting 캐시용)
declare global {
  var rateLimitCache: Map<string, number[]> | undefined;
}