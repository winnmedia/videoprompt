'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@/shared/lib/logger';
import { Button } from './button';
import { Icon } from './Icon';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Production 환경에서는 최소한의 로깅만 수행
    if (process.env.NODE_ENV === 'development') {
      logger.debug('ErrorBoundary caught an error:', error, errorInfo);
    } else {
      // Production에서는 에러 ID만 로깅
      logger.debug(`Error ${this.state.errorId}:`, error.message);
    }

    // 사용자 정의 에러 핸들러 호출
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorId: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-96 flex items-center justify-center p-6">
          <div className="text-center max-w-md mx-auto">
            <div className="mb-6">
              <Icon name="error" size="xl" className="text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                문제가 발생했습니다
              </h2>
              <p className="text-gray-600 text-sm mb-4">
                예상치 못한 오류가 발생했습니다. 페이지를 새로고침하거나 다시 시도해 주세요.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left text-xs text-red-600 bg-red-50 p-3 rounded border mb-4">
                  <summary className="cursor-pointer font-medium">기술적 세부사항</summary>
                  <div className="mt-2 font-mono whitespace-pre-wrap break-all">
                    {this.state.error.message}
                  </div>
                </details>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
              >
                다시 시도
              </Button>
              <Button
                size="sm"
                onClick={this.handleReload}
              >
                페이지 새로고침
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 함수형 컴포넌트를 위한 HOC
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) {
  const WrappedComponent: React.FC<P> = (props) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}