'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/shared/ui/Button';
import {
  Video,
  Sparkles,
  Zap,
  Shield,
  Users,
  ArrowRight,
  Play,
  Camera,
  Palette,
  Clock,
} from 'lucide-react';

export default function HomePage() {
  const features = [
    {
      icon: <Video className="h-8 w-8" />,
      title: 'AI 영상 생성',
      description: '최신 AI 기술을 활용하여 전문가 수준의 영상을 자동으로 생성합니다.',
      color: 'text-blue-600',
    },
    {
      icon: <Sparkles className="h-8 w-8" />,
      title: '스마트 프롬프트',
      description: '체계적인 프롬프트 생성으로 일관된 품질의 콘텐츠를 제작합니다.',
      color: 'text-purple-600',
    },
    {
      icon: <Zap className="h-8 w-8" />,
      title: '빠른 워크플로우',
      description: '3단계만으로 복잡한 영상 제작 과정을 단순화합니다.',
      color: 'text-yellow-600',
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: '품질 보장',
      description: 'AI 기반 자동화로 매번 일관된 결과물을 제공합니다.',
      color: 'text-green-600',
    },
  ];

  const workflowSteps = [
    {
      step: '01',
      title: '프로젝트 설정',
      description: '기본 스타일과 메타데이터를 설정합니다',
      icon: <Camera className="h-6 w-6" />,
    },
    {
      step: '02',
      title: '요소 정의',
      description: '등장인물과 핵심 사물을 정의합니다',
      icon: <Palette className="h-6 w-6" />,
    },
    {
      step: '03',
      title: '타임라인 구성',
      description: '동적 타임라인으로 연출을 구성합니다',
      icon: <Clock className="h-6 w-6" />,
    },
    {
      step: '04',
      title: 'AI 최적화',
      description: 'AI가 최적의 프롬프트를 생성합니다',
      icon: <Sparkles className="h-6 w-6" />,
    },
  ];

  return (
    <div className="min-h-screen">
      {/* 히어로 섹션 */}
      <section className="relative bg-gradient-to-br from-primary-50 via-white to-accent-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="mb-6 text-5xl font-bold text-gray-900 md:text-6xl">
              AI로 만드는 영상 시나리오
              <span className="block text-primary-600">전문가급 영상</span>
            </h1>
            <p className="mx-auto mb-8 max-w-3xl text-xl leading-relaxed text-gray-600">
              복잡한 설정 없이 3단계만으로 전문가 수준의 영상을 제작하세요. AI가 당신의 아이디어를
              시각적 걸작으로 변환합니다.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/scenario">
                <Button size="xl" className="px-8 py-4 text-lg">
                  <Play className="mr-2 h-5 w-5" />
                  무료로 시작하기
                </Button>
              </Link>
              <Link href="/manual">
                <Button variant="outline" size="xl" className="px-8 py-4 text-lg">
                  <ArrowRight className="mr-2 h-5 w-5" />
                  워크플로우 보기
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 주요 기능 */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
              혁신적인 AI 영상 생성
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-gray-600">
              최신 AI 기술을 활용하여 영상 제작의 모든 단계를 자동화하고 전문가 수준의 결과물을
              제공합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="rounded-lg p-6 text-center transition-shadow hover:shadow-lg"
              >
                <div className={`${feature.color} mb-4 flex justify-center`}>{feature.icon}</div>
                <h3 className="mb-3 text-xl font-semibold text-gray-900">{feature.title}</h3>
                <p className="leading-relaxed text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 워크플로우 */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
              간단한 4단계 워크플로우
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-gray-600">
              복잡한 영상 제작 과정을 4단계로 단순화하여 누구나 쉽게 전문적인 콘텐츠를 제작할 수
              있습니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {workflowSteps.map((step, index) => (
              <div key={index} className="relative">
                <div className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-800">
                    {step.step}
                  </div>
                  <div className="mb-3 flex justify-center text-primary-600">{step.icon}</div>
                  <h3 className="mb-3 text-xl font-semibold text-gray-900">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-600">{step.description}</p>
                </div>

                {/* 연결선 */}
                {index < workflowSteps.length - 1 && (
                  <div className="absolute -right-4 top-1/2 hidden h-0.5 w-8 -translate-y-1/2 transform bg-primary-200 lg:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="bg-primary-600 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-6 text-3xl font-bold text-white md:text-4xl">지금 바로 시작하세요</h2>
          <p className="mb-8 text-xl text-primary-100">
            AI 영상 생성의 새로운 시대를 경험해보세요. 전문적인 영상 제작이 이제 누구에게나
            가능합니다.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/scenario">
              <Button variant="secondary" size="xl" className="px-8 py-4 text-lg">
                AI 기획안 작성 시작
              </Button>
            </Link>
            <Link href="/manual">
              <Button
                variant="outline"
                size="xl"
                className="border-white px-8 py-4 text-lg text-white hover:bg-white hover:text-primary-600"
              >
                워크플로우 보기
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 통계 */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 text-center md:grid-cols-3">
            <div>
              <div className="mb-2 text-4xl font-bold text-primary-600">10,000+</div>
              <div className="text-gray-600">생성된 영상</div>
            </div>
            <div>
              <div className="mb-2 text-4xl font-bold text-primary-600">95%</div>
              <div className="text-gray-600">사용자 만족도</div>
            </div>
            <div>
              <div className="mb-2 text-4xl font-bold text-primary-600">24/7</div>
              <div className="text-gray-600">AI 서비스 가동</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
