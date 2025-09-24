/**
 * Individual Story API Routes
 * GET /api/story/[id] - 개별 스토리 조회
 * PUT /api/story/[id] - 스토리 업데이트
 * DELETE /api/story/[id] - 스토리 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// 임시 메모리 스토리지 (프로덕션에서는 실제 DB 사용)
// 실제로는 다른 파일에서 import하거나 DB 연결을 사용
const storyStorage = new Map<string, any>();

// 스토리 업데이트 스키마 (부분 업데이트 지원)
const UpdateStorySchema = z.object({
  title: z.string().min(1).max(100).optional(),
  synopsis: z.string().min(20).max(500).optional(),
  genre: z.enum(['drama', 'action', 'comedy', 'documentary', 'educational', 'thriller', 'romance']).optional(),
  targetAudience: z.enum(['general', 'kids', 'teen', 'adult', 'senior']).optional(),
  tone: z.enum(['serious', 'light', 'dramatic', 'humorous', 'mysterious']).optional(),
  acts: z.object({
    setup: z.object({
      title: z.string().optional(),
      content: z.string().optional(),
      thumbnail: z.string().optional(),
      duration: z.number().optional(),
      keyEvents: z.array(z.string()).optional(),
      emotions: z.string().optional(),
      characterFocus: z.array(z.string()).optional()
    }).optional(),
    development: z.object({
      title: z.string().optional(),
      content: z.string().optional(),
      thumbnail: z.string().optional(),
      duration: z.number().optional(),
      keyEvents: z.array(z.string()).optional(),
      emotions: z.string().optional(),
      characterFocus: z.array(z.string()).optional()
    }).optional(),
    climax: z.object({
      title: z.string().optional(),
      content: z.string().optional(),
      thumbnail: z.string().optional(),
      duration: z.number().optional(),
      keyEvents: z.array(z.string()).optional(),
      emotions: z.string().optional(),
      characterFocus: z.array(z.string()).optional()
    }).optional(),
    resolution: z.object({
      title: z.string().optional(),
      content: z.string().optional(),
      thumbnail: z.string().optional(),
      duration: z.number().optional(),
      keyEvents: z.array(z.string()).optional(),
      emotions: z.string().optional(),
      characterFocus: z.array(z.string()).optional()
    }).optional()
  }).optional(),
  status: z.enum(['draft', 'inProgress', 'completed', 'published']).optional(),
  totalDuration: z.number().optional()
});

// GET - 개별 스토리 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId는 필수입니다' },
        { status: 400 }
      );
    }

    // 스토리 조회
    const story = storyStorage.get(id);

    if (!story) {
      return NextResponse.json(
        { success: false, error: '스토리를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 권한 확인 (본인의 스토리만 조회 가능)
    if (story.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 완성도 계산
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

    return NextResponse.json({
      success: true,
      story: {
        ...story,
        completionPercentage
      }
    });

  } catch (error) {
    console.error('Story fetch error:', error);

    return NextResponse.json(
      {
        success: false,
        error: '스토리를 불러오는데 실패했습니다'
      },
      { status: 500 }
    );
  }
}

// PUT - 스토리 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // 스키마 검증
    const validationResult = UpdateStorySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '업데이트 데이터가 올바르지 않습니다',
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    // 기존 스토리 조회
    const existingStory = storyStorage.get(id);

    if (!existingStory) {
      return NextResponse.json(
        { success: false, error: '스토리를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 권한 확인
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId || existingStory.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '수정 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 딥 머지 수행 (특히 acts 객체의 부분 업데이트)
    const updatedStory = {
      ...existingStory,
      ...updateData,
      acts: {
        ...existingStory.acts,
        ...(updateData.acts && {
          setup: { ...existingStory.acts.setup, ...updateData.acts.setup },
          development: { ...existingStory.acts.development, ...updateData.acts.development },
          climax: { ...existingStory.acts.climax, ...updateData.acts.climax },
          resolution: { ...existingStory.acts.resolution, ...updateData.acts.resolution }
        })
      },
      updatedAt: new Date().toISOString()
    };

    // 스토리 저장
    storyStorage.set(id, updatedStory);

    // 완성도 재계산
    const completionFields = [
      updatedStory.title,
      updatedStory.synopsis,
      updatedStory.acts.setup.content,
      updatedStory.acts.development.content,
      updatedStory.acts.climax.content,
      updatedStory.acts.resolution.content,
      updatedStory.acts.setup.thumbnail,
      updatedStory.acts.development.thumbnail,
      updatedStory.acts.climax.thumbnail,
      updatedStory.acts.resolution.thumbnail
    ];

    const completedFields = completionFields.filter(field => field && field.trim() !== '').length;
    const completionPercentage = Math.round((completedFields / completionFields.length) * 100);

    return NextResponse.json({
      success: true,
      story: {
        ...updatedStory,
        completionPercentage
      },
      message: '스토리가 성공적으로 업데이트되었습니다'
    });

  } catch (error) {
    console.error('Story update error:', error);

    return NextResponse.json(
      {
        success: false,
        error: '스토리 업데이트에 실패했습니다'
      },
      { status: 500 }
    );
  }
}

// DELETE - 스토리 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId는 필수입니다' },
        { status: 400 }
      );
    }

    // 기존 스토리 조회
    const existingStory = storyStorage.get(id);

    if (!existingStory) {
      return NextResponse.json(
        { success: false, error: '스토리를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 권한 확인
    if (existingStory.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '삭제 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 스토리 삭제
    storyStorage.delete(id);

    // TODO: 연관된 썸네일 이미지들도 삭제 처리
    // TODO: 연관된 숏트 데이터들도 삭제 처리

    return NextResponse.json({
      success: true,
      message: '스토리가 성공적으로 삭제되었습니다',
      deletedStoryId: id
    });

  } catch (error) {
    console.error('Story delete error:', error);

    return NextResponse.json(
      {
        success: false,
        error: '스토리 삭제에 실패했습니다'
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
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}