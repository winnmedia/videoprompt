import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Logo variant="compact" size="lg" />
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="/wizard" className="text-gray-700 hover:text-primary-600 font-medium">
                장면 마법사
              </Link>
              <Link href="/projects" className="text-gray-700 hover:text-primary-600 font-medium">
                프로젝트
              </Link>
              <Link href="/presets" className="text-gray-700 hover:text-primary-600 font-medium">
                프리셋
              </Link>
            </nav>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                로그인
              </Button>
              <Button size="sm">
                시작하기
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main>
        {/* 히어로 섹션 */}
        <section className="relative bg-gradient-to-br from-primary-50 to-blue-50 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
                  AI로 만드는
                  <span className="text-primary-600 block">영상 시나리오</span>
                </h1>
                <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                  VideoPlanet으로 상상력을 현실로 만들어보세요. 
                  AI가 당신의 아이디어를 전문적인 영상 시나리오로 변환합니다.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/wizard">
                    <Button size="lg" className="w-full sm:w-auto">
                      <Icon name="wizard" size="lg" className="mr-3" />
                      장면 마법사 시작하기
                    </Button>
                  </Link>
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    <Icon name="play" size="lg" className="mr-3" />
                    데모 보기
                  </Button>
                </div>
              </div>
              <div className="flex justify-center">
                <Logo variant="default" size="xl" />
              </div>
            </div>
          </div>
        </section>

        {/* 채팅 UI 섹션 */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                시나리오 입력
              </h2>
              <p className="text-lg text-gray-600">
                AI와 대화하듯 시나리오를 입력하고 창의적인 영상을 만들어보세요
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
              {/* 채팅 헤더 */}
              <div className="bg-primary-600 px-6 py-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <span className="text-white font-medium ml-4">VideoPlanet AI 어시스턴트</span>
                </div>
              </div>

              {/* 채팅 메시지 */}
              <div className="p-6 space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <Icon name="wizard" size="sm" className="text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-sm">
                      <p className="text-gray-800">
                        안녕하세요! 영상 시나리오를 만들어드릴게요. 
                        어떤 장면을 상상하고 계신가요?
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3 justify-end">
                  <div className="flex-1 flex justify-end">
                    <div className="bg-primary-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-sm">
                      <p>
                        아이가 부엌에서 쿠키를 만드는 장면을 만들어주세요!
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <Icon name="user" size="sm" className="text-gray-600" />
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <Icon name="wizard" size="sm" className="text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-sm">
                      <p className="text-gray-800">
                        멋진 아이디어네요! 부엌에서 쿠키를 만드는 따뜻한 장면을 만들어드릴게요. 
                        어떤 분위기로 만들까요?
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 입력 필드 */}
              <div className="border-t border-gray-200 p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="이 곳에 시나리오를 넣어주세요!"
                      className="w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <Button size="lg" className="rounded-full px-6">
                    <Icon name="send" size="sm" className="mr-2" />
                    전송
                  </Button>
                </div>
                <div className="mt-3 text-center">
                  <Link href="/wizard" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                    장면 마법사에서 더 자세한 설정하기 →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 기능 소개 */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                VideoPlanet의 핵심 기능
              </h2>
              <p className="text-lg text-gray-600">
                AI 기술로 영상 제작을 혁신적으로 만들어보세요
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="wizard" size="xl" className="text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">AI 장면 생성</h3>
                <p className="text-gray-600">
                  자연어로 설명하면 AI가 전문적인 영상 시나리오를 자동으로 생성합니다
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="edit" size="xl" className="text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">타임라인 에디터</h3>
                <p className="text-gray-600">
                  2초 구슬 단위로 정밀한 타임라인을 편집하고 액션을 추가할 수 있습니다
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="presets" size="xl" className="text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">프리셋 라이브러리</h3>
                <p className="text-gray-600">
                  다양한 테마와 스타일의 프리셋을 활용하여 빠르게 프로젝트를 시작하세요
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 사용법 */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                간단한 3단계로 시작하기
              </h2>
              <p className="text-lg text-gray-600">
                복잡한 도구 없이도 전문적인 영상을 만들 수 있습니다
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  1
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">시나리오 입력</h3>
                <p className="text-gray-600">
                  원하는 장면을 자연어로 설명하세요. AI가 이해하고 최적화합니다
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  2
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">AI 생성</h3>
                <p className="text-gray-600">
                  OpenAI와 Gemini AI가 협력하여 창의적이고 상세한 장면을 생성합니다
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  3
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">편집 및 완성</h3>
                <p className="text-gray-600">
                  타임라인 에디터로 세밀하게 조정하고 최종 영상을 완성하세요
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 푸터 */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <Logo variant="compact" size="lg" className="mb-4" />
              <p className="text-gray-400">
                AI 기술로 영상 제작을 혁신적으로 만들어가는 VideoPlanet입니다.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">제품</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/wizard" className="hover:text-white">장면 마법사</Link></li>
                <li><Link href="/editor" className="hover:text-white">타임라인 에디터</Link></li>
                <li><Link href="/presets" className="hover:text-white">프리셋</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">지원</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/docs" className="hover:text-white">문서</Link></li>
                <li><Link href="/tutorials" className="hover:text-white">튜토리얼</Link></li>
                <li><Link href="/contact" className="hover:text-white">문의</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">회사</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-white">소개</Link></li>
                <li><Link href="/blog" className="hover:text-white">블로그</Link></li>
                <li><Link href="/careers" className="hover:text-white">채용</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 VideoPlanet. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
