/**
 * Storyboard API - 개별 스토리보드 CRUD
 * UserJourneyMap 7-9단계 대응
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createCostSafetyContext, validateApiCostSafety } from '@/shared/lib/cost-safety-middleware';

// 스토리보드 수정 요청 스키마
const updateStoryboardSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  style: z.enum(['pencil', 'rough', 'monochrome', 'colored']).optional(),
  aspectRatio: z.enum(['16:9', '4:3', '1:1', '9:16']).optional(),
  panels: z.array(z.object({
    id: z.string(),
    sceneId: z.string(),
    imagePrompt: z.string(),
    imageUrl: z.string().nullable(),
    duration: z.number().positive(),
    order: z.number().positive(),
    visualDescription: z.string().optional(),
    cameraAngle: z.string().optional(),
    lighting: z.string().optional(),
  })).optional(),
});

/**
 * GET /api/storyboard/[id] - 스토리보드 단일 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: {
          message: '스토리보드 ID가 필요합니다',
          timestamp: new Date().toISOString(),
        },
      }, { status: 400 });
    }

    // 실제 구현에서는 데이터베이스에서 조회
    // const storyboard = await db.storyboard.findUnique({
    //   where: { id },
    //   include: { panels: true },
    // });

    // if (!storyboard) {
    //   return NextResponse.json({
    //     success: false,
    //     error: {
    //       message: '스토리보드를 찾을 수 없습니다',
    //       timestamp: new Date().toISOString(),
    //     },
    //   }, { status: 404 });
    // }

    // 목 데이터 응답
    const mockStoryboard = {
      id,
      scenarioId: 'scenario-1',
      title: '제주도 여행 스토리보드',
      description: '제주도 자연 풍경을 담은 스토리보드',
      userId: 'user-1',
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
          visualDescription: '한라산의 웅장한 전경',
          cameraAngle: '와이드 샷',
          lighting: '자연광',
        },
        {
          id: 'panel-2',
          sceneId: 'scene-2',
          imagePrompt: '제주도 해변 풍경, 시네마틱, 고화질, 미디엄 샷',
          imageUrl: 'https://example.com/storyboard-1-panel-2.jpg',
          duration: 25,
          order: 2,
          visualDescription: '맑고 푸른 바다와 해변',
          cameraAngle: '미디엄 샷',
          lighting: '황금빛 조명',
        },
      ],
      totalDuration: 55,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: {
        storyboard: mockStoryboard,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('스토리보드 조회 오류:', error);

    return NextResponse.json({
      success: false,
      error: {
        message: '스토리보드를 조회하는 중 오류가 발생했습니다',
        timestamp: new Date().toISOString(),
      },
    }, { status: 500 });
  }
}

/**
 * PUT /api/storyboard/[id] - 스토리보드 수정
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json({
        success: false,
        error: {
          message: '스토리보드 ID가 필요합니다',
          timestamp: new Date().toISOString(),
        },
      }, { status: 400 });
    }

    const validatedData = updateStoryboardSchema.parse(body);

    // 비용 안전 검사 (수정은 생성보다 저렴)
    const costContext = await createCostSafetyContext('user-1', 'storyboard-update');
    const costCheck = await validateApiCostSafety(costContext, {
      estimatedCost: 0.10, // 스토리보드 수정 비용
      maxAllowedCost: 0.50,
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

    // 기존 스토리보드 조회 및 수정
    // const existingStoryboard = await db.storyboard.findUnique({
    //   where: { id },
    // });

    // if (!existingStoryboard) {
    //   return NextResponse.json({
    //     success: false,
    //     error: {
    //       message: '스토리보드를 찾을 수 없습니다',
    //       timestamp: new Date().toISOString(),
    //     },
    //   }, { status: 404 });
    // }

    // 총 시간 재계산
    const totalDuration = validatedData.panels
      ? validatedData.panels.reduce((sum, panel) => sum + panel.duration, 0)
      : 55; // 기존 값 유지

    const updatedStoryboard = {
      id,
      scenarioId: 'scenario-1',
      title: validatedData.title || '제주도 여행 스토리보드',
      description: validatedData.description || '제주도 자연 풍경을 담은 스토리보드',
      userId: 'user-1',
      style: validatedData.style || 'colored',
      aspectRatio: validatedData.aspectRatio || '16:9',
      panels: validatedData.panels || [
        {
          id: 'panel-1',
          sceneId: 'scene-1',
          imagePrompt: '제주도 한라산 전경, 시네마틱, 고화질, 와이드 샷',
          imageUrl: 'https://example.com/storyboard-1-panel-1.jpg',
          duration: 30,
          order: 1,
          visualDescription: '한라산의 웅장한 전경',
          cameraAngle: '와이드 샷',
          lighting: '자연광',
        },
      ],
      totalDuration,
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1일 전
      updatedAt: new Date().toISOString(),
    };

    // 실제 구현에서는 데이터베이스 업데이트
    // const savedStoryboard = await db.storyboard.update({
    //   where: { id },
    //   data: updatedStoryboard,
    // });

    return NextResponse.json({
      success: true,
      data: {
        storyboard: updatedStoryboard,
        cost: {
          amount: costCheck.estimatedCost,
          currency: 'USD',
          remainingBudget: costCheck.remainingBudget,
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('스토리보드 수정 오류:', error);

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
        message: '스토리보드를 수정하는 중 오류가 발생했습니다',
        timestamp: new Date().toISOString(),
      },
    }, { status: 500 });
  }
}

/**
 * DELETE /api/storyboard/[id] - 스토리보드 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: {
          message: '스토리보드 ID가 필요합니다',
          timestamp: new Date().toISOString(),
        },
      }, { status: 400 });
    }

    // 실제 구현에서는 권한 확인 후 삭제
    // const storyboard = await db.storyboard.findUnique({
    //   where: { id },
    // });

    // if (!storyboard) {
    //   return NextResponse.json({
    //     success: false,
    //     error: {
    //       message: '스토리보드를 찾을 수 없습니다',
    //       timestamp: new Date().toISOString(),
    //     },
    //   }, { status: 404 });
    // }

    // if (storyboard.userId !== currentUserId) {
    //   return NextResponse.json({
    //     success: false,
    //     error: {
    //       message: '삭제 권한이 없습니다',
    //       timestamp: new Date().toISOString(),
    //     },
    //   }, { status: 403 });
    // }

    // await db.storyboard.delete({
    //   where: { id },
    // });

    return NextResponse.json({
      success: true,
      data: {
        message: '스토리보드가 성공적으로 삭제되었습니다',
        deletedId: id,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('스토리보드 삭제 오류:', error);

    return NextResponse.json({
      success: false,
      error: {
        message: '스토리보드를 삭제하는 중 오류가 발생했습니다',
        timestamp: new Date().toISOString(),
      },
    }, { status: 500 });
  }
}