/**
 * 시나리오 API 핸들러
 * TDD 및 결정론적 테스트를 위한 시나리오 관련 API 모킹
 * UserJourneyMap 3-4단계 대응
 */

import { http, HttpResponse } from 'msw';
import { createMockScenario, createMockError } from '../data/factories';
import { withCostSafety } from './cost-safety';
// TODO: 해결해야 할 임포트 충돌 - scenario.ts vs scenario/ 디렉토리
// import type { ScenarioGenerationRequest, ScenarioGenerationResponse } from '../../entities/scenario';
// import { createScenarioId } from '../../entities/scenario';

// 임시 타입 정의
type ScenarioGenerationRequest = any;
type ScenarioGenerationResponse = any;

// 임시 함수 정의
const createScenarioId = () => 'scenario-' + Date.now();

// 시나리오 저장소
const scenarioStore = new Map<string, any>();

// 기본 테스트 시나리오 생성
const seedData = () => {
  if (scenarioStore.size === 0) {
    const scenarios = [
      createMockScenario('travel-jeju'),
      createMockScenario('cooking-show'),
      createMockScenario('tech-review'),
    ];

    scenarios.forEach(scenario => {
      scenarioStore.set(scenario.id, scenario);
    });
  }
};

export const scenarioHandlers = [
  // 시나리오 목록 조회
  http.get('/api/planning/scenarios', ({ request }) => {
    seedData();
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    const scenarios = Array.from(scenarioStore.values());
    const filteredScenarios = userId
      ? scenarios.filter(s => s.userId === userId)
      : scenarios;

    return HttpResponse.json({
      scenarios: filteredScenarios,
      total: filteredScenarios.length,
    });
  }),

  // 시나리오 단일 조회
  http.get('/api/planning/scenarios/:id', ({ params }) => {
    const { id } = params;
    const scenario = scenarioStore.get(id as string);

    if (!scenario) {
      return HttpResponse.json(
        createMockError('시나리오를 찾을 수 없습니다', 404),
        { status: 404 }
      );
    }

    return HttpResponse.json({ scenario });
  }),

  // 시나리오 생성
  http.post('/api/planning/scenarios', async ({ request }) => {
    const data = await request.json() as any;

    if (!data.title || !data.description) {
      return HttpResponse.json(
        createMockError('제목과 설명을 입력해주세요', 400),
        { status: 400 }
      );
    }

    const scenario = createMockScenario(data.title.toLowerCase().replace(/\s+/g, '-'));
    scenario.title = data.title;
    scenario.description = data.description;
    scenario.genre = data.genre || '일반';
    scenario.style = data.style || 'documentary';
    scenario.targetAudience = data.targetAudience || '일반';

    scenarioStore.set(scenario.id, scenario);

    return HttpResponse.json({ scenario }, { status: 201 });
  }),

  // 시나리오 수정
  http.put('/api/planning/scenarios/:id', async ({ params, request }) => {
    const { id } = params;
    const data = await request.json() as any;
    const existingScenario = scenarioStore.get(id as string);

    if (!existingScenario) {
      return HttpResponse.json(
        createMockError('시나리오를 찾을 수 없습니다', 404),
        { status: 404 }
      );
    }

    const updatedScenario = {
      ...existingScenario,
      ...data,
      id: existingScenario.id, // ID는 변경 불가
      updatedAt: new Date().toISOString(),
    };

    scenarioStore.set(id as string, updatedScenario);

    return HttpResponse.json({ scenario: updatedScenario });
  }),

  // 시나리오 삭제
  http.delete('/api/planning/scenarios/:id', ({ params }) => {
    const { id } = params;
    const scenario = scenarioStore.get(id as string);

    if (!scenario) {
      return HttpResponse.json(
        createMockError('시나리오를 찾을 수 없습니다', 404),
        { status: 404 }
      );
    }

    scenarioStore.delete(id as string);

    return HttpResponse.json({ message: '시나리오가 삭제되었습니다' });
  }),

  // AI 스토리 생성 - 비용 안전 적용
  http.post('/api/ai/generate-story', withCostSafety('/api/ai/generate-story', async ({ request }: any) => {
    const { prompt, genre, style, duration } = await request.json();

    if (!prompt) {
      return HttpResponse.json(
        createMockError('스토리 프롬프트를 입력해주세요', 400),
        { status: 400 }
      );
    }

    // AI 생성 시뮬레이션 (지연 추가)
    await new Promise(resolve => setTimeout(resolve, 1000));

    const generatedScenario = createMockScenario(prompt.toLowerCase().replace(/\s+/g, '-'));
    generatedScenario.title = `AI 생성: ${prompt}`;
    generatedScenario.description = `AI가 생성한 ${genre || '일반'} 장르의 스토리`;
    generatedScenario.genre = genre || '일반';
    generatedScenario.style = style || 'documentary';
    generatedScenario.duration = duration || 300;

    // 프롬프트 기반 장면 생성
    generatedScenario.scenes = [
      {
        ...generatedScenario.scenes[0],
        title: `${prompt} - 시작`,
        content: `${prompt}에 대한 흥미로운 오프닝`,
      },
      {
        ...generatedScenario.scenes[1],
        title: `${prompt} - 전개`,
        content: `${prompt}의 핵심 내용 전개`,
      },
      {
        ...generatedScenario.scenes[2],
        title: `${prompt} - 절정`,
        content: `${prompt}의 가장 중요한 순간`,
      },
      {
        ...generatedScenario.scenes[3],
        title: `${prompt} - 마무리`,
        content: `${prompt}에 대한 만족스러운 결말`,
      },
    ];

    scenarioStore.set(generatedScenario.id, generatedScenario);

    return HttpResponse.json({
      scenario: generatedScenario,
      cost: {
        amount: 1.0,
        currency: 'USD',
        service: 'ai-story-generation',
      },
    });
  })),

  // 시나리오 복제
  http.post('/api/planning/scenarios/:id/duplicate', ({ params }) => {
    const { id } = params;
    const originalScenario = scenarioStore.get(id as string);

    if (!originalScenario) {
      return HttpResponse.json(
        createMockError('시나리오를 찾을 수 없습니다', 404),
        { status: 404 }
      );
    }

    const duplicatedScenario = createMockScenario(`${originalScenario.title}-copy`);
    duplicatedScenario.title = `${originalScenario.title} (복사본)`;
    duplicatedScenario.description = originalScenario.description;
    duplicatedScenario.genre = originalScenario.genre;
    duplicatedScenario.style = originalScenario.style;
    duplicatedScenario.scenes = originalScenario.scenes.map((scene: any) => ({
      ...scene,
      id: `${duplicatedScenario.id}-scene-${scene.order}`,
    }));

    scenarioStore.set(duplicatedScenario.id, duplicatedScenario);

    return HttpResponse.json({ scenario: duplicatedScenario }, { status: 201 });
  }),

  // 시나리오 검증
  http.post('/api/planning/scenarios/validate', async ({ request }) => {
    const scenario = await request.json() as any;

    const errors = [];

    if (!scenario.title) errors.push('제목이 필요합니다');
    if (!scenario.description) errors.push('설명이 필요합니다');
    if (!scenario.scenes || scenario.scenes.length === 0) errors.push('최소 1개의 장면이 필요합니다');

    const totalDuration = scenario.scenes?.reduce((sum: number, scene: any) => sum + (scene.duration || 0), 0) || 0;
    if (totalDuration > 3600) errors.push('총 시간이 1시간을 초과할 수 없습니다');

    return HttpResponse.json({
      valid: errors.length === 0,
      errors,
      warnings: totalDuration > 1800 ? ['시간이 30분을 초과합니다. 더 짧게 만드는 것을 고려해보세요.'] : [],
    });
  }),

  // NEW: UserJourneyMap 3-4단계 시나리오 생성 API
  http.post('/api/scenario/generate', withCostSafety('/api/scenario/generate', async ({ request }: any) => {
    try {
      const body = await request.json() as ScenarioGenerationRequest;

      // 간단한 유효성 검사
      if (!body.title || !body.content) {
        return HttpResponse.json(
          {
            success: false,
            error: {
              message: '제목과 내용은 필수입니다',
              timestamp: new Date().toISOString(),
            },
          },
          { status: 400 }
        );
      }

      if (body.content.length < 50) {
        return HttpResponse.json(
          {
            success: false,
            error: {
              message: '내용은 최소 50자 이상이어야 합니다',
              timestamp: new Date().toISOString(),
            },
          },
          { status: 400 }
        );
      }

      // 지연 시뮬레이션 (실제 AI API 호출과 유사하게)
      await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

      // 장르별 목 데이터 생성
      const mockResponse = generateMockScenarioResponse(body);

      return HttpResponse.json({
        success: true,
        data: {
          scenario: mockResponse.scenario,
          feedback: mockResponse.feedback,
          suggestions: mockResponse.suggestions,
          alternatives: mockResponse.alternatives,
          meta: {
            generationTime: Date.now(),
            userId: 'mock_user',
            requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          },
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            message: '서버 내부 오류가 발생했습니다',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 500 }
      );
    }
  })),

  // NEW: 시나리오 생성 API 상태 확인
  http.get('/api/scenario/generate', () => {
    return HttpResponse.json({
      service: 'scenario-generation',
      status: 'healthy',
      version: '1.0.0',
      features: {
        geminiIntegration: true,
        costSafety: true,
        rateLimiting: true,
        zodValidation: true,
      },
      limits: {
        requestsPerMinute: 5,
        maxTitleLength: 100,
        maxContentLength: 5000,
        minContentLength: 50,
      },
      timestamp: new Date().toISOString(),
    });
  }),
];

// 목 시나리오 응답 생성 함수
function generateMockScenarioResponse(request: ScenarioGenerationRequest): ScenarioGenerationResponse {
  const now = new Date().toISOString();

  // 장르별 샘플 시나리오 내용
  const genreContent: Record<string, string> = {
    drama: `한국의 작은 시골 마을에 살고 있는 17세 소녀 민지는 항상 큰 꿈을 품고 있었다.

**도입부:**
민지는 매일 아침 할머니와 함께 밭일을 하며 하루를 시작한다. 하지만 그녀의 마음 한편에는 언제나 서울에서 연기자가 되고 싶다는 꿈이 자리잡고 있다. 친구들은 현실적이지 못한 꿈이라며 만류하지만, 민지의 의지는 꺾이지 않는다.

**전개부:**
어느 날, 마을에 영화 촬영팀이 들어온다. 민지는 우연히 단역 배우로 캐스팅되면서 처음으로 연기의 세계를 경험한다. 그 과정에서 자신의 재능을 발견하고, 더욱 확신을 갖게 된다.

**위기:**
하지만 할머니가 갑자기 쓰러지시고, 민지는 꿈과 가족 사이에서 선택의 기로에 놓인다. 서울로 떠날 기회가 생겼지만, 할머니를 돌봐야 하는 현실적 책임감 때문에 고민에 빠진다.

**해결:**
민지는 할머니와 깊은 대화를 나눈다. 할머니는 젊은 시절 자신도 꿈이 있었지만 포기했던 이야기를 들려주며, 민지에게 꿈을 포기하지 말라고 격려한다. 민지는 당분간 마을에 머물며 할머니를 돌보되, 온라인으로 연기를 배우고 지역 극단 활동을 통해 꿈을 이어나가기로 결심한다.`,

    comedy: `서울 강남의 고급 펜트하우스에 사는 30대 재벌 2세 준호는 모든 것을 가졌지만, 사랑만은 얻지 못한 남자다.

**도입부:**
준호는 아버지가 정해준 결혼 상대와의 만남을 피하기 위해 가짜 연인이 필요하다. 그런데 우연히 만난 아르바이트생 수지는 돈 때문에 가짜 연인 역할을 수락한다.

**전개부:**
처음에는 서로를 견딜 수 없었던 두 사람. 준호는 수지의 솔직함에 당황하고, 수지는 준호의 버릇없는 행동에 화가 난다. 하지만 가족들 앞에서 연기하면서 점점 서로에게 마음을 열게 된다.

**위기:**
준호의 아버지가 수지의 정체를 알게 되고, 두 사람의 관계가 거짓이었다는 것이 밝혀진다. 수지는 돈만 받고 떠나려 하고, 준호는 진짜 감정을 깨달았지만 이미 늦었다고 생각한다.

**해결:**
공항에서 수지를 놓친 준호는 그녀가 일하는 편의점을 찾아간다. 그곳에서 진심을 고백하고, 수지도 자신의 마음을 인정한다. 두 사람은 신분의 차이를 극복하고 진짜 사랑을 시작한다.`,

    thriller: `서울 도심의 한 고급 아파트에서 벌어진 연쇄 살인 사건. 경찰은 범인을 잡기 위해 최선을 다하지만, 범인은 한 발 앞서 있다.

**도입부:**
형사 강우진은 3년 전 자신의 파트너를 잃은 트라우마로 고생하고 있다. 그런 그에게 새로운 연쇄 살인 사건이 배정된다. 범인은 매번 같은 방식으로 피해자를 살해하고, 현장에 수수께끼 같은 메시지를 남긴다.

**전개부:**
수사가 진행될수록 범인이 강우진을 타겟으로 하고 있다는 것이 밝혀진다. 범인은 강우진의 과거와 연결된 인물이며, 복수를 위해 계획적으로 범행을 저지르고 있었다.

**위기:**
범인이 강우진의 가족을 납치한다. 강우진은 혼자서 범인을 추적해야 하는 상황에 놓인다. 시간은 24시간, 범인이 제시한 조건을 맞추지 못하면 가족의 생명이 위험하다.

**해결:**
강우진은 범인의 정체를 알아내고, 그가 3년 전 사건의 진범이었다는 것을 깨닫는다. 최후의 대결에서 강우진은 과거의 트라우마를 극복하고 범인을 제압한다. 가족을 구하고 진실을 밝혀낸다.`,
  };

  const content = genreContent[request.genre] || genreContent.drama;

  // 구조별 예상 시간 계산
  const structureDuration: Record<string, number> = {
    traditional: 15,
    'three-act': 12,
    'free-form': 18,
    episodic: 20,
    circular: 14,
    'non-linear': 16,
    montage: 10,
    vignette: 8,
  };

  // 강도별 품질 점수 조정
  const intensityBonus: Record<string, number> = {
    low: 5,
    medium: 0,
    high: 10,
  };

  const baseScore = 75 + Math.floor(Math.random() * 20);
  const qualityScore = Math.min(100, baseScore + intensityBonus[request.intensity]);

  return {
    scenario: {
      id: createScenarioId(),
      title: request.title,
      content,
      userId: 'mock_user',
      createdAt: now,
      updatedAt: now,
      status: 'completed',
      metadata: {
        genre: request.genre,
        style: request.style,
        target: request.target,
        structure: request.structure,
        intensity: request.intensity,
        estimatedDuration: structureDuration[request.structure] || 15,
        qualityScore,
        tokens: Math.floor(content.length / 4), // 대략적인 토큰 수
        cost: 0.05 + Math.random() * 0.1, // $0.05-0.15
      },
    },
    feedback: [
      '캐릭터의 내적 갈등이 잘 표현되었습니다',
      '현실적이면서도 희망적인 결말이 인상적입니다',
      '세부적인 감정 묘사를 보완하면 더욱 좋겠습니다',
    ],
    suggestions: [
      '배경 설정을 더 구체적으로 묘사해보세요',
      '주인공의 성장 과정을 강조해보세요',
      '갈등 해결 과정을 더 자연스럽게 연결해보세요',
    ],
    alternatives: [
      {
        intensity: request.intensity === 'medium' ? 'high' : 'medium',
        structure: request.structure,
      },
      {
        intensity: request.intensity,
        structure: request.structure === 'traditional' ? 'three-act' : 'traditional',
      },
    ],
  };
}