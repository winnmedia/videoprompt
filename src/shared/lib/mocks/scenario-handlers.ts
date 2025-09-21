/**
 * MSW 시나리오 관련 핸들러
 * 스토리 생성, 샷 분해, 스토리보드 생성 API 모킹
 * FSD shared 레이어 - 테스트용 API 모킹
 */

import { http, HttpResponse, delay } from 'msw';
import { logger } from '@/shared/lib/logger';
import { StoryStep, Shot, StoryboardShot, StoryInput } from '@/entities/scenario';

// =============================================================================
// 모킹 데이터 생성 유틸리티
// =============================================================================

function generateMockStorySteps(storyInput: StoryInput): StoryStep[] {
  const steps: StoryStep[] = [
    {
      id: `step-1-${Date.now()}`,
      title: '설정 및 캐릭터 소개',
      summary: `${storyInput.title}의 배경과 주인공을 소개하는 단계`,
      content: `이 단계에서는 ${storyInput.oneLineStory}의 배경이 되는 상황과 주인공의 성격, 목표를 명확히 제시합니다. ${storyInput.toneAndManner.join(', ')} 톤으로 시청자들이 몰입할 수 있도록 설정을 구축합니다.`,
      goal: '배경 설정과 캐릭터 매력 전달',
      lengthHint: '전체 영상의 약 25% (1/4 단계)',
      isEditing: false,
    },
    {
      id: `step-2-${Date.now() + 1}`,
      title: '갈등 발생 및 전개',
      summary: '주요 갈등이 시작되고 긴장감이 고조되는 단계',
      content: `주인공이 직면한 핵심 문제가 드러나고, ${storyInput.target} 대상에게 적합한 방식으로 갈등이 전개됩니다. ${storyInput.tempo} 템포로 스토리가 진행되며 시청자의 관심을 끌어올립니다.`,
      goal: '갈등 구조 확립 및 긴장감 조성',
      lengthHint: '전체 영상의 약 25% (2/4 단계)',
      isEditing: false,
    },
    {
      id: `step-3-${Date.now() + 2}`,
      title: '클라이맥스 및 전환점',
      summary: '가장 극적인 순간과 이야기의 전환점',
      content: `${storyInput.developmentMethod} 방식으로 스토리가 절정에 도달합니다. ${storyInput.developmentIntensity} 강도로 주인공의 선택과 행동이 결과를 좌우하는 결정적 순간을 보여줍니다.`,
      goal: '극적 긴장의 정점 달성',
      lengthHint: '전체 영상의 약 25% (3/4 단계)',
      isEditing: false,
    },
    {
      id: `step-4-${Date.now() + 3}`,
      title: '해결 및 마무리',
      summary: '갈등이 해결되고 이야기가 완결되는 단계',
      content: `모든 갈등이 해결되고 주인공의 여정이 완성됩니다. ${storyInput.genre} 장르에 맞는 만족스러운 결말로 시청자들에게 깊은 여운을 남깁니다. ${storyInput.format} 형태로 최적화된 마무리입니다.`,
      goal: '만족스러운 결말 및 메시지 전달',
      lengthHint: '전체 영상의 약 25% (4/4 단계)',
      isEditing: false,
    },
  ];

  return steps;
}

