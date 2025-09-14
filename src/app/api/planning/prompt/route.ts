import { NextRequest, NextResponse } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/shared/schemas/api.schema';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import type { PromptMetadata } from '@/shared/types/metadata';

export const dynamic = 'force-dynamic';

/**
 * GET /api/planning/prompt
 * 저장된 프롬프트 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 🔐 보안 강화: 인증 필수 검사
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      console.warn('🚨 Planning prompts 인증 실패 - 401 반환');
      return NextResponse.json(
        createErrorResponse('AUTHENTICATION_REQUIRED', '로그인이 필요합니다. 인증 후 다시 시도해주세요.'),
        { status: 401 }
      );
    }

    console.log('✅ Planning prompts 인증 성공:', userId);

    // Prisma 클라이언트 임포트 및 연결 검증
    const { prisma, checkDatabaseConnection } = await import('@/lib/prisma');

    // 데이터베이스 연결 상태 검증
    const connectionStatus = await checkDatabaseConnection(2);
    if (!connectionStatus.success) {
      console.error('❌ Database connection failed:', connectionStatus.error);
      return NextResponse.json(
        createErrorResponse('DATABASE_CONNECTION_ERROR', '데이터베이스 연결에 실패했습니다.'),
        { status: 503 }
      );
    }

    // 🔐 보안 강화: 현재 사용자의 프롬프트만 조회
    const projects = await prisma.project.findMany({
      where: {
        userId: userId, // 🔐 사용자별 필터링 추가
        tags: {
          array_contains: 'prompt'
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      select: {
        id: true,
        title: true,
        description: true,
        metadata: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        prompt: true,
        tags: true,
        user: {
          select: {
            id: true,
            username: true,
          }
        }
      }
    });

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
}