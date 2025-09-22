/**
 * Root Layout - Next.js App Router
 *
 * CLAUDE.md 준수사항:
 * - FSD 아키텍처 앱 레이어 (app/)
 * - 전역 에러 처리 및 접근성 준수
 * - SEO 최적화 메타데이터 설정
 * - Core Web Vitals 성능 예산 준수
 * - 폰트 최적화 및 레이아웃 시프트 방지
 */

import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

// Shared UI 컴포넌트 (FSD Public API 준수)
import { PageErrorBoundary, ClientNavigation } from '../shared/ui'
import { EnvValidator } from '../shared/config/env-validator'
import { ReduxProvider } from './providers'

// 앱 시작 시점에 환경변수 검증 (서버 사이드에서만 실행)
if (typeof window === 'undefined') {
  const envValidation = EnvValidator.validate()
  if (!envValidation.success) {
    console.error('❌ 환경변수 검증 실패:', envValidation.error.errors)
    // 개발 환경에서는 경고만 출력하고 계속 진행
    if (process.env.NODE_ENV === 'production') {
      throw new Error('환경변수 검증 실패')
    }
  } else {
    console.log('✅ 환경변수 검증 완료')
  }
}

// 폰트 최적화 (CLS 방지)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap', // FOUT 방지
  preload: true,
})

// SEO 및 메타데이터 최적화
export const metadata: Metadata = {
  title: {
    default: 'VideoPlanet - 고성능 영상 기획 및 생성 플랫폼',
    template: '%s | VideoPlanet'
  },
  description: 'AI 기반 영상 기획부터 제작까지 한번에. 시나리오 작성, 프롬프트 생성, 워크플로우 관리를 통합 지원',
  keywords: ['영상 기획', '영상 제작', 'AI 영상', '시나리오', '프롬프트', '워크플로우', 'VideoPlanet'],
  authors: [{ name: 'VideoPlanet Team' }],
  creator: 'VideoPlanet',
  publisher: 'VideoPlanet',

  // Open Graph
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://videoplanet.com',
    siteName: 'VideoPlanet',
    title: 'VideoPlanet - 고성능 영상 기획 및 생성 플랫폼',
    description: 'AI 기반 영상 기획부터 제작까지 한번에',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'VideoPlanet Platform',
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'VideoPlanet - 고성능 영상 기획 및 생성 플랫폼',
    description: 'AI 기반 영상 기획부터 제작까지 한번에',
    images: ['/og-image.png'],
  },

  // 로봇 및 인덱싱
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // 기타 메타데이터
  category: 'technology',
  classification: 'Business',
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
}

// 뷰포트 설정 (모바일 최적화)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

/**
 * Root Layout 컴포넌트
 *
 * 전역 레이아웃과 프로바이더들을 관리합니다.
 * - 전역 에러 처리
 * - 네비게이션 레이아웃
 * - 접근성 기본 설정
 * - 성능 모니터링 초기화
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="ko"
      className={inter.variable}
      suppressHydrationWarning // Next.js 다크모드 깜빡임 방지
    >
      <head>
        {/* 성능 최적화를 위한 리소스 힌트 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://api.videoplanet.com" />

        {/* 파비콘 */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className="min-h-screen bg-white font-sans antialiased"
        suppressHydrationWarning
      >
        {/* 스킵 링크 (접근성) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-primary-600 text-white rounded-md"
          data-testid="skip-link"
        >
          메인 콘텐츠로 건너뛰기
        </a>

        {/* Redux Provider */}
        <ReduxProvider>
          {/* 전역 에러 경계 */}
          <PageErrorBoundary>
            {/* 네비게이션 */}
            <ClientNavigation
              brandText="VideoPlanet"
              brandHref="/"
              data-testid="main-navigation"
            />

            {/* 메인 콘텐츠 */}
            <main
              id="main-content"
              className="flex-1"
              role="main"
              data-testid="main-content"
            >
              {children}
            </main>

            {/* 푸터 */}
            <footer
              className="bg-neutral-50 border-t border-neutral-200 py-8 mt-auto"
              role="contentinfo"
              data-testid="main-footer"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center text-sm text-neutral-600">
                  <p>&copy; 2024 VideoPlanet. All rights reserved.</p>
                  <p className="mt-1">
                    고성능 영상 기획 및 생성 플랫폼
                  </p>
                </div>
              </div>
            </footer>
          </PageErrorBoundary>
        </ReduxProvider>

        {/* 전역 에러 핸들러 초기화 스크립트 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // 전역 에러 핸들러 설정
                if (typeof window !== 'undefined') {
                  // 처리되지 않은 Promise rejection
                  window.addEventListener('unhandledrejection', function(event) {
                    console.error('Unhandled promise rejection:', event.reason);
                  });

                  // 일반적인 JavaScript 에러
                  window.addEventListener('error', function(event) {
                    console.error('Global JavaScript error:', event.error);
                  });
                }
              })();
            `,
          }}
        />
      </body>
    </html>
  )
}