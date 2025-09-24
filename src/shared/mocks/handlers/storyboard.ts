/**
 * 스토리보드 API 핸들러
 * TDD 및 결정론적 테스트를 위한 스토리보드 관련 API 모킹
 */

import { http, HttpResponse } from 'msw';
import { createMockStoryboard, createMockError } from '../data/factories';
import { withCostSafety } from './cost-safety';

// 스토리보드 저장소
const storyboardStore = new Map<string, any>();

// 기본 테스트 데이터 생성
const seedData = () => {
  if (storyboardStore.size === 0) {
    const storyboards = [
      createMockStoryboard('travel-jeju'),
      createMockStoryboard('cooking-show'),
      createMockStoryboard('tech-review'),
    ];

    storyboards.forEach(storyboard => {
      storyboardStore.set(storyboard.id, storyboard);
    });
  }
};

export const storyboardHandlers = [
  // 스토리보드 목록 조회
  http.get('/api/storyboard', ({ request }) => {
    seedData();
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const scenarioId = url.searchParams.get('scenarioId');

    let storyboards = Array.from(storyboardStore.values());

    if (userId) {
      storyboards = storyboards.filter(s => s.userId === userId);
    }

    if (scenarioId) {
      storyboards = storyboards.filter(s => s.scenarioId === scenarioId);
    }

    return HttpResponse.json({
      storyboards,
      total: storyboards.length,
    });
  }),

  // 스토리보드 단일 조회
  http.get('/api/storyboard/:id', ({ params }) => {
    const { id } = params;
    const storyboard = storyboardStore.get(id as string);

    if (!storyboard) {
      return HttpResponse.json(
        createMockError('스토리보드를 찾을 수 없습니다', 404),
        { status: 404 }
      );
    }

    return HttpResponse.json({ storyboard });
  }),

  // 스토리보드 생성
  http.post('/api/storyboard', async ({ request }) => {
    const data = await request.json() as any;

    if (!data.scenarioId || !data.title) {
      return HttpResponse.json(
        createMockError('시나리오 ID와 제목을 입력해주세요', 400),
        { status: 400 }
      );
    }

    const storyboard = createMockStoryboard(data.title.toLowerCase().replace(/\s+/g, '-'));
    storyboard.scenarioId = data.scenarioId;
    storyboard.title = data.title;
    storyboard.description = data.description || '';

    storyboardStore.set(storyboard.id, storyboard);

    return HttpResponse.json({ storyboard }, { status: 201 });
  }),

  // 스토리보드 생성 (AI) - 비용 안전 적용
  http.post('/api/storyboard/generate', withCostSafety('/api/storyboard/generate', async ({ request }: any) => {
    const { scenarioId, title, description, scenes } = await request.json();

    if (!scenarioId) {
      return HttpResponse.json(
        createMockError('시나리오 ID를 입력해주세요', 400),
        { status: 400 }
      );
    }

    if (!scenes || scenes.length === 0) {
      return HttpResponse.json(
        createMockError('최소 1개의 장면이 필요합니다', 400),
        { status: 400 }
      );
    }

    // AI 생성 시뮬레이션 (지연 추가)
    await new Promise(resolve => setTimeout(resolve, 2000));

    const storyboard = createMockStoryboard(title?.toLowerCase().replace(/\s+/g, '-') || 'generated');
    storyboard.scenarioId = scenarioId;
    storyboard.title = title || '생성된 스토리보드';
    storyboard.description = description || 'AI가 생성한 스토리보드';

    // 장면 기반 패널 생성
    storyboard.panels = scenes.map((scene: any, index: number) => ({
      id: `panel-${storyboard.id}-${index + 1}`,
      sceneId: scene.id,
      imagePrompt: `${scene.title}: ${scene.description}, 시네마틱, 고화질, ${scene.type === '기' ? '미디엄 샷' : scene.type === '승' ? '와이드 샷' : scene.type === '전' ? '클로즈업' : '롱 샷'}`,
      imageUrl: `https://example.com/generated/${storyboard.id}-${index + 1}.jpg`,
      duration: scene.duration || 30,
      order: index + 1,
      visualDescription: scene.description,
      cameraAngle: scene.type === '기' ? '미디엄 샷' : scene.type === '승' ? '와이드 샷' : scene.type === '전' ? '클로즈업' : '롱 샷',
      lighting: index % 2 === 0 ? '자연광' : '인공조명',
    }));

    storyboard.totalDuration = storyboard.panels.reduce((sum, panel) => sum + panel.duration, 0);

    storyboardStore.set(storyboard.id, storyboard);

    return HttpResponse.json({
      storyboard,
      cost: {
        amount: 2.5,
        currency: 'USD',
        breakdown: [
          { service: 'scene-analysis', amount: 0.5 },
          { service: 'prompt-generation', amount: 1.0 },
          { service: 'image-planning', amount: 1.0 },
        ],
      },
    });
  })),

  // 스토리보드 수정
  http.put('/api/storyboard/:id', async ({ params, request }) => {
    const { id } = params;
    const data = await request.json() as any;
    const existingStoryboard = storyboardStore.get(id as string);

    if (!existingStoryboard) {
      return HttpResponse.json(
        createMockError('스토리보드를 찾을 수 없습니다', 404),
        { status: 404 }
      );
    }

    const updatedStoryboard = {
      ...existingStoryboard,
      ...data,
      id: existingStoryboard.id, // ID는 변경 불가
      updatedAt: new Date().toISOString(),
    };

    // 총 시간 재계산
    if (updatedStoryboard.panels) {
      updatedStoryboard.totalDuration = updatedStoryboard.panels.reduce(
        (sum: number, panel: any) => sum + (panel.duration || 0),
        0
      );
    }

    storyboardStore.set(id as string, updatedStoryboard);

    return HttpResponse.json({ storyboard: updatedStoryboard });
  }),

  // 스토리보드 삭제
  http.delete('/api/storyboard/:id', ({ params }) => {
    const { id } = params;
    const storyboard = storyboardStore.get(id as string);

    if (!storyboard) {
      return HttpResponse.json(
        createMockError('스토리보드를 찾을 수 없습니다', 404),
        { status: 404 }
      );
    }

    storyboardStore.delete(id as string);

    return HttpResponse.json({ message: '스토리보드가 삭제되었습니다' });
  }),

  // 이미지 생성
  http.post('/api/storyboard/generate-image', async ({ request }) => {
    const { prompt, style, aspectRatio } = await request.json() as any;

    if (!prompt) {
      return HttpResponse.json(
        createMockError('이미지 프롬프트를 입력해주세요', 400),
        { status: 400 }
      );
    }

    // 이미지 생성 시뮬레이션 (지연 추가)
    await new Promise(resolve => setTimeout(resolve, 3000));

    const imageId = `img-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    return HttpResponse.json({
      imageUrl: `https://example.com/generated/${imageId}.jpg`,
      prompt: prompt,
      style: style || 'realistic',
      aspectRatio: aspectRatio || '16:9',
      metadata: {
        width: 1920,
        height: 1080,
        format: 'jpg',
        size: '2.5MB',
      },
      cost: {
        amount: 0.25,
        currency: 'USD',
        service: 'image-generation',
      },
    });
  }),

  // 일괄 이미지 생성
  http.post('/api/storyboard/batch', async ({ request }) => {
    const { panels } = await request.json() as any;

    if (!panels || panels.length === 0) {
      return HttpResponse.json(
        createMockError('생성할 패널이 없습니다', 400),
        { status: 400 }
      );
    }

    // 일괄 생성 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, panels.length * 1000));

    const results = panels.map((panel: any, index: number) => ({
      panelId: panel.id,
      imageUrl: `https://example.com/batch/${panel.id}-${Date.now()}.jpg`,
      status: 'completed',
      order: index + 1,
    }));

    return HttpResponse.json({
      results,
      total: panels.length,
      completed: results.length,
      failed: 0,
      cost: {
        amount: panels.length * 0.25,
        currency: 'USD',
        service: 'batch-image-generation',
      },
    });
  }),

  // 스토리보드 일관성 검사
  http.post('/api/storyboard/consistency', async ({ request }) => {
    const { storyboardId } = await request.json() as any;

    if (!storyboardId) {
      return HttpResponse.json(
        createMockError('스토리보드 ID를 입력해주세요', 400),
        { status: 400 }
      );
    }

    const storyboard = storyboardStore.get(storyboardId);

    if (!storyboard) {
      return HttpResponse.json(
        createMockError('스토리보드를 찾을 수 없습니다', 404),
        { status: 404 }
      );
    }

    // 일관성 분석 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 1500));

    const issues = [];

    // 예시 일관성 검사
    if (storyboard.panels.length < 2) {
      issues.push({
        type: 'warning',
        message: '패널이 너무 적습니다. 최소 2개 이상 권장합니다.',
      });
    }

    const avgDuration = storyboard.totalDuration / storyboard.panels.length;
    if (avgDuration < 3) {
      issues.push({
        type: 'warning',
        message: '패널당 평균 시간이 너무 짧습니다.',
      });
    }

    return HttpResponse.json({
      consistent: issues.length === 0,
      issues,
      score: Math.max(0, 100 - issues.length * 10),
      recommendations: [
        '일관된 카메라 앵글 사용',
        '조명 스타일 통일',
        '색상 팔레트 일관성 유지',
      ],
    });
  }),
];