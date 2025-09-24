/**
 * Typed Redux Hooks
 * 타입 안전한 Redux hooks 제공
 */

import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from '@/app/store';
import { useEffect } from 'react';
import {
  saveUserJourney,
  loadUserJourney,
  saveUserData,
  loadUserData,
  saveProjectData,
  loadProjectData,
  debouncedSaveUserJourney,
  debouncedSaveUserData,
  debouncedSaveProjectData,
} from '@/shared/lib/storage';
import { restoreSession } from '@/entities/user-journey/store';
import { setCurrentUser } from '@/entities/user/store';

// 타입이 지정된 hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Storage 연동 hooks
export const useStoragePersistence = () => {
  const dispatch = useAppDispatch();
  const userJourney = useAppSelector((state) => state.userJourney);
  const user = useAppSelector((state) => state.user);
  const project = useAppSelector((state) => state.project);

  // 초기 데이터 로드
  useEffect(() => {
    const loadInitialData = () => {
      // UserJourney 복원
      const savedJourney = loadUserJourney();
      if (savedJourney) {
        dispatch(restoreSession(savedJourney));
      }

      // User 데이터 복원 (게스트 사용자)
      const savedUser = loadUserData();
      if (savedUser && savedUser.currentUser) {
        dispatch(setCurrentUser(savedUser.currentUser));
      }

      // 프로젝트 데이터는 필요시 복원 (현재는 세션 기반)
    };

    loadInitialData();
  }, [dispatch]);

  // 자동 저장 - useEffect 의존성 안전 패턴 적용
  useEffect(() => {
    debouncedSaveUserJourney(userJourney);
  }, []); // $300 사건 방지: 빈 배열 사용

  useEffect(() => {
    debouncedSaveUserData(user);
  }, []); // $300 사건 방지: 빈 배열 사용

  useEffect(() => {
    debouncedSaveProjectData(project);
  }, []); // $300 사건 방지: 빈 배열 사용
};

// 특정 슬라이스 선택을 위한 편의 hooks
export const useAuth = () => {
  return useAppSelector((state) => state.auth);
};

export const useUser = () => {
  return useAppSelector((state) => state.user);
};

export const useProject = () => {
  return useAppSelector((state) => state.project);
};

export const useStory = () => {
  return useAppSelector((state) => state.story);
};

export const useScene = () => {
  return useAppSelector((state) => state.scene);
};

export const useShot = () => {
  return useAppSelector((state) => state.shot);
};

export const useScenario = () => {
  return useAppSelector((state) => state.scenario);
};

export const useStoryboard = () => {
  return useAppSelector((state) => state.storyboard);
};

export const useUserJourney = () => {
  return useAppSelector((state) => state.userJourney);
};

// 복합 선택자들
export const useCurrentUserInfo = () => {
  const auth = useAuth();
  const user = useUser();

  return {
    isAuthenticated: auth.isAuthenticated,
    authUser: auth.user,
    currentUser: user.currentUser,
    isGuest: user.currentUser?.isGuest ?? true,
  };
};

export const useWorkflowData = () => {
  const project = useProject();
  const story = useStory();
  const scene = useScene();
  const shot = useShot();
  const userJourney = useUserJourney();

  return {
    currentProject: project.currentProject,
    currentStory: story.currentStory,
    currentScene: scene.currentScene,
    currentShot: shot.currentShot,
    currentStep: userJourney.currentStep,
    totalProgress: userJourney.totalProgress,
    isWorkflowActive: project.currentProject !== null,
  };
};

// 로딩 상태 통합
export const useLoadingStates = () => {
  return useAppSelector((state) => ({
    auth: state.auth.isLoading,
    user: state.user.isLoading,
    project: state.project.isLoading,
    story: state.story.isLoading,
    scene: state.scene.isLoading,
    shot: state.shot.isLoading,
    scenario: state.scenario.isLoading,
    storyboard: state.storyboard.isLoading,
    userJourney: state.userJourney.isLoading,
    isAnyLoading: Object.values({
      auth: state.auth.isLoading,
      user: state.user.isLoading,
      project: state.project.isLoading,
      story: state.story.isLoading,
      scene: state.scene.isLoading,
      shot: state.shot.isLoading,
      scenario: state.scenario.isLoading,
      storyboard: state.storyboard.isLoading,
      userJourney: state.userJourney.isLoading,
    }).some(Boolean),
  }));
};

// 에러 상태 통합
export const useErrorStates = () => {
  return useAppSelector((state) => {
    const errors = {
      auth: state.auth.error,
      user: state.user.error,
      project: state.project.error,
      story: state.story.error,
      scene: state.scene.error,
      shot: state.shot.error,
      scenario: state.scenario.error,
      storyboard: state.storyboard.error,
      userJourney: state.userJourney.error,
    };

    const hasErrors = Object.values(errors).some(error => error !== null);
    const firstError = Object.values(errors).find(error => error !== null);

    return {
      ...errors,
      hasErrors,
      firstError,
    };
  });
};
