import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { createErrorResponse } from '@/shared/schemas/api.schema';
import { logger } from '@/shared/lib/logger';
import {


  createSuccessResponse,
  createErrorResponse as createPlanningErrorResponse,
  DualStorageResult,
  normalizeRepositoryResult} from '@/shared/schemas/planning-response.schema';
import { withAuth } from '@/shared/lib/auth-middleware-v2';
import { getPlanningRepository } from '@/entities/planning';
import type { ScenarioMetadata } from '@/shared/types/metadata';
import type { BaseContent, ScenarioContent } from '@/entities/planning';

export const dynamic = 'force-dynamic';

/**
 * GET /api/planning/scenarios
 * 저장된 시나리오 목록 조회
 */
const getHandler = async (request: NextRequest, { user, authContext }: { user: { id: string | null }, authContext: any }) => {
  try {
    const userId = user.id;
    logger.info('✅ Planning scenarios 인증 성공:', userId);

    // 🔄 Planning Repository를 통한 듀얼 저장소 조회
    const repository = getPlanningRepository();
    const allContent = await repository.findByUserId(userId || 'guest');

    // scenario 타입으로 필터링 및 변환
    const scenarios = allContent
      .filter(content => content.type === 'scenario')
      .map(content => {
        const scenario = content as ScenarioContent;
        return {
          id: scenario.id,
          type: scenario.type,
          title: scenario.title || 'Untitled Scenario',
          content: scenario,
          userId: scenario.metadata?.userId || null,
          status: scenario.metadata?.status || 'draft',
          createdAt: typeof scenario.metadata?.createdAt === 'number' ? scenario.metadata.createdAt : Date.now(),
          updatedAt: typeof scenario.metadata?.updatedAt === 'number' ? scenario.metadata.updatedAt : Date.now()
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt); // 최신순 정렬

    // 저장소 상태 확인 및 표준화된 응답 생성
    const healthStatus = await repository.getStorageHealth();
    const adaptedHealthStatus = {
      // PRISMA_DISABLED: prisma: { isHealthy: healthStatus.prisma.status === 'healthy' },
      supabase: { isHealthy: healthStatus.supabase.status === 'healthy' }
    };
    const dualStorageResult = normalizeRepositoryResult(
      { id: 'scenarios-query', success: true },
      adaptedHealthStatus
    );

    const responseData = {
      scenarios,
      total: scenarios.length
    };

    logger.info(`✅ 듀얼 저장 Repository에서 ${scenarios.length}개 시나리오 조회 성공`);

    return NextResponse.json(
      createSuccessResponse(responseData, dualStorageResult),
      { status: 200 }
    );

  } catch (error) {
    console.error('시나리오 조회 오류:', error);

    const dualStorageResult = normalizeRepositoryResult(
      {
        id: 'scenarios-query-error',
        success: false,
        error: error instanceof Error ? error.message : '시나리오 조회 중 오류 발생'
      }
    );

    return NextResponse.json(
      createPlanningErrorResponse('시나리오 조회 중 오류가 발생했습니다.', dualStorageResult),
      { status: 500 }
    );
  }
};

export const GET = withAuth(getHandler, { endpoint: 'planning-scenarios' });