function generateMockShots(steps: StoryStep[]): Shot[] {
  const shotTypes = ['Wide Shot', 'Medium Shot', 'Close-up', 'Extreme Close-up', 'Over-the-shoulder', 'Master Shot'];
  const cameras = ['Static', 'Pan Left', 'Pan Right', 'Tilt Up', 'Tilt Down', 'Zoom In', 'Zoom Out', 'Dolly In'];
  const transitions = ['Cut', 'Fade', 'Dissolve', 'Wipe'];

  const shots: Shot[] = [];

  steps.forEach((step, stepIndex) => {
    // 각 단계당 3개씩 총 12개 샷 생성
    for (let i = 0; i < 3; i++) {
      const shotIndex = stepIndex * 3 + i;

      shots.push({
        id: `shot-${shotIndex + 1}-${Date.now() + shotIndex}`,
        stepId: step.id,
        title: `샷 ${shotIndex + 1}: ${step.title.slice(0, 15)}...`,
        description: `${step.summary}의 핵심 장면을 담은 ${shotTypes[shotIndex % shotTypes.length]}입니다. 이 샷은 ${step.goal}을 시각적으로 전달하는 중요한 역할을 합니다.`,
        shotType: shotTypes[shotIndex % shotTypes.length],
        camera: cameras[shotIndex % cameras.length],
        composition: i === 0 ? 'Rule of Thirds' : i === 1 ? 'Center Composition' : 'Leading Lines',
        length: Math.floor(Math.random() * 8) + 3, // 3~10초
        dialogue: shotIndex % 4 === 0 ? `샷 ${shotIndex + 1}의 대화 내용입니다.` : '',
        subtitle: shotIndex % 3 === 0 ? `자막: 샷 ${shotIndex + 1}` : '',
        transition: transitions[shotIndex % transitions.length],
        contiImage: undefined, // 이미지는 스토리보드 단계에서 생성
        insertShots: shotIndex % 5 === 0 ? [
          {
            id: `insert-${shotIndex}-${Date.now()}`,
            purpose: '디테일 강조',
            description: '주요 오브젝트의 클로즈업',
            framing: 'Extreme Close-up'
          }
        ] : [],
      });
    }
  });

  return shots;
}

function generateMockStoryboardShots(shots: Shot[]): StoryboardShot[] {
  return shots.map((shot, index) => ({
    id: `storyboard-${shot.id}`,
    title: shot.title,
    description: shot.description,
    imageUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
        <rect width="100%" height="100%" fill="#e5e7eb"/>
        <rect x="50" y="50" width="924" height="924" fill="#f3f4f6" stroke="#d1d5db" stroke-width="2"/>
        <text x="512" y="400" text-anchor="middle" font-size="32" fill="#374151" font-family="Arial, sans-serif">
          ${shot.shotType}
        </text>
        <text x="512" y="450" text-anchor="middle" font-size="24" fill="#6b7280" font-family="Arial, sans-serif">
          ${shot.camera}
        </text>
        <text x="512" y="500" text-anchor="middle" font-size="18" fill="#9ca3af" font-family="Arial, sans-serif">
          Shot ${index + 1}
        </text>
        <text x="512" y="600" text-anchor="middle" font-size="16" fill="#4b5563" font-family="Arial, sans-serif">
          ${shot.title.length > 40 ? shot.title.slice(0, 40) + '...' : shot.title}
        </text>
      </svg>
    `)}`,
    prompt: `Create a ${shot.shotType.toLowerCase()} showing ${shot.description.slice(0, 100)}. Camera: ${shot.camera}. Style: cinematic, professional filmmaking.`,
    shotType: shot.shotType,
    camera: shot.camera,
    duration: shot.length,
    index,
  }));
}

// =============================================================================
// 시나리오 API 핸들러
// =============================================================================

