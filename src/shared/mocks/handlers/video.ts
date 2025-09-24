/**
 * 비디오 생성 API 핸들러
 * TDD 및 결정론적 테스트를 위한 비디오 생성 관련 API 모킹
 */

import { http, HttpResponse } from 'msw';
import { createMockVideoRequest, createMockVideoResponse, createMockError } from '../data/factories';
import { withCostSafety } from './cost-safety';

// 비디오 생성 요청 저장소
const videoStore = new Map<string, any>();
const jobStore = new Map<string, any>();

export const videoHandlers = [
  // 비디오 생성 요청 - 비용 안전 적용
  http.post('/api/video/generate', withCostSafety('/api/video/generate', async ({ request }: any) => {
    const { storyboardId, panels, settings } = await request.json();

    if (!storyboardId) {
      return HttpResponse.json(
        createMockError('스토리보드 ID를 입력해주세요', 400),
        { status: 400 }
      );
    }

    if (!panels || panels.length === 0) {
      return HttpResponse.json(
        createMockError('생성할 패널이 없습니다', 400),
        { status: 400 }
      );
    }

    // 최대 패널 수 제한 (비용 절약)
    if (panels.length > 10) {
      return HttpResponse.json(
        createMockError('한 번에 최대 10개 패널까지만 처리할 수 있습니다', 400),
        { status: 400 }
      );
    }

    const videoRequest = createMockVideoRequest(storyboardId);
    videoRequest.storyboardId = storyboardId;
    videoRequest.panels = panels;
    videoRequest.settings = settings || {
      quality: 'medium',
      fps: 24,
      resolution: '1280x720',
    };

    // 작업 ID 생성
    const jobId = `job-${videoRequest.id}-${Date.now()}`;

    // 작업 상태 저장
    jobStore.set(jobId, {
      id: jobId,
      requestId: videoRequest.id,
      status: 'queued',
      progress: 0,
      estimatedTime: panels.length * 30, // 패널당 30초 예상
      createdAt: new Date().toISOString(),
    });

    videoStore.set(videoRequest.id, videoRequest);

    // 비동기 처리 시뮬레이션
    setTimeout(() => {
      // 진행 상태 업데이트
      const job = jobStore.get(jobId);
      if (job) {
        job.status = 'processing';
        job.progress = 25;
        jobStore.set(jobId, job);
      }

      setTimeout(() => {
        const job = jobStore.get(jobId);
        if (job) {
          job.status = 'processing';
          job.progress = 75;
          jobStore.set(jobId, job);
        }

        setTimeout(() => {
          // 완료 처리
          const job = jobStore.get(jobId);
          if (job) {
            job.status = 'completed';
            job.progress = 100;
            job.completedAt = new Date().toISOString();

            // 결과 비디오 생성
            const videoResponse = createMockVideoResponse(storyboardId);
            videoResponse.requestId = videoRequest.id;
            videoResponse.videos = panels.map((panel: any, index: number) => ({
              id: `video-${panel.id}`,
              url: `https://example.com/video/${panel.id}-${Date.now()}.mp4`,
              duration: panel.duration || 5,
              thumbnail: `https://example.com/thumbnail/${panel.id}.jpg`,
              metadata: {
                resolution: settings?.resolution || '1280x720',
                fps: settings?.fps || 24,
                format: 'mp4',
                size: '15.2MB',
              },
            }));

            job.result = videoResponse;
            jobStore.set(jobId, job);
          }
        }, 3000);
      }, 2000);
    }, 1000);

    return HttpResponse.json({
      jobId,
      requestId: videoRequest.id,
      status: 'queued',
      estimatedTime: panels.length * 30,
      cost: {
        estimated: panels.length * 5.0,
        currency: 'USD',
        breakdown: panels.map((panel: any, index: number) => ({
          panelId: panel.id,
          duration: panel.duration || 5,
          cost: 5.0,
        })),
      },
    }, { status: 202 });
  })),

  // 비디오 생성 진행 상태 조회
  http.get('/api/video/progress/:jobId', ({ params }) => {
    const { jobId } = params;
    const job = jobStore.get(jobId as string);

    if (!job) {
      return HttpResponse.json(
        createMockError('작업을 찾을 수 없습니다', 404),
        { status: 404 }
      );
    }

    return HttpResponse.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      estimatedTime: job.estimatedTime,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      result: job.result,
    });
  }),

  // 사용자별 비디오 생성 기록 조회
  http.get('/api/video/history', ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const jobs = Array.from(jobStore.values())
      .filter(job => !userId || job.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return HttpResponse.json({
      jobs,
      total: jobs.length,
    });
  }),

  // 비디오 생성 작업 취소
  http.delete('/api/video/progress/:jobId', ({ params }) => {
    const { jobId } = params;
    const job = jobStore.get(jobId as string);

    if (!job) {
      return HttpResponse.json(
        createMockError('작업을 찾을 수 없습니다', 404),
        { status: 404 }
      );
    }

    if (job.status === 'completed') {
      return HttpResponse.json(
        createMockError('완료된 작업은 취소할 수 없습니다', 400),
        { status: 400 }
      );
    }

    job.status = 'cancelled';
    job.cancelledAt = new Date().toISOString();
    jobStore.set(jobId as string, job);

    return HttpResponse.json({
      message: '작업이 취소되었습니다',
      jobId: job.id,
      status: job.status,
    });
  }),

  // 비디오 품질 프리셋 조회
  http.get('/api/video/presets', () => {
    return HttpResponse.json({
      presets: [
        {
          id: 'low',
          name: '저화질',
          resolution: '854x480',
          fps: 24,
          bitrate: '1000k',
          cost: 2.0,
        },
        {
          id: 'medium',
          name: '중화질',
          resolution: '1280x720',
          fps: 30,
          bitrate: '2500k',
          cost: 5.0,
        },
        {
          id: 'high',
          name: '고화질',
          resolution: '1920x1080',
          fps: 30,
          bitrate: '5000k',
          cost: 10.0,
        },
        {
          id: 'ultra',
          name: '초고화질',
          resolution: '3840x2160',
          fps: 60,
          bitrate: '15000k',
          cost: 25.0,
        },
      ],
    });
  }),

  // 비디오 다운로드 링크 생성
  http.post('/api/video/download/:videoId', ({ params }) => {
    const { videoId } = params;

    // 보안 토큰이 포함된 임시 다운로드 링크 생성
    const token = `dl-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const downloadUrl = `https://example.com/download/${videoId}?token=${token}&expires=${Date.now() + 3600000}`;

    return HttpResponse.json({
      downloadUrl,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      token,
    });
  }),

  // 비디오 메타데이터 조회
  http.get('/api/video/:videoId/metadata', ({ params }) => {
    const { videoId } = params;

    return HttpResponse.json({
      videoId,
      metadata: {
        duration: 30,
        resolution: '1920x1080',
        fps: 30,
        format: 'mp4',
        codec: 'h264',
        bitrate: '5000k',
        fileSize: '45.2MB',
        createdAt: new Date().toISOString(),
      },
    });
  }),

  // 비디오 생성 통계
  http.get('/api/video/stats', ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    const userJobs = Array.from(jobStore.values())
      .filter(job => !userId || job.userId === userId);

    const completed = userJobs.filter(job => job.status === 'completed').length;
    const processing = userJobs.filter(job => job.status === 'processing').length;
    const failed = userJobs.filter(job => job.status === 'failed').length;

    return HttpResponse.json({
      total: userJobs.length,
      completed,
      processing,
      failed,
      totalCost: userJobs.reduce((sum, job) => sum + (job.result?.cost?.amount || 0), 0),
      avgProcessingTime: 45, // seconds
    });
  }),
];