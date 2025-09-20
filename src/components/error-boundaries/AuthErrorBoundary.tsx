'use client';

/**
 * 인증 전용 Error Boundary
 * 401, 403 등 인증 관련 오류를 포착하여 사용자 친화적 UI 제공
 */

import React, { Component, ReactNode } from 'react';
import { Button } from '@/shared/ui';
import { logger } from '@/shared/lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // 인증 관련 오류인지 확인
    const isAuthError = 
      error.message.includes('인증') ||
      error.message.includes('401') ||
      error.message.includes('403') ||
      error.name === 'ContractViolationError' ||
      error.message.includes('토큰') ||
      error.message.includes('로그인');

    if (isAuthError) {
      return { hasError: true, error };
    }

    // 인증 관련이 아닌 오류는 상위 Error Boundary로 전파
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: any) {
    logger.error('Auth Error Boundary caught error', error, {
      operation: 'auth-error-boundary',
      errorInfo: {
        componentStack: errorInfo?.componentStack,
        errorBoundary: 'AuthErrorBoundary'
      }
    });
    
    // 토큰 정리 (오염된 토큰 제거)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      
      // 토큰 무효화 이벤트 발생
      window.dispatchEvent(new CustomEvent('auth:token-invalid', {
        detail: { error: error.message }
      }));
    }

    this.setState({ errorInfo });
  }

  handleRetry = () => {
    // 상태 초기화
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    
    // 페이지 새로고침으로 인증 상태 재확인
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleGoToLogin = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/login?message=세션이 만료되었습니다. 다시 로그인해주세요.';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
              {/* 인증 오류 아이콘 */}
              <div className="flex justify-center mb-6">
                <div className="rounded-full bg-red-100 p-3">
                  <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.268 21.5c-.77.833.192 2.5 1.732 2.5z" 
                    />
                  </svg>
                </div>
              </div>

              {/* 오류 메시지 */}
              <div className="text-center">
                <h2 className="text-lg font-medium text-gray-900 mb-2">
                  인증 문제가 발생했습니다
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  세션이 만료되었거나 인증 정보에 문제가 있습니다.
                </p>

                {/* 개발 환경에서만 상세 오류 표시 */}
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="mb-6 text-left">
                    <summary className="text-xs text-gray-500 cursor-pointer mb-2">
                      개발자 정보 (프로덕션에서는 숨김)
                    </summary>
                    <pre className="text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto">
                      {this.state.error.message}
                    </pre>
                  </details>
                )}
              </div>

              {/* 액션 버튼 */}
              <div className="space-y-3">
                <Button 
                  onClick={this.handleGoToLogin}
                  className="w-full"
                  variant="primary"
                >
                  로그인 페이지로 이동
                </Button>
                
                <Button 
                  onClick={this.handleRetry}
                  className="w-full"
                  variant="outline"
                >
                  다시 시도
                </Button>
              </div>

              {/* 추가 안내 */}
              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500">
                  문제가 지속되면 브라우저 캐시를 삭제하거나 <br />
                  관리자에게 문의해주세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}