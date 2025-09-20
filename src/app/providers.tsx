/**
 * 앱 레벨 Provider 구성
 * Redux (RTK Query 포함) Provider 설정
 */

'use client';

import { ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '@/app/store';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * 앱 전체 Provider 컴포넌트
 * Redux (RTK Query 포함) with persistence 제공
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ReduxProvider store={store}>
      <PersistGate loading={<div>로딩 중...</div>} persistor={persistor}>
        {children}
      </PersistGate>
    </ReduxProvider>
  );
}