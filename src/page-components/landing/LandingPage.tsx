'use client';

import { HeroSection, ProcessSection, CTASection } from '@/widgets/landing';

/**
 * 랜딩페이지 컴포넌트
 *
 * FSD 아키텍처:
 * - page-components: 페이지별 컴포넌트 조립
 * - widgets 레이어의 섹션들을 조합하여 완전한 페이지 구성
 * - app 레이어와 widgets 레이어 사이의 중간 계층 역할
 *
 * 마케팅 전략:
 * - AI 영상 생성의 혁신성 강조
 * - 3분 내 완성 가능한 편의성 부각
 * - 전문가급 퀄리티 보장
 */
export function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-gray-900">
      <HeroSection />
      <ProcessSection />
      <CTASection />
    </main>
  );
}