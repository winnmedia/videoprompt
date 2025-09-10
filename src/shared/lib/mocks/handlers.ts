/**
 * MSW (Mock Service Worker) 핸들러
 * API 모킹을 위한 핸들러 정의
 */

import { http, HttpResponse, delay } from 'msw';
import type { StoryboardResult } from '../types/storyboard';
import { safeBase64Encode } from '../encoding-utils';

// 모의 데이터 생성 함수
function generateMockImageData(prompt: string): string {
  // 간단한 SVG 플레이스홀더 생성
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="50%" text-anchor="middle" font-size="24" fill="#333">
        Mock Image: ${prompt.slice(0, 50)}
      </text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${safeBase64Encode(svg)}`;
}

// 모의 스토리보드 결과 생성
function generateMockStoryboardResult(shotId: string, prompt: string): StoryboardResult {
  return {
    shotId,
    imageData: generateMockImageData(prompt),
    prompt,
    metadata: {
      generatedAt: new Date(),
      model: 'imagen-4.0-fast',
      generationTimeMs: Math.floor(Math.random() * 2000) + 1000,
      size: '1024x1024',
      tokensUsed: Math.floor(Math.random() * 100) + 50,
    },
  };
}

/**
 * MSW 핸들러 정의
 */
export const handlers = [
  // =============================================================================
  // 스토리보드 생성 엔드포인트
  // =============================================================================
  
  /**
   * 단일 샷 생성
   */
  http.post('/api/storyboard/generate-shot', async ({ request }) => {
    await delay(1000); // 네트워크 지연 시뮬레이션
    
    const body = await request.json() as any;
    const { shotId, prompt } = body;
    
    // 10% 확률로 실패 시뮬레이션
    if (Math.random() < 0.1) {
      return HttpResponse.json(
        { error: 'Image generation failed' },
        { status: 500 },
      );
    }
    
    const result = generateMockStoryboardResult(shotId, prompt);
    
    return HttpResponse.json(result);
  }),
  
  /**
   * 배치 생성
   */
  http.post('/api/storyboard/generate-batch', async ({ request }) => {
    await delay(2000); // 배치 처리 시간 시뮬레이션
    
    const body = await request.json() as any;
    const { shots } = body;
    
    const results = shots.map((shot: any) => {
      // 5% 확률로 개별 샷 실패
      if (Math.random() < 0.05) {
        return {
          success: false,
          shotId: shot.shotId,
          error: 'Generation failed for this shot',
        };
      }
      
      return {
        success: true,
        result: generateMockStoryboardResult(shot.shotId, shot.prompt),
      };
    });
    
    const successful = results
      .filter((r: any) => r.success)
      .map((r: any) => r.result);
    
    const failed = results
      .filter((r: any) => !r.success)
      .map((r: any) => ({ shotId: r.shotId, error: r.error }));
    
    return HttpResponse.json({
      batchId: crypto.randomUUID(),
      successful,
      failed,
      processingTimeMs: 2000,
    });
  }),
  
  // =============================================================================
  // 스토리보드 조회 엔드포인트
  // =============================================================================
  
  /**
   * 프로젝트의 스토리보드 조회
   */
  http.get('/api/storyboards/:projectId', async ({ params }) => {
    await delay(500);
    
    const { projectId } = params;
    
    // 모의 스토리보드 데이터
    const mockResults = Array.from({ length: 5 }, (_, index) => 
      generateMockStoryboardResult(
        `shot-${index + 1}`,
        `Test prompt for shot ${index + 1}`,
      ),
    );
    
    return HttpResponse.json({
      projectId,
      results: mockResults,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }),
  
  /**
   * 생성 히스토리 조회
   */
  http.get('/api/storyboards/:projectId/history', async ({ params }) => {
    await delay(300);
    
    const { projectId } = params;
    
    // 모의 히스토리 데이터
    const history = Array.from({ length: 10 }, (_, index) => ({
      id: `history-${index + 1}`,
      projectId,
      shotId: `shot-${(index % 5) + 1}`,
      status: index < 8 ? 'completed' : 'failed',
      generatedAt: new Date(Date.now() - index * 3600000).toISOString(),
      model: index % 2 === 0 ? 'imagen-4.0-fast' : 'dall-e-3',
      prompt: `Historical prompt ${index + 1}`,
      imageUrl: index < 8 ? generateMockImageData(`History ${index + 1}`) : null,
      error: index >= 8 ? 'Generation failed' : null,
    }));
    
    return HttpResponse.json(history);
  }),
  
  // =============================================================================
  // 스토리보드 저장 엔드포인트
  // =============================================================================
  
  /**
   * 스토리보드 저장
   */
  http.post('/api/storyboards/save', async ({ request }) => {
    await delay(800);
    
    const body = await request.json() as any;
    const { projectId, results } = body;
    
    // 5% 확률로 저장 실패
    if (Math.random() < 0.05) {
      return HttpResponse.json(
        { error: 'Failed to save storyboard' },
        { status: 500 },
      );
    }
    
    return HttpResponse.json({
      success: true,
      projectId,
      savedCount: results.length,
      savedAt: new Date().toISOString(),
    });
  }),
  
  // =============================================================================
  // 생성 상태 엔드포인트
  // =============================================================================
  
  /**
   * 생성 상태 조회
   */
  http.get('/api/storyboard/status/:projectId', async ({ params }) => {
    await delay(200);
    
    const { projectId } = params;
    
    // 모의 상태 데이터
    const progress = Math.floor(Math.random() * 100);
    
    return HttpResponse.json({
      projectId,
      overallProgress: progress,
      totalShots: 10,
      completedShots: Math.floor(progress / 10),
      failedShots: Math.floor(Math.random() * 2),
      startedAt: new Date(Date.now() - 60000).toISOString(),
      estimatedCompletionTime: progress < 100 
        ? new Date(Date.now() + (100 - progress) * 1000).toISOString() 
        : null,
    });
  }),
  
  // =============================================================================
  // 캐시 관련 엔드포인트
  // =============================================================================
  
  /**
   * 캐시 통계
   */
  http.get('/api/storyboard/cache/stats', async () => {
    await delay(100);
    
    return HttpResponse.json({
      size: Math.floor(Math.random() * 100),
      hits: Math.floor(Math.random() * 1000),
      totalSize: Math.floor(Math.random() * 10000000),
      hitRate: Math.random(),
    });
  }),
  
  /**
   * 캐시 클리어
   */
  http.post('/api/storyboard/cache/clear', async () => {
    await delay(500);
    
    return HttpResponse.json({
      success: true,
      clearedAt: new Date().toISOString(),
    });
  }),
];

/**
 * 에러 시나리오를 위한 추가 핸들러
 */
export const errorHandlers = [
  // 네트워크 에러 시뮬레이션
  http.post('/api/storyboard/generate-shot', () => {
    return HttpResponse.error();
  }),
  
  // 타임아웃 시뮬레이션
  http.post('/api/storyboard/generate-batch', async () => {
    await delay(30000); // 30초 지연
    return HttpResponse.json({ error: 'Timeout' }, { status: 504 });
  }),
  
  // 인증 에러
  http.get('/api/storyboards/:projectId', () => {
    return HttpResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }),
  
  // Rate limit 에러
  http.post('/api/storyboard/generate-shot', () => {
    return HttpResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 },
    );
  }),
];

/**
 * 성공 시나리오를 위한 핸들러
 */
export const successHandlers = [
  // 즉시 성공
  http.post('/api/storyboard/generate-shot', async ({ request }) => {
    const body = await request.json() as any;
    const result = generateMockStoryboardResult(body.shotId, body.prompt);
    return HttpResponse.json(result);
  }),
  
  // 모든 배치 성공
  http.post('/api/storyboard/generate-batch', async ({ request }) => {
    const body = await request.json() as any;
    const successful = body.shots.map((shot: any) =>
      generateMockStoryboardResult(shot.shotId, shot.prompt),
    );
    
    return HttpResponse.json({
      batchId: crypto.randomUUID(),
      successful,
      failed: [],
      processingTimeMs: 1000,
    });
  }),
];