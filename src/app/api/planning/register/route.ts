import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { PlanningRegistrationRequestSchema, createValidationErrorResponse, createErrorResponse } from '@/shared/schemas/api.schema';
import { createSuccessResponse, createErrorResponse as createPlanningErrorResponse, DualStorageResult } from '@/shared/schemas/planning-response.schema';
import { withAuth } from '@/shared/lib/auth-middleware-v2';
import { getPlanningRepository, type BaseContent } from '@/entities/planning';

export const dynamic = 'force-dynamic';

/**
 * POST /api/planning/register
 * 생성된 콘텐츠를 planning 시스템에 등록 (단순화된 버전)
 */
export const POST = withAuth(async (request: NextRequest, { user, authContext }) => {
  try {
    const body = await request.json();

    // 입력 검증
    const validationResult = PlanningRegistrationRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error),
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // BaseContent로 변환
    const planningContent: BaseContent = {
      id: `${validatedData.type}_${validatedData.projectId}_${Date.now()}`,
      title: validatedData.title || `${validatedData.type} - ${new Date().toISOString()}`,
      ...validatedData,
      userId: user.id || undefined,
      status: 'active' as const,
      storageStatus: 'pending' as const,
      createdAt: validatedData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        userId: user.id || undefined,
        status: 'active' as const,
        createdAt: validatedData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    // Repository 호출
    const repository = getPlanningRepository();
    const saveResult = await repository.save(planningContent);

    if (!saveResult.success) {
      const dualStorageResult: DualStorageResult = {
        id: planningContent.id,
        success: false,
        error: saveResult.error
      };

      return NextResponse.json(
        createPlanningErrorResponse('Planning 저장에 실패했습니다.', dualStorageResult),
        { status: 500 }
      );
    }

    // 성공 응답
    const healthStatus = await repository.getStorageHealth();
    const dualStorageResult: DualStorageResult = {
      id: saveResult.id,
      success: true,
      // PRISMA_DISABLED: prismaSuccess: healthStatus.prisma.status === 'healthy',
      supabaseSuccess: healthStatus.supabase.status === 'healthy'
    };

    const responseData = {
      id: saveResult.id,
      type: planningContent.type,
      title: planningContent.title,
      userId: user.id,
      status: 'active' as const,
      createdAt: planningContent.metadata?.createdAt,
      updatedAt: planningContent.metadata?.updatedAt
    };

    return NextResponse.json(
      createSuccessResponse(responseData, dualStorageResult),
      { status: 201 }
    );

  } catch (error) {
    return NextResponse.json(
      createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        error instanceof Error ? error.message : '등록 중 서버 오류가 발생했습니다.'
      ),
      { status: 500 }
    );
  }
}, {
  endpoint: 'planning/register',
  allowGuest: false
});