export const scenarioHandlers = [
  /**
   * 스토리 생성 API
   */
  http.post('/api/ai/generate-story', async ({ request }) => {
    await delay(2000); // AI 처리 시간 시뮬레이션

    try {
      const body = await request.json() as StoryInput;

      // 입력 검증
      if (!body.title?.trim()) {
        return HttpResponse.json({
          success: false,
          message: '제목은 필수입니다',
          data: null
        }, { status: 400 });
      }

      if (!body.oneLineStory?.trim()) {
        return HttpResponse.json({
          success: false,
          message: '한 줄 스토리는 필수입니다',
          data: null
        }, { status: 400 });
      }

      if (!Array.isArray(body.toneAndManner) || body.toneAndManner.length === 0) {
        return HttpResponse.json({
          success: false,
          message: '톤앤매너는 최소 하나 이상 선택해야 합니다',
          data: null
        }, { status: 400 });
      }

      // 테스트 시나리오
      if (body.title === 'NETWORK_ERROR_TEST') {
        return HttpResponse.error();
      }

      if (body.title === 'SERVER_ERROR_TEST') {
        return HttpResponse.json({
          success: false,
          message: 'AI 서비스 일시 장애로 처리할 수 없습니다',
          data: null
        }, { status: 500 });
      }

      if (body.title === 'TIMEOUT_TEST') {
        await delay(35000); // 35초 지연으로 타임아웃 시뮬레이션
        return HttpResponse.json({
          success: false,
          message: '처리 시간이 초과되었습니다',
          data: null
        }, { status: 504 });
      }

      // 성공적인 스토리 생성
      const steps = generateMockStorySteps(body);

      return HttpResponse.json({
        success: true,
        message: '4단계 스토리가 성공적으로 생성되었습니다!',
        data: { steps }
      });

    } catch (error) {
      logger.error('[MSW] Story generation error:', error instanceof Error ? error : new Error(String(error)));
      return HttpResponse.json({
        success: false,
        message: '스토리 생성 중 오류가 발생했습니다',
        data: null
      }, { status: 500 });
    }
  }),

  /**
   * 12샷 분해 API
   */
  http.post('/api/ai/generate-shots', async ({ request }) => {
    await delay(3000); // AI 처리 시간 시뮬레이션

    try {
      const body = await request.json() as {
        structure4: Array<{ title: string; summary: string }>;
        genre: string;
        tone: string;
      };

      // 입력 검증
      if (!Array.isArray(body.structure4) || body.structure4.length !== 4) {
        return HttpResponse.json({
          success: false,
          message: '정확히 4개의 구조가 필요합니다',
          data: null
        }, { status: 400 });
      }

      // 테스트 시나리오
      const testTitle = body.structure4[0]?.title;

      if (testTitle === 'SHOTS_ERROR_TEST') {
        return HttpResponse.json({
          success: false,
          message: '샷 분해 중 AI 서비스 오류가 발생했습니다',
          data: null
        }, { status: 503 });
      }

      // 구조를 StoryStep 형태로 변환하여 샷 생성
      const mockSteps: StoryStep[] = body.structure4.map((item, index) => ({
        id: `step-${index + 1}-${Date.now() + index}`,
        title: item.title,
        summary: item.summary,
        content: item.summary,
        goal: `${index + 1}단계의 목표`,
        lengthHint: `전체 영상의 약 25% (${index + 1}/4 단계)`,
        isEditing: false,
      }));

      const shots = generateMockShots(mockSteps);

      return HttpResponse.json({
        success: true,
        message: `${shots.length}개의 샷으로 분해되었습니다!`,
        data: {
          shots,
          metadata: {
            totalShots: shots.length,
            aiModel: 'gemini-2.0-flash-exp',
            generatedAt: new Date().toISOString(),
            processingTime: 2800,
          }
        }
      });

    } catch (error) {
      logger.error('[MSW] Shots generation error:', error instanceof Error ? error : new Error(String(error)));
      return HttpResponse.json({
        success: false,
        message: '샷 분해 중 오류가 발생했습니다',
        data: null
      }, { status: 500 });
    }
  }),

  /**
   * 스토리보드 이미지 생성 API
   */
  http.post('/api/ai/generate-storyboard', async ({ request }) => {
    await delay(5000); // 이미지 생성 시간 시뮬레이션

    try {
      const body = await request.json() as {
        shots: Array<{
          id: string;
          title: string;
          description: string;
          shotType: string;
          camera: string;
        }>;
      };

      // 입력 검증
      if (!Array.isArray(body.shots) || body.shots.length === 0) {
        return HttpResponse.json({
          success: false,
          message: '생성할 샷 데이터가 필요합니다',
          data: null
        }, { status: 400 });
      }

      // 테스트 시나리오 - 첫 번째 샷의 제목으로 판단
      const firstShotTitle = body.shots[0]?.title;

      if (firstShotTitle?.includes('STORYBOARD_ERROR_TEST')) {
        return HttpResponse.json({
          success: false,
          message: '이미지 생성 서비스 일시 장애',
          data: null
        }, { status: 503 });
      }

      // 부분 실패 시뮬레이션 (10% 확률)
      const shouldSimulatePartialFailure = firstShotTitle?.includes('PARTIAL_FAILURE_TEST');

      // Shot을 StoryboardShot으로 변환하여 이미지 생성
      const mockShots: Shot[] = body.shots.map((shot, index) => ({
        id: shot.id,
        stepId: `step-${Math.floor(index / 3) + 1}`,
        title: shot.title,
        description: shot.description,
        shotType: shot.shotType,
        camera: shot.camera,
        composition: '',
        length: 5,
        dialogue: '',
        subtitle: '',
        transition: 'Cut',
        insertShots: [],
      }));

      let storyboardShots = generateMockStoryboardShots(mockShots);

      // 부분 실패 시뮬레이션
      if (shouldSimulatePartialFailure) {
        // 일부 샷의 이미지 URL을 제거하여 실패 시뮬레이션
        storyboardShots = storyboardShots.map((shot, index) => ({
          ...shot,
          imageUrl: index % 4 === 0 ? undefined : shot.imageUrl, // 4개 중 1개씩 실패
        }));
      }

      return HttpResponse.json({
        success: true,
        message: `${storyboardShots.length}개의 스토리보드가 생성되었습니다!`,
        data: {
          storyboardShots,
          metadata: {
            totalImages: storyboardShots.length,
            successCount: storyboardShots.filter(shot => shot.imageUrl).length,
            failedCount: storyboardShots.filter(shot => !shot.imageUrl).length,
            aiModel: 'imagen-4.0',
            generatedAt: new Date().toISOString(),
            processingTime: 4800,
            style: 'cinematic',
          }
        }
      });

    } catch (error) {
      logger.error('[MSW] Storyboard generation error:', error instanceof Error ? error : new Error(String(error)));
      return HttpResponse.json({
        success: false,
        message: '스토리보드 생성 중 오류가 발생했습니다',
        data: null
      }, { status: 500 });
    }
  }),

  /**
   * 프로젝트 저장 API (스토리 + 샷 + 스토리보드)
   */
  http.post('/api/planning/stories', async ({ request }) => {
    await delay(800); // 저장 시간 시뮬레이션

    try {
      const body = await request.json() as {
        storyInput?: StoryInput;
        steps?: StoryStep[];
        shots?: Shot[];
        storyboardShots?: StoryboardShot[];
        projectId?: string;
      };

      // 입력 검증
      if (!body.storyInput?.title) {
        return HttpResponse.json({
          success: false,
          message: '프로젝트 제목이 필요합니다',
          data: null
        }, { status: 400 });
      }

      // 테스트 시나리오
      if (body.storyInput.title === 'SAVE_ERROR_TEST') {
        return HttpResponse.json({
          success: false,
          message: '프로젝트 저장 중 데이터베이스 오류가 발생했습니다',
          data: null
        }, { status: 500 });
      }

      const projectId = body.projectId || `project-${Date.now()}`;
      const savedAt = new Date().toISOString();

      return HttpResponse.json({
        success: true,
        message: '프로젝트가 성공적으로 저장되었습니다',
        data: {
          projectId,
          savedAt,
          title: body.storyInput.title,
          stepCount: body.steps?.length || 0,
          shotCount: body.shots?.length || 0,
          storyboardCount: body.storyboardShots?.length || 0,
        }
      });

    } catch (error) {
      logger.error('[MSW] Project save error:', error instanceof Error ? error : new Error(String(error)));
      return HttpResponse.json({
        success: false,
        message: '프로젝트 저장 중 오류가 발생했습니다',
        data: null
      }, { status: 500 });
    }
  }),

  /**
   * 프로젝트 불러오기 API
   */
  http.get('/api/planning/stories/:projectId', async ({ params }) => {
    await delay(500); // 로딩 시간 시뮬레이션

    try {
      const { projectId } = params;

      // 테스트 시나리오
      if (projectId === 'NOT_FOUND_TEST') {
        return HttpResponse.json({
          success: false,
          message: '프로젝트를 찾을 수 없습니다',
          data: null
        }, { status: 404 });
      }

      if (projectId === 'ACCESS_DENIED_TEST') {
        return HttpResponse.json({
          success: false,
          message: '프로젝트에 접근할 권한이 없습니다',
          data: null
        }, { status: 403 });
      }

      // 모킹 데이터 생성
      const mockStoryInput: StoryInput = {
        title: '저장된 테스트 프로젝트',
        oneLineStory: '흥미진진한 이야기의 한줄 소개입니다',
        toneAndManner: ['진지한', '감동적인'],
        genre: 'Drama',
        target: 'Adult',
        duration: '3분',
        format: '16:9',
        tempo: '보통',
        developmentMethod: '직선적',
        developmentIntensity: '강함',
      };

      const steps = generateMockStorySteps(mockStoryInput);
      const shots = generateMockShots(steps);
      const storyboardShots = generateMockStoryboardShots(shots);

      return HttpResponse.json({
        success: true,
        message: '프로젝트를 성공적으로 불러왔습니다',
        data: {
          storyInput: mockStoryInput,
          steps,
          shots,
          storyboardShots,
          savedAt: new Date(Date.now() - 86400000).toISOString(), // 하루 전
          projectId: projectId as string,
        }
      });

    } catch (error) {
      logger.error('[MSW] Project load error:', error instanceof Error ? error : new Error(String(error)));
      return HttpResponse.json({
        success: false,
        message: '프로젝트 불러오기 중 오류가 발생했습니다',
        data: null
      }, { status: 500 });
    }
  }),

  /**
   * 프로젝트 목록 조회 API
   */
  http.get('/api/planning/stories', async ({ request }) => {
    await delay(300);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search');

    const mockProjects = Array.from({ length: 25 }, (_, index) => ({
      id: `project-${index + 1}`,
      title: `테스트 프로젝트 ${index + 1}`,
      description: `프로젝트 ${index + 1}의 설명입니다`,
      updatedAt: new Date(Date.now() - index * 3600000).toISOString(),
      status: ['draft', 'story_complete', 'shots_complete', 'storyboard_complete', 'final'][index % 5] as any,
    }));

    // 검색 필터링
    const filteredProjects = search
      ? mockProjects.filter(project =>
          project.title.toLowerCase().includes(search.toLowerCase())
        )
      : mockProjects;

    // 페이지네이션
    const startIndex = (page - 1) * limit;
    const paginatedProjects = filteredProjects.slice(startIndex, startIndex + limit);

    return HttpResponse.json({
      success: true,
      data: {
        stories: paginatedProjects,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(filteredProjects.length / limit),
          totalCount: filteredProjects.length,
          hasNext: startIndex + limit < filteredProjects.length,
          hasPrevious: page > 1,
        }
      }
    });
  }),
];

