/**
 * Error Page - Next.js App Router
 *
 * CLAUDE.md 준수사항:
 * - FSD 아키텍처 앱 레이어 (app/)
 * - 클라이언트 컴포넌트 (use client)
 * - 에러 복구 메커니즘 제공
 * - 구조화된 에러 로깅
 * - 접근성 준수
 * - $300 사건 방지를 위한 안전 장치
 */

'use client'

import { useEffect } from 'react'
import { logger } from '../shared/lib/structured-logger'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * 에러 페이지 컴포넌트
 *
 * Next.js App Router의 error.tsx 파일로,
 * 페이지 레벨에서 발생하는 에러를 처리합니다.
 * - 에러 정보 로깅
 * - 사용자 친화적 메시지
 * - 복구 액션 제공
 * - 접근성 준수
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // $300 사건 방지: useEffect 의존성 배열에 함수 절대 금지
    // 구조화된 에러 로깅
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.error('페이지 레벨 에러 발생', error, {
      component: 'ErrorPage',
      metadata: {
        errorId,
        digest: error.digest,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        errorLevel: 'page',
      },
    })

    // 글로벌 에러 트래킹 (Sentry 등)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        tags: {
          errorPage: true,
          level: 'page',
        },
        extra: {
          errorId,
          digest: error.digest,
        },
      })
    }
  }, []) // 빈 배열로 마운트 시 1회만 실행

  const isDevelopment = process.env.NODE_ENV === 'development'

  const handleReportError = () => {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.info('사용자가 페이지 에러 신고', {
      component: 'ErrorPage',
      action: 'report_error',
      metadata: {
        errorId,
        userReported: true,
        errorMessage: error.message,
      },
    })

    // 에러 신고 로직
    const subject = encodeURIComponent(`페이지 에러 신고: ${errorId}`)
    const body = encodeURIComponent(
      `에러 ID: ${errorId}\n` +
      `발생 시간: ${new Date().toLocaleString()}\n` +
      `URL: ${window.location.href}\n` +
      `에러 메시지: ${error.message}\n` +
      `Digest: ${error.digest || 'N/A'}\n\n` +
      `추가 정보를 입력해주세요:`
    )
    window.open(`mailto:support@videoplanet.com?subject=${subject}&body=${body}`)
  }

  return (
    <div
      className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-16"
      role="main"
      aria-labelledby="error-title"
    >
      <div className="text-center max-w-2xl">
        {/* 에러 아이콘 */}
        <div className="mx-auto w-24 h-24 text-red-500 mb-8">
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className="w-full h-full"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        {/* 에러 메시지 */}
        <h1
          id="error-title"
          className="text-3xl font-bold text-neutral-900 mb-4 md:text-4xl"
        >
          문제가 발생했습니다
        </h1>

        <h2 className="text-xl font-semibold text-neutral-700 mb-4">
          페이지를 로드하는 중 오류가 발생했습니다
        </h2>

        <p className="text-neutral-600 mb-8 text-lg leading-relaxed">
          {isDevelopment && error.message ? (
            <>
              <code className="text-sm bg-red-100 px-2 py-1 rounded text-red-800">
                {error.message}
              </code>
              <br />
              <span className="text-sm text-neutral-500 mt-2 block">
                개발 환경에서만 표시되는 정보입니다.
              </span>
            </>
          ) : (
            '예상치 못한 오류가 발생했습니다. 페이지를 새로고침하거나 잠시 후 다시 시도해주세요.'
          )}
        </p>

        {/* 에러 ID (지원팀 문의용) */}
        {error.digest && (
          <p className="text-xs text-neutral-500 mb-6">
            에러 ID: <code className="bg-neutral-100 px-1 py-0.5 rounded">{error.digest}</code>
          </p>
        )}

        {/* 복구 액션 버튼들 */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg text-base font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-150"
              data-testid="error-retry-button"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              다시 시도
            </button>

            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center px-6 py-3 border border-neutral-300 rounded-lg text-base font-medium text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-150"
              data-testid="error-reload-button"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              페이지 새로고침
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 border border-neutral-300 rounded-lg text-base font-medium text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-150"
              data-testid="error-home-link"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              홈으로 돌아가기
            </a>

            <button
              onClick={handleReportError}
              className="inline-flex items-center justify-center px-6 py-3 border border-blue-300 rounded-lg text-base font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-150"
              data-testid="error-report-button"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              에러 신고하기
            </button>
          </div>
        </div>

        {/* 개발 환경에서만 상세 에러 정보 */}
        {isDevelopment && error.stack && (
          <details className="mt-8 text-left">
            <summary className="cursor-pointer text-sm font-medium text-neutral-700 mb-2">
              개발자 정보 (프로덕션에서는 숨겨짐)
            </summary>
            <div className="bg-neutral-100 p-4 rounded text-xs overflow-auto">
              <div className="mb-2">
                <strong>에러:</strong>
                <pre className="text-red-600 mt-1">{error.toString()}</pre>
              </div>
              <div>
                <strong>스택 트레이스:</strong>
                <pre className="text-neutral-600 mt-1">{error.stack}</pre>
              </div>
            </div>
          </details>
        )}

        {/* 도움말 */}
        <div className="mt-12 pt-8 border-t border-neutral-200">
          <p className="text-sm text-neutral-500">
            문제가 지속되면{' '}
            <a
              href="/feedback"
              className="text-primary-600 hover:text-primary-500 underline"
              data-testid="error-feedback-link"
            >
              피드백을 보내주세요
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}