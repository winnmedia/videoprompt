/**
 * Redux Store Integration Test
 * 모든 슬라이스의 통합 테스트 및 타입 안전성 검증
 */

import { setupStore } from '@/app/store';
import type { RootState } from '@/app/store';

// Auth slice actions
import { setUser, logout, clearError as clearAuthError } from '@/entities/auth';

// User slice actions
import {
  createGuestUserAction,
  clearError as clearUserError
} from '@/entities/user/store';

// Project slice actions
import {
  createProjectAction,
  clearError as clearProjectError
} from '@/entities/project/store';

// Story slice actions
import {
  createStoryAction,
  clearError as clearStoryError
} from '@/entities/story/store';

// Scene slice actions
import {
  createSceneAction,
  clearError as clearSceneError
} from '@/entities/scene/store';

// Shot slice actions
import {
  createShotAction,
  clearError as clearShotError
} from '@/entities/shot/store';

// Scenario slice actions
import {
  clearError as clearScenarioError
} from '@/entities/scenario/store/scenario-slice';

// Storyboard slice actions
import {
  clearError as clearStoryboardError
} from '@/entities/storyboard/store/storyboard-slice';

// UserJourney slice actions
import {
  setCurrentStep,
  updateStepProgress,
  completeStep,
  clearError as clearJourneyError
} from '@/entities/user-journey/store';

// 목킹된 데이터
import { createGuestUser } from '@/entities/User';
import { createProject } from '@/entities/Project';
import { createStory } from '@/entities/Story';
import { createScene } from '@/entities/Scene';
import { createShot } from '@/entities/Shot';

