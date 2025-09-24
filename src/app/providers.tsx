/**
 * App Providers - Redux와 기타 컨텍스트 제공자
 * 클라이언트 사이드에서만 사용되는 Provider들
 */

'use client';

import React from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from './store';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ReduxProvider store={store}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </ReduxProvider>
  );
}

// 에러 바운더리 컴포넌트
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              문제가 발생했습니다
            </h1>
            <p className="text-gray-600 mb-6">
              일시적인 오류가 발생했습니다. 페이지를 새로고침해주세요.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}