/**
 * 앱 레벨 Provider 구성
 * Redux와 React Query를 위한 Provider 설정
 */

'use client';

import { ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { store } from '@/shared/lib/store';
import { queryClient } from '@/shared/lib/query/client';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * 앱 전체 Provider 컴포넌트
 * Redux와 React Query를 모두 제공
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </ReduxProvider>
  );
}