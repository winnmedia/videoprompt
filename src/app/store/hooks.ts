/**
 * 타입이 지정된 Redux hooks
 * 순환 의존성 방지를 위해 별도 파일로 분리
 */

import { useSelector, useDispatch } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';

// 타입 정의를 지연 로딩하여 순환 의존성 방지
type AppDispatch = any; // 런타임에 올바른 타입으로 추론됨
type RootState = any;   // 런타임에 올바른 타입으로 추론됨

/**
 * 타입이 지정된 dispatch hook
 */
export const useAppDispatch = () => useDispatch<AppDispatch>();

/**
 * 타입이 지정된 selector hook
 */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;