import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VideoPrompt - AI 영상 생성 플랫폼',
  description: 'AI를 활용한 전문가 수준의 영상 콘텐츠 생성 및 관리 플랫폼',
  keywords: 'AI, 영상 생성, 비디오, 콘텐츠, 프롬프트',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                {/* 로고 */}
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <h1 className="text-2xl font-bold text-primary-600">
                      VideoPrompt
                    </h1>
                  </div>
                </div>

                {/* 네비게이션 */}
                <nav className="hidden md:flex space-x-8">
                  <a
                    href="/"
                    className="text-gray-900 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    홈
                  </a>
                  <a
                    href="/prompt-generator"
                    className="text-gray-900 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    프롬프트 생성기
                  </a>
                  <a
                    href="/workflow"
                    className="text-gray-900 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    영상 제작
                  </a>
                  <a
                    href="/scenario"
                    className="text-gray-900 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    시나리오 개발
                  </a>
                  <a
                    href="/planning"
                    className="text-gray-900 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    콘텐츠 관리
                  </a>
                </nav>

                {/* 사용자 메뉴 */}
                <div className="flex items-center space-x-4">
                  <button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    시작하기
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main>{children}</main>

          <footer className="bg-white border-t border-gray-200 mt-16">
            <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="col-span-1 md:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    VideoPrompt
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    AI를 활용한 전문가 수준의 영상 콘텐츠 생성 및 관리 플랫폼입니다. 
                    복잡한 설정 없이 3단계만으로 전문가 수준의 영상을 제작할 수 있습니다.
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">제품</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li><a href="/prompt-generator" className="hover:text-primary-600">프롬프트 생성기</a></li>
                    <li><a href="/workflow" className="hover:text-primary-600">영상 제작</a></li>
                    <li><a href="/scenario" className="hover:text-primary-600">시나리오 개발</a></li>
                    <li><a href="/planning" className="hover:text-primary-600">콘텐츠 관리</a></li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">지원</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li><a href="/docs" className="hover:text-primary-600">문서</a></li>
                    <li><a href="/api" className="hover:text-primary-600">API</a></li>
                    <li><a href="/contact" className="hover:text-primary-600">문의</a></li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-8 pt-8 border-t border-gray-200">
                <p className="text-sm text-gray-500 text-center">
                  © 2025 VideoPrompt. All rights reserved.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
