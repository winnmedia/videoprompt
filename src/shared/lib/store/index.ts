/**
 * Redux 스토어 설정
 * FSD 아키텍처 shared 레이어 - 전역 상태 관리
 */

import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import storyboardReducer from './slices/storyboard';

/**
 * Redux 스토어 구성
 */
export const store = configureStore({
  reducer: {
    storyboard: storyboardReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Date 객체 직렬화 허용
        ignoredActions: ['storyboard/updateGenerationState'],
        ignoredPaths: ['storyboard.generationStates'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// 타입 정의
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// 타입 안전한 hooks
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;