/**
 * Redux Store 설정
 * 모든 상태 관리를 위한 중앙 집중식 store 구성
 * FSD app 레이어 - 전역 상태 관리
 */

import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { combineReducers } from '@reduxjs/toolkit';
import { logger } from '@/shared/lib/logger';


// RTK Query API slice
import { apiSlice, RTKQueryUtils } from '@/shared/api/api-slice';

// Slice reducers - 새로운 통합 파이프라인 스토어
import { pipelineReducer } from '@/entities/pipeline';
import { seedanceProviderReducer } from '@/entities/seedance';
import { planningReducer } from '@/entities/planning/store/planning-slice';
import uiReducer from './ui-slice';

// 레거시 슬라이스들 (점진적 마이그레이션 중)
import { scenarioReducer, storyReducer, storyboardReducer } from '@/entities/scenario';

// 통합된 상태 관리 슬라이스들
import authReducer from './auth-slice';
import projectReducer from './project-slice';
import performanceReducer from './performance-slice';

/**
 * Persistence 설정
 */
const authPersistConfig = {
  key: 'auth',
  storage,
  whitelist: ['user', 'isAuthenticated'] // 특정 필드만 persist
};

const projectPersistConfig = {
  key: 'project',
  storage,
  whitelist: ['id', 'scenario', 'prompt', 'video', 'versions', 'scenarioId', 'promptId', 'videoAssetId', 'createdAt', 'updatedAt']
};

/**
 * RTK Query 캐시는 persist하지 않음 (서버 상태이므로)
 * 앱 재시작 시 fresh 데이터 로드
 */

/**
 * Persisted Reducers
 */
const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);
const persistedProjectReducer = persistReducer(projectPersistConfig, projectReducer);

/**
 * Root Reducer
 */
const rootReducer = combineReducers({
  // RTK Query API reducer
  [apiSlice.reducerPath]: apiSlice.reducer,

  // 통합된 상태 관리 (Redux 중심, 영속성 포함)
  auth: persistedAuthReducer,
  project: persistedProjectReducer,
  pipeline: pipelineReducer,
  planning: planningReducer,
  performance: performanceReducer,

  // 기존 스토어들 (점진적 마이그레이션)
  scenario: scenarioReducer,
  story: storyReducer,
  storyboard: storyboardReducer,
  seedanceProvider: seedanceProviderReducer,
  ui: uiReducer,
});

/**
 * Redux Store 구성
 */
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // redux-persist actions와 RTK Query actions 제외
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'persist/PAUSE',
          'persist/PURGE',
          'persist/REGISTER',
          // RTK Query actions
          'api/executeQuery/pending',
          'api/executeQuery/fulfilled',
          'api/executeQuery/rejected',
          'api/executeMutation/pending',
          'api/executeMutation/fulfilled',
          'api/executeMutation/rejected'
        ],
        // 토스트 액션의 함수는 직렬화 검사에서 제외
        ignoredActionsPaths: ['payload.action.onClick', 'payload.onCancel', 'payload.retryAction'],
        // 상태에서도 함수 및 RTK Query 캐시 제외
        ignoredPaths: [
          'ui.toasts',
          'api.queries',
          'api.mutations',
          'api.subscriptions'
        ],
      },
    })
    // RTK Query middleware 추가
    .concat(apiSlice.middleware),
  devTools: process.env.NODE_ENV !== 'production',
});

/**
 * Persistor 생성
 */
export const persistor = persistStore(store);

/**
 * 타입 정의
 */
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

/**
 * 타입이 지정된 hooks (별도 파일에서 import)
 */
export { useAppDispatch, useAppSelector } from './hooks';

/**
 * Store 유틸리티
 */
export class StoreUtils {
  /**
   * 전체 상태 직렬화
   */
  static serialize(state: RootState): string {
    const serializableState = {
      ...state,
      ui: {
        ...state.ui,
        toasts: state.ui.toasts.map(toast => ({
          ...toast,
          action: toast.action ? { label: toast.action.label, onClick: '[Function]' } : undefined,
        })),
      },
    };

    return JSON.stringify(serializableState, null, 2);
  }

  /**
   * 상태 크기 계산 (메모리 사용량 모니터링용)
   */
  static getStateSize(state: RootState): {
    total: number;
    breakdown: Record<string, number>;
  } {
    const breakdown: Record<string, number> = {};
    let total = 0;

    Object.entries(state).forEach(([key, value]) => {
      const size = JSON.stringify(value).length;
      breakdown[key] = size;
      total += size;
    });

    return { total, breakdown };
  }

  /**
   * 디버그 정보 출력
   */
  static logDebugInfo(): void {
    if (process.env.NODE_ENV === 'development') {
      const state = store.getState();
      const { total, breakdown } = this.getStateSize(state);

      console.group('🏪 Redux Store Debug Info');
      logger.info('Total size:', total, 'bytes');
      logger.info('Size breakdown:', breakdown);
      logger.info('Current state:', state);
      console.groupEnd();
    }
  }
}

/**
 * 통합된 상태 관리 hooks export
 */
export { useAuth, useAuthStore } from './hooks/useAuth';
export { useProject, useProjectStore } from './hooks/useProject';
export { usePerformance, usePerformanceStore } from './hooks/usePerformance';

/**
 * Redux slice actions export
 */
export * from './auth-slice';
export * from './project-slice';
export * from './performance-slice';

/**
 * RTK Query exports
 */
export { apiSlice, RTKQueryUtils };

/**
 * 개발용 전역 store 접근
 */
if (process.env.NODE_ENV === 'development') {
  (window as any).__REDUX_STORE__ = store;
  (window as any).__STORE_UTILS__ = StoreUtils;
  (window as any).__RTK_QUERY_UTILS__ = RTKQueryUtils;

  // RTK Query 캐시 디버깅 함수 추가
  (window as any).__DEBUG_RTK_CACHE__ = () => RTKQueryUtils.debugCache(store.getState);
}