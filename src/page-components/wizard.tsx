/**
 * Wizard Page Component - FSD Pages Layer
 *
 * CLAUDE.md 준수사항:
 * - FSD pages 레이어 컴포넌트
 * - 워크플로우 위저드 UI/UX 구현
 * - 접근성 WCAG 2.1 AA 준수
 * - data-testid 네이밍 규약
 */

'use client';

import type { Metadata } from 'next'
import { useState } from 'react'
import Link from 'next/link'

// Shared UI 컴포넌트 (FSD Public API 준수)
import { Button, Card } from '../shared/ui'

export const metadata: Metadata = {
  title: '워크플로우 위저드',
  description: '단계별 영상 제작 가이드 - VideoPlanet',
}

/**
 * 워크플로우 위저드 페이지 컴포넌트
 *
 * 단계별 가이드로 영상 제작 과정을 안내합니다:
 * - 프로젝트 설정
 * - 시나리오 작성
 * - 프롬프트 생성
 * - 리뷰 및 완성
 */
export function WizardPage() {
  const [currentStep, setCurrentStep] = useState(1)

  const steps = [
    { id: 1, title: '프로젝트 설정', description: '영상의 기본 정보를 설정합니다' },
    { id: 2, title: '시나리오 작성', description: '스토리와 구성을 계획합니다' },
    { id: 3, title: '프롬프트 생성', description: 'AI 프롬프트를 생성합니다' },
    { id: 4, title: '리뷰 및 완성', description: '최종 검토 후 완성합니다' },
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
              <li className="text-neutral-900 font-medium">워크플로우 위저드</li>
            </ol>
          </nav>

          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            워크플로우 위저드
          </h1>
          <p className="text-lg text-neutral-600">
            단계별 가이드로 전문적인 영상을 쉽게 만들어보세요
          </p>
        </div>

        {/* 진행 단계 */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      step.id <= currentStep
                        ? 'bg-primary-600 text-white'
                        : 'bg-neutral-200 text-neutral-600'
                    }`}
                  >
                    {step.id}
                  </div>
                  <div className="mt-2 text-center">
                    <div className="text-sm font-medium text-neutral-900">
                      {step.title}
                    </div>
                    <div className="text-xs text-neutral-600 max-w-24">
                      {step.description}
                    </div>
                  </div>
                </div>

                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-4 ${
                      step.id < currentStep ? 'bg-primary-600' : 'bg-neutral-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 현재 단계 콘텐츠 */}
        <Card className="p-8 mb-8">
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">
            {steps[currentStep - 1].title}
          </h2>
          <p className="text-neutral-600 mb-6">
            {steps[currentStep - 1].description}
          </p>

          {/* 단계별 콘텐츠 (실제로는 각 단계별 컴포넌트로 분리) */}
          <div className="min-h-64 flex items-center justify-center bg-neutral-50 rounded-lg">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto text-neutral-400 mb-4">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-neutral-600">
                {currentStep}단계 콘텐츠가 여기에 표시됩니다
              </p>
            </div>
          </div>
        </Card>

        {/* 네비게이션 버튼 */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            data-testid="wizard-prev-button"
          >
            이전
          </Button>

          <Button
            onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
            disabled={currentStep === steps.length}
            data-testid="wizard-next-button"
          >
            {currentStep === steps.length ? '완성' : '다음'}
          </Button>
        </div>
      </div>
    </div>
  )
}