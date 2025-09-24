/**
 * RootLayout - Next.js 루트 레이아웃
 * 모든 페이지에서 공통으로 사용되는 레이아웃
 */

import type { Metadata } from 'next';
import { Providers } from './providers';
import { GlobalNavigation } from '@/widgets/layout';
import './globals.css';

export const metadata: Metadata = {
  title: 'VideoPlanet - 영상 기획 및 생성 플랫폼',
  description:
    '고성능 영상 기획 및 생성 플랫폼으로 시나리오 작성부터 콘티 제작까지',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <Providers>
          <GlobalNavigation />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
