/**
 * App Providers
 *
 * Redux Provider를 포함한 애플리케이션 전역 Provider들
 * CLAUDE.md 준수: 클라이언트 컴포넌트, FSD app 레이어
 */

'use client'

import { Provider } from 'react-redux'
import { store } from './store'

interface ReduxProviderProps {
  children: React.ReactNode
}

/**
 * Redux Provider 컴포넌트
 *
 * Redux store를 애플리케이션에 제공합니다.
 * 클라이언트 컴포넌트로 구현하여 SSR과 CSR 모두 지원합니다.
 */
export function ReduxProvider({ children }: ReduxProviderProps) {
  return <Provider store={store}>{children}</Provider>
}