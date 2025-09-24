/**
 * Story Generation API Route
 * POST /api/story/generate
 * CLAUDE.md 비용 안전 규칙 준수
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StoryGenerationEngine } from '@/features/story-generator/model/StoryGenerationEngine';
import type { StoryGenerationRequest } from '@/features/story-generator/types';

// 요청 스키마 검증
const GenerateStorySchema = z.object({
  params: z.object({
    title: z.string().min(1).max(100),
    synopsis: z.string().min(20).max(500),
    genre: z.enum(['drama', 'action', 'comedy', 'documentary', 'educational', 'thriller', 'romance']),
    targetAudience: z.enum(['general', 'kids', 'teen', 'adult', 'senior']),
    tone: z.enum(['serious', 'light', 'dramatic', 'humorous', 'mysterious']),
    creativity: z.number().min(0).max(100),
    intensity: z.number().min(0).max(100),
    pacing: z.enum(['slow', 'medium', 'fast']),
    keyCharacters: z.array(z.string()).optional(),
    keyThemes: z.array(z.string()).optional(),
    specialRequirements: z.string().optional()
  }),
  userId: z.string().min(1),
  scenarioId: z.string().optional(),
  regenerateAct: z.enum(['setup', 'development', 'climax', 'resolution']).optional()
});

// Rate Limiting 상태 (메모리 기반, 프로덕션에서는 Redis 사용)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = {
  maxRequests: 5, // 시간당 최대 5회
  windowMs: 60 * 60 * 1000 // 1시간
};

// Rate Limiting 체크
function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    // 새로운 윈도우 시작
    rateLimitMap.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT.maxRequests - 1,
      resetTime: now + RATE_LIMIT.windowMs
    };
  }

  if (userLimit.count >= RATE_LIMIT.maxRequests) {
    // Rate limit 초과
    return {
      allowed: false,
      remaining: 0,
      resetTime: userLimit.resetTime
    };
  }

  // 허용 범위 내
  userLimit.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT.maxRequests - userLimit.count,
    resetTime: userLimit.resetTime
  };
}

// 비용 추적 (기본 구현)
const costTracker = {
  daily: 0,
  monthly: 0,
  lastReset: new Date().toDateString()
};

const COST_LIMITS = {
  perGeneration: 0.02, // $0.02 per story generation
  dailyLimit: 2.00, // $2 per day
  monthlyLimit: 20.00 // $20 per month
};

function trackCost(cost: number): boolean {
  const today = new Date().toDateString();

  // 일일 리셋
  if (costTracker.lastReset !== today) {
    costTracker.daily = 0;
    costTracker.lastReset = today;
  }

  // 비용 제한 체크
  if (costTracker.daily + cost > COST_LIMITS.dailyLimit) {
    return false; // 일일 한도 초과
  }

  if (costTracker.monthly + cost > COST_LIMITS.monthlyLimit) {
    return false; // 월간 한도 초과
  }

  // 비용 추가
  costTracker.daily += cost;
  costTracker.monthly += cost;

  return true;
}

export async function POST(request: NextRequest) {
  try {
    // 요청 본문 파싱
    const body = await request.json();

    // 스키마 검증
    const validationResult = GenerateStorySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'validation_error',
            message: '요청 데이터가 올바르지 않습니다',
            details: validationResult.error.issues,
            retryable: false,
            timestamp: new Date().toISOString()
          }
        },
        { status: 400 }
      );
    }

    const { params, userId, scenarioId, regenerateAct } = validationResult.data;

    // Rate Limiting 체크 ($300 사건 방지)
    const rateLimitCheck = checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'rate_limit',
            message: '시간당 생성 한도를 초과했습니다. 나중에 다시 시도해주세요.',
            retryable: true,
            timestamp: new Date().toISOString()
          }
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT.maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimitCheck.remaining.toString(),
            'X-RateLimit-Reset': rateLimitCheck.resetTime.toString()
          }
        }
      );
    }

    // 비용 안전 체크
    if (!trackCost(COST_LIMITS.perGeneration)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'cost_limit',
            message: '일일 또는 월간 생성 한도를 초과했습니다.',
            retryable: false,
            timestamp: new Date().toISOString()
          }
        },
        { status: 402 } // Payment Required
      );
    }

    // 스토리 생성 요청 구성
    const generationRequest: StoryGenerationRequest = {
      params,
      userId,
      scenarioId,
      regenerateAct
    };

    // 스토리 생성 엔진 실행
    const engine = new StoryGenerationEngine();
    const result = await engine.generateStory(generationRequest);

    // 응답 헤더 설정
    const responseHeaders = {
      'X-RateLimit-Limit': RATE_LIMIT.maxRequests.toString(),
      'X-RateLimit-Remaining': rateLimitCheck.remaining.toString(),
      'X-RateLimit-Reset': rateLimitCheck.resetTime.toString(),
      'X-Cost-Daily': costTracker.daily.toFixed(4),
      'X-Cost-Monthly': costTracker.monthly.toFixed(4)
    };

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          story: result.story,
          tokensUsed: result.tokensUsed,
          generationTime: result.generationTime,
          cost: COST_LIMITS.perGeneration
        },
        { headers: responseHeaders }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        {
          status: 500,
          headers: responseHeaders
        }
      );
    }

  } catch (error) {
    console.error('Story generation error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'unknown_error',
          message: '스토리 생성 중 오류가 발생했습니다',
          retryable: true,
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
}

// OPTIONS 메서드 지원 (CORS)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}