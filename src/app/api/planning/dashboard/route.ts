import { NextRequest, NextResponse } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/shared/schemas/api.schema';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import { logger } from '@/shared/lib/logger';
import type { ScenarioMetadata, PromptMetadata, VideoMetadata } from '@/shared/types/metadata';

export const dynamic = 'force-dynamic';

/**
 * GET /api/planning/dashboard
 * Planning Dashboard 통합 데이터 조회 API
 * 기존 3개 API (/scenarios, /prompt, /videos) 통합으로 중복 호출 방지
 */
export async function GET(request: NextRequest) {
  try {
    // 🔐 보안 강화: 인증 필수 검사
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      logger.warn('Planning Dashboard 인증 실패 - 401 반환');
      return NextResponse.json(
        createErrorResponse('AUTHENTICATION_REQUIRED', '로그인이 필요합니다. 인증 후 다시 시도해주세요.'),
        { status: 401 }
      );
    }

    logger.info('Planning Dashboard 데이터 조회 시작', { userId });

    // Prisma 클라이언트 임포트 및 연결 검증
//     const { prisma, checkDatabaseConnection } = await import('@/lib/prisma');

    // 데이터베이스 연결 상태 검증
    const connectionStatus = await checkDatabaseConnection(2);
    if (!connectionStatus.success) {
      logger.error(`Planning Dashboard DB 연결 실패: ${connectionStatus.error || 'Unknown error'}`);
      return NextResponse.json(
        createErrorResponse('DATABASE_CONNECTION_ERROR', '데이터베이스 연결에 실패했습니다.'),
        { status: 503 }
      );
    }

    // 🔐 보안 강화: 현재 사용자의 데이터만 조회
    const [scenarioProjects, promptProjects, videoAssets] = await Promise.all([
      // 시나리오 데이터 (사용자별 필터링)
      prisma.project.findMany({
        where: {
          userId: userId, // 🔐 사용자별 필터링 추가
          tags: {
            array_contains: 'scenario'
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
          scenario: true,
          tags: true,
          user: {
            select: {
              id: true,
              username: true,
            }
          }
        }
      }),

      // 프롬프트 데이터 (사용자별 필터링)
      prisma.project.findMany({
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
      }),

      // 비디오 에셋 데이터 (사용자별 필터링 - 기존 테이블 구조 사용)
      prisma.videoAsset.findMany({
        where: {
          userId: userId // 🔐 사용자별 필터링 추가
        },
        orderBy: { createdAt: 'desc' },
        include: {
          prompt: {
            select: {
              id: true,
              metadata: true,
              timeline: true,
            },
          },
        },
      })
    ]);

    // 데이터 변환 (타입 안전성 강화)
    const scenarios = scenarioProjects.map(project => {
      const metadata = project.metadata as ScenarioMetadata | null;
      return {
        id: project.id,
        title: project.title,
        version: metadata?.version || 'V1',
        author: project.user?.username || metadata?.author || 'AI Generated',
        updatedAt: project.updatedAt,
        createdAt: project.createdAt,
        hasFourStep: metadata?.hasFourStep || false,
        hasTwelveShot: metadata?.hasTwelveShot || false,
        story: metadata?.story || '',
        genre: metadata?.genre || '',
        tone: metadata?.tone || '',
        target: metadata?.target || '',
        format: metadata?.format || '16:9',
        tempo: metadata?.tempo || '보통',
        developmentMethod: metadata?.developmentMethod || '',
        developmentIntensity: metadata?.developmentIntensity || '',
        durationSec: metadata?.durationSec || 10,
        pdfUrl: null, // PDF 생성 기능은 별도 구현 필요
      };
    });

    const prompts = promptProjects.map(project => {
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

    const videos = videoAssets.map(video => {
      const metadata = (video as any).metadata as VideoMetadata | null;
      return {
        id: video.id,
        title: metadata?.title || 'Untitled Video',
        prompt: metadata?.prompt || '',
        provider: video.provider || 'unknown',
        duration: video.duration || 10,
        aspectRatio: '16:9',
        status: video.status || 'queued',
        videoUrl: video.url,
        thumbnailUrl: metadata?.thumbnailUrl || null,
        createdAt: video.createdAt,
        completedAt: metadata?.completedAt || null,
        jobId: metadata?.jobId || null,
      };
    });

    logger.info('Planning Dashboard 데이터 조회 완료', {
      scenarios: scenarios.length,
      prompts: prompts.length,
      videos: videos.length
    });

    return NextResponse.json(
      createSuccessResponse({
        scenarios,
        prompts,
        videos,
        summary: {
          totalScenarios: scenarios.length,
          totalPrompts: prompts.length,
          totalVideos: videos.length,
          lastUpdated: new Date().toISOString()
        }
      }, 'Planning Dashboard 데이터를 성공적으로 조회했습니다.'),
      {
        status: 200,
        headers: {
          // 5분 캐시 설정 (API 중복 호출 방지)
          'Cache-Control': 'max-age=300, s-maxage=300, stale-while-revalidate=60',
        }
      }
    );

  } catch (error) {
    logger.error('Planning Dashboard 조회 오류', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      createErrorResponse(
        'DASHBOARD_FETCH_ERROR',
        error instanceof Error ? error.message : 'Planning Dashboard 조회 중 오류가 발생했습니다.'
      ),
      { status: 500 }
    );
  }
}