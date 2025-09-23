/**
 * Landing Widget - 통합 버전
 */

import React from 'react';

export interface HeroSectionProps {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  onCtaClick?: () => void;
  className?: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  title = 'VideoPlanet',
  subtitle = 'AI 기반 영상 기획 및 생성 도구',
  ctaText = '시작하기',
  onCtaClick,
  className = ''
}) => {
  return (
    <section className={`bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20 ${className}`}>
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-5xl font-bold mb-6">{title}</h1>
        <p className="text-xl mb-8 max-w-2xl mx-auto">{subtitle}</p>
        <button
          onClick={onCtaClick}
          className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors"
        >
          {ctaText}
        </button>
      </div>
    </section>
  );
};

export interface ProcessStep {
  title: string;
  description: string;
  icon: string;
}

export interface ProcessSectionProps {
  steps?: ProcessStep[];
  className?: string;
}

export const ProcessSection: React.FC<ProcessSectionProps> = ({
  steps = [
    {
      title: '스토리 작성',
      description: 'AI가 도와주는 스토리 기획',
      icon: '✍️'
    },
    {
      title: '시나리오 생성',
      description: '자동 시나리오 변환',
      icon: '📝'
    },
    {
      title: '스토리보드 제작',
      description: '비주얼 스토리보드 생성',
      icon: '🎨'
    },
    {
      title: '영상 생성',
      description: 'AI 기반 영상 제작',
      icon: '🎬'
    }
  ],
  className = ''
}) => {
  return (
    <section className={`py-16 bg-gray-50 ${className}`}>
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
          간단한 4단계 프로세스
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl mb-4">{step.icon}</div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">{step.title}</h3>
              <p className="text-gray-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export interface CTASectionProps {
  title?: string;
  description?: string;
  buttonText?: string;
  onButtonClick?: () => void;
  className?: string;
}

export const CTASection: React.FC<CTASectionProps> = ({
  title = '지금 시작해보세요',
  description = '무료로 시작하여 AI의 힘을 경험해보세요',
  buttonText = '무료 시작',
  onButtonClick,
  className = ''
}) => {
  return (
    <section className={`bg-gray-900 text-white py-16 ${className}`}>
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold mb-4">{title}</h2>
        <p className="text-xl mb-8 text-gray-300">{description}</p>
        <button
          onClick={onButtonClick}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors"
        >
          {buttonText}
        </button>
      </div>
    </section>
  );
};