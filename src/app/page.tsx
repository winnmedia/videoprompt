"use client";
 
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
  Clock
} from 'lucide-react';

export default function HomePage() {
  const features = [
    {
      icon: <Video className="w-8 h-8" />,
      title: 'AI 영상 생성',
      description: '최신 AI 기술을 활용하여 전문가 수준의 영상을 자동으로 생성합니다.',
      color: 'text-blue-600'
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: '스마트 프롬프트',
      description: '체계적인 프롬프트 생성으로 일관된 품질의 콘텐츠를 제작합니다.',
      color: 'text-purple-600'
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: '빠른 워크플로우',
      description: '3단계만으로 복잡한 영상 제작 과정을 단순화합니다.',
      color: 'text-yellow-600'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: '품질 보장',
      description: 'AI 기반 자동화로 매번 일관된 결과물을 제공합니다.',
      color: 'text-green-600'
    }
  ];

  const workflowSteps = [
    {
      step: '01',
      title: '프로젝트 설정',
      description: '기본 스타일과 메타데이터를 설정합니다',
      icon: <Camera className="w-6 h-6" />
    },
    {
      step: '02',
      title: '요소 정의',
      description: '등장인물과 핵심 사물을 정의합니다',
      icon: <Palette className="w-6 h-6" />
    },
    {
      step: '03',
      title: '타임라인 구성',
      description: '동적 타임라인으로 연출을 구성합니다',
      icon: <Clock className="w-6 h-6" />
    },
    {
      step: '04',
      title: 'AI 최적화',
      description: 'AI가 최적의 프롬프트를 생성합니다',
      icon: <Sparkles className="w-6 h-6" />
    }
  ];

  return (
    <div className="min-h-screen">
      {/* 히어로 섹션 */}
      <section className="relative bg-gradient-to-br from-primary-50 via-white to-accent-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              AI로 만드는
              <span className="text-primary-600 block">전문가급 영상</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              복잡한 설정 없이 3단계만으로 전문가 수준의 영상을 제작하세요. 
              AI가 당신의 아이디어를 시각적 걸작으로 변환합니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/prompt-generator">
                <Button size="xl" className="text-lg px-8 py-4">
                  <Play className="w-5 h-5 mr-2" />
                  무료로 시작하기
                </Button>
              </Link>
              <Link href="/workflow">
                <Button variant="outline" size="xl" className="text-lg px-8 py-4">
                  <ArrowRight className="w-5 h-5 mr-2" />
                  워크플로우 보기
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 주요 기능 */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              혁신적인 AI 영상 생성
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              최신 AI 기술을 활용하여 영상 제작의 모든 단계를 자동화하고 
              전문가 수준의 결과물을 제공합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center p-6 rounded-lg hover:shadow-lg transition-shadow">
                <div className={`${feature.color} mb-4 flex justify-center`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 워크플로우 */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              간단한 4단계 워크플로우
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              복잡한 영상 제작 과정을 4단계로 단순화하여 
              누구나 쉽게 전문적인 콘텐츠를 제작할 수 있습니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {workflowSteps.map((step, index) => (
              <div key={index} className="relative">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
                  <div className="bg-primary-100 text-primary-800 rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg mx-auto mb-4">
                    {step.step}
                  </div>
                  <div className="text-primary-600 mb-3 flex justify-center">
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
                
                {/* 연결선 */}
                {index < workflowSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-primary-200 transform -translate-y-1/2" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            지금 바로 시작하세요
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            AI 영상 생성의 새로운 시대를 경험해보세요. 
            전문적인 영상 제작이 이제 누구에게나 가능합니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/prompt-generator">
              <Button variant="secondary" size="xl" className="text-lg px-8 py-4">
                프롬프트 생성기 시작
              </Button>
            </Link>
            <Link href="/workflow">
              <Button variant="outline" size="xl" className="text-lg px-8 py-4 border-white text-white hover:bg-white hover:text-primary-600">
                워크플로우 보기
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 통계 */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary-600 mb-2">10,000+</div>
              <div className="text-gray-600">생성된 영상</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary-600 mb-2">95%</div>
              <div className="text-gray-600">사용자 만족도</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary-600 mb-2">24/7</div>
              <div className="text-gray-600">AI 서비스 가동</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
