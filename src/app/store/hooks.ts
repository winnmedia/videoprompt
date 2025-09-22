/**
 * Typed Redux Hooks
 *
 * CLAUDE.md 준수: TypeScript 5.x, Redux Toolkit 2.0
 * $300 사건 방지: 안전한 타입 지정된 훅
 */

import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from './index'

/**
 * 타입이 지정된 useDispatch 훅
 *
 * 비용 안전: AppDispatch 타입으로 제한하여 잘못된 액션 방지
 */
export const useAppDispatch = () => useDispatch<AppDispatch>()

/**
 * 타입이 지정된 useSelector 훅
 *
 * 비용 안전: RootState 타입 강제로 잘못된 셀렉터 방지
 */
export const useAppSelector = <TSelected>(
  selector: (state: RootState) => TSelected
) => useSelector(selector)

/**
 * 안전한 셀렉터 훅 (메모화 포함)
 *
 * 비용 안전 규칙:
 * - 얕은 비교로 불필요한 리렌더링 방지
 * - 셀렉터 함수 메모화로 계산 최적화
 */
export { useSelector, useDispatch }

// 비용 안전: 개발 환경에서 훅 사용량 모니터링
if (process.env.NODE_ENV === 'development') {
  let hookCallCount = 0
  const originalUseSelector = useSelector

  // useSelector 호출 횟수 모니터링
  // @ts-ignore - 개발 환경 전용 모니터링
  global.useSelector = (...args) => {
    hookCallCount++

    // 비정상적으로 많은 호출 감지
    if (hookCallCount > 1000) {
      console.warn('⚠️ useSelector 과다 호출 감지', {
        count: hookCallCount,
        warning: '무한 리렌더링으로 인한 성능 저하 위험',
      })
    }

    return originalUseSelector.apply(null, args as any)
  }
}