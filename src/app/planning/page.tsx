/**
 * Planning Main Page
 *
 * FRD.md 명세: 4탭 콘텐츠 관리 대시보드 메인 페이지
 * Next.js App Router 14+ 준수, 메타데이터 최적화, 성능 최적화
 * CLAUDE.md 준수: FSD app 레이어, React 19, 접근성 WCAG 2.1 AA
 */

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ContentDashboard } from '../../widgets/content-management';
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner';

/**
 * 페이지 메타데이터
 */
export const metadata: Metadata = {
  title: '콘텐츠 관리 | VLANET',
  description: 'AI 시나리오, 프롬프트, 이미지, 비디오를 통합 관리하는 콘텐츠 대시보드',
  keywords: ['콘텐츠 관리', '콘텐츠 대시보드', 'AI 시나리오', '프롬프트', '이미지', '비디오', '영상 기획'],
  authors: [{ name: 'VLANET Team' }],
  creator: 'VLANET',
  publisher: 'VLANET',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: '콘텐츠 관리 | VLANET',
    description: 'AI 시나리오, 프롬프트, 이미지, 비디오를 통합 관리하는 콘텐츠 대시보드',
    type: 'website',
    locale: 'ko_KR',
    siteName: 'VLANET',
  },
  twitter: {
    card: 'summary_large_image',
    title: '콘텐츠 관리 | VLANET',
    description: 'AI 시나리오, 프롬프트, 이미지, 비디오를 통합 관리하는 콘텐츠 대시보드',
  },
  alternates: {
    canonical: '/planning',
  },
};

/**
 * 대시보드 로딩 상태
 */
function PlanningDashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 스켈레톤 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
            </div>
            <div className="flex space-x-3">
              <div className="h-10 bg-gray-200 rounded w-24 animate-pulse"></div>
              <div className="h-10 bg-gray-200 rounded w-20 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 통계 카드 스켈레톤 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 bg-gray-200 rounded-lg animate-pulse"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                    <div className="h-6 bg-gray-200 rounded w-12 animate-pulse"></div>
                  </div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-12 animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 메인 콘텐츠 스켈레톤 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* 탭 헤더 스켈레톤 */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex space-x-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-6 bg-gray-200 rounded w-24 animate-pulse"></div>
              ))}
            </div>
          </div>

          {/* 콘텐츠 영역 스켈레톤 */}
          <div className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 로딩 메시지 */}
      <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <LoadingSpinner size="small" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-900">콘텐츠 대시보드 로딩 중</p>
            <p className="text-xs text-gray-600">데이터를 불러오고 있습니다...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 대시보드 에러 상태
 */
function PlanningDashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full mx-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-red-900">
              대시보드 로딩 실패
            </h2>
            <p className="text-sm text-red-700">
              콘텐츠 관리 대시보드를 불러오는 중 오류가 발생했습니다.
            </p>
            <details className="text-xs text-gray-500 text-left">
              <summary className="cursor-pointer hover:text-gray-700">
                오류 세부사항 보기
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                {error.message}
                {error.digest && `\nDigest: ${error.digest}`}
              </pre>
            </details>
          </div>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              다시 시도
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              홈으로
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 콘텐츠 관리 메인 페이지
 * FRD.md 명세: 4탭 콘텐츠 관리 대시보드 구현
 */
export default function PlanningPage({
  searchParams,
}: {
  searchParams: { tab?: string; filter?: string; search?: string };
}) {
  const activeTab = searchParams.tab || 'scenario';
  const filterType = searchParams.filter;
  const searchQuery = searchParams.search;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* SEO를 위한 구조화된 데이터 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: '콘텐츠 관리 대시보드',
            description: 'AI 시나리오, 프롬프트, 이미지, 비디오를 통합 관리하는 콘텐츠 대시보드',
            url: 'https://vlanet.com/planning',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            featureList: [
              'AI 시나리오 관리',
              '프롬프트 라이브러리',
              '이미지 에셋 관리',
              '비디오 콘텐츠 관리',
              '통합 검색 및 필터링',
              '배치 작업 지원',
              '실시간 통계',
            ],
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'KRW',
            },
          }),
        }}
      />

      {/* 메인 콘텐츠 */}
      <ErrorBoundary fallback={PlanningDashboardError}>
        <Suspense fallback={<PlanningDashboardLoading />}>
          <PlanningDashboardClient
            initialTab={activeTab}
            initialFilter={filterType}
            initialSearch={searchQuery}
          />
        </Suspense>
      </ErrorBoundary>

      {/* 접근성 개선: 스킵 링크 */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50"
      >
        메인 콘텐츠로 건너뛰기
      </a>

      {/* 페이지 하단 정보 */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-600">
              <p>
                © 2024 VLANET. AI 기반 콘텐츠 통합 관리 대시보드로 효율성을 극대화하세요.
              </p>
            </div>
            <div className="flex gap-4 text-sm">
              <a
                href="/support"
                className="text-gray-600 hover:text-gray-900 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                고객지원
              </a>
              <a
                href="/guide/content-management"
                className="text-gray-600 hover:text-gray-900 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                사용 가이드
              </a>
              <a
                href="/api-docs"
                className="text-gray-600 hover:text-gray-900 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                API 문서
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * 클라이언트 컴포넌트
 * 사용자 상호작용과 상태 관리를 담당
 */
function PlanningDashboardClient({
  initialTab,
  initialFilter,
  initialSearch,
}: {
  initialTab?: string;
  initialFilter?: string;
  initialSearch?: string;
}) {
  return (
    <main id="main-content" className="relative">
      {/* 키보드 네비게이션 도움말 */}
      <div className="sr-only">
        <h1>콘텐츠 관리 대시보드</h1>
        <p>
          이 페이지에서는 AI 시나리오, 프롬프트, 이미지, 비디오 콘텐츠를 통합 관리할 수 있습니다.
          Tab 키를 사용하여 페이지 요소들을 탐색하고, 화살표 키로 탭을 이동할 수 있습니다.
        </p>
      </div>

      {/* 메인 대시보드 */}
      <ContentDashboard
        key={`${initialTab}-${initialFilter}-${initialSearch}`} // URL 파라미터 변경시 재렌더링
      />

      {/* 성능 모니터링 (개발 환경에서만) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 bg-black bg-opacity-75 text-white text-xs rounded p-2 z-40">
          <div>Initial Tab: {initialTab}</div>
          <div>Filter: {initialFilter || 'None'}</div>
          <div>Search: {initialSearch || 'None'}</div>
          <div>Rendered: {new Date().toLocaleTimeString()}</div>
        </div>
      )}
    </main>
  );
}