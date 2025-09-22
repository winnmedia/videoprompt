/**
 * Prompt Generator Page Component - FSD Pages Layer
 *
 * CLAUDE.md 준수사항:
 * - FSD pages 레이어 컴포넌트
 * - VLANET 프롬프트 생성 UI/UX 구현
 * - 접근성 WCAG 2.1 AA 준수
 * - TDD 테스트 가능한 구조
 * - widgets/prompt 컴포넌트 활용
 */

'use client';

import type { Metadata } from 'next'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// FSD Public API를 통한 import (CLAUDE.md 준수)
import { PromptBuilder } from '../widgets/prompt'
import { Button, Card } from '../shared/ui'
import { useScenario } from '../features/scenario'

export const metadata: Metadata = {
  title: 'VLANET 프롬프트 생성기',
  description: '시나리오에서 VLANET 프롬프트를 생성하는 도구 - VideoPlanet',
}

/**
 * 프롬프트 생성기 페이지 컴포넌트
 *
 * 시나리오의 씬들을 선택하여 VLANET 프롬프트를 생성하는 페이지입니다:
 * - 12개 샷 선택 UI
 * - VLANET 프롬프트 생성
 * - 실시간 프리뷰
 * - 프롬프트 히스토리
 * - 접근성 준수
 */
export function PromptGeneratorPage() {
  const router = useRouter()
  const {
    currentScenario,
    scenes,
    isLoading,
    error,
  } = useScenario()

  const [showWelcome, setShowWelcome] = useState(true)

  // 시나리오가 없으면 시나리오 페이지로 리다이렉트
  useEffect(() => {
    if (!isLoading && !currentScenario) {
      // 첫 방문이면 안내 메시지 표시, 아니면 바로 리다이렉트
      if (scenes.length === 0) {
        setShowWelcome(true)
      }
    }
  }, [currentScenario, isLoading, scenes.length])

  const handleGoToScenario = () => {
    router.push('/scenario')
  }

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div>
              <h3 className="font-medium text-gray-900">
                로딩 중...
              </h3>
              <p className="text-sm text-gray-600">
                시나리오 데이터를 불러오고 있습니다
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 시나리오가 없거나 씬이 없는 경우
  if (!currentScenario || scenes.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50">
        {/* 상단 헤더 */}
        <header className="bg-white border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* 브레드크럼 및 제목 */}
              <div className="flex items-center gap-4">
                <nav aria-label="브레드크럼" className="hidden sm:block">
                  <ol className="flex items-center space-x-2 text-sm text-neutral-600">
                    <li>
                      <Link href="/" className="hover:text-blue-600 transition-colors">
                        홈
                      </Link>
                    </li>
                    <li>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </li>
                    <li>
                      <Link href="/scenario" className="hover:text-blue-600 transition-colors">
                        시나리오
                      </Link>
                    </li>
                    <li>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </li>
                    <li className="text-neutral-900 font-medium">프롬프트 생성</li>
                  </ol>
                </nav>

                <h1 className="text-xl font-semibold text-neutral-900">
                  VLANET 프롬프트 생성기
                </h1>
              </div>

              {/* 시나리오로 이동 버튼 */}
              <Button
                onClick={handleGoToScenario}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="go-to-scenario"
              >
                시나리오 작성하기
              </Button>
            </div>
          </div>
        </header>

        {/* 메인 콘텐츠 - 시나리오 없음 안내 */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="mx-auto w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              시나리오가 필요합니다
            </h2>

            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              VLANET 프롬프트를 생성하려면 먼저 시나리오를 작성해야 합니다.
              시나리오 페이지에서 AI를 활용해 스토리를 생성하고 씬을 편집한 후,
              원하는 씬들을 선택하여 프롬프트를 생성할 수 있습니다.
            </p>

            <div className="space-y-4">
              <Button
                onClick={handleGoToScenario}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="create-scenario-cta"
              >
                시나리오 작성 시작하기
              </Button>

              <div className="text-sm text-gray-500">
                또는{' '}
                <Link href="/" className="text-blue-600 hover:text-blue-700 underline">
                  홈으로 돌아가기
                </Link>
              </div>
            </div>

            {/* 프롬프트 생성 과정 안내 */}
            <div className="mt-16">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                프롬프트 생성 과정
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-blue-600 font-bold text-lg">1</span>
                  </div>
                  <h4 className="font-medium text-gray-900 mb-2">시나리오 작성</h4>
                  <p className="text-sm text-gray-600">
                    AI를 활용하여 스토리를 생성하고 씬을 편집합니다
                  </p>
                </Card>

                <Card className="p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-blue-600 font-bold text-lg">2</span>
                  </div>
                  <h4 className="font-medium text-gray-900 mb-2">씬 선택</h4>
                  <p className="text-sm text-gray-600">
                    프롬프트로 만들고 싶은 씬들을 선택합니다 (최대 12개)
                  </p>
                </Card>

                <Card className="p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-blue-600 font-bold text-lg">3</span>
                  </div>
                  <h4 className="font-medium text-gray-900 mb-2">프롬프트 생성</h4>
                  <p className="text-sm text-gray-600">
                    VLANET 형식의 프롬프트가 자동으로 생성됩니다
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // 정상적인 프롬프트 생성기 페이지
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* 브레드크럼 및 제목 */}
            <div className="flex items-center gap-4">
              <nav aria-label="브레드크럼" className="hidden sm:block">
                <ol className="flex items-center space-x-2 text-sm text-neutral-600">
                  <li>
                    <Link href="/" className="hover:text-blue-600 transition-colors">
                      홈
                    </Link>
                  </li>
                  <li>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </li>
                  <li>
                    <Link href="/scenario" className="hover:text-blue-600 transition-colors">
                      시나리오
                    </Link>
                  </li>
                  <li>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </li>
                  <li className="text-neutral-900 font-medium">프롬프트 생성</li>
                </ol>
              </nav>

              <h1 className="text-xl font-semibold text-neutral-900">
                VLANET 프롬프트 생성기
              </h1>
            </div>

            {/* 액션 버튼들 */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                asChild
                data-testid="back-to-scenario"
              >
                <Link href="/scenario">
                  시나리오로 돌아가기
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 시나리오 정보 카드 */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {currentScenario.metadata.title}
              </h2>
              <p className="text-gray-600 mt-1">
                {currentScenario.metadata.description}
              </p>
            </div>
            <div className="text-right text-sm text-gray-600">
              <div>총 {scenes.length}개 씬</div>
              <div>장르: {currentScenario.metadata.genre}</div>
            </div>
          </div>
        </Card>

        {/* 프롬프트 빌더 */}
        <PromptBuilder scenario={currentScenario} />
      </main>

      {/* 에러 모달 */}
      {error && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-labelledby="error-title"
          aria-describedby="error-description"
        >
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 id="error-title" className="font-medium text-neutral-900 mb-2">
                  오류가 발생했습니다
                </h3>
                <p id="error-description" className="text-sm text-neutral-600 mb-4">
                  {error}
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGoToScenario}
                  >
                    시나리오로 이동
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => window.location.reload()}
                    data-testid="dismiss-error"
                  >
                    새로고침
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}