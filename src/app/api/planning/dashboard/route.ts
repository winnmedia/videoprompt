import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { createSuccessResponse, createErrorResponse } from '@/shared/schemas/api.schema';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import { logger } from '@/shared/lib/logger';
import type { ScenarioMetadata, PromptMetadata, VideoMetadata } from '@/shared/types/metadata';

export const dynamic = 'force-dynamic';

/**
 * GET /api/planning/dashboard
 * Planning Dashboard 통합 데이터 조회 API
 * 기존 3개 API (/scenarios, /prompt, /videos) 통합으로 중복 호출 방지
 * Supabase 전용 구현
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

    // Supabase 클라이언트 초기화
    const supabase = await getSupabaseClientSafe('admin');

    // 🔐 보안 강화: 현재 사용자의 데이터만 조회
    const [scenarioProjectsResult, promptProjectsResult, videoAssetsResult] = await Promise.all([
      // 시나리오 데이터 (사용자별 필터링)
      supabase
        .from('projects')
        .select(`
          id, title, description, metadata, status, created_at, updated_at,
          scenario, tags,
          user:users!projects_user_id_fkey(id, username)
        `)
        .eq('user_id', userId)
        .contains('tags', ['scenario'])
        .order('updated_at', { ascending: false }),

      // 프롬프트 데이터 (사용자별 필터링)
      supabase
        .from('projects')
        .select(`
          id, title, description, metadata, status, created_at, updated_at,
          prompt, tags,
          user:users!projects_user_id_fkey(id, username)
        `)
        .eq('user_id', userId)
        .contains('tags', ['prompt'])
        .order('updated_at', { ascending: false }),

      // 비디오 에셋 데이터 (사용자별 필터링)
      supabase
        .from('video_assets')
        .select(`
          id, metadata, provider, duration, url, status, created_at,
          prompt:prompts!video_assets_prompt_id_fkey(id, metadata, timeline)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    ]);

    // 오류 처리
    if (scenarioProjectsResult.error) {
      throw new Error(`시나리오 데이터 조회 실패: ${scenarioProjectsResult.error.message}`);
    }
    if (promptProjectsResult.error) {
      throw new Error(`프롬프트 데이터 조회 실패: ${promptProjectsResult.error.message}`);
    }
    if (videoAssetsResult.error) {
      throw new Error(`비디오 데이터 조회 실패: ${videoAssetsResult.error.message}`);
    }

    const scenarioProjects = scenarioProjectsResult.data || [];
    const promptProjects = promptProjectsResult.data || [];
    const videoAssets = videoAssetsResult.data || [];

    // 데이터 변환 (타입 안전성 강화)
    const scenarios = scenarioProjects.map(project => {
      const metadata = project.metadata as ScenarioMetadata | null;
      return {
        id: project.id,
        title: project.title,
        version: metadata?.version || 'V1',
        author: (project.user as any)?.username || metadata?.author || 'AI Generated',
        updatedAt: project.updated_at,
        createdAt: project.created_at,
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
        createdAt: project.created_at,
        updatedAt: project.updated_at,
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
      const metadata = video.metadata as VideoMetadata | null;
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
        createdAt: video.created_at,
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