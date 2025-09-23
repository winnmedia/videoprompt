/**
 * LandingCTA 컴포넌트 - Call To Action 섹션
 * FSD 아키텍처 준수
 */

import React from 'react';
import { Button } from '@/shared/ui';

interface LandingCTAProps {
  onGetStarted?: () => void;
  className?: string;
}

export const LandingCTA: React.FC<LandingCTAProps> = ({
  onGetStarted,
  className = ''
}) => {
  return (
    <section className={`py-16 bg-blue-600 ${className}`}>
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">
          지금 바로 시작해보세요
        </h2>

        <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
          복잡한 영상 제작 과정을 단 몇 분만에 완성하세요.
          전문가 수준의 결과물을 누구나 쉽게 만들 수 있습니다.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={onGetStarted}
            variant="secondary"
            size="lg"
            className="px-8 py-3 bg-white text-blue-600 hover:bg-gray-50"
          >
            무료로 시작하기
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="px-8 py-3 border-white text-white hover:bg-white hover:text-blue-600"
          >
            데모 보기
          </Button>
        </div>

        <div className="mt-8 text-blue-200 text-sm">
          신용카드 불필요 • 언제든 취소 가능 • 30일 무료 체험
        </div>
      </div>
    </section>
  );
};