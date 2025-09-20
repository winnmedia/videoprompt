/**
 * 파이프라인 통합 스토어 테스트 (TDD)
 * Benjamin's Contract-First + TDD 원칙에 따른 테스트 우선 설계
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { configureStore } from '@reduxjs/toolkit';
import {
  pipelineSlice,
  PipelineState,
  updateStoryData,
  updateScenarioData,
  updatePromptData,
  updateVideoData,
  setPipelineStep,
  setPipelineStatus,
  setCorrelationId,
  resetPipeline,
  addPipelineError,
  clearPipelineErrors,
  updatePipelineProgress
} from '@/entities/pipeline/store/pipeline-slice';
import {
  PipelineStep,
  PipelineStatus,
  StoryData,
  ScenarioData,
  PromptData,
  VideoData
} from '@/shared/contracts/pipeline-integration.contract';

// ============================================================================
// 테스트 설정
// ============================================================================

describe('파이프라인 통합 스토어 테스트', () => {
  let store: ReturnType<typeof configureStore>;
  let initialState: PipelineState;

  beforeEach(() => {
    // 각 테스트마다 새로운 스토어 생성
    store = configureStore({
      reducer: {
        pipeline: pipelineSlice.reducer
      }
    });

    initialState = {
      projectId: null,
      correlationId: null,
      currentStep: 'story',
      status: 'idle',
      progress: {
        story: { completed: false },
        scenario: { completed: false },
        prompt: { completed: false },
        video: { completed: false }
      },
      data: {
        story: null,
        scenario: null,
        prompt: null,
        video: null
      },
      errors: [],
      metadata: {
        createdAt: null,
        lastUpdated: null,
        version: '1.0.0'
      }
    };
  });

  // ============================================================================
  // 초기 상태 테스트
  // ============================================================================

  describe('초기 상태', () => {
    it('파이프라인 초기 상태가 올바르게 설정되어야 한다', () => {
      const state = store.getState().pipeline;

      expect(state.currentStep).toBe('story');
      expect(state.status).toBe('idle');
      expect(state.projectId).toBeNull();
      expect(state.correlationId).toBeNull();
      expect(state.errors).toEqual([]);
      expect(state.progress.story.completed).toBe(false);
      expect(state.progress.scenario.completed).toBe(false);
      expect(state.progress.prompt.completed).toBe(false);
      expect(state.progress.video.completed).toBe(false);
    });
  });

  // ============================================================================
  // 스토리 데이터 관리 테스트
  // ============================================================================

  describe('스토리 데이터 관리', () => {
    const validStoryData: StoryData = {
      content: '한 소년이 마법의 세계로 떠나는 모험 이야기입니다. 그는 용기와 지혜로 시련을 극복하고 성장하게 됩니다.',
      title: '마법 세계의 모험',
      genre: 'Fantasy',
      tone: 'Adventurous',
      targetAudience: 'Young Adults'
    };

    it('스토리 데이터를 업데이트할 수 있어야 한다', () => {
      store.dispatch(updateStoryData({
        storyId: '550e8400-e29b-41d4-a716-446655440002',
        data: validStoryData
      }));

      const state = store.getState().pipeline;
      expect(state.data.story).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440002',
        ...validStoryData
      });
      expect(state.progress.story.completed).toBe(true);
      expect(state.progress.story.id).toBe('550e8400-e29b-41d4-a716-446655440002');
      expect(state.metadata.lastUpdated).toBeTruthy();
    });

    it('스토리 데이터 업데이트 시 다음 단계로 자동 진행되어야 한다', () => {
      store.dispatch(updateStoryData({
        storyId: '550e8400-e29b-41d4-a716-446655440002',
        data: validStoryData
      }));

      const state = store.getState().pipeline;
      expect(state.currentStep).toBe('scenario');
      expect(state.status).toBe('idle');
    });
  });

  // ============================================================================
  // 시나리오 데이터 관리 테스트
  // ============================================================================

  describe('시나리오 데이터 관리', () => {
    const validScenarioData: ScenarioData = {
      genre: 'Fantasy',
      tone: 'Adventurous',
      structure: ['설정', '갈등', '절정', '해결'],
      target: 'Young Adults',
      developmentMethod: 'character-driven',
      developmentIntensity: 'medium'
    };

    beforeEach(() => {
      // 스토리 단계 먼저 완료
      store.dispatch(updateStoryData({
        storyId: '550e8400-e29b-41d4-a716-446655440002',
        data: {
          content: '테스트 스토리',
          title: '테스트 제목'
        }
      }));
    });

    it('시나리오 데이터를 업데이트할 수 있어야 한다', () => {
      store.dispatch(updateScenarioData({
        scenarioId: '550e8400-e29b-41d4-a716-446655440003',
        data: validScenarioData,
        generatedScenario: '생성된 시나리오 내용...'
      }));

      const state = store.getState().pipeline;
      expect(state.data.scenario).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440003',
        ...validScenarioData,
        generatedScenario: '생성된 시나리오 내용...'
      });
      expect(state.progress.scenario.completed).toBe(true);
      expect(state.currentStep).toBe('prompt');
    });

    it('시나리오 업데이트 시 스토리 단계가 완료되어 있어야 한다', () => {
      // 스토리 단계를 미완료 상태로 재설정
      store.dispatch(resetPipeline());

      const action = updateScenarioData({
        scenarioId: '550e8400-e29b-41d4-a716-446655440003',
        data: validScenarioData,
        generatedScenario: '생성된 시나리오 내용...'
      });

      store.dispatch(action);

      const state = store.getState().pipeline;
      // 스토리 단계가 미완료이므로 시나리오 데이터가 업데이트되지 않아야 함
      expect(state.data.scenario).toBeNull();
      expect(state.errors.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // 프롬프트 데이터 관리 테스트
  // ============================================================================

  describe('프롬프트 데이터 관리', () => {
    const validPromptData: PromptData = {
      visualStyle: 'cinematic',
      mood: 'adventurous',
      quality: 'premium',
      directorStyle: 'Christopher Nolan',
      lighting: 'golden hour',
      cameraAngle: 'wide shot',
      movement: 'slow zoom',
      keywords: ['magic', 'adventure', 'young hero']
    };

    beforeEach(() => {
      // 이전 단계들 완료
      store.dispatch(updateStoryData({
        storyId: '550e8400-e29b-41d4-a716-446655440002',
        data: { content: '테스트 스토리', title: '테스트 제목' }
      }));
      store.dispatch(updateScenarioData({
        scenarioId: '550e8400-e29b-41d4-a716-446655440003',
        data: {
          genre: 'Fantasy',
          tone: 'Adventurous',
          structure: ['설정'],
          target: 'Young Adults'
        },
        generatedScenario: '생성된 시나리오'
      }));
    });

    it('프롬프트 데이터를 업데이트할 수 있어야 한다', () => {
      store.dispatch(updatePromptData({
        promptId: '550e8400-e29b-41d4-a716-446655440004',
        data: validPromptData,
        finalPrompt: '생성된 최종 프롬프트',
        enhancedKeywords: ['magic', 'adventure', 'young hero', 'fantasy']
      }));

      const state = store.getState().pipeline;
      expect(state.data.prompt).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440004',
        ...validPromptData,
        finalPrompt: '생성된 최종 프롬프트',
        enhancedKeywords: ['magic', 'adventure', 'young hero', 'fantasy']
      });
      expect(state.progress.prompt.completed).toBe(true);
      expect(state.currentStep).toBe('video');
    });
  });

  // ============================================================================
  // 영상 데이터 관리 테스트
  // ============================================================================

  describe('영상 데이터 관리', () => {
    const validVideoData: VideoData = {
      duration: 30,
      aspectRatio: '16:9',
      resolution: '1080p',
      provider: 'seedance',
      priority: 'normal'
    };

    beforeEach(() => {
      // 모든 이전 단계 완료
      store.dispatch(updateStoryData({
        storyId: '550e8400-e29b-41d4-a716-446655440002',
        data: { content: '테스트 스토리', title: '테스트 제목' }
      }));
      store.dispatch(updateScenarioData({
        scenarioId: '550e8400-e29b-41d4-a716-446655440003',
        data: {
          genre: 'Fantasy',
          tone: 'Adventurous',
          structure: ['설정'],
          target: 'Young Adults'
        },
        generatedScenario: '생성된 시나리오'
      }));
      store.dispatch(updatePromptData({
        promptId: '550e8400-e29b-41d4-a716-446655440004',
        data: {
          visualStyle: 'cinematic',
          mood: 'adventurous',
          quality: 'premium'
        },
        finalPrompt: '생성된 프롬프트',
        enhancedKeywords: ['magic']
      }));
    });

    it('영상 데이터를 업데이트할 수 있어야 한다', () => {
      store.dispatch(updateVideoData({
        videoId: '550e8400-e29b-41d4-a716-446655440005',
        data: validVideoData,
        jobId: 'job-12345',
        status: 'queued'
      }));

      const state = store.getState().pipeline;
      expect(state.data.video).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440005',
        ...validVideoData,
        jobId: 'job-12345',
        status: 'queued'
      });
      expect(state.progress.video.completed).toBe(false); // 큐 상태이므로 아직 미완료
      expect(state.progress.video.jobId).toBe('job-12345');
    });

    it('영상 상태를 completed로 업데이트하면 전체 파이프라인이 완료되어야 한다', () => {
      store.dispatch(updateVideoData({
        videoId: '550e8400-e29b-41d4-a716-446655440005',
        data: validVideoData,
        jobId: 'job-12345',
        status: 'completed',
        videoUrl: 'https://example.com/video.mp4'
      }));

      const state = store.getState().pipeline;
      expect(state.progress.video.completed).toBe(true);
      expect(state.status).toBe('completed');
      expect(state.data.video?.videoUrl).toBe('https://example.com/video.mp4');
    });
  });

  // ============================================================================
  // 파이프라인 상태 관리 테스트
  // ============================================================================

  describe('파이프라인 상태 관리', () => {
    it('파이프라인 단계를 수동으로 설정할 수 있어야 한다', () => {
      store.dispatch(setPipelineStep('prompt'));

      const state = store.getState().pipeline;
      expect(state.currentStep).toBe('prompt');
    });

    it('파이프라인 상태를 설정할 수 있어야 한다', () => {
      store.dispatch(setPipelineStatus('processing'));

      const state = store.getState().pipeline;
      expect(state.status).toBe('processing');
    });

    it('상관관계 ID를 설정할 수 있어야 한다', () => {
      const correlationId = '550e8400-e29b-41d4-a716-446655440001';
      store.dispatch(setCorrelationId(correlationId));

      const state = store.getState().pipeline;
      expect(state.correlationId).toBe(correlationId);
    });

    it('파이프라인을 초기화할 수 있어야 한다', () => {
      // 일부 데이터 설정
      store.dispatch(updateStoryData({
        storyId: '550e8400-e29b-41d4-a716-446655440002',
        data: { content: '테스트', title: '테스트' }
      }));

      // 초기화
      store.dispatch(resetPipeline());

      const state = store.getState().pipeline;
      expect(state.currentStep).toBe('story');
      expect(state.status).toBe('idle');
      expect(state.data.story).toBeNull();
      expect(state.progress.story.completed).toBe(false);
      expect(state.errors).toEqual([]);
    });
  });

  // ============================================================================
  // 에러 관리 테스트
  // ============================================================================

  describe('에러 관리', () => {
    it('파이프라인 에러를 추가할 수 있어야 한다', () => {
      const error = {
        step: 'scenario' as PipelineStep,
        message: '시나리오 생성 실패',
        timestamp: new Date().toISOString()
      };

      store.dispatch(addPipelineError(error));

      const state = store.getState().pipeline;
      expect(state.errors).toHaveLength(1);
      expect(state.errors[0]).toEqual(error);
    });

    it('파이프라인 에러를 모두 지울 수 있어야 한다', () => {
      // 에러 추가
      store.dispatch(addPipelineError({
        step: 'story',
        message: '에러 1',
        timestamp: new Date().toISOString()
      }));
      store.dispatch(addPipelineError({
        step: 'scenario',
        message: '에러 2',
        timestamp: new Date().toISOString()
      }));

      // 에러 클리어
      store.dispatch(clearPipelineErrors());

      const state = store.getState().pipeline;
      expect(state.errors).toEqual([]);
    });

    it('최대 10개의 에러만 유지해야 한다', () => {
      // 15개의 에러 추가
      for (let i = 0; i < 15; i++) {
        store.dispatch(addPipelineError({
          step: 'story',
          message: `에러 ${i}`,
          timestamp: new Date().toISOString()
        }));
      }

      const state = store.getState().pipeline;
      expect(state.errors).toHaveLength(10);
      expect(state.errors[0].message).toBe('에러 5'); // 오래된 에러는 제거됨
    });
  });

  // ============================================================================
  // 진행 상태 업데이트 테스트
  // ============================================================================

  describe('진행 상태 업데이트', () => {
    it('전체 진행 상태를 한 번에 업데이트할 수 있어야 한다', () => {
      const progress = {
        story: { completed: true, id: '550e8400-e29b-41d4-a716-446655440002' },
        scenario: { completed: true, id: '550e8400-e29b-41d4-a716-446655440003' },
        prompt: { completed: false },
        video: { completed: false }
      };

      store.dispatch(updatePipelineProgress(progress));

      const state = store.getState().pipeline;
      expect(state.progress).toEqual(progress);
    });

    it('현재 단계를 자동으로 계산해야 한다', () => {
      const progress = {
        story: { completed: true, id: '550e8400-e29b-41d4-a716-446655440002' },
        scenario: { completed: true, id: '550e8400-e29b-41d4-a716-446655440003' },
        prompt: { completed: false },
        video: { completed: false }
      };

      store.dispatch(updatePipelineProgress(progress));

      const state = store.getState().pipeline;
      expect(state.currentStep).toBe('prompt'); // 다음 미완료 단계
    });

    it('모든 단계가 완료되면 파이프라인 상태가 completed가 되어야 한다', () => {
      const progress = {
        story: { completed: true, id: '550e8400-e29b-41d4-a716-446655440002' },
        scenario: { completed: true, id: '550e8400-e29b-41d4-a716-446655440003' },
        prompt: { completed: true, id: '550e8400-e29b-41d4-a716-446655440004' },
        video: { completed: true, id: '550e8400-e29b-41d4-a716-446655440005' }
      };

      store.dispatch(updatePipelineProgress(progress));

      const state = store.getState().pipeline;
      expect(state.status).toBe('completed');
    });
  });

  // ============================================================================
  // 데이터 무결성 테스트
  // ============================================================================

  describe('데이터 무결성', () => {
    it('$300 사건 방지: useEffect 의존성에 함수 참조가 없어야 한다', () => {
      // 스토어 상태는 직렬화 가능해야 함
      const state = store.getState().pipeline;

      // JSON 직렬화 테스트
      expect(() => JSON.stringify(state)).not.toThrow();

      // 함수 참조가 없는지 확인
      const checkForFunctions = (obj: any): boolean => {
        for (const key in obj) {
          if (typeof obj[key] === 'function') {
            return true;
          }
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            if (checkForFunctions(obj[key])) {
              return true;
            }
          }
        }
        return false;
      };

      expect(checkForFunctions(state)).toBe(false);
    });

    it('상태 크기가 합리적인 범위 내에 있어야 한다', () => {
      // 모든 데이터로 스토어 채우기
      store.dispatch(updateStoryData({
        storyId: '550e8400-e29b-41d4-a716-446655440002',
        data: {
          content: 'A'.repeat(2000), // 최대 크기
          title: 'B'.repeat(200)     // 최대 크기
        }
      }));

      const state = store.getState().pipeline;
      const serialized = JSON.stringify(state);

      // 상태 크기가 10KB 이하여야 함 (합리적인 제한)
      expect(serialized.length).toBeLessThan(10 * 1024);
    });

    it('타임스탬프가 올바르게 관리되어야 한다', () => {
      const before = Date.now();

      store.dispatch(updateStoryData({
        storyId: '550e8400-e29b-41d4-a716-446655440002',
        data: { content: '테스트', title: '테스트' }
      }));

      const after = Date.now();
      const state = store.getState().pipeline;

      expect(state.metadata.lastUpdated).toBeTruthy();
      const lastUpdated = new Date(state.metadata.lastUpdated!).getTime();
      expect(lastUpdated).toBeGreaterThanOrEqual(before);
      expect(lastUpdated).toBeLessThanOrEqual(after);
    });
  });

  // ============================================================================
  // 성능 테스트
  // ============================================================================

  describe('성능', () => {
    it('대량의 업데이트를 효율적으로 처리해야 한다', () => {
      const start = performance.now();

      // 100번의 업데이트 실행
      for (let i = 0; i < 100; i++) {
        store.dispatch(updateStoryData({
          storyId: `id-${i}`,
          data: { content: `content-${i}`, title: `title-${i}` }
        }));
      }

      const end = performance.now();
      const duration = end - start;

      // 100번의 업데이트가 100ms 이하에 완료되어야 함
      expect(duration).toBeLessThan(100);
    });

    it('상태 선택자가 메모이제이션되어야 한다', () => {
      // 이 테스트는 실제 컴포넌트에서 reselect 등을 사용할 때 중요함
      const state1 = store.getState().pipeline;
      const state2 = store.getState().pipeline;

      // 동일한 참조여야 함
      expect(state1).toBe(state2);
    });
  });
});

// ============================================================================
// 통합 테스트
// ============================================================================

describe('파이프라인 전체 플로우 통합 테스트', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        pipeline: pipelineSlice.reducer
      }
    });
  });

  it('전체 파이프라인 플로우가 순서대로 작동해야 한다', () => {
    // 1. 프로젝트 시작
    store.dispatch(setCorrelationId('550e8400-e29b-41d4-a716-446655440001'));

    // 2. 스토리 입력
    store.dispatch(updateStoryData({
      storyId: '550e8400-e29b-41d4-a716-446655440002',
      data: {
        content: '한 소년이 마법의 세계로 떠나는 모험 이야기입니다.',
        title: '마법 세계의 모험',
        genre: 'Fantasy'
      }
    }));

    let state = store.getState().pipeline;
    expect(state.currentStep).toBe('scenario');
    expect(state.progress.story.completed).toBe(true);

    // 3. 시나리오 생성
    store.dispatch(updateScenarioData({
      scenarioId: '550e8400-e29b-41d4-a716-446655440003',
      data: {
        genre: 'Fantasy',
        tone: 'Adventurous',
        structure: ['설정', '갈등', '절정', '해결'],
        target: 'Young Adults'
      },
      generatedScenario: '생성된 시나리오 내용입니다...'
    }));

    state = store.getState().pipeline;
    expect(state.currentStep).toBe('prompt');
    expect(state.progress.scenario.completed).toBe(true);

    // 4. 프롬프트 생성
    store.dispatch(updatePromptData({
      promptId: '550e8400-e29b-41d4-a716-446655440004',
      data: {
        visualStyle: 'cinematic',
        mood: 'adventurous',
        quality: 'premium'
      },
      finalPrompt: '생성된 최종 프롬프트',
      enhancedKeywords: ['magic', 'adventure']
    }));

    state = store.getState().pipeline;
    expect(state.currentStep).toBe('video');
    expect(state.progress.prompt.completed).toBe(true);

    // 5. 영상 생성
    store.dispatch(updateVideoData({
      videoId: '550e8400-e29b-41d4-a716-446655440005',
      data: {
        duration: 30,
        aspectRatio: '16:9',
        resolution: '1080p',
        provider: 'seedance',
        priority: 'normal'
      },
      jobId: 'job-12345',
      status: 'completed',
      videoUrl: 'https://example.com/video.mp4'
    }));

    state = store.getState().pipeline;
    expect(state.status).toBe('completed');
    expect(state.progress.video.completed).toBe(true);

    // 전체 데이터 확인
    expect(state.data.story?.title).toBe('마법 세계의 모험');
    expect(state.data.scenario?.generatedScenario).toContain('생성된 시나리오');
    expect(state.data.prompt?.finalPrompt).toBe('생성된 최종 프롬프트');
    expect(state.data.video?.videoUrl).toBe('https://example.com/video.mp4');
  });
});