// =============================================================================
// 에러 테스트용 핸들러
// =============================================================================

export const scenarioErrorHandlers = [
  // 네트워크 에러
  http.post('/api/ai/generate-story', () => HttpResponse.error()),

  // 인증 에러
  http.post('/api/ai/generate-shots', () =>
    HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
  ),

  // Rate Limit 에러
  http.post('/api/ai/generate-storyboard', () =>
    HttpResponse.json({
      success: false,
      message: 'API 호출 제한 초과. 잠시 후 다시 시도해주세요.'
    }, { status: 429 })
  ),
];

// =============================================================================
// 성공 테스트용 핸들러
// =============================================================================

export const scenarioSuccessHandlers = [
  // 즉시 성공
  http.post('/api/ai/generate-story', async ({ request }) => {
    const body = await request.json() as StoryInput;
    const steps = generateMockStorySteps(body);

    return HttpResponse.json({
      success: true,
      message: '스토리가 즉시 생성되었습니다!',
      data: { steps }
    });
  }),

  // 완벽한 12샷 생성
  http.post('/api/ai/generate-shots', async ({ request }) => {
    const body = await request.json() as { structure4: any[] };

    const mockSteps: StoryStep[] = body.structure4.map((item, index) => ({
      id: `step-${index + 1}-${Date.now()}`,
      title: item.title,
      summary: item.summary,
      content: item.summary,
      goal: `목표 ${index + 1}`,
      lengthHint: `25%`,
      isEditing: false,
    }));

    const shots = generateMockShots(mockSteps);

    return HttpResponse.json({
      success: true,
      message: '완벽한 12샷이 생성되었습니다!',
      data: { shots }
    });
  }),

  // 모든 스토리보드 이미지 성공
  http.post('/api/ai/generate-storyboard', async ({ request }) => {
    const body = await request.json() as { shots: any[] };

    const mockShots: Shot[] = body.shots.map((shot, index) => ({
      id: shot.id,
      stepId: `step-${Math.floor(index / 3) + 1}`,
      title: shot.title,
      description: shot.description,
      shotType: shot.shotType,
      camera: shot.camera,
      composition: '',
      length: 5,
      dialogue: '',
      subtitle: '',
      transition: 'Cut',
      insertShots: [],
    }));

    const storyboardShots = generateMockStoryboardShots(mockShots);

    return HttpResponse.json({
      success: true,
      message: '모든 스토리보드가 성공적으로 생성되었습니다!',
      data: { storyboardShots }
    });
  }),
];