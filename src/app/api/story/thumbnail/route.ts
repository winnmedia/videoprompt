/**
 * Thumbnail Generation API Route
 * POST /api/story/thumbnail
 * 각 Act별 썸네일 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ThumbnailGenerator, THUMBNAIL_STYLES } from '@/shared/api/thumbnail-generator';

// 요청 스키마
const ThumbnailRequestSchema = z.object({
  storyId: z.string().min(1),
  actType: z.enum(['setup', 'development', 'climax', 'resolution']),
  actContent: z.string().min(1),
  storyGenre: z.enum(['drama', 'action', 'comedy', 'documentary', 'educational', 'thriller', 'romance']),
  storyTone: z.enum(['serious', 'light', 'dramatic', 'humorous', 'mysterious']),
  style: z.enum(Object.keys(THUMBNAIL_STYLES) as [keyof typeof THUMBNAIL_STYLES]),
  userId: z.string().min(1)
});

const BatchThumbnailRequestSchema = z.object({
  storyId: z.string().min(1),
  story: z.object({
    title: z.string(),
    genre: z.enum(['drama', 'action', 'comedy', 'documentary', 'educational', 'thriller', 'romance']),
    tone: z.enum(['serious', 'light', 'dramatic', 'humorous', 'mysterious']),
    acts: z.object({
      setup: z.object({ content: z.string(), emotions: z.string() }),
      development: z.object({ content: z.string(), emotions: z.string() }),
      climax: z.object({ content: z.string(), emotions: z.string() }),
      resolution: z.object({ content: z.string(), emotions: z.string() })
    })
  }),
  style: z.enum(Object.keys(THUMBNAIL_STYLES) as [keyof typeof THUMBNAIL_STYLES]),
  userId: z.string().min(1)
});

// Rate Limiting (썸네일은 더 엄격하게)
const thumbnailRateLimit = new Map<string, { count: number; resetTime: number }>();
const THUMBNAIL_RATE_LIMIT = {
  maxRequests: 10, // 시간당 최대 10회 (개별 썸네일)
  batchMaxRequests: 3, // 시간당 최대 3회 (일괄 생성)
  windowMs: 60 * 60 * 1000 // 1시간
};

function checkThumbnailRateLimit(userId: string, isBatch: boolean = false): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const userLimit = thumbnailRateLimit.get(userId);
  const maxRequests = isBatch ? THUMBNAIL_RATE_LIMIT.batchMaxRequests : THUMBNAIL_RATE_LIMIT.maxRequests;

  if (!userLimit || now > userLimit.resetTime) {
    thumbnailRateLimit.set(userId, {
      count: 1,
      resetTime: now + THUMBNAIL_RATE_LIMIT.windowMs
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: now + THUMBNAIL_RATE_LIMIT.windowMs
    };
  }

  if (userLimit.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: userLimit.resetTime
    };
  }

  userLimit.count++;
  return {
    allowed: true,
    remaining: maxRequests - userLimit.count,
    resetTime: userLimit.resetTime
  };
}

// 개별 썸네일 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 일괄 생성 vs 개별 생성 구분
    const isBatchRequest = 'story' in body;

    if (isBatchRequest) {
      return handleBatchThumbnailGeneration(body);
    } else {
      return handleSingleThumbnailGeneration(body);
    }

  } catch (error) {
    console.error('Thumbnail generation error:', error);

    return NextResponse.json(
      {
        success: false,
        error: '썸네일 생성 중 오류가 발생했습니다'
      },
      { status: 500 }
    );
  }
}

async function handleSingleThumbnailGeneration(body: any) {
  // 스키마 검증
  const validationResult = ThumbnailRequestSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: '요청 데이터가 올바르지 않습니다',
        details: validationResult.error.issues
      },
      { status: 400 }
    );
  }

  const { storyId, actType, actContent, storyGenre, storyTone, style, userId } = validationResult.data;

  // Rate Limiting 체크
  const rateLimitCheck = checkThumbnailRateLimit(userId, false);
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: '시간당 썸네일 생성 한도를 초과했습니다'
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': THUMBNAIL_RATE_LIMIT.maxRequests.toString(),
          'X-RateLimit-Remaining': rateLimitCheck.remaining.toString(),
          'X-RateLimit-Reset': rateLimitCheck.resetTime.toString()
        }
      }
    );
  }

  // 썸네일 생성
  const generator = new ThumbnailGenerator();

  // Mock Act 객체 생성
  const mockAct = {
    id: `${storyId}_${actType}`,
    actNumber: (actType === 'setup' ? 1 : actType === 'development' ? 2 : actType === 'climax' ? 3 : 4) as 1 | 2 | 3 | 4,
    title: actType,
    content: actContent,
    emotions: 'calm' as const,
    duration: 60,
    keyEvents: [],
    characterFocus: []
  };

  // Mock Story 객체 생성
  const mockStory = {
    id: storyId,
    title: '',
    synopsis: '',
    genre: storyGenre,
    tone: storyTone,
    targetAudience: 'general' as const,
    acts: {
      setup: mockAct,
      development: mockAct,
      climax: mockAct,
      resolution: mockAct
    },
    status: 'inProgress' as const,
    userId,
    totalDuration: 240,
    aiGenerated: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const result = await generator.generateActThumbnail(mockAct, mockStory, style);

  const responseHeaders = {
    'X-RateLimit-Limit': THUMBNAIL_RATE_LIMIT.maxRequests.toString(),
    'X-RateLimit-Remaining': rateLimitCheck.remaining.toString(),
    'X-RateLimit-Reset': rateLimitCheck.resetTime.toString()
  };

  if (result.success) {
    return NextResponse.json(
      {
        success: true,
        thumbnailUrl: result.thumbnailUrl,
        thumbnailId: result.thumbnailId,
        cost: result.cost,
        generationTime: result.generationTime
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
}

async function handleBatchThumbnailGeneration(body: any) {
  // 스키마 검증
  const validationResult = BatchThumbnailRequestSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: '요청 데이터가 올바르지 않습니다',
        details: validationResult.error.issues
      },
      { status: 400 }
    );
  }

  const { storyId, story, style, userId } = validationResult.data;

  // Rate Limiting 체크 (일괄 생성)
  const rateLimitCheck = checkThumbnailRateLimit(userId, true);
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: '시간당 일괄 썸네일 생성 한도를 초과했습니다'
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': THUMBNAIL_RATE_LIMIT.batchMaxRequests.toString(),
          'X-RateLimit-Remaining': rateLimitCheck.remaining.toString(),
          'X-RateLimit-Reset': rateLimitCheck.resetTime.toString()
        }
      }
    );
  }

  // 일괄 썸네일 생성
  const generator = new ThumbnailGenerator();

  // Story 객체 변환
  const fullStory = {
    ...story,
    id: storyId,
    synopsis: '', // Default value
    targetAudience: 'general' as const,
    status: 'inProgress' as const,
    userId,
    totalDuration: 240,
    aiGenerated: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    acts: {
      setup: {
        id: `${storyId}_setup`,
        actNumber: 1 as const,
        title: '도입',
        content: story.acts.setup.content,
        emotions: story.acts.setup.emotions as any,
        duration: 60,
        keyEvents: [],
        characterFocus: []
      },
      development: {
        id: `${storyId}_development`,
        actNumber: 2 as const,
        title: '전개',
        content: story.acts.development.content,
        emotions: story.acts.development.emotions as any,
        duration: 60,
        keyEvents: [],
        characterFocus: []
      },
      climax: {
        id: `${storyId}_climax`,
        actNumber: 3 as const,
        title: '절정',
        content: story.acts.climax.content,
        emotions: story.acts.climax.emotions as any,
        duration: 60,
        keyEvents: [],
        characterFocus: []
      },
      resolution: {
        id: `${storyId}_resolution`,
        actNumber: 4 as const,
        title: '결말',
        content: story.acts.resolution.content,
        emotions: story.acts.resolution.emotions as any,
        duration: 60,
        keyEvents: [],
        characterFocus: []
      }
    }
  };

  const result = await generator.generateStoryThumbnails(fullStory, style);

  const responseHeaders = {
    'X-RateLimit-Limit': THUMBNAIL_RATE_LIMIT.batchMaxRequests.toString(),
    'X-RateLimit-Remaining': rateLimitCheck.remaining.toString(),
    'X-RateLimit-Reset': rateLimitCheck.resetTime.toString()
  };

  if (result.success) {
    return NextResponse.json(
      {
        success: true,
        thumbnails: result.thumbnails,
        totalCost: result.totalCost
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
}

// OPTIONS 메서드 지원
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