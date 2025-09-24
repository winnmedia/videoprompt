/**
 * UserJourney Slice Implementation
 * 사용자 여정 17단계 워크플로우 상태 관리
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// UserJourneyMap.md에 정의된 17단계
export type UserJourneyStep =
  | 'landing'          // 1. 홈페이지
  | 'auth'             // 2. 로그인/회원가입
  | 'scenario-input'   // 3. 시나리오 입력
  | 'story-4step'      // 4. 4단계 스토리 생성
  | 'story-edit'       // 5. 스토리 편집
  | 'shots-12'         // 6. 12단계 숏트 생성
  | 'prompt-gen'       // 7. 프롬프트 생성
  | 'conti-gen'        // 8. 콘티 생성
  | 'conti-download'   // 9. 콘티 다운로드
  | 'content-mgmt'     // 10. 콘텐츠 관리
  | 'project-mgmt'     // 11. 프로젝트 관리
  | 'template-use'     // 12. 템플릿 활용
  | 'collaboration'    // 13. 협업 기능
  | 'feedback'         // 14. 피드백 시스템
  | 'version-control'  // 15. 버전 관리
  | 'export-share'     // 16. 내보내기/공유
  | 'analytics';       // 17. 분석 및 인사이트

export interface UserJourneyState {
  currentStep: UserJourneyStep;
  completedSteps: UserJourneyStep[];
  stepProgress: Record<UserJourneyStep, number>; // 0-100 진행률
  stepData: Partial<Record<UserJourneyStep, any>>; // 각 단계별 데이터
  totalProgress: number; // 전체 진행률 0-100
  isLoading: boolean;
  error: string | null;

  // 지속성을 위한 메타데이터
  sessionId: string;
  startedAt: string;
  lastActiveAt: string;
}

// 단계별 기본 진행률 가중치
const STEP_WEIGHTS: Record<UserJourneyStep, number> = {
  'landing': 2,
  'auth': 3,
  'scenario-input': 8,
  'story-4step': 15,
  'story-edit': 10,
  'shots-12': 20,
  'prompt-gen': 12,
  'conti-gen': 15,
  'conti-download': 5,
  'content-mgmt': 3,
  'project-mgmt': 2,
  'template-use': 1,
  'collaboration': 1,
  'feedback': 1,
  'version-control': 1,
  'export-share': 1,
  'analytics': 0,
};

const initialState: UserJourneyState = {
  currentStep: 'landing',
  completedSteps: [],
  stepProgress: Object.keys(STEP_WEIGHTS).reduce((acc, step) => ({
    ...acc,
    [step]: 0,
  }), {} as Record<UserJourneyStep, number>),
  stepData: {},
  totalProgress: 0,
  isLoading: false,
  error: null,
  sessionId: `session_${Date.now()}`,
  startedAt: new Date().toISOString(),
  lastActiveAt: new Date().toISOString(),
};

// 전체 진행률 계산 함수
const calculateTotalProgress = (
  stepProgress: Record<UserJourneyStep, number>
): number => {
  const totalWeight = Object.values(STEP_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  const completedWeight = Object.entries(stepProgress).reduce(
    (sum, [step, progress]) => sum + (STEP_WEIGHTS[step as UserJourneyStep] * (progress / 100)),
    0
  );
  return Math.round((completedWeight / totalWeight) * 100);
};

export const userJourneySlice = createSlice({
  name: 'userJourney',
  initialState,
  reducers: {
    setCurrentStep: (state, action: PayloadAction<UserJourneyStep>) => {
      const newStep = action.payload;
      state.currentStep = newStep;
      state.lastActiveAt = new Date().toISOString();

      // 이전 단계 완료 처리
      if (!state.completedSteps.includes(state.currentStep)) {
        state.completedSteps.push(state.currentStep);
      }
    },

    updateStepProgress: (
      state,
      action: PayloadAction<{ step: UserJourneyStep; progress: number }>
    ) => {
      const { step, progress } = action.payload;
      const clampedProgress = Math.max(0, Math.min(100, progress));

      state.stepProgress[step] = clampedProgress;
      state.totalProgress = calculateTotalProgress(state.stepProgress);
      state.lastActiveAt = new Date().toISOString();

      // 100% 완료 시 완료된 단계에 추가
      if (clampedProgress === 100 && !state.completedSteps.includes(step)) {
        state.completedSteps.push(step);
      }
    },

    setStepData: (
      state,
      action: PayloadAction<{ step: UserJourneyStep; data: any }>
    ) => {
      const { step, data } = action.payload;
      state.stepData[step] = data;
      state.lastActiveAt = new Date().toISOString();
    },

    completeStep: (state, action: PayloadAction<UserJourneyStep>) => {
      const step = action.payload;

      if (!state.completedSteps.includes(step)) {
        state.completedSteps.push(step);
      }

      state.stepProgress[step] = 100;
      state.totalProgress = calculateTotalProgress(state.stepProgress);
      state.lastActiveAt = new Date().toISOString();
    },

    // 다음 단계로 이동
    goToNextStep: (state) => {
      const allSteps = Object.keys(STEP_WEIGHTS) as UserJourneyStep[];
      const currentIndex = allSteps.indexOf(state.currentStep);

      if (currentIndex < allSteps.length - 1) {
        const nextStep = allSteps[currentIndex + 1];
        state.currentStep = nextStep;
        state.lastActiveAt = new Date().toISOString();
      }
    },

    // 이전 단계로 이동
    goToPreviousStep: (state) => {
      const allSteps = Object.keys(STEP_WEIGHTS) as UserJourneyStep[];
      const currentIndex = allSteps.indexOf(state.currentStep);

      if (currentIndex > 0) {
        const previousStep = allSteps[currentIndex - 1];
        state.currentStep = previousStep;
        state.lastActiveAt = new Date().toISOString();
      }
    },

    // 특정 단계로 직접 이동
    jumpToStep: (state, action: PayloadAction<UserJourneyStep>) => {
      state.currentStep = action.payload;
      state.lastActiveAt = new Date().toISOString();
    },

    // 워크플로우 리셋
    resetJourney: (state) => {
      return {
        ...initialState,
        sessionId: `session_${Date.now()}`,
        startedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
    },

    // 세션 복원 (localStorage에서)
    restoreSession: (state, action: PayloadAction<Partial<UserJourneyState>>) => {
      const restoredState = action.payload;
      return {
        ...state,
        ...restoredState,
        lastActiveAt: new Date().toISOString(),
      };
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },

    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setCurrentStep,
  updateStepProgress,
  setStepData,
  completeStep,
  goToNextStep,
  goToPreviousStep,
  jumpToStep,
  resetJourney,
  restoreSession,
  setLoading,
  setError,
  clearError,
} = userJourneySlice.actions;

// Selectors
export const selectUserJourney = (state: { userJourney: UserJourneyState }) =>
  state.userJourney;

export const selectCurrentStep = (state: { userJourney: UserJourneyState }) =>
  state.userJourney.currentStep;

export const selectCompletedSteps = (state: { userJourney: UserJourneyState }) =>
  state.userJourney.completedSteps;

export const selectStepProgress = (step: UserJourneyStep) => (state: { userJourney: UserJourneyState }) =>
  state.userJourney.stepProgress[step];

export const selectStepData = (step: UserJourneyStep) => (state: { userJourney: UserJourneyState }) =>
  state.userJourney.stepData[step];

export const selectTotalProgress = (state: { userJourney: UserJourneyState }) =>
  state.userJourney.totalProgress;

export const selectIsStepCompleted = (step: UserJourneyStep) => (state: { userJourney: UserJourneyState }) =>
  state.userJourney.completedSteps.includes(step);

export const selectJourneyStats = (state: { userJourney: UserJourneyState }) => {
  const journey = state.userJourney;
  const allSteps = Object.keys(STEP_WEIGHTS) as UserJourneyStep[];

  return {
    totalSteps: allSteps.length,
    completedSteps: journey.completedSteps.length,
    currentStepIndex: allSteps.indexOf(journey.currentStep) + 1,
    totalProgress: journey.totalProgress,
    sessionDuration: new Date().getTime() - new Date(journey.startedAt).getTime(),
    lastActive: journey.lastActiveAt,
  };
};

// 다음 추천 단계 셀렉터
export const selectRecommendedNextStep = (state: { userJourney: UserJourneyState }) => {
  const { currentStep, completedSteps } = state.userJourney;
  const allSteps = Object.keys(STEP_WEIGHTS) as UserJourneyStep[];
  const currentIndex = allSteps.indexOf(currentStep);

  // 현재 단계가 완료되지 않았다면 현재 단계 추천
  if (!completedSteps.includes(currentStep)) {
    return currentStep;
  }

  // 다음 단계 추천
  if (currentIndex < allSteps.length - 1) {
    return allSteps[currentIndex + 1];
  }

  return null; // 모든 단계 완료
};

export default userJourneySlice.reducer;