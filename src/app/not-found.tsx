/**
 * 404 Not Found Page - Next.js App Router
 *
 * CLAUDE.md 준수사항:
 * - FSD 아키텍처 앱 레이어 (app/)
 * - WCAG 2.1 AA 접근성 준수
 * - 사용자 친화적 에러 메시지
 * - 복구 액션 제공
 * - SEO 최적화
 */

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없습니다',
  description: '요청하신 페이지를 찾을 수 없습니다. 다른 페이지로 이동하거나 홈으로 돌아가세요.',
  robots: {
    index: false,
    follow: true,
  },
}

/**
 * 404 Not Found 페이지 컴포넌트
 *
 * 사용자가 존재하지 않는 페이지에 접근했을 때 표시됩니다.
 * - 명확한 에러 메시지
 * - 유용한 네비게이션 링크
 * - 검색 기능 (선택사항)
 * - 접근성 준수
 */
export default function NotFound() {
  return (
    <div
      className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-16"
      role="main"
      aria-labelledby="not-found-title"
    >
      <div className="text-center max-w-2xl">
        {/* 404 아이콘 */}
        <div className="mx-auto w-24 h-24 text-neutral-400 mb-8">
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
              d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.507-.874-6.131-2.313L12 15l6.131-2.313A7.962 7.962 0 0112 15z"
            />
          </svg>
        </div>

        {/* 에러 메시지 */}
        <h1
          id="not-found-title"
          className="text-4xl font-bold text-neutral-900 mb-4 md:text-6xl"
        >
          404
        </h1>

        <h2 className="text-xl font-semibold text-neutral-700 mb-4 md:text-2xl">
          페이지를 찾을 수 없습니다
        </h2>

        <p className="text-neutral-600 mb-8 text-lg leading-relaxed">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
          <br />
          아래 링크를 통해 원하는 페이지로 이동해보세요.
        </p>

        {/* 네비게이션 액션 */}
        <div className="space-y-6">
          {/* 주요 액션 버튼 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg text-base font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-150"
              data-testid="not-found-home-link"
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
            </Link>

            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center px-6 py-3 border border-neutral-300 rounded-lg text-base font-medium text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-150"
              data-testid="not-found-back-button"
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
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              이전 페이지로
            </button>
          </div>

          {/* 유용한 링크들 */}
          <div className="pt-8 border-t border-neutral-200">
            <h3 className="text-lg font-medium text-neutral-900 mb-4">
              다음 페이지들을 찾고 계신가요?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link
                href="/scenario"
                className="flex items-center p-4 border border-neutral-200 rounded-lg hover:border-primary-200 hover:bg-primary-50 transition-all duration-150 group"
                data-testid="not-found-scenario-link"
              >
                <div className="flex-shrink-0 w-8 h-8 text-primary-600 group-hover:text-primary-700">
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
                      strokeWidth={2}
                      d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 2h10a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2z"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-neutral-900 group-hover:text-primary-700">
                    시나리오 작성
                  </h4>
                  <p className="text-sm text-neutral-500">
                    새로운 영상 시나리오 만들기
                  </p>
                </div>
              </Link>

              <Link
                href="/prompt-generator"
                className="flex items-center p-4 border border-neutral-200 rounded-lg hover:border-primary-200 hover:bg-primary-50 transition-all duration-150 group"
                data-testid="not-found-prompt-link"
              >
                <div className="flex-shrink-0 w-8 h-8 text-primary-600 group-hover:text-primary-700">
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
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-neutral-900 group-hover:text-primary-700">
                    프롬프트 생성
                  </h4>
                  <p className="text-sm text-neutral-500">
                    AI 프롬프트 빌더 사용하기
                  </p>
                </div>
              </Link>

              <Link
                href="/wizard"
                className="flex items-center p-4 border border-neutral-200 rounded-lg hover:border-primary-200 hover:bg-primary-50 transition-all duration-150 group"
                data-testid="not-found-wizard-link"
              >
                <div className="flex-shrink-0 w-8 h-8 text-primary-600 group-hover:text-primary-700">
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
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-neutral-900 group-hover:text-primary-700">
                    워크플로우
                  </h4>
                  <p className="text-sm text-neutral-500">
                    단계별 워크플로우 따라하기
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* 도움말 */}
        <div className="mt-12 pt-8 border-t border-neutral-200">
          <p className="text-sm text-neutral-500">
            문제가 지속되면{' '}
            <Link
              href="/feedback"
              className="text-primary-600 hover:text-primary-500 underline"
              data-testid="not-found-feedback-link"
            >
              피드백을 보내주세요
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}