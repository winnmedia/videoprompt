/**
 * Feedback Store Index
 *
 * Redux store의 public API를 제공합니다.
 */

// 기본 export (reducer)
export { default } from './feedback-slice';

// 모든 액션 및 selector export
export * from './feedback-slice';

// 셀렉터 export
export * from './selectors';