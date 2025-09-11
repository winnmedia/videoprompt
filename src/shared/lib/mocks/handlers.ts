/**
 * MSW (Mock Service Worker) 핸들러
 * API 모킹을 위한 핸들러 정의 - 실제 API 엔드포인트와 연동된 통합 테스트용
 */

import { http, HttpResponse, delay } from 'msw';
import { safeBase64Encode } from '../encoding-utils';
import type { StoryboardResult } from '../types/storyboard';

// 테스트용 유틸리티
function generateMockPdfBuffer(): Buffer {
  // 실제 PDF 바이너리 데이터 시뮬레이션
  const pdfHeader = '%PDF-1.4\n';
  const mockContent = `1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Test PDF Content) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \n0000000179 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n250\n%%EOF`;
  return Buffer.from(pdfHeader + mockContent);
}

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
 * MSW 핸들러 정의 - 실제 API 엔드포인트와 통합 테스트용
 */
export const handlers = [
  // =============================================================================
  // 인증 API 핸들러
  // =============================================================================
  
  /**
   * 사용자 회원가입
   */
  http.post('/api/auth/register', async ({ request }) => {
    await delay(500);
    const body = await request.json() as any;
    
    // 이메일 중복 체크 시뮬레이션
    if (body.email === 'existing@example.com') {
      return HttpResponse.json(
        { ok: false, message: '이미 사용중인 이메일입니다.' },
        { status: 400 }
      );
    }
    
    // 비밀번호 검증 시뮬레이션
    if (body.password && body.password.length < 8) {
      return HttpResponse.json(
        { ok: false, message: '비밀번호는 최소 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }
    
    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (body.email && !emailRegex.test(body.email)) {
      return HttpResponse.json(
        { ok: false, message: '유효한 이메일 주소를 입력해주세요.' },
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      ok: true,
      data: {
        id: `user_${Date.now()}`,
        email: body.email,
        username: body.username || body.email.split('@')[0],
        createdAt: new Date().toISOString(),
      }
    });
  }),

  /**
   * 사용자 로그인
   */
  http.post('/api/auth/login', async ({ request }) => {
    await delay(300);
    const body = await request.json() as any;
    
    // 잘못된 자격증명 시뮬레이션
    if (body.email === 'wrong@example.com' || body.password === 'wrongpassword') {
      return HttpResponse.json(
        { ok: false, message: '로그인 정보가 올바르지 않습니다.' },
        { status: 401 }
      );
    }
    
    // 이메일 미인증 사용자 시뮬레이션
    if (body.email === 'unverified@example.com') {
      return HttpResponse.json(
        { ok: false, message: '이메일 인증이 필요합니다.' },
        { status: 403 }
      );
    }
    
    return HttpResponse.json({
      ok: true,
      data: {
        id: `user_${Date.now()}`,
        email: body.email,
        username: body.email.split('@')[0],
        token: `jwt_token_${Date.now()}`,
      }
    });
  }),

  /**
   * 사용자 정보 조회
   */
  http.get('/api/auth/me', async ({ request }) => {
    await delay(200);
    
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader === 'Bearer invalid-token') {
      return HttpResponse.json(
        { ok: false, message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }
    
    return HttpResponse.json({
      ok: true,
      data: {
        id: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
      }
    });
  }),

  // =============================================================================
  // 스토리 기획 API 핸들러
  // =============================================================================
  
  /**
   * 스토리 목록 조회
   */
  http.get('/api/planning/stories', async ({ request }) => {
    await delay(400);
    
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1')); // 음수나 0을 1로 변환
    const limit = Math.max(1, parseInt(url.searchParams.get('limit') || '10')); // 음수나 0을 1로 변환
    const search = url.searchParams.get('search');
    
    const mockStories = Array.from({ length: 15 }, (_, index) => ({
      id: `story_${index + 1}`,
      title: `테스트 스토리 ${index + 1}`,
      oneLineStory: `흥미진진한 스토리 ${index + 1}의 한줄 소개`,
      genre: ['Drama', 'Action', 'Comedy', 'Romance'][index % 4],
      tone: ['Serious', 'Light', 'Exciting'][index % 3],
      target: ['Adult', 'Teen', 'General'][index % 3],
      structure: null,
      createdAt: new Date(Date.now() - index * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - index * 43200000).toISOString(),
    }));

    // 검색 필터링 시뮬레이션
    const filteredStories = search 
      ? mockStories.filter(story => 
          story.title.toLowerCase().includes(search.toLowerCase()) ||
          story.oneLineStory.toLowerCase().includes(search.toLowerCase()) ||
          story.genre.toLowerCase().includes(search.toLowerCase())
        )
      : mockStories;

    // 페이지네이션
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedStories = filteredStories.slice(startIndex, endIndex);

    return HttpResponse.json({
      stories: paginatedStories,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(filteredStories.length / limit),
        totalItems: filteredStories.length,
        itemsPerPage: limit,
      }
    });
  }),

  /**
   * 스토리 생성
   */
  http.post('/api/planning/stories', async ({ request }) => {
    await delay(600);
    const body = await request.json() as any;
    
    // 필수 필드 검증
    if (!body.title || !body.oneLineStory) {
      return HttpResponse.json(
        { error: '제목과 스토리는 필수입니다.' },
        { status: 400 }
      );
    }
    
    // DB 에러 시뮬레이션
    if (body.title === 'DB_ERROR_TEST') {
      return HttpResponse.json(
        { error: '스토리 저장 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
    
    const newStory = {
      id: `story_${Date.now()}`,
      title: body.title,
      oneLineStory: body.oneLineStory,
      genre: body.genre || 'Drama',
      tone: body.tone || 'Neutral',
      target: body.target || 'General',
      structure: body.structure || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    return HttpResponse.json(newStory, { status: 201 });
  }),

  // =============================================================================
  // 파일 업로드 API 핸들러
  // =============================================================================
  
  /**
   * 동영상 업로드
   */
  http.post('/api/upload/video', async ({ request }) => {
    await delay(2000); // 업로드 시뮬레이션
    
    const formData = await request.formData();
    const file = formData.get('video') as File;
    
    if (!file) {
      return HttpResponse.json(
        { error: '비디오 파일이 필요합니다.' },
        { status: 400 }
      );
    }
    
    // 600MB 제한 테스트
    const MAX_SIZE = 600 * 1024 * 1024; // 600MB
    if (file.size > MAX_SIZE) {
      return HttpResponse.json(
        { error: '파일 크기가 600MB를 초과합니다.' },
        { status: 413 }
      );
    }
    
    // 파일 형식 검증
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      return HttpResponse.json(
        { error: '지원하지 않는 파일 형식입니다.' },
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      success: true,
      data: {
        id: `upload_${Date.now()}`,
        filename: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        url: `/api/files/${file.name}`,
      }
    });
  }),

  /**
   * 이미지 업로드
   */
  http.post('/api/upload/image', async ({ request }) => {
    await delay(1000);
    
    const formData = await request.formData();
    const file = formData.get('image') as File;
    
    if (!file) {
      return HttpResponse.json(
        { error: '이미지 파일이 필요합니다.' },
        { status: 400 }
      );
    }
    
    // 파일 형식 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return HttpResponse.json(
        { error: '지원하지 않는 이미지 형식입니다.' },
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      success: true,
      data: {
        id: `image_${Date.now()}`,
        filename: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        url: `/api/files/images/${file.name}`,
        thumbnailUrl: `/api/files/images/thumb/${file.name}`,
      }
    });
  }),

  // =============================================================================
  // PDF 생성 API 핸들러
  // =============================================================================
  
  /**
   * PDF 생성
   */
  http.post('/api/generate/pdf', async ({ request }) => {
    await delay(3000); // PDF 생성 시간 시뮬레이션
    
    const body = await request.json() as any;
    
    if (!body.content && !body.storyId) {
      return HttpResponse.json(
        { error: '생성할 컨텐츠 또는 스토리 ID가 필요합니다.' },
        { status: 400 }
      );
    }
    
    // 메모리 사용량 시뮬레이션 (대용량 컨텐츠 테스트)
    if (body.content && body.content.length > 1000000) { // 1MB 이상 컨텐츠
      return HttpResponse.json(
        { error: '컨텐츠가 너무 큽니다. 메모리 부족으로 처리할 수 없습니다.' },
        { status: 413 }
      );
    }
    
    // 한국어 폰트 처리 시뮬레이션
    const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(body.content || body.title || '');
    
    const pdfBuffer = generateMockPdfBuffer();
    
    return new HttpResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="story_${Date.now()}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        'X-Korean-Font-Used': hasKorean ? 'true' : 'false',
      }
    });
  }),

  // =============================================================================
  // 시나리오 개발 API 핸들러 
  // =============================================================================
  
  /**
   * 시나리오 샷 개발
   */
  http.post('/api/scenario/develop-shots', async ({ request }) => {
    await delay(5000); // AI 처리 시간 시뮬레이션
    
    const body = await request.json() as any;
    
    if (!body.storyId && !body.scenario) {
      return HttpResponse.json(
        { error: '스토리 ID 또는 시나리오 데이터가 필요합니다.' },
        { status: 400 }
      );
    }
    
    // AI API 호출 실패 시뮬레이션
    if (body.scenario === 'AI_API_ERROR') {
      return HttpResponse.json(
        { error: 'AI 서비스 일시 장애로 처리할 수 없습니다.' },
        { status: 503 }
      );
    }
    
    // 타임아웃 테스트 (30초 이상)
    if (body.scenario === 'TIMEOUT_TEST') {
      await delay(35000);
      return HttpResponse.json(
        { error: '처리 시간이 초과되었습니다.' },
        { status: 504 }
      );
    }
    
    // 성공적인 샷 개발 결과
    const shots = Array.from({ length: Math.floor(Math.random() * 10) + 5 }, (_, index) => ({
      shotNumber: index + 1,
      shotType: ['Wide Shot', 'Medium Shot', 'Close-up', 'Over-the-shoulder'][index % 4],
      description: `샷 ${index + 1}: 테스트 시나리오의 핵심 장면`,
      duration: Math.floor(Math.random() * 30) + 10,
      camera: {
        movement: ['Static', 'Pan', 'Tilt', 'Dolly'][index % 4],
        angle: ['Eye Level', 'High Angle', 'Low Angle'][index % 3],
      },
      lighting: ['Natural', 'Soft', 'Dramatic', 'Bright'][index % 4],
      audio: {
        dialogue: index % 2 === 0,
        music: Math.random() > 0.5,
        sfx: Math.random() > 0.3,
      }
    }));
    
    return HttpResponse.json({
      success: true,
      data: {
        storyId: body.storyId || `story_${Date.now()}`,
        shots,
        totalShots: shots.length,
        estimatedDuration: shots.reduce((sum, shot) => sum + shot.duration, 0),
        generatedAt: new Date().toISOString(),
        aiModel: 'gemini-1.5-flash',
        processingTime: 4800,
      }
    });
  }),
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