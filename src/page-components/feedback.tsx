/**
 * Feedback Page Component - FSD Pages Layer
 *
 * CLAUDE.md 준수사항:
 * - FSD pages 레이어 컴포넌트
 * - 피드백 수집 UI/UX 구현
 * - 접근성 WCAG 2.1 AA 준수
 * - data-testid 네이밍 규약
 */

'use client';

import type { Metadata } from 'next'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

// Shared UI 컴포넌트 (FSD Public API 준수)
import { Button, Card, Input } from '../shared/ui'

// Enhanced 피드백 페이지 import
import { EnhancedFeedbackPage } from './enhanced-feedback'

export const metadata: Metadata = {
  title: '피드백',
  description: '영상 피드백 및 협업 플랫폼 - VideoPlanet',
}

/**
 * 피드백 페이지 라우터 컴포넌트
 *
 * URL 파라미터에 따라 다른 피드백 페이지를 렌더링:
 * - /feedback?video=... : 영상 피드백 페이지 (Enhanced)
 * - /feedback : 일반 피드백 수집 페이지 (기존)
 */
function FeedbackPageContent() {
  const searchParams = useSearchParams()
  const videoId = searchParams.get('video')

  // 비디오 ID가 있으면 향상된 피드백 페이지 렌더링
  if (videoId) {
    return <EnhancedFeedbackPage />
  }

  // 기존 일반 피드백 페이지 렌더링
  return <GeneralFeedbackPage />
}

/**
 * 일반 피드백 수집 페이지 컴포넌트 (기존)
 *
 * 사용자의 피드백을 수집하는 페이지입니다:
 * - 버그 리포트
 * - 기능 요청
 * - 일반 문의
 * - 평점 및 리뷰
 */
function GeneralFeedbackPage() {
  const [feedbackType, setFeedbackType] = useState('general')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    // 피드백 제출 로직
    setTimeout(() => setIsSubmitting(false), 2000)
  }

  const feedbackTypes = [
    { id: 'bug', label: '버그 리포트', icon: '🐛' },
    { id: 'feature', label: '기능 요청', icon: '💡' },
    { id: 'general', label: '일반 문의', icon: '💬' },
    { id: 'review', label: '평점 및 리뷰', icon: '⭐' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <nav className="mb-4" aria-label="브레드크럼">
            <ol className="flex items-center space-x-2 text-sm text-neutral-600">
              <li>
                <Link href="/" className="hover:text-primary-600">홈</Link>
              </li>
              <li>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </li>
              <li className="text-neutral-900 font-medium">피드백</li>
            </ol>
          </nav>

          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            피드백 및 문의
          </h1>
          <p className="text-lg text-neutral-600">
            VideoPlanet을 더 나은 서비스로 만들기 위해 여러분의 소중한 의견을 들려주세요
          </p>

          {/* 영상 피드백 링크 */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900">영상 피드백 시스템</h3>
                <p className="text-sm text-blue-700">영상 리뷰 및 협업을 위한 전용 피드백 도구를 사용해보세요</p>
              </div>
              <Link
                href="/feedback?video=demo-video-1"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                시작하기
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 피드백 폼 */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 피드백 유형 선택 */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-3">
                    피드백 유형
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {feedbackTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setFeedbackType(type.id)}
                        className={`p-4 border rounded-lg text-left transition-all ${
                          feedbackType === type.id
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                        data-testid={`feedback-type-${type.id}`}
                      >
                        <div className="text-2xl mb-2">{type.icon}</div>
                        <div className="font-medium">{type.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 제목 */}
                <div>
                  <label htmlFor="feedback-title" className="block text-sm font-medium text-neutral-700 mb-2">
                    제목
                  </label>
                  <Input
                    id="feedback-title"
                    placeholder="간단하게 제목을 입력해주세요"
                    required
                    data-testid="feedback-title"
                  />
                </div>

                {/* 내용 */}
                <div>
                  <label htmlFor="feedback-content" className="block text-sm font-medium text-neutral-700 mb-2">
                    내용
                  </label>
                  <textarea
                    id="feedback-content"
                    rows={6}
                    placeholder="상세한 내용을 입력해주세요. 버그의 경우 재현 방법을 포함해주시면 도움이 됩니다."
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                    data-testid="feedback-content"
                  />
                </div>

                {/* 이메일 */}
                <div>
                  <label htmlFor="feedback-email" className="block text-sm font-medium text-neutral-700 mb-2">
                    이메일 (선택사항)
                  </label>
                  <Input
                    id="feedback-email"
                    type="email"
                    placeholder="답변을 받고 싶다면 이메일을 입력해주세요"
                    data-testid="feedback-email"
                  />
                </div>

                {/* 제출 버튼 */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                  data-testid="feedback-submit"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      제출 중...
                    </>
                  ) : (
                    '피드백 보내기'
                  )}
                </Button>
              </form>
            </Card>
          </div>

          {/* 사이드바 */}
          <div className="space-y-6">
            {/* 연락처 정보 */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                다른 연락 방법
              </h3>

              <div className="space-y-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-neutral-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href="mailto:support@videoplanet.com" className="text-primary-600 hover:text-primary-700">
                    support@videoplanet.com
                  </a>
                </div>

                <div className="flex items-center">
                  <svg className="w-5 h-5 text-neutral-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-neutral-600">라이브 채팅 (평일 9:00-18:00)</span>
                </div>
              </div>
            </Card>

            {/* FAQ */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                자주 묻는 질문
              </h3>

              <div className="space-y-3">
                <Link href="/manual/faq" className="block p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors">
                  <div className="font-medium text-neutral-900 mb-1">
                    계정 및 로그인 문제
                  </div>
                  <div className="text-sm text-neutral-600">
                    계정 관련 문제 해결 방법
                  </div>
                </Link>

                <Link href="/manual/faq" className="block p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors">
                  <div className="font-medium text-neutral-900 mb-1">
                    시나리오 작성 도움
                  </div>
                  <div className="text-sm text-neutral-600">
                    효과적인 시나리오 작성 방법
                  </div>
                </Link>

                <Link href="/manual/faq" className="block p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors">
                  <div className="font-medium text-neutral-900 mb-1">
                    요금 및 결제
                  </div>
                  <div className="text-sm text-neutral-600">
                    요금제 및 결제 관련 안내
                  </div>
                </Link>
              </div>

              <Button asChild variant="outline" className="w-full mt-4">
                <Link href="/manual/faq">
                  전체 FAQ 보기
                </Link>
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 메인 피드백 페이지 컴포넌트 (Suspense 래퍼)
 */
export function FeedbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600">페이지를 불러오는 중...</div>
        </div>
      </div>
    }>
      <FeedbackPageContent />
    </Suspense>
  )
}