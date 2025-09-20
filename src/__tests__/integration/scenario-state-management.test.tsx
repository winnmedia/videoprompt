/**
 * 시나리오 상태 관리 통합 테스트
 * Redux Toolkit + React Query + MSW를 사용한 완전한 워크플로우 테스트
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Store slices
import { scenarioReducer, storyReducer, storyboardReducer } from '@/entities/scenario';
import uiReducer from '@/app/store/ui-slice';

// Hooks
import { useStoryGeneration, useStorySave } from '@/features/scenario/hooks/use-story-generation';
import { useShotGeneration, useStoryboardGeneration } from '@/features/scenario/hooks/use-storyboard-generation';

// Types
import { StoryInput, StoryStep } from '@/entities/scenario';

// Test setup
import { server } from '@/shared/lib/mocks/server';
import { scenarioSuccessHandlers, scenarioErrorHandlers } from '@/shared/lib/mocks/scenario-handlers';

describe('시나리오 상태 관리 통합 테스트', () => {
  let store: ReturnType<typeof configureStore>;
  let queryClient: QueryClient;

  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </Provider>
  );

  beforeEach(() => {
    // Redux store 설정
    store = configureStore({
      reducer: {
        scenario: scenarioReducer,
        story: storyReducer,
        storyboard: storyboardReducer,
        ui: uiReducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: {
            ignoredActions: ['ui/addToast'],
          },
        }),
    });

    // React Query client 설정
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          cacheTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });

    // MSW 서버 리셋
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('성공 시나리오 테스트', () => {
    beforeEach(() => {
      server.use(...scenarioSuccessHandlers);
    });

    test('완전한 시나리오 워크플로우: 스토리 생성 → 샷 분해 → 스토리보드 생성', async () => {
      const mockStoryInput: StoryInput = {
        title: '테스트 스토리',
        oneLineStory: '흥미진진한 모험 이야기',
        toneAndManner: ['진지한', '감동적인'],
        genre: 'Drama',
        target: 'Adult',
        duration: '3분',
        format: '16:9',
        tempo: '보통',
        developmentMethod: '직선적',
        developmentIntensity: '강함',
      };

      // 1단계: 스토리 생성 테스트
      const { result: storyResult } = renderHook(() => useStoryGeneration(), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        storyResult.current.mutate(mockStoryInput);
      });

      await waitFor(() => {
        expect(storyResult.current.isSuccess).toBe(true);
        expect(storyResult.current.data).toBeDefined();
        expect(storyResult.current.data).toHaveLength(4);
      });

      const storySteps = storyResult.current.data!;

      // 2단계: 샷 분해 테스트
      const { result: shotResult } = renderHook(() => useShotGeneration(), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        shotResult.current.mutate(storySteps);
      });

      await waitFor(() => {
        expect(shotResult.current.isSuccess).toBe(true);
        expect(shotResult.current.data).toBeDefined();
        expect(shotResult.current.data).toHaveLength(12);
      });

      const shots = shotResult.current.data!;

      // 3단계: 스토리보드 생성 테스트
      const { result: storyboardResult } = renderHook(() => useStoryboardGeneration(), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        storyboardResult.current.mutate(shots);
      });

      await waitFor(() => {
        expect(storyboardResult.current.isSuccess).toBe(true);
        expect(storyboardResult.current.data).toBeDefined();
        expect(storyboardResult.current.data).toHaveLength(12);
      });

      // 4단계: Redux 상태 확인
      const state = store.getState();

      // 스토리 상태 확인
      expect(state.story.steps).toHaveLength(4);
      expect(state.story.isLoading).toBe(false);
      expect(state.story.error).toBeNull();

      // 스토리보드 상태 확인
      expect(state.storyboard.shots).toHaveLength(12);
      expect(state.storyboard.storyboardShots).toHaveLength(12);
      expect(state.storyboard.isLoading).toBe(false);
      expect(state.storyboard.error).toBeNull();

      // 시나리오 워크플로우 상태 확인
      expect(state.scenario.workflow.isCompleted).toBe(false);
      expect(state.scenario.storyInput).toBeDefined();
      expect(state.scenario.isValid).toBe(true);
    });

    test('자동 저장 기능 테스트', async () => {
      const mockStoryInput: StoryInput = {
        title: '자동 저장 테스트',
        oneLineStory: '자동 저장이 잘 되는지 확인',
        toneAndManner: ['유머러스한'],
        genre: 'Comedy',
        target: 'General',
        duration: '2분',
        format: '16:9',
        tempo: '빠름',
        developmentMethod: '비선형적',
        developmentIntensity: '약함',
      };

      // 스토리 생성
      const { result: storyResult } = renderHook(() => useStoryGeneration(), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        storyResult.current.mutate(mockStoryInput);
      });

      await waitFor(() => {
        expect(storyResult.current.isSuccess).toBe(true);
      });

      // 자동 저장 테스트
      const { result: saveResult } = renderHook(() => useStorySave(), {
        wrapper: TestWrapper,
      });

      const storySteps = storyResult.current.data!;

      await act(async () => {
        saveResult.current.mutate({
          storyInput: mockStoryInput,
          steps: storySteps,
        });
      });

      await waitFor(() => {
        expect(saveResult.current.isSuccess).toBe(true);
        expect(saveResult.current.data).toBeDefined();
        expect(saveResult.current.data.projectId).toBeDefined();
        expect(saveResult.current.data.savedAt).toBeDefined();
      });

      // Redux 상태에서 저장 완료 확인
      const state = store.getState();
      expect(state.scenario.isDirty).toBe(false);
      expect(state.scenario.lastSavedAt).toBeTruthy();
    });
  });

  describe('에러 시나리오 테스트', () => {
    beforeEach(() => {
      server.use(...scenarioErrorHandlers);
    });

    test('네트워크 에러 처리', async () => {
      const mockStoryInput: StoryInput = {
        title: 'NETWORK_ERROR_TEST',
        oneLineStory: '네트워크 에러 테스트',
        toneAndManner: ['진지한'],
        genre: 'Drama',
        target: 'Adult',
        duration: '3분',
        format: '16:9',
        tempo: '보통',
        developmentMethod: '직선적',
        developmentIntensity: '강함',
      };

      const { result } = renderHook(() => useStoryGeneration(), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        result.current.mutate(mockStoryInput);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
        expect(result.current.error).toBeDefined();
      });

      // Redux 상태에서 에러 확인
      const state = store.getState();
      expect(state.story.error).toBeTruthy();
      expect(state.story.isLoading).toBe(false);

      // UI 상태에서 에러 토스트 확인
      expect(state.ui.toasts.length).toBeGreaterThan(0);
      expect(state.ui.toasts[0].type).toBe('error');
    });

    test('서버 에러 처리', async () => {
      const mockStoryInput: StoryInput = {
        title: 'SERVER_ERROR_TEST',
        oneLineStory: '서버 에러 테스트',
        toneAndManner: ['진지한'],
        genre: 'Drama',
        target: 'Adult',
        duration: '3분',
        format: '16:9',
        tempo: '보통',
        developmentMethod: '직선적',
        developmentIntensity: '강함',
      };

      const { result } = renderHook(() => useStoryGeneration(), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        result.current.mutate(mockStoryInput);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // 에러 메시지 확인
      expect(result.current.error?.message).toContain('AI 서비스');

      // Redux 에러 상태 확인
      const state = store.getState();
      expect(state.story.error).toContain('AI 서비스');
    });
  });

  describe('낙관적 업데이트 테스트', () => {
    test('스토리 편집 중 낙관적 업데이트', async () => {
      // 초기 스토리 데이터 설정
      const mockStorySteps: StoryStep[] = [
        {
          id: 'step-1',
          title: '원본 제목 1',
          summary: '원본 요약 1',
          content: '원본 내용 1',
          goal: '목표 1',
          lengthHint: '25%',
          isEditing: false,
        },
        {
          id: 'step-2',
          title: '원본 제목 2',
          summary: '원본 요약 2',
          content: '원본 내용 2',
          goal: '목표 2',
          lengthHint: '25%',
          isEditing: false,
        },
      ];

      // 초기 상태 설정
      store.dispatch({ type: 'story/setStorySteps', payload: mockStorySteps });

      // 낙관적 업데이트 적용
      store.dispatch({
        type: 'story/applyOptimisticUpdate',
        payload: {
          stepId: 'step-1',
          updates: { title: '수정된 제목 1', content: '수정된 내용 1' },
        },
      });

      // 상태 확인
      const state = store.getState();
      const optimisticSteps = state.story.steps;

      expect(optimisticSteps[0].title).toBe('수정된 제목 1');
      expect(optimisticSteps[0].content).toBe('수정된 내용 1');
      expect(optimisticSteps[1].title).toBe('원본 제목 2'); // 다른 단계는 변경 없음

      // 낙관적 업데이트 기록 확인
      expect(state.story.optimisticUpdates['step-1']).toBeDefined();
      expect(state.story.optimisticUpdates['step-1'].title).toBe('수정된 제목 1');

      // 낙관적 업데이트 확정
      store.dispatch({
        type: 'story/confirmOptimisticUpdate',
        payload: 'step-1',
      });

      // 최종 상태 확인
      const finalState = store.getState();
      expect(finalState.story.optimisticUpdates['step-1']).toBeUndefined();
      expect(finalState.story.steps[0].title).toBe('수정된 제목 1');
    });
  });

  describe('성능 테스트', () => {
    test('대량 데이터 처리 성능', async () => {
      const startTime = performance.now();

      // 큰 스토리 입력 생성
      const largeStoryInput: StoryInput = {
        title: 'A'.repeat(200), // 최대 길이
        oneLineStory: 'B'.repeat(500), // 최대 길이
        toneAndManner: Array.from({ length: 10 }, (_, i) => `톤${i}`),
        genre: 'Drama',
        target: 'Adult',
        duration: '30분',
        format: '16:9',
        tempo: '보통',
        developmentMethod: '직선적',
        developmentIntensity: '강함',
      };

      server.use(...scenarioSuccessHandlers);

      const { result } = renderHook(() => useStoryGeneration(), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        result.current.mutate(largeStoryInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // 성능 임계값 확인 (3초 이내)
      expect(processingTime).toBeLessThan(3000);

      // 메모리 사용량 확인 (대략적)
      const state = store.getState();
      const stateSize = JSON.stringify(state).length;
      expect(stateSize).toBeLessThan(100000); // 100KB 이내
    });

    test('연속 요청 처리 성능', async () => {
      server.use(...scenarioSuccessHandlers);

      const { result } = renderHook(() => useStoryGeneration(), {
        wrapper: TestWrapper,
      });

      const requests = Array.from({ length: 5 }, (_, i) => ({
        title: `연속 테스트 ${i + 1}`,
        oneLineStory: `연속 스토리 ${i + 1}`,
        toneAndManner: ['진지한'],
        genre: 'Drama' as const,
        target: 'Adult' as const,
        duration: '1분',
        format: '16:9',
        tempo: '보통',
        developmentMethod: '직선적',
        developmentIntensity: '강함',
      }));

      const startTime = performance.now();

      // 연속으로 요청 보내기
      for (const request of requests) {
        await act(async () => {
          result.current.mutate(request);
        });

        await waitFor(() => {
          expect(result.current.isSuccess || result.current.isError).toBe(true);
        });

        // 각 요청 사이의 간격 (실제 사용 패턴 시뮬레이션)
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // 평균 응답 시간이 합리적인지 확인
      const averageTime = totalTime / requests.length;
      expect(averageTime).toBeLessThan(1000); // 평균 1초 이내

      console.log(`연속 요청 테스트 완료: 총 ${totalTime.toFixed(2)}ms, 평균 ${averageTime.toFixed(2)}ms`);
    });
  });

  describe('데이터 무결성 테스트', () => {
    test('Redux 상태와 React Query 캐시 동기화', async () => {
      const mockStoryInput: StoryInput = {
        title: '동기화 테스트',
        oneLineStory: '상태 동기화 확인',
        toneAndManner: ['진지한'],
        genre: 'Drama',
        target: 'Adult',
        duration: '3분',
        format: '16:9',
        tempo: '보통',
        developmentMethod: '직선적',
        developmentIntensity: '강함',
      };

      server.use(...scenarioSuccessHandlers);

      const { result } = renderHook(() => useStoryGeneration(), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        result.current.mutate(mockStoryInput);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // React Query 캐시에서 데이터 확인
      const cachedData = queryClient.getQueryData(['story', 'generation', mockStoryInput]);
      expect(cachedData).toBeDefined();

      // Redux 상태에서 데이터 확인
      const state = store.getState();
      expect(state.story.steps).toHaveLength(4);

      // 데이터 일관성 확인
      expect(Array.isArray(cachedData)).toBe(true);
      expect((cachedData as any[]).length).toBe(state.story.steps.length);

      // 각 단계의 ID가 일치하는지 확인
      const cachedSteps = cachedData as StoryStep[];
      cachedSteps.forEach((cachedStep, index) => {
        expect(cachedStep.id).toBe(state.story.steps[index].id);
        expect(cachedStep.title).toBe(state.story.steps[index].title);
      });
    });
  });
});