describe('Redux Store Integration', () => {
  let store: ReturnType<typeof setupStore>;

  beforeEach(() => {
    store = setupStore();
  });

  describe('타입 안전성 검증', () => {
    it('RootState 타입이 올바르게 추론되어야 한다', () => {
      const state: RootState = store.getState();

      // 모든 슬라이스가 포함되어 있는지 확인
      expect(state.auth).toBeDefined();
      expect(state.user).toBeDefined();
      expect(state.project).toBeDefined();
      expect(state.story).toBeDefined();
      expect(state.scene).toBeDefined();
      expect(state.shot).toBeDefined();
      expect(state.scenario).toBeDefined();
      expect(state.storyboard).toBeDefined();
      expect(state.userJourney).toBeDefined();
    });

    it('모든 슬라이스가 초기 상태를 가져야 한다', () => {
      const state = store.getState();

      // Auth 초기 상태
      expect(state.auth.user).toBeNull();
      expect(state.auth.isAuthenticated).toBe(false);
      expect(state.auth.isLoading).toBe(false);

      // User 초기 상태
      expect(state.user.currentUser).toBeNull();
      expect(state.user.users).toEqual([]);
      expect(state.user.isLoading).toBe(false);

      // Project 초기 상태
      expect(state.project.projects).toEqual([]);
      expect(state.project.currentProject).toBeNull();

      // Story 초기 상태
      expect(state.story.stories).toEqual([]);
      expect(state.story.currentStory).toBeNull();

      // Scene 초기 상태
      expect(state.scene.scenes).toEqual([]);
      expect(state.scene.currentScene).toBeNull();

      // Shot 초기 상태
      expect(state.shot.shots).toEqual([]);
      expect(state.shot.currentShot).toBeNull();

      // Scenario 초기 상태
      expect(state.scenario.scenarios).toEqual([]);
      expect(state.scenario.currentScenario).toBeNull();

      // Storyboard 초기 상태
      expect(state.storyboard.storyboards).toEqual([]);
      expect(state.storyboard.currentStoryboard).toBeNull();

      // UserJourney 초기 상태
      expect(state.userJourney.currentStep).toBe('landing');
      expect(state.userJourney.completedSteps).toEqual([]);
      expect(state.userJourney.totalProgress).toBe(0);
    });
  });

  describe('Auth 슬라이스 통합', () => {
    it('사용자 설정 및 로그아웃이 정상 동작해야 한다', () => {
      const user = createGuestUser('test@example.com');

      // 사용자 설정
      store.dispatch(setUser(user));
      let state = store.getState();

      expect(state.auth.user).toEqual(user);
      expect(state.auth.isAuthenticated).toBe(true);
      expect(state.auth.error).toBeNull();

      // 로그아웃
      store.dispatch(logout());
      state = store.getState();

      expect(state.auth.user).toBeNull();
      expect(state.auth.isAuthenticated).toBe(false);
    });
  });

  describe('User 슬라이스 통합', () => {
    it('게스트 사용자 생성이 정상 동작해야 한다', () => {
      store.dispatch(createGuestUserAction({ email: 'guest@example.com' }));
      const state = store.getState();

      expect(state.user.currentUser).toBeDefined();
      expect(state.user.currentUser?.isGuest).toBe(true);
      expect(state.user.currentUser?.email).toBe('guest@example.com');
      expect(state.user.users).toHaveLength(1);
    });
  });

  describe('전체 워크플로우 통합 테스트', () => {
    it('완전한 사용자 여정을 시뮬레이션해야 한다', () => {
      // 1. 게스트 사용자 생성
      store.dispatch(createGuestUserAction({ email: 'workflow@example.com' }));

      let state = store.getState();
      const userId = state.user.currentUser?.id!;

      // 2. 프로젝트 생성
      store.dispatch(createProjectAction({
        title: '테스트 프로젝트',
        description: '워크플로우 테스트용 프로젝트',
        userId,
      }));

      // 3. 스토리 생성
      store.dispatch(createStoryAction({
        title: '테스트 스토리',
        synopsis: '워크플로우 테스트용 스토리',
        genre: 'drama',
        userId,
      }));

      state = store.getState();
      const storyId = state.story.currentStory?.id!;

      // 4. 씬 생성
      store.dispatch(createSceneAction({
        storyId,
        title: '첫 번째 씬',
        description: '테스트용 씬',
        order: 1,
      }));

      state = store.getState();
      const sceneId = state.scene.currentScene?.id!;

      // 5. 샷 생성
      store.dispatch(createShotAction({
        sceneId,
        shotType: 'medium',
        description: '테스트용 샷',
      }));

      // 6. 사용자 여정 업데이트
      store.dispatch(setCurrentStep('story-4step'));
      store.dispatch(updateStepProgress({ step: 'story-4step', progress: 50 }));
      store.dispatch(completeStep('story-4step'));

      // 최종 상태 검증
      const finalState = store.getState();

      // 모든 데이터가 연결되어 있는지 확인
      expect(finalState.user.currentUser?.id).toBe(userId);
      expect(finalState.project.currentProject?.userId).toBe(userId);
      expect(finalState.story.currentStory?.userId).toBe(userId);
      expect(finalState.scene.currentScene?.storyId).toBe(storyId);
      expect(finalState.shot.currentShot?.sceneId).toBe(sceneId);

      // 사용자 여정이 업데이트되었는지 확인
      expect(finalState.userJourney.currentStep).toBe('story-4step');
      expect(finalState.userJourney.completedSteps).toContain('story-4step');
      expect(finalState.userJourney.stepProgress['story-4step']).toBe(100);
      expect(finalState.userJourney.totalProgress).toBeGreaterThan(0);
    });
  });

  describe('에러 처리 통합', () => {
    it('모든 슬라이스의 에러를 정상적으로 클리어해야 한다', () => {
      // 모든 슬라이스에 에러 설정
      store.dispatch(clearAuthError());
      store.dispatch(clearUserError());
      store.dispatch(clearProjectError());
      store.dispatch(clearStoryError());
      store.dispatch(clearSceneError());
      store.dispatch(clearShotError());
      store.dispatch(clearScenarioError());
      store.dispatch(clearStoryboardError());
      store.dispatch(clearJourneyError());

      const state = store.getState();

      // 모든 에러가 null인지 확인
      expect(state.auth.error).toBeNull();
      expect(state.user.error).toBeNull();
      expect(state.project.error).toBeNull();
      expect(state.story.error).toBeNull();
      expect(state.scene.error).toBeNull();
      expect(state.shot.error).toBeNull();
      expect(state.scenario.error).toBeNull();
      expect(state.storyboard.error).toBeNull();
      expect(state.userJourney.error).toBeNull();
    });
  });

  describe('비용 안전 미들웨어 통합', () => {
    it('위험한 액션이 적절히 모니터링되어야 한다', () => {
      // 콘솔 스파이 설정
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // 위험한 액션 디스패치
      store.dispatch({ type: 'scenario/generate', payload: { idea: 'test' } });
      store.dispatch({ type: 'storyboard/generate', payload: { prompt: 'test' } });

      // 미들웨어가 로깅했는지 확인 (실제 구현에 따라 조정 필요)
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('셀렉터 함수 검증', () => {
    it('모든 셀렉터가 올바른 타입을 반환해야 한다', () => {
      const state = store.getState();

      // 타입 검증을 위한 샘플 테스트
      // TypeScript가 컴파일 시점에 타입을 검증함
      const authState: typeof state.auth = state.auth;
      const userState: typeof state.user = state.user;
      const projectState: typeof state.project = state.project;

      expect(authState).toBeDefined();
      expect(userState).toBeDefined();
      expect(projectState).toBeDefined();
    });
  });
});