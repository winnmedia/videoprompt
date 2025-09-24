/**
 * Redux Store Configuration
 * Redux Toolkit을 사용한 전역 상태 관리 설정
 */

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { authReducer } from '@/entities/auth';
import { userReducer } from '@/entities/user/store';
import { projectReducer } from '@/entities/project/store';
import { storyReducer } from '@/entities/story/store';
import { sceneReducer } from '@/entities/scene/store';
import { shotReducer } from '@/entities/shot/store';
import scenarioReducer from '@/entities/scenario/store/scenario-slice';
import storyboardReducer from '@/entities/storyboard/store/storyboard-slice';
import { userJourneyReducer } from '@/entities/user-journey/store';
import { costSafetyMiddleware } from '@/shared/lib/cost-safety-middleware';
import storyGeneratorReducer from '../features/story-generator/store/storyGeneratorSlice';
import shotsReducer from '../features/shots/store/shots-slice';

// 루트 리듀서 생성
const rootReducer = combineReducers({
  auth: authReducer,
  user: userReducer,
  project: projectReducer,
  story: storyReducer,
  scene: sceneReducer,
  shot: shotReducer,
  scenario: scenarioReducer,
  storyboard: storyboardReducer,
  userJourney: userJourneyReducer,
  storyGenerator: storyGeneratorReducer, // 4단계 스토리 생성기 추가
  shots: shotsReducer, // 12단계 숏트 시스템 추가
});

// Store 설정 함수
export function setupStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        },
      }).concat(costSafetyMiddleware), // $300 사건 방지 미들웨어 추가
    devTools: process.env.NODE_ENV !== 'production',
  });
}

// 스토어 인스턴스 생성
export const store = setupStore();

// TypeScript 타입 추론
export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof setupStore>;
export type AppDispatch = typeof store.dispatch;

// 개발 환경에서 hot reloading 지원 (Next.js 규칙 준수)
if (process.env.NODE_ENV !== 'production') {
  // HMR 지원은 Next.js에서 자동으로 처리됩니다
}
