/**
 * React Error Boundary
 *
 * 기능:
 * - React 컴포넌트 에러 캐치
 * - 구조화된 에러 로깅
 * - 사용자 친화적 폴백 UI
 * - 에러 복구 메커니즘
 * - 개발/프로덕션 환경별 처리
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../lib/structured-logger';
import { ErrorActions } from './error-actions';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isolate?: boolean; // 에러를 이 컴포넌트로 격리 (상위로 전파 안함)
  level?: 'page' | 'section' | 'component'; // 에러 레벨
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorId: string;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.errorId = this.generateErrorId();
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.generateErrorId();

    // 구조화된 로깅
    logger.error('React Error Boundary에서 에러 포착', error, {
      component: 'ErrorBoundary',
      metadata: {
        errorId,
        errorLevel: this.props.level || 'component',
        componentStack: errorInfo.componentStack,
        errorBoundaryProps: {
          isolate: this.props.isolate,
          level: this.props.level,
        },
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        timestamp: new Date().toISOString(),
      },
    });

    // 상태 업데이트
    this.setState({
      error,
      errorInfo,
      errorId,
    });

    // 커스텀 에러 핸들러 호출
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 에러를 상위로 전파하지 않을 경우
    if (this.props.isolate) {
      return;
    }

    // 글로벌 에러 트래킹 (Sentry 등)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        tags: {
          errorBoundary: true,
          level: this.props.level || 'component',
        },
        extra: {
          errorId,
          componentStack: errorInfo.componentStack,
        },
      });
    }
  }

  private handleRetry = () => {
    logger.info('Error Boundary 재시도 시도', {
      component: 'ErrorBoundary',
      metadata: {
        errorId: this.state.errorId,
        action: 'retry',
      },
    });

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  private handleReportError = () => {
    const { error, errorInfo, errorId } = this.state;
    if (!error || !errorId) return;

    logger.info('사용자가 에러 신고', {
      component: 'ErrorBoundary',
      action: 'report_error',
      metadata: {
        errorId,
        userReported: true,
      },
    });

    // 에러 신고 로직 (이메일, 이슈 트래킹 시스템 등)
    if (typeof window !== 'undefined') {
      const subject = encodeURIComponent(`에러 신고: ${errorId}`);
      const body = encodeURIComponent(
        `에러 ID: ${errorId}\n` +
        `발생 시간: ${new Date().toLocaleString()}\n` +
        `URL: ${window.location.href}\n` +
        `에러 메시지: ${error.message}\n` +
        `스택 트레이스: ${error.stack}\n\n` +
        `추가 정보를 입력해주세요:`
      );
      window.open(`mailto:support@videoplanet.com?subject=${subject}&body=${body}`);
    }
  };

  render() {
    if (this.state.hasError) {
      // 커스텀 폴백 UI가 제공된 경우
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorId } = this.state;
      const isDevelopment = process.env.NODE_ENV === 'development';
      const level = this.props.level || 'component';

      return (
        <div className="min-h-[200px] flex items-center justify-center p-6 border border-red-200 rounded-lg bg-red-50">
          <div className="text-center max-w-lg">
            {/* 에러 아이콘 */}
            <div className="mx-auto w-16 h-16 text-red-500 mb-4">
              <svg
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                className="w-full h-full"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            {/* 에러 메시지 */}
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              {level === 'page' ? '페이지 로딩 중 오류가 발생했습니다' :
               level === 'section' ? '이 섹션을 불러오는 중 오류가 발생했습니다' :
               '컴포넌트 오류가 발생했습니다'}
            </h3>

            <p className="text-red-600 mb-4">
              {isDevelopment && error?.message ? (
                <code className="text-sm bg-red-100 px-2 py-1 rounded">
                  {error.message}
                </code>
              ) : (
                '예상치 못한 오류가 발생했습니다. 페이지를 새로고침하거나 잠시 후 다시 시도해주세요.'
              )}
            </p>

            {/* 에러 ID */}
            {errorId && (
              <p className="text-xs text-gray-500 mb-4">
                에러 ID: <code className="bg-gray-100 px-1 py-0.5 rounded">{errorId}</code>
              </p>
            )}

            {/* 액션 버튼들 */}
            <ErrorActions
              errorId={errorId}
              onRetry={this.handleRetry}
              onReport={this.handleReportError}
            />

            {/* 개발 환경에서만 상세 정보 표시 */}
            {isDevelopment && error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                  개발자 정보 (프로덕션에서는 숨겨짐)
                </summary>
                <div className="bg-gray-100 p-3 rounded text-xs overflow-auto">
                  <div className="mb-2">
                    <strong>에러:</strong>
                    <pre className="text-red-600">{error.toString()}</pre>
                  </div>
                  {error.stack && (
                    <div className="mb-2">
                      <strong>스택 트레이스:</strong>
                      <pre className="text-gray-600">{error.stack}</pre>
                    </div>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <strong>컴포넌트 스택:</strong>
                      <pre className="text-blue-600">{this.state.errorInfo.componentStack}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 특화된 Error Boundary 컴포넌트들

/**
 * 페이지 레벨 Error Boundary
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      level="page"
      onError={(error, errorInfo) => {
        logger.logSecurityEvent('page_error_boundary_triggered', 'medium', {
          error: error.message,
          componentStack: errorInfo.componentStack,
        });
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * 섹션 레벨 Error Boundary (격리된)
 */
export function SectionErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      level="section"
      isolate={true}
      fallback={
        <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
          <p className="text-yellow-800">
            이 섹션을 일시적으로 불러올 수 없습니다. 잠시 후 다시 시도해주세요.
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * 컴포넌트 레벨 Error Boundary (격리된, 최소 UI)
 */
export function ComponentErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      level="component"
      isolate={true}
      fallback={
        <div className="p-2 text-sm text-gray-500 border border-gray-200 rounded">
          컴포넌트를 불러올 수 없습니다
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * 비동기 에러 캐처 (Promise rejection 등)
 */
export function setupGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;

  // 처리되지 않은 Promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('처리되지 않은 Promise rejection', new Error(event.reason), {
      component: 'GlobalErrorHandler',
      metadata: {
        type: 'unhandled_promise_rejection',
        reason: event.reason,
        url: window.location.href,
      },
    });

    // 개발 환경에서는 콘솔에 출력
    if (process.env.NODE_ENV === 'development') {
      console.error('Unhandled promise rejection:', event.reason);
    }
  });

  // 일반적인 JavaScript 에러
  window.addEventListener('error', (event) => {
    logger.error('전역 JavaScript 에러', event.error, {
      component: 'GlobalErrorHandler',
      metadata: {
        type: 'global_javascript_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        url: window.location.href,
      },
    });
  });
}