/**
 * Redux hooks for shared usage
 * FSD 아키텍처 준수를 위해 app/store에서 분리
 */

import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from '@/app/store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Type exports for FSD compliance
export type { RootState, AppDispatch };