/**
 * Global Error Page - Next.js App Router
 *
 * CLAUDE.md 준수사항:
 * - FSD 아키텍처 앱 레이어 (app/)
 * - 클라이언트 컴포넌트 (use client)
 * - 전역 에러 처리 (루트 레이아웃 에러 포함)
 * - 최소한의 안전한 UI 제공
 * - 접근성 준수
 * - $300 사건 방지를 위한 안전 장치
 */

'use client'

import { useEffect } from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * 전역 에러 페이지 컴포넌트
 *
 * Next.js App Router의 global-error.tsx 파일로,
 * 루트 레이아웃을 포함한 모든 에러를 최종적으로 처리합니다.
 * - 전체 HTML 구조 대체
 * - 최소한의 안전한 UI
 * - 에러 복구 메커니즘
 * - 외부 의존성 최소화
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // $300 사건 방지: useEffect 의존성 배열에 함수 절대 금지
    // 전역 에러 로깅 (최소한의 로깅)
    console.error('Global Error:', error)

    // 글로벌 에러 트래킹 (외부 서비스가 로드된 경우만)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        tags: {
          globalError: true,
          level: 'critical',
        },
        extra: {
          digest: error.digest,
          url: window.location.href,
        },
      })
    }
  }, []) // 빈 배열로 마운트 시 1회만 실행

  const handleReportError = () => {
    try {
      const errorId = `global_err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const subject = encodeURIComponent(`전역 에러 신고: ${errorId}`)
      const body = encodeURIComponent(
        `에러 ID: ${errorId}\n` +
        `발생 시간: ${new Date().toLocaleString()}\n` +
        `URL: ${window.location.href}\n` +
        `에러 메시지: ${error.message}\n` +
        `Digest: ${error.digest || 'N/A'}\n` +
        `에러 타입: 전역 에러 (Global Error)\n\n` +
        `추가 정보를 입력해주세요:`
      )
      window.open(`mailto:support@videoplanet.com?subject=${subject}&body=${body}`)
    } catch (e) {
      // 에러 신고 기능조차 실패한 경우 무시
      console.error('Failed to report error:', e)
    }
  }

  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>오류가 발생했습니다 - VideoPlanet</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }

              html, body {
                height: 100%;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #374151;
                background-color: #ffffff;
              }

              .container {
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1rem;
              }

              .content {
                text-align: center;
                max-width: 32rem;
                width: 100%;
              }

              .icon {
                width: 6rem;
                height: 6rem;
                margin: 0 auto 2rem;
                color: #ef4444;
              }

              .title {
                font-size: 2.25rem;
                font-weight: 700;
                color: #111827;
                margin-bottom: 1rem;
              }

              .subtitle {
                font-size: 1.25rem;
                font-weight: 600;
                color: #4b5563;
                margin-bottom: 1rem;
              }

              .description {
                color: #6b7280;
                margin-bottom: 2rem;
                line-height: 1.7;
              }

              .error-id {
                font-size: 0.75rem;
                color: #9ca3af;
                margin-bottom: 2rem;
                font-family: monospace;
              }

              .actions {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                align-items: center;
              }

              .button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0.75rem 1.5rem;
                border-radius: 0.5rem;
                font-weight: 500;
                text-decoration: none;
                transition: all 0.15s ease;
                cursor: pointer;
                border: none;
                font-size: 1rem;
                min-width: 10rem;
              }

              .button-primary {
                background-color: #2563eb;
                color: white;
              }

              .button-primary:hover {
                background-color: #1d4ed8;
              }

              .button-secondary {
                background-color: #f3f4f6;
                color: #374151;
                border: 1px solid #d1d5db;
              }

              .button-secondary:hover {
                background-color: #e5e7eb;
              }

              .button-danger {
                background-color: #fef2f2;
                color: #dc2626;
                border: 1px solid #fecaca;
              }

              .button-danger:hover {
                background-color: #fee2e2;
              }

              .help {
                margin-top: 3rem;
                padding-top: 2rem;
                border-top: 1px solid #e5e7eb;
                font-size: 0.875rem;
                color: #6b7280;
              }

              .help a {
                color: #2563eb;
                text-decoration: underline;
              }

              .help a:hover {
                color: #1d4ed8;
              }

              @media (min-width: 640px) {
                .actions {
                  flex-direction: row;
                  justify-content: center;
                }
              }
            `,
          }}
        />
      </head>
      <body>
        <div className="container">
          <div className="content">
            {/* 에러 아이콘 */}
            <div className="icon">
              <svg
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
            <h1 className="title">
              심각한 오류가 발생했습니다
            </h1>

            <h2 className="subtitle">
              애플리케이션을 로드할 수 없습니다
            </h2>

            <p className="description">
              전체 시스템에 예상치 못한 오류가 발생했습니다.
              <br />
              페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
            </p>

            {/* 에러 ID */}
            {error.digest && (
              <p className="error-id">
                에러 ID: {error.digest}
              </p>
            )}

            {/* 복구 액션 */}
            <div className="actions">
              <button
                onClick={reset}
                className="button button-primary"
                type="button"
              >
                다시 시도
              </button>

              <button
                onClick={() => window.location.reload()}
                className="button button-secondary"
                type="button"
              >
                페이지 새로고침
              </button>

              <button
                onClick={handleReportError}
                className="button button-danger"
                type="button"
              >
                에러 신고
              </button>
            </div>

            {/* 도움말 */}
            <div className="help">
              <p>
                문제가 지속되면{' '}
                <a href="mailto:support@videoplanet.com">
                  지원팀에 문의
                </a>
                해주세요.
              </p>
            </div>
          </div>
        </div>

        {/* 기본 에러 핸들러 스크립트 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // 최후의 에러 핸들러
                window.addEventListener('error', function(event) {
                  console.error('Final error handler:', event.error);
                });

                window.addEventListener('unhandledrejection', function(event) {
                  console.error('Final promise rejection handler:', event.reason);
                });
              })();
            `,
          }}
        />
      </body>
    </html>
  )
}