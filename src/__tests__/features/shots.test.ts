/**
 * Shots Feature Tests
 * Redux 스토어 및 비즈니스 로직 테스트
 */

import { configureStore } from '@reduxjs/toolkit';
import shotsReducer, {
  generateShots,
  shotsActions,
  selectCurrentCollection,
  selectIsGenerating,
  selectGenerationProgress
} from '../../features/shots/store/shots-slice';
import type { ShotState } from '../../features/shots/types';
import type { FourActStory } from '../../entities/story';

// 테스트용 모의 스토어 생성
const createTestStore = (initialState?: Partial<ShotState>) => {
  return configureStore({
    reducer: {
      shots: shotsReducer
    },
    preloadedState: {
      shots: {
        currentCollection: null,
        isGenerating: false,
        generationProgress: {
          phase: 'analyzing',
          currentShot: 0,
          overallProgress: 0,
          estimatedTimeRemaining: 0,
          currentTask: ''
        },
        storyboardGeneration: {},
        error: null,
        collections: [],
        selectedShotId: null,
        dragEnabled: true,
        previewMode: 'grid',
        ...initialState
      }
    }
  });
};

// 테스트용 모의 데이터
const mockStory: FourActStory = {
  id: 'story_test_123',
  title: '테스트 스토리',
  synopsis: '테스트용 스토리입니다.',
  genre: 'drama',
  targetAudience: 'general',
  tone: 'serious',
  acts: {
    setup: {
      id: 'act_1',
      actNumber: 1,
      title: '도입',
      content: '도입부 내용',
      duration: 60,
      keyEvents: [],
      emotions: 'calm',
      characterFocus: []
    },
    development: {
      id: 'act_2',
      actNumber: 2,
      title: '전개',
      content: '전개부 내용',
      duration: 120,
      keyEvents: [],
      emotions: 'tension',
      characterFocus: []
    },
    climax: {
      id: 'act_3',
      actNumber: 3,
      title: '절정',
      content: '절정부 내용',
      duration: 90,
      keyEvents: [],
      emotions: 'excitement',
      characterFocus: []
    },
    resolution: {
      id: 'act_4',
      actNumber: 4,
      title: '결말',
      content: '결말부 내용',
      duration: 60,
      keyEvents: [],
      emotions: 'hope',
      characterFocus: []
    }
  },
  status: 'completed',
  userId: 'user_test',
  totalDuration: 330,
  aiGenerated: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

// MSW 모킹 (실제 API 호출 방지)
jest.mock('../../features/shots/api/shot-generation-engine', () => ({
  ShotGenerationEngine: jest.fn().mockImplementation(() => ({
    generateShots: jest.fn().mockResolvedValue({
      success: true,
      collection: {
        id: 'collection_test_123',
        storyId: 'story_test_123',
        shots: Array.from({ length: 12 }, (_, i) => ({
          id: `shot_${i + 1}`,
          storyId: 'story_test_123',
          actType: i < 3 ? 'setup' : i < 7 ? 'development' : i < 10 ? 'climax' : 'resolution',
          actOrder: (i % 3) + 1,
          globalOrder: i + 1,
          title: `샷 ${i + 1}`,
          description: `샷 ${i + 1} 설명`,
          shotType: 'medium',
          cameraMovement: 'static',
          duration: 5,
          emotion: 'neutral',
          lightingMood: 'natural',
          colorPalette: 'natural',
          transitionType: 'cut',
          continuityNotes: '',
          charactersInShot: [],
          storyboard: {
            id: `storyboard_${i + 1}`,
            shotId: `shot_${i + 1}`,
            prompt: '',
            style: 'cinematic',
            status: 'empty',
            generationAttempts: 0
          },
          visualReferences: [],
          isUserEdited: false,
          editHistory: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        })),
        totalDuration: 60,
        aiGenerated: true,
        generationParams: {
          creativity: 70,
          cinematic: 80,
          pacing: 'medium',
          style: 'commercial'
        },
        status: 'completed',
        completionPercentage: 100,
        storyboardsCompleted: 0,
        allStoryboardsGenerated: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      },
      tokensUsed: 1000,
      generationTime: 30
    })
  }))
}));

describe('Shots Redux Store', () => {
  describe('초기 상태', () => {
    it('should have correct initial state', () => {
      const store = createTestStore();
      const state = store.getState().shots;

      expect(state.currentCollection).toBeNull();
      expect(state.isGenerating).toBe(false);
      expect(state.error).toBeNull();
      expect(state.selectedShotId).toBeNull();
      expect(state.dragEnabled).toBe(true);
      expect(state.previewMode).toBe('grid');
    });
  });

  describe('동기 액션들', () => {
    let store: ReturnType<typeof createTestStore>;

    beforeEach(() => {
      store = createTestStore();
    });

    it('should handle setCurrentCollection', () => {
      const mockCollection = {
        id: 'test_collection',
        storyId: 'test_story',
        shots: [],
        totalDuration: 0,
        aiGenerated: true,
        generationParams: {
          creativity: 70,
          cinematic: 80,
          pacing: 'medium' as const,
          style: 'commercial' as const
        },
        status: 'draft' as const,
        completionPercentage: 0,
        storyboardsCompleted: 0,
        allStoryboardsGenerated: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      store.dispatch(shotsActions.setCurrentCollection(mockCollection));

      const collection = selectCurrentCollection(store.getState());
      expect(collection).toEqual(mockCollection);
    });

    it('should handle selectShot', () => {
      const shotId = 'shot_123';
      store.dispatch(shotsActions.selectShot(shotId));

      const state = store.getState().shots;
      expect(state.selectedShotId).toBe(shotId);
    });

    it('should handle toggleDrag', () => {
      // 초기값 확인
      expect(store.getState().shots.dragEnabled).toBe(true);

      // 비활성화
      store.dispatch(shotsActions.toggleDrag(false));
      expect(store.getState().shots.dragEnabled).toBe(false);

      // 다시 활성화
      store.dispatch(shotsActions.toggleDrag(true));
      expect(store.getState().shots.dragEnabled).toBe(true);
    });

    it('should handle setPreviewMode', () => {
      store.dispatch(shotsActions.setPreviewMode('timeline'));

      const state = store.getState().shots;
      expect(state.previewMode).toBe('timeline');
    });

    it('should handle updateGenerationProgress', () => {
      const progress = {
        phase: 'generating' as const,
        currentShot: 5,
        overallProgress: 50,
        estimatedTimeRemaining: 30,
        currentTask: '샷 생성 중...'
      };

      store.dispatch(shotsActions.updateGenerationProgress(progress));

      const currentProgress = selectGenerationProgress(store.getState());
      expect(currentProgress).toEqual(progress);
    });

    it('should handle clearError', () => {
      // 먼저 에러 설정
      const errorState = {
        error: {
          type: 'api_error' as const,
          message: '테스트 에러',
          retryable: true,
          timestamp: '2024-01-01T00:00:00Z'
        }
      };

      store = createTestStore(errorState);
      expect(store.getState().shots.error).not.toBeNull();

      // 에러 클리어
      store.dispatch(shotsActions.clearError());
      expect(store.getState().shots.error).toBeNull();
    });
  });

  describe('비동기 액션들', () => {
    let store: ReturnType<typeof createTestStore>;

    beforeEach(() => {
      store = createTestStore();
    });

    it('should handle generateShots lifecycle', async () => {
      const request = {
        story: mockStory,
        params: {
          storyId: mockStory.id,
          creativity: 70,
          cinematic: 80,
          pacing: 'medium' as const,
          style: 'commercial' as const
        },
        userId: 'user_test'
      };

      // 생성 시작
      const promise = store.dispatch(generateShots(request));

      // 생성 중 상태 확인
      expect(selectIsGenerating(store.getState())).toBe(true);

      // 완료 대기
      await promise;

      // 완료 후 상태 확인
      const state = store.getState().shots;
      expect(state.isGenerating).toBe(false);
      expect(state.currentCollection).not.toBeNull();
      expect(state.currentCollection?.shots).toHaveLength(12);
      expect(state.error).toBeNull();
    });

    it('should handle generateShots error', async () => {
      // 에러를 발생시키도록 모킹 변경
      const ShotGenerationEngine = require('../../features/shots/api/shot-generation-engine').ShotGenerationEngine;
      ShotGenerationEngine.mockImplementation(() => ({
        generateShots: jest.fn().mockRejectedValue(new Error('API 에러'))
      }));

      const request = {
        story: mockStory,
        params: {
          storyId: mockStory.id,
          creativity: 70,
          cinematic: 80,
          pacing: 'medium' as const,
          style: 'commercial' as const
        },
        userId: 'user_test'
      };

      await store.dispatch(generateShots(request));

      const state = store.getState().shots;
      expect(state.isGenerating).toBe(false);
      expect(state.error).not.toBeNull();
      expect(state.error?.type).toBe('unknown_error');
    });
  });

  describe('선택자 함수들', () => {
    it('should select current collection correctly', () => {
      const mockCollection = {
        id: 'test_collection',
        storyId: 'test_story',
        shots: [],
        totalDuration: 0,
        aiGenerated: true,
        generationParams: {
          creativity: 70,
          cinematic: 80,
          pacing: 'medium' as const,
          style: 'commercial' as const
        },
        status: 'draft' as const,
        completionPercentage: 0,
        storyboardsCompleted: 0,
        allStoryboardsGenerated: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      const store = createTestStore({ currentCollection: mockCollection });
      const collection = selectCurrentCollection(store.getState());

      expect(collection).toEqual(mockCollection);
    });

    it('should select generation state correctly', () => {
      const store = createTestStore({ isGenerating: true });

      expect(selectIsGenerating(store.getState())).toBe(true);
    });
  });

  describe('복잡한 상태 업데이트', () => {
    let store: ReturnType<typeof createTestStore>;

    beforeEach(() => {
      store = createTestStore();
    });

    it('should handle multiple shot edits correctly', () => {
      // 먼저 컬렉션 생성
      const mockCollection = {
        id: 'test_collection',
        storyId: 'test_story',
        shots: [
          {
            id: 'shot_1',
            storyId: 'test_story',
            actType: 'setup' as const,
            actOrder: 1,
            globalOrder: 1,
            title: '원본 제목',
            description: '원본 설명',
            shotType: 'medium' as const,
            cameraMovement: 'static' as const,
            duration: 5,
            emotion: 'neutral' as const,
            lightingMood: 'natural' as const,
            colorPalette: 'natural' as const,
            transitionType: 'cut' as const,
            continuityNotes: '',
            charactersInShot: [],
            storyboard: {
              id: 'storyboard_1',
              shotId: 'shot_1',
              prompt: '',
              style: 'cinematic' as const,
              status: 'empty' as const,
              generationAttempts: 0
            },
            visualReferences: [],
            isUserEdited: false,
            editHistory: [],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ],
        totalDuration: 5,
        aiGenerated: true,
        generationParams: {
          creativity: 70,
          cinematic: 80,
          pacing: 'medium' as const,
          style: 'commercial' as const
        },
        status: 'draft' as const,
        completionPercentage: 0,
        storyboardsCompleted: 0,
        allStoryboardsGenerated: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      store.dispatch(shotsActions.setCurrentCollection(mockCollection));

      // 샷 편집
      store.dispatch(shotsActions.editShot({
        shotId: 'shot_1',
        updates: {
          title: '편집된 제목',
          description: '편집된 설명'
        }
      }));

      const state = store.getState().shots;
      const editedShot = state.currentCollection?.shots[0];

      expect(editedShot?.title).toBe('편집된 제목');
      expect(editedShot?.description).toBe('편집된 설명');
      expect(editedShot?.isUserEdited).toBe(true);
    });

    it('should maintain state consistency during rapid updates', () => {
      // 연속적인 업데이트가 일관성을 유지하는지 테스트
      const actions = [
        () => store.dispatch(shotsActions.selectShot('shot_1')),
        () => store.dispatch(shotsActions.toggleDrag(false)),
        () => store.dispatch(shotsActions.setPreviewMode('timeline')),
        () => store.dispatch(shotsActions.selectShot('shot_2')),
        () => store.dispatch(shotsActions.toggleDrag(true)),
        () => store.dispatch(shotsActions.setPreviewMode('grid'))
      ];

      // 모든 액션을 순차적으로 실행
      actions.forEach(action => action());

      const finalState = store.getState().shots;
      expect(finalState.selectedShotId).toBe('shot_2');
      expect(finalState.dragEnabled).toBe(true);
      expect(finalState.previewMode).toBe('grid');
    });
  });
});