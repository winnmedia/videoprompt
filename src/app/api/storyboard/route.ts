/**
 * Storyboard API - CRUD 기본 라우트
 * UserJourneyMap 7-9단계 대응
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createCostSafetyContext, validateApiCostSafety } from '@/shared/lib/cost-safety-middleware';

// 스토리보드 생성 요청 스키마
const createStoryboardSchema = z.object({
  scenarioId: z.string().min(1, '시나리오 ID는 필수입니다'),
  title: z.string().min(1, '제목은 필수입니다').max(100, '제목은 100자 이내여야 합니다'),
  description: z.string().max(500, '설명은 500자 이내여야 합니다').optional(),
  scenes: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    duration: z.number().positive(),
    order: z.number().positive(),
  })).min(1, '최소 1개의 장면이 필요합니다'),
  style: z.enum(['pencil', 'rough', 'monochrome', 'colored']).default('pencil'),
  aspectRatio: z.enum(['16:9', '4:3', '1:1', '9:16']).default('16:9'),
});

// 스토리보드 수정 요청 스키마
const updateStoryboardSchema = createStoryboardSchema.partial().extend({
  id: z.string().min(1),
});

// 스토리보드 목록 조회 파라미터 스키마
const getStoryboardsSchema = z.object({
  scenarioId: z.string().optional(),
  userId: z.string().optional(),
  page: z.string().transform(val => parseInt(val) || 1),
  limit: z.string().transform(val => Math.min(parseInt(val) || 10, 50)),
});

/**
 * GET /api/storyboard - 스토리보드 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = {
      scenarioId: searchParams.get('scenarioId'),
      userId: searchParams.get('userId'),
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '10',
    };

    const validatedParams = getStoryboardsSchema.parse(queryParams);

    // 실제 구현에서는 데이터베이스에서 조회
    // const storyboards = await db.storyboard.findMany({
    //   where: {
    //     ...(validatedParams.scenarioId && { scenarioId: validatedParams.scenarioId }),
    //     ...(validatedParams.userId && { userId: validatedParams.userId }),
    //   },
    //   orderBy: { createdAt: 'desc' },
    //   skip: (validatedParams.page - 1) * validatedParams.limit,
    //   take: validatedParams.limit,
    // });

    // 목 데이터 응답
    const mockStoryboards = [
      {
        id: 'storyboard-1',
        scenarioId: validatedParams.scenarioId || 'scenario-1',
        title: '제주도 여행 스토리보드',
        description: '제주도 자연 풍경을 담은 스토리보드',
        userId: validatedParams.userId || 'user-1',
        style: 'colored',
        aspectRatio: '16:9',
        panels: [
          {
            id: 'panel-1',
            sceneId: 'scene-1',
            imagePrompt: '제주도 한라산 전경, 시네마틱, 고화질, 와이드 샷',
            imageUrl: 'https://example.com/storyboard-1-panel-1.jpg',
            duration: 30,
            order: 1,
          },
        ],
        totalDuration: 30,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      data: {
        storyboards: mockStoryboards,
        pagination: {
          page: validatedParams.page,
          limit: validatedParams.limit,
          total: mockStoryboards.length,
          totalPages: Math.ceil(mockStoryboards.length / validatedParams.limit),
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('스토리보드 목록 조회 오류:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          message: '요청 파라미터가 유효하지 않습니다',
          details: error.errors,
          timestamp: new Date().toISOString(),
        },
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: {
        message: '스토리보드 목록을 조회하는 중 오류가 발생했습니다',
        timestamp: new Date().toISOString(),
      },
    }, { status: 500 });
  }
}

/**
 * POST /api/storyboard - 스토리보드 생성
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createStoryboardSchema.parse(body);

    // 비용 안전 검사
    const costContext = await createCostSafetyContext('user-1', 'storyboard-create');
    const costCheck = await validateApiCostSafety(costContext, {
      estimatedCost: 0.50, // 스토리보드 생성 비용
      maxAllowedCost: 1.00,
      userDailyLimit: 20.00,
      emergencyStopThreshold: 50.00,
    });

    if (!costCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          message: costCheck.reason,
          code: 'COST_LIMIT_EXCEEDED',
          timestamp: new Date().toISOString(),
        },
      }, { status: 402 });
    }

    // 스토리보드 생성 로직
    const newStoryboard = {
      id: `storyboard-${Date.now()}`,
      ...validatedData,
      userId: 'user-1', // 실제로는 JWT에서 추출
      panels: validatedData.scenes.map((scene, index) => ({
        id: `panel-${Date.now()}-${index + 1}`,
        sceneId: scene.id,
        imagePrompt: `${scene.title}: ${scene.description}, 시네마틱, 고화질, 스타일: ${validatedData.style}`,
        imageUrl: null, // 이미지 생성 후 업데이트
        duration: scene.duration,
        order: scene.order,
        visualDescription: scene.description,
        cameraAngle: '미디엄 샷',
        lighting: '자연광',
      })),
      totalDuration: validatedData.scenes.reduce((sum, scene) => sum + scene.duration, 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 실제 구현에서는 데이터베이스에 저장
    // const savedStoryboard = await db.storyboard.create({
    //   data: newStoryboard,
    // });

    return NextResponse.json({
      success: true,
      data: {
        storyboard: newStoryboard,
        cost: {
          amount: costCheck.estimatedCost,
          currency: 'USD',
          remainingBudget: costCheck.remainingBudget,
        },
      },
      timestamp: new Date().toISOString(),
    }, { status: 201 });

  } catch (error) {
    console.error('스토리보드 생성 오류:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          message: '요청 데이터가 유효하지 않습니다',
          details: error.errors,
          timestamp: new Date().toISOString(),
        },
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: {
        message: '스토리보드를 생성하는 중 오류가 발생했습니다',
        timestamp: new Date().toISOString(),
      },
    }, { status: 500 });
  }
}