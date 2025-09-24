/**
 * Story CRUD API Routes
 * GET /api/story - 스토리 목록 조회
 * POST /api/story - 스토리 생성/저장
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// 임시 메모리 스토리지 (프로덕션에서는 실제 DB 사용)
const storyStorage = new Map<string, any>();

// 스토리 저장 스키마
const SaveStorySchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(100),
  synopsis: z.string().min(20).max(500),
  genre: z.enum(['drama', 'action', 'comedy', 'documentary', 'educational', 'thriller', 'romance']),
  targetAudience: z.enum(['general', 'kids', 'teen', 'adult', 'senior']),
  tone: z.enum(['serious', 'light', 'dramatic', 'humorous', 'mysterious']),
  acts: z.object({
    setup: z.object({
      id: z.string(),
      actNumber: z.literal(1),
      title: z.string(),
      content: z.string(),
      thumbnail: z.string().optional(),
      duration: z.number(),
      keyEvents: z.array(z.string()),
      emotions: z.string(),
      characterFocus: z.array(z.string())
    }),
    development: z.object({
      id: z.string(),
      actNumber: z.literal(2),
      title: z.string(),
      content: z.string(),
      thumbnail: z.string().optional(),
      duration: z.number(),
      keyEvents: z.array(z.string()),
      emotions: z.string(),
      characterFocus: z.array(z.string())
    }),
    climax: z.object({
      id: z.string(),
      actNumber: z.literal(3),
      title: z.string(),
      content: z.string(),
      thumbnail: z.string().optional(),
      duration: z.number(),
      keyEvents: z.array(z.string()),
      emotions: z.string(),
      characterFocus: z.array(z.string())
    }),
    resolution: z.object({
      id: z.string(),
      actNumber: z.literal(4),
      title: z.string(),
      content: z.string(),
      thumbnail: z.string().optional(),
      duration: z.number(),
      keyEvents: z.array(z.string()),
      emotions: z.string(),
      characterFocus: z.array(z.string())
    })
  }),
  status: z.enum(['draft', 'inProgress', 'completed', 'published']),
  userId: z.string().min(1),
  scenarioId: z.string().optional(),
  totalDuration: z.number(),
  aiGenerated: z.boolean().optional(),
  aiModel: z.string().optional(),
  aiPrompt: z.string().optional(),
  generationParams: z.object({
    creativity: z.number().min(0).max(100),
    intensity: z.number().min(0).max(100),
    pacing: z.enum(['slow', 'medium', 'fast'])
  }).optional()
});

// GET - 스토리 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const genre = searchParams.get('genre');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId는 필수입니다' },
        { status: 400 }
      );
    }

    // 메모리에서 스토리 조회 (실제로는 DB 쿼리)
    let stories = Array.from(storyStorage.values()).filter(
      (story: any) => story.userId === userId
    );

    // 필터링
    if (status) {
      stories = stories.filter((story: any) => story.status === status);
    }

    if (genre) {
      stories = stories.filter((story: any) => story.genre === genre);
    }

    // 정렬 (최신순)
    stories.sort((a: any, b: any) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    // 페이지네이션
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedStories = stories.slice(startIndex, endIndex);

    // 완성도 계산
    const storiesWithCompletion = paginatedStories.map((story: any) => {
      const completionFields = [
        story.title,
        story.synopsis,
        story.acts.setup.content,
        story.acts.development.content,
        story.acts.climax.content,
        story.acts.resolution.content,
        story.acts.setup.thumbnail,
        story.acts.development.thumbnail,
        story.acts.climax.thumbnail,
        story.acts.resolution.thumbnail
      ];

      const completedFields = completionFields.filter(field => field && field.trim() !== '').length;
      const completionPercentage = Math.round((completedFields / completionFields.length) * 100);

      return {
        ...story,
        completionPercentage
      };
    });

    return NextResponse.json({
      success: true,
      stories: storiesWithCompletion,
      pagination: {
        page,
        limit,
        total: stories.length,
        totalPages: Math.ceil(stories.length / limit),
        hasNext: endIndex < stories.length,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Story list fetch error:', error);

    return NextResponse.json(
      {
        success: false,
        error: '스토리 목록을 불러오는데 실패했습니다'
      },
      { status: 500 }
    );
  }
}

// POST - 스토리 저장
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 스키마 검증
    const validationResult = SaveStorySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '스토리 데이터가 올바르지 않습니다',
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const storyData = validationResult.data;

    // ID 생성 (새 스토리인 경우)
    if (!storyData.id) {
      storyData.id = `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 타임스탬프 설정
    const timestamp = new Date().toISOString();
    const existingStory = storyStorage.get(storyData.id);

    const finalStory = {
      ...storyData,
      id: storyData.id || `story-${Date.now()}`,
      createdAt: existingStory?.createdAt || timestamp,
      updatedAt: timestamp
    };

    // 스토리 저장 (메모리)
    storyStorage.set(finalStory.id, finalStory);

    // 완성도 계산
    const completionFields = [
      finalStory.title,
      finalStory.synopsis,
      finalStory.acts.setup.content,
      finalStory.acts.development.content,
      finalStory.acts.climax.content,
      finalStory.acts.resolution.content,
      finalStory.acts.setup.thumbnail,
      finalStory.acts.development.thumbnail,
      finalStory.acts.climax.thumbnail,
      finalStory.acts.resolution.thumbnail
    ];

    const completedFields = completionFields.filter(field => field && field.trim() !== '').length;
    const completionPercentage = Math.round((completedFields / completionFields.length) * 100);

    return NextResponse.json({
      success: true,
      story: {
        ...finalStory,
        completionPercentage
      },
      message: existingStory ? '스토리가 업데이트되었습니다' : '스토리가 저장되었습니다'
    });

  } catch (error) {
    console.error('Story save error:', error);

    return NextResponse.json(
      {
        success: false,
        error: '스토리 저장에 실패했습니다'
      },
      { status: 500 }
    );
  }
}

// OPTIONS 메서드 지원
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}