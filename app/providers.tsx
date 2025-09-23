'use client';

import { Provider } from 'react-redux';
import { store } from '@/app/store';
import { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * 클라이언트 측 Provider 래퍼 컴포넌트
 * Redux Store를 전체 앱에 제공
 *
 * CLAUDE.md 원칙:
 * - $300 사건 방지: useEffect 의존성 배열 엄격 관리
 * - FSD 아키텍처: app 레이어에서만 Provider 설정
 * - 클라이언트 컴포넌트 최소화
 */
export function Providers({ children }: ProvidersProps) {
  return <Provider store={store}>{children}</Provider>;
}