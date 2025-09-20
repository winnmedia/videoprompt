/**
 * 공유 Redux Store 타입 정의
 * FSD Architecture - Shared Layer
 *
 * app/store의 타입을 재익스포트하여 FSD 경계 위반 방지
 */

import type { RootState as AppRootState, AppDispatch as AppDispatchType } from '@/app/store';

// Redux 타입 재익스포트
export type RootState = AppRootState;
export type AppDispatch = AppDispatchType;

// 타입 가드 함수들
export function isValidState(state: unknown): state is RootState {
  return typeof state === 'object' && state !== null;
}

// 공통 선택자 타입
export type StateSelector<T> = (state: RootState) => T;
export type TypedUseSelector = <T>(selector: StateSelector<T>) => T;