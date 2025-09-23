/**
 * LandingHero 컴포넌트 - 메인 히어로 섹션
 * FSD 아키텍처 준수
 */

import React from 'react';
import { Button } from '@/shared/ui';

interface LandingHeroProps {
  onGetStarted?: () => void;
  className?: string;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onGetStarted,
  className = ''
}) => {
  return (
    <section className={`py-16 text-center ${className}`}>
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          영상 기획부터 생성까지
          <br />
          <span className="text-blue-600">VideoPlanet</span>과 함께
        </h1>

        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          AI 기반 스토리보드 생성, 자동 영상 제작, 실시간 협업까지.
          영상 제작의 모든 과정을 혁신적으로 단순화합니다.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={onGetStarted}
            size="lg"
            className="px-8 py-3"
          >
            무료로 시작하기
          </Button>

          <Button
            variant="secondary"
            size="lg"
            className="px-8 py-3"
          >
            기능 둘러보기
          </Button>
        </div>

        <div className="mt-12 text-sm text-gray-500">
          지금 가입하면 모든 기능을 무료로 체험할 수 있습니다
        </div>
      </div>
    </section>
  );
};