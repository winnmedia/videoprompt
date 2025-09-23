/**
 * LandingFeatures 컴포넌트 - 주요 기능 소개
 * FSD 아키텍처 준수
 */

import React from 'react';

interface Feature {
  title: string;
  description: string;
  icon: string;
}

interface LandingFeaturesProps {
  className?: string;
}

export const LandingFeatures: React.FC<LandingFeaturesProps> = ({
  className = ''
}) => {
  const features: Feature[] = [
    {
      title: 'AI 스토리보드 생성',
      description: '텍스트 입력만으로 전문적인 스토리보드를 자동 생성합니다.',
      icon: '🎬'
    },
    {
      title: '자동 영상 제작',
      description: '스토리보드를 바탕으로 완성된 영상을 자동으로 제작합니다.',
      icon: '🎥'
    },
    {
      title: '실시간 협업',
      description: '팀원들과 실시간으로 협업하며 프로젝트를 관리합니다.',
      icon: '👥'
    },
    {
      title: '다양한 템플릿',
      description: '업종별, 용도별 다양한 템플릿으로 빠르게 시작하세요.',
      icon: '📋'
    },
    {
      title: '클라우드 저장',
      description: '모든 작업물이 안전하게 클라우드에 저장됩니다.',
      icon: '☁️'
    },
    {
      title: '고품질 출력',
      description: '4K 화질의 고품질 영상 출력을 지원합니다.',
      icon: '✨'
    }
  ];

  return (
    <section className={`py-16 bg-gray-50 ${className}`}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            영상 제작의 모든 과정을 한 곳에서
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            복잡한 영상 제작 과정을 직관적이고 효율적으로 만들어주는 다양한 기능들을 제공합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="text-3xl mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};