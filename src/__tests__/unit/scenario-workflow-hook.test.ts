/**
 * 시나리오 워크플로우 훅 단위 테스트
 *
 * 테스트 범위:
 * - useScenarioWorkflow 상태 관리
 * - 단계별 진행 로직
 * - API 호출 및 에러 처리
 * - 자동 저장 기능
 * - 상태 전환 검증
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

import { useScenarioWorkflow } from '@/features/scenario';
import { WORKFLOW_STEPS, type StoryInput, type StoryStep, type Shot } from '@/entities/scenario';

// MSW 서버 설정
const server = setupServer(
  // 성공적인 스토리 생성
  http.post('/api/ai/generate-story', async ({ request }) => {
    const body = await request.json() as StoryInput;

    const mockSteps: StoryStep[] = [
      {
        id: 'step-1',
        title: '설정 및 캐릭터 소개',
        summary: `${body.title}의 배경 설정`,
        content: '첫 번째 단계 내용',
        goal: '캐릭터 소개',
        lengthHint: '25%',
        isEditing: false
      },
      {
        id: 'step-2',
        title: '갈등 발생 및 전개',
        summary: '갈등 시작',
        content: '두 번째 단계 내용',
        goal: '갈등 구조 확립',
        lengthHint: '25%',
        isEditing: false
      },
      {
        id: 'step-3',
        title: '클라이맥스',
        summary: '절정 부분',
        content: '세 번째 단계 내용',
        goal: '극적 긴장',
        lengthHint: '25%',
        isEditing: false
      },
      {
        id: 'step-4',
        title: '해결',
        summary: '결말 부분',
        content: '네 번째 단계 내용',
        goal: '만족스러운 결말',
        lengthHint: '25%',
        isEditing: false
      }
    ];

    await new Promise(resolve => setTimeout(resolve, 100)); // 응답 지연 시뮬레이션

    return HttpResponse.json({
      success: true,
      message: '4단계 스토리가 성공적으로 생성되었습니다!',
      data: { steps: mockSteps }
    });
  }),

  // 12샷 생성
  http.post('/api/ai/generate-shots', async () => {
    const mockShots: Shot[] = Array.from({ length: 12 }, (_, index) => ({
      id: `shot-${index + 1}`,
      stepId: `step-${Math.floor(index / 3) + 1}`,
      title: `샷 ${index + 1}: 테스트 샷`,
      description: `샷 ${index + 1} 설명`,
      shotType: 'Wide Shot',
      camera: 'Static',
      composition: 'Rule of Thirds',
      length: 5,
      dialogue: '',
      subtitle: '',
      transition: 'Cut',
      insertShots: []
    }));

    await new Promise(resolve => setTimeout(resolve, 150)); // 응답 지연 시뮬레이션

    return HttpResponse.json({
      success: true,
      message: '12개의 샷으로 분해되었습니다!',
      data: { shots: mockShots }
    });
  }),

  // 에러 시나리오
  http.post('/api/ai/generate-story-error', () => {
    return HttpResponse.json({
      success: false,
      message: 'API 서비스 오류가 발생했습니다'
    }, { status: 500 });
  })
);

describe('시나리오 워크플로우 훅 단위 테스트', () => {
  beforeEach(() => {
    server.listen();
    // localStorage 초기화
    localStorage.clear();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    server.resetHandlers();
    vi.useRealTimers();
  });

  afterAll(() => {
    server.close();
  });

  describe('초기 상태', () => {
    it('올바른 초기 상태로 시작해야 한다', () => {
      const { result } = renderHook(() => useScenarioWorkflow());

      expect(result.current.currentStep).toBe(WORKFLOW_STEPS.STORY_INPUT);
      expect(result.current.storyInput).toEqual({
        title: '',
        oneLineStory: '',
        toneAndManner: [],
        genre: '',
        target: '',
        duration: '',
        format: '',
        tempo: '',
        developmentMethod: '',
        developmentIntensity: ''
      });
      expect(result.current.storySteps).toEqual([]);
      expect(result.current.shots).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
    });
  });

  describe('스토리 입력 관리', () => {
    it('스토리 입력을 업데이트할 수 있어야 한다', () => {
      const { result } = renderHook(() => useScenarioWorkflow());

      act(() => {
        result.current.updateStoryInput({
          title: '테스트 제목',
          oneLineStory: '테스트 스토리'
        });
      });

      expect(result.current.storyInput.title).toBe('테스트 제목');
      expect(result.current.storyInput.oneLineStory).toBe('테스트 스토리');
    });

    it('스토리 입력 시 자동 저장되어야 한다', () => {
      const { result } = renderHook(() => useScenarioWorkflow());

      act(() => {
        result.current.updateStoryInput({
          title: '자동 저장 테스트',
          oneLineStory: '자동 저장될 스토리'
        });
      });

      // 디바운스 시간 경과
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      const saved = localStorage.getItem('scenario-draft');
      expect(saved).toContain('자동 저장 테스트');
    });
  });

  describe('스토리 생성', () => {
    it('유효한 입력으로 스토리를 생성할 수 있어야 한다', async () => {
      const { result } = renderHook(() => useScenarioWorkflow());

      // 스토리 입력 설정
      act(() => {
        result.current.updateStoryInput({
          title: '테스트 스토리',
          oneLineStory: '흥미진진한 이야기',
          toneAndManner: ['진지한'],
          genre: 'Drama',
          target: 'Adult'
        });
      });

      // 스토리 생성 호출
      act(() => {
        result.current.generateStory();
      });

      // 로딩 상태 확인
      expect(result.current.loading).toBe(true);
      expect(result.current.loadingMessage).toContain('생성');

      // API 응답 대기
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.storySteps).toHaveLength(4);
        expect(result.current.currentStep).toBe(WORKFLOW_STEPS.STORY_REVIEW);
      });

      // 생성된 스토리 단계 확인
      expect(result.current.storySteps[0].title).toBe('설정 및 캐릭터 소개');
      expect(result.current.storySteps[1].title).toBe('갈등 발생 및 전개');
      expect(result.current.storySteps[2].title).toBe('클라이맥스');
      expect(result.current.storySteps[3].title).toBe('해결');
    });

    it('필수 필드가 누락되면 에러가 발생해야 한다', () => {
      const { result } = renderHook(() => useScenarioWorkflow());

      // 제목만 입력하고 스토리는 비움
      act(() => {
        result.current.updateStoryInput({
          title: '제목만 있음',
          oneLineStory: '' // 필수 필드 누락
        });
      });

      act(() => {
        result.current.generateStory();
      });

      expect(result.current.error).toContain('필수');
      expect(result.current.errorType).toBe('validation');
    });

    it('API 에러 시 적절한 에러 처리가 되어야 한다', async () => {
      // 에러 핸들러로 변경
      server.use(
        http.post('/api/ai/generate-story', () => {
          return HttpResponse.json({
            success: false,
            message: 'AI 서비스 오류가 발생했습니다'
          }, { status: 500 });
        })
      );

      const { result } = renderHook(() => useScenarioWorkflow());

      act(() => {
        result.current.updateStoryInput({
          title: '에러 테스트',
          oneLineStory: '에러 발생 시나리오',
          toneAndManner: ['진지한']
        });
      });

      act(() => {
        result.current.generateStory();
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toContain('오류');
        expect(result.current.errorType).toBe('server');
      });
    });
  });

  describe('12샷 생성', () => {
    it('스토리 단계로부터 12샷을 생성할 수 있어야 한다', async () => {
      const { result } = renderHook(() => useScenarioWorkflow());

      // 먼저 스토리를 생성
      act(() => {
        result.current.updateStoryInput({
          title: '테스트',
          oneLineStory: '테스트',
          toneAndManner: ['진지한']
        });
      });

      act(() => {
        result.current.generateStory();
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(result.current.storySteps).toHaveLength(4);
      });

      // 12샷 생성
      act(() => {
        result.current.generateShotsFromSteps();
      });

      expect(result.current.loading).toBe(true);

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.shots).toHaveLength(12);
        expect(result.current.currentStep).toBe(WORKFLOW_STEPS.SHOTS_GENERATION);
      });
    });
  });

  describe('단계 편집 기능', () => {
    it('스토리 단계를 편집 모드로 전환할 수 있어야 한다', () => {
      const { result } = renderHook(() => useScenarioWorkflow());

      // 테스트용 스토리 단계 추가
      const testSteps: StoryStep[] = [
        {
          id: 'step-1',
          title: '테스트 단계',
          summary: '테스트',
          content: '테스트 내용',
          goal: '테스트 목표',
          lengthHint: '25%',
          isEditing: false
        }
      ];

      act(() => {
        // @ts-ignore - 테스트를 위한 직접 상태 설정
        result.current.storySteps = testSteps;
      });

      act(() => {
        result.current.toggleStepEditing('step-1');
      });

      expect(result.current.storySteps[0].isEditing).toBe(true);
    });

    it('스토리 단계 내용을 업데이트할 수 있어야 한다', () => {
      const { result } = renderHook(() => useScenarioWorkflow());

      // 테스트용 스토리 단계 추가
      const testSteps: StoryStep[] = [
        {
          id: 'step-1',
          title: '원본 제목',
          summary: '원본 요약',
          content: '원본 내용',
          goal: '원본 목표',
          lengthHint: '25%',
          isEditing: false
        }
      ];

      act(() => {
        // @ts-ignore - 테스트를 위한 직접 상태 설정
        result.current.storySteps = testSteps;
      });

      act(() => {
        result.current.updateStoryStep('step-1', {
          title: '수정된 제목',
          content: '수정된 내용'
        });
      });

      expect(result.current.storySteps[0].title).toBe('수정된 제목');
      expect(result.current.storySteps[0].content).toBe('수정된 내용');
      expect(result.current.storySteps[0].summary).toBe('원본 요약'); // 변경되지 않은 필드는 유지
    });
  });

  describe('워크플로우 단계 네비게이션', () => {
    it('단계 간 이동이 올바르게 동작해야 한다', () => {
      const { result } = renderHook(() => useScenarioWorkflow());

      // 다음 단계로 이동
      act(() => {
        result.current.goToStep(WORKFLOW_STEPS.STORY_REVIEW);
      });

      expect(result.current.currentStep).toBe(WORKFLOW_STEPS.STORY_REVIEW);

      // 이전 단계로 이동
      act(() => {
        result.current.goToPreviousStep();
      });

      expect(result.current.currentStep).toBe(WORKFLOW_STEPS.STORY_INPUT);
    });
  });

  describe('에러 처리', () => {
    it('에러를 수동으로 지울 수 있어야 한다', () => {
      const { result } = renderHook(() => useScenarioWorkflow());

      // 에러 상태 설정
      act(() => {
        // @ts-ignore - 테스트를 위한 직접 상태 설정
        result.current.error = '테스트 에러';
        result.current.errorType = 'server';
      });

      expect(result.current.error).toBe('테스트 에러');

      // 에러 지우기
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.errorType).toBeNull();
    });

    it('재시도 기능이 올바르게 동작해야 한다', () => {
      const { result } = renderHook(() => useScenarioWorkflow());

      // 에러 상태와 재시도 카운트 설정
      act(() => {
        // @ts-ignore - 테스트를 위한 직접 상태 설정
        result.current.error = '서버 에러';
        result.current.errorType = 'server';
        result.current.retryCount = 1;
      });

      // 재시도
      act(() => {
        result.current.retry();
      });

      expect(result.current.retryCount).toBe(2);
      expect(result.current.error).toBeNull(); // 재시도 시 에러는 클리어됨
    });
  });

  describe('템플릿 기능', () => {
    it('템플릿을 적용할 수 있어야 한다', () => {
      const { result } = renderHook(() => useScenarioWorkflow());

      const testTemplate = {
        id: 'template-1',
        name: '액션 영화 템플릿',
        description: '액션 영화를 위한 기본 템플릿',
        storyInput: {
          title: '템플릿 제목',
          oneLineStory: '템플릿 스토리',
          toneAndManner: ['역동적인', '긴장감 넘치는'],
          genre: 'Action',
          target: 'Adult'
        }
      };

      act(() => {
        result.current.applyTemplate(testTemplate);
      });

      expect(result.current.storyInput.title).toBe('템플릿 제목');
      expect(result.current.storyInput.toneAndManner).toEqual(['역동적인', '긴장감 넘치는']);
      expect(result.current.storyInput.genre).toBe('Action');
    });
  });
});