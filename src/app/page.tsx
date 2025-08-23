"use client";
 
import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';

export default function HomePage() {
  const [heroInput, setHeroInput] = useState('');
  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Logo size="lg" />
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="/wizard" className="text-gray-700 hover:text-primary-600 font-medium">
                AI 영상 생성
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
        {/* 히어로 섹션: 문구만 남김 */}
        <section className="relative bg-gradient-to-br from-primary-50 to-blue-50 py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
              AI로 만드는 <span className="text-primary-600">영상 시나리오</span>
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              VideoPlanet으로 상상력을 현실로 만들어보세요. AI가 당신의 아이디어를 전문적인 영상 시나리오로 변환합니다.
            </p>
          </div>
        </section>

        {/* 채팅 UI 섹션: 히어로 바로 아래 배치 */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* 빠른 액션 버튼들 */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                size="lg" 
                className="h-16 flex flex-col items-center justify-center space-y-2"
                onClick={() => window.location.href = '/wizard?mode=image'}
              >
                <Icon name="image" size="lg" className="text-blue-600" />
                <span className="font-medium">AI 이미지 생성</span>
                <span className="text-xs text-gray-500">Google Imagen / DALL-E</span>
              </Button>
              
              <Button 
                variant="outline" 
                size="lg" 
                className="h-16 flex flex-col items-center justify-center space-y-2"
                onClick={() => window.location.href = '/wizard?mode=video'}
              >
                <Icon name="video" size="lg" className="text-green-600" />
                <span className="font-medium">AI 동영상 생성</span>
                <span className="text-xs text-gray-500">Google Veo / Seedance</span>
              </Button>
              
              <Button 
                variant="outline" 
                size="lg" 
                className="h-16 flex flex-col items-center justify-center space-y-2"
                onClick={() => window.location.href = '/wizard?mode=scenario'}
              >
                <Icon name="wizard" size="lg" className="text-purple-600" />
                <span className="font-medium">AI 시나리오 생성</span>
                <span className="text-xs text-gray-500">GPT-4 / Gemini</span>
              </Button>
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
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const q = encodeURIComponent(heroInput.trim());
                    window.location.href = q ? `/wizard?q=${q}` : '/wizard';
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={heroInput}
                        onChange={(e) => setHeroInput(e.target.value)}
                        placeholder="이 곳에 시나리오를 넣어주세요!"
                        className="w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <Button size="lg" className="rounded-full px-6" type="submit" data-testid="landing-generate-btn">
                      <Icon name="wizard" size="sm" className="mr-2" />
                      AI 생성 시작
                    </Button>
                  </div>
                </form>
                <div className="mt-3 text-center">
                  <Link href="/wizard" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                    AI 영상 생성에서 더 자세한 설정하기 →
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
                  <Icon name="image" size="xl" className="text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">AI 이미지 생성</h3>
                <p className="text-gray-600">
                  Google Imagen 4.0과 OpenAI DALL-E 3를 활용하여 고품질 이미지를 생성합니다
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="video" size="xl" className="text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">AI 동영상 생성</h3>
                <p className="text-gray-600">
                  Google Veo 3와 Seedance ModelArk를 통해 창의적인 동영상을 제작합니다
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="wizard" size="xl" className="text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">AI 시나리오 생성</h3>
                <p className="text-gray-600">
                  GPT-4와 Gemini AI가 협력하여 전문적인 영상 시나리오를 자동 생성합니다
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
                <h3 className="text-xl font-semibold text-gray-900 mb-3">AI 모델 선택</h3>
                <p className="text-gray-600">
                  이미지, 동영상, 시나리오 중 원하는 AI 생성 모드를 선택하세요
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  2
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">프롬프트 입력</h3>
                <p className="text-gray-600">
                  원하는 결과물을 자연어로 설명하세요. AI가 최적의 설정을 자동으로 구성합니다
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  3
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">AI 생성 및 완성</h3>
                <p className="text-gray-600">
                  선택한 AI 모델이 창의적인 콘텐츠를 생성하고, 필요시 세밀하게 조정할 수 있습니다
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
              <Logo size="lg" className="mb-4" />
              <p className="text-gray-400">
                AI 기술로 영상 제작을 혁신적으로 만들어가는 VideoPlanet입니다.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">제품</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/wizard" className="hover:text-white">AI 영상 생성</Link></li>
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
