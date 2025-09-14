/**
 * Redux Store 설정
 * 모든 상태 관리를 위한 중앙 집중식 store 구성
 * FSD shared 레이어 - 전역 상태 관리
 */

import { configureStore } from '@reduxjs/toolkit';

// Slice reducers
import scenarioReducer from '@/entities/scenario/store/scenario-slice';
import storyReducer from '@/entities/scenario/store/story-slice';
import storyboardReducer from '@/entities/scenario/store/storyboard-slice';
import uiReducer from './ui-slice';

// 인증 상태 (기존)
import { useAuthStore } from './useAuthStore';

/**
 * Redux Store 구성
 */
export const store = configureStore({
  reducer: {
    scenario: scenarioReducer,
    story: storyReducer,
    storyboard: storyboardReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // 토스트 액션의 함수는 직렬화 검사에서 제외
        ignoredActions: ['ui/addToast'],
        ignoredActionsPaths: ['payload.action.onClick', 'payload.onCancel', 'payload.retryAction'],
        // 상태에서도 함수 제외
        ignoredPaths: ['ui.toasts'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

/**
 * 타입 정의
 */
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/**
 * 타입이 지정된 hooks
 */
import { useSelector, useDispatch } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

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
      console.log('Total size:', total, 'bytes');
      console.log('Size breakdown:', breakdown);
      console.log('Current state:', state);
      console.groupEnd();
    }
  }
}

/**
 * 개발용 전역 store 접근
 */
if (process.env.NODE_ENV === 'development') {
  (window as any).__REDUX_STORE__ = store;
  (window as any).__STORE_UTILS__ = StoreUtils;
}