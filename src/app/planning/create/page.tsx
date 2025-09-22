/**
 * Planning Create Page
 *
 * FRD.md 명세: 영상 기획 위저드 3-Step Wizard 메인 페이지
 * Next.js App Router 14+ 준수, 메타데이터 최적화, 성능 최적화
 * CLAUDE.md 준수: FSD app 레이어, React 19, 접근성 WCAG 2.1 AA
 */

import { Suspense } from 'react'
import type { Metadata } from 'next'

import { PlanningWizard } from '../../../widgets/planning/PlanningWizard'
import { ErrorBoundary } from '../../../shared/ui/ErrorBoundary'
import { LoadingSpinner } from '../../../shared/ui/LoadingSpinner'

/**
 * 페이지 메타데이터
 */
export const metadata: Metadata = {
  title: '영상 기획 위저드 | VLANET',
  description: '3단계로 완성하는 전문적인 영상 기획서. AI가 도와주는 스토리 구성부터 12숏 분해까지.',
  keywords: ['영상 기획', '스토리보드', '콘티', '영상 제작', 'AI 스토리', '12숏'],
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
    title: '영상 기획 위저드 | VLANET',
    description: '3단계로 완성하는 전문적인 영상 기획서',
    type: 'website',
    locale: 'ko_KR',
    siteName: 'VLANET',
  },
  twitter: {
    card: 'summary_large_image',
    title: '영상 기획 위저드 | VLANET',
    description: '3단계로 완성하는 전문적인 영상 기획서',
  },
  alternates: {
    canonical: '/planning/create',
  },
}

/**
 * 페이지 컴포넌트 로딩 상태
 */
function PlanningWizardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full mx-4">
        <div className="text-center space-y-4">
          <LoadingSpinner size="large" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900">
              영상 기획 위저드 로딩 중
            </h2>
            <p className="text-sm text-gray-600">
              AI 기반 영상 기획 도구를 준비하고 있습니다...
            </p>
          </div>

          {/* 로딩 단계 표시 */}
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>AI 모델 초기화 중...</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span>사용자 설정 로드 중...</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <span>위저드 인터페이스 준비 중...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 페이지 에러 상태
 */
function PlanningWizardError({ error, reset }: { error: Error; reset: () => void }) {
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
              위저드 로딩 실패
            </h2>
            <p className="text-sm text-red-700">
              영상 기획 위저드를 불러오는 중 오류가 발생했습니다.
            </p>
            <details className="text-xs text-gray-500 text-left">
              <summary className="cursor-pointer hover:text-gray-700">
                오류 세부사항 보기
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                {error.message}
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
  )
}

/**
 * 영상 기획 생성 페이지
 * FRD.md 명세: 3-Step Wizard UI/UX 구현
 */
export default function PlanningCreatePage({
  searchParams,
}: {
  searchParams: { projectId?: string; restore?: string }
}) {
  const projectId = searchParams.projectId
  const shouldRestore = searchParams.restore === 'true'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* SEO를 위한 구조화된 데이터 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: '영상 기획 위저드',
            description: '3단계로 완성하는 전문적인 영상 기획서',
            url: 'https://vlanet.com/planning/create',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'KRW',
            },
          }),
        }}
      />

      {/* 메인 컨테이너 */}
      <div className="container mx-auto px-4 py-8">
        <ErrorBoundary fallback={PlanningWizardError}>
          <Suspense fallback={<PlanningWizardLoading />}>
            <PlanningWizardClient
              projectId={projectId}
              enableSessionRestore={shouldRestore}
            />
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* 페이지 하단 정보 */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-600">
              <p>
                © 2024 VLANET. AI 기반 영상 기획 도구로 전문적인 콘텐츠를 만들어보세요.
              </p>
            </div>
            <div className="flex gap-4 text-sm">
              <a href="/support" className="text-gray-600 hover:text-gray-900 transition-colors">
                고객지원
              </a>
              <a href="/guide" className="text-gray-600 hover:text-gray-900 transition-colors">
                사용 가이드
              </a>
              <a href="/privacy" className="text-gray-600 hover:text-gray-900 transition-colors">
                개인정보처리방침
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

/**
 * 클라이언트 컴포넌트
 * 사용자 상호작용과 상태 관리를 담당
 */
function PlanningWizardClient({
  projectId,
  enableSessionRestore = false,
}: {
  projectId?: string
  enableSessionRestore?: boolean
}) {
  return (
    <main className="max-w-6xl mx-auto">
      {/* 페이지 헤더 */}
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          영상 기획 위저드
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          AI가 도와주는 3단계 영상 기획 프로세스로 전문적인 기획서를 완성하세요.
          아이디어부터 12숏 콘티까지 한 번에!
        </p>
      </header>

      {/* 메인 위저드 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <PlanningWizard
          projectId={projectId}
          enableAutoSave={true}
          enableSessionRestore={enableSessionRestore}
          enableKeyboardNavigation={true}
          enableAccessibility={true}
          enablePerformanceOptimization={true}
          onComplete={(completedProjectId) => {
            // 완료 후 결과 페이지로 이동
            window.location.href = `/planning/result/${completedProjectId}`
          }}
          onError={(error) => {
            console.error('위저드 오류:', error)
            // 에러 추적 및 사용자 피드백
          }}
          onStepChange={(step) => {
            // 단계 변경 추적 (분석 목적)
            if (typeof gtag !== 'undefined') {
              gtag('event', 'wizard_step_change', {
                step,
                project_id: projectId,
              })
            }
          }}
          className="min-h-[800px]"
        />
      </div>

      {/* 도움말 및 추가 정보 */}
      <aside className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">🎯 1단계: 기본정보</h3>
          <p className="text-sm text-blue-700">
            제목, 로그라인, 톤앤매너를 설정하고 프리셋을 활용해 빠르게 시작하세요.
          </p>
        </div>

        <div className="bg-green-50 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-2">📝 2단계: 4단계 스토리</h3>
          <p className="text-sm text-green-700">
            AI가 생성한 스토리 구조를 검토하고 인라인 편집으로 완성도를 높이세요.
          </p>
        </div>

        <div className="bg-purple-50 rounded-lg p-6">
          <h3 className="font-semibold text-purple-900 mb-2">🎬 3단계: 12숏 편집</h3>
          <p className="text-sm text-purple-700">
            3x4 그리드에서 각 숏을 편집하고 AI 콘티를 생성한 후 PDF로 내보내세요.
          </p>
        </div>
      </aside>
    </main>
  )
}