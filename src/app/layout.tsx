import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { assertEnvInitialized } from '@/shared/config/env';
import { Logo, ToastProvider } from '@/shared/ui';
import { MainNav } from '@/components/layout/MainNav';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VLANET - AI 영상 플랫폼',
  description: 'AI 시나리오 · 프롬프트 · 영상 생성 · 피드백 파이프라인',
  keywords: 'VLANET, AI Video, Scenario, Prompt, Feedback',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 런타임 환경변수 스키마 검증 (서버에서만 실행)
  if (typeof window === 'undefined') {
    try {
      assertEnvInitialized();
    } catch (error) {
      console.warn('Environment validation failed during static generation:', error);
    }
  }
  return (
    <html lang="ko">
      <body className={`${inter.className} bg-white text-gray-900`}>
        <ToastProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-white">본문으로 건너뛰기</a>
          <div className="min-h-screen">
          <header className="border-b border-gray-200 bg-white/80 backdrop-blur">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center justify-between">
                {/* 로고 */}
                <Link href="/" className="flex items-center" aria-label="VLANET Home">
                  <Logo size="lg" />
                </Link>

                {/* 네비게이션 */}
                <MainNav />

                {/* 액션 */}
                <div className="flex items-center gap-3">
                  <Link
                    href="/scenario"
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  >
                    무료로 시작하기
                  </Link>
                </div>
              </div>
            </div>
          </header>

          <main id="main" tabIndex={-1}>{children}</main>

          <footer className="mt-16 border-t border-gray-200 bg-white">
            <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-gray-600 sm:px-6 lg:px-8">
              {/* 로고 중복 방지: 푸터 로고 제거 */}
              <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
                <div className="col-span-1 text-gray-600 md:col-span-2">
                  AI 시나리오 · 프롬프트 · 영상 생성 · 피드백까지 한 번에.
                </div>
                <div>
                  <h3 className="mb-2 font-medium text-gray-800">제품</h3>
                  <ul className="space-y-1">
                    <li>
                      <Link href="/scenario" className="hover:text-brand-600">
                        AI 영상 기획
                      </Link>
                    </li>
                    <li>
                      <Link href="/prompt-generator" className="hover:text-brand-600">
                        프롬프트 생성기
                      </Link>
                    </li>
                    <li>
                      <Link href="/wizard" className="hover:text-brand-600">
                        AI 영상 생성
                      </Link>
                    </li>
                    <li>
                      <Link href="/feedback" className="hover:text-brand-600">
                        영상 피드백
                      </Link>
                    </li>
                    <li>
                      <Link href="/planning" className="hover:text-brand-600">
                        콘텐츠 관리
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 font-medium text-gray-800">지원</h3>
                  <ul className="space-y-1">
                    <li>
                      <Link href="/docs" className="hover:text-brand-600">
                        문서
                      </Link>
                    </li>
                    <li>
                      <Link href="/api" className="hover:text-brand-600">
                        API
                      </Link>
                    </li>
                    <li>
                      <Link href="/contact" className="hover:text-brand-600">
                        문의
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="mt-8 border-t border-gray-200 pt-6 text-center text-gray-500">
                © 2025 vlanet. All rights reserved.
              </div>
            </div>
          </footer>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
