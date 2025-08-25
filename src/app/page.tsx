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
              <Link href="/planning" className="text-gray-700 hover:text-primary-600 font-medium">
                기획안 관리
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
        <section className="py-20 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              AI로 만드는
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-primary-600">
                전문적인 영상 콘텐츠
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              시나리오부터 영상 제작까지, AI가 도와주는 체계적인 콘텐츠 제작 플랫폼입니다.
              전문가 수준의 영상을 누구나 쉽게 만들 수 있습니다.
            </p>
            
            {/* CTA 버튼 */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="px-8 py-4 text-lg btn-primary"
                onClick={() => window.location.href = '/scenario'}
              >
                시나리오 시작하기
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="px-8 py-4 text-lg btn-secondary"
                onClick={() => window.location.href = '/wizard'}
              >
                영상 생성하기
              </Button>
            </div>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* 빠른 액션 버튼들 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">빠른 시작</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                              <Button 
                variant="outline" 
                size="lg" 
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-2 border-blue-200 hover:border-blue-300 text-blue-700 hover:text-blue-800 font-semibold px-4 py-2 rounded-2xl transition-all duration-300 hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:ring-offset-2 cursor-pointer inline-flex items-center justify-center group"
                onClick={() => window.location.href = '/wizard?mode=image'}
              >
                  <Icon name="image" size="md" className="text-blue-600 group-hover:text-blue-700 transition-colors duration-300" />
                  <span className="font-semibold text-blue-800 group-hover:text-blue-900">AI 이미지 생성</span>
                  <span className="text-xs text-blue-600 group-hover:text-blue-700">Google Imagen / DALL-E</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-2 border-purple-200 hover:border-purple-300 text-purple-700 hover:text-purple-800 font-semibold px-4 py-2 rounded-2xl transition-all duration-300 hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-4 focus:ring-purple-200 focus:ring-offset-2 cursor-pointer inline-flex items-center justify-center group"
                  onClick={() => window.location.href = '/wizard?mode=video'}
                >
                  <Icon name="video" size="md" className="text-purple-600 group-hover:text-purple-700 transition-colors duration-300" />
                  <span className="font-semibold text-purple-800 group-hover:text-purple-900">AI 동영상 생성</span>
                  <span className="text-xs text-purple-600 group-hover:text-purple-700">Google Veo / Seedance</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border-2 border-emerald-200 hover:border-emerald-300 text-emerald-700 hover:text-emerald-800 font-semibold px-4 py-2 rounded-2xl transition-all duration-300 hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-4 focus:ring-emerald-200 focus:ring-offset-2 cursor-pointer inline-flex items-center justify-center group"
                  onClick={() => window.location.href = '/scenario'}
                >
                  <Icon name="wizard" size="md" className="text-emerald-600 group-hover:text-emerald-700 transition-colors duration-300" />
                  <span className="font-semibold text-emerald-800 group-hover:text-emerald-900">AI 시나리오 생성</span>
                  <span className="text-xs text-emerald-600 group-hover:text-emerald-700">GPT-4 / Gemini</span>
                </Button>

                <Button 
                  variant="outline" 
                  size="lg" 
                  className="h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 border-2 border-orange-200 hover:border-orange-300 text-orange-700 hover:text-orange-800 font-semibold px-4 py-2 rounded-2xl transition-all duration-300 hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-4 focus:ring-orange-200 focus:ring-offset-2 cursor-pointer inline-flex items-center justify-center group"
                  onClick={() => window.location.href = '/planning'}
                >
                  <Icon name="projects" size="md" className="text-orange-600 group-hover:text-orange-700 transition-colors duration-300" />
                  <span className="font-semibold text-orange-800 group-hover:text-orange-900">기획안 관리</span>
                  <span className="text-xs text-orange-600 group-hover:text-orange-700">생성된 콘텐츠 관리</span>
                </Button>
              </div>
            </div>
            
            {/* 핵심 기능 소개 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="wizard" size="lg" className="text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">AI 시나리오 개발</h3>
                <p className="text-gray-600">한 줄 스토리로 시작하여 체계적인 4단계 구성과 12개 숏트까지 자동 생성</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="video" size="lg" className="text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">AI 영상 생성</h3>
                <p className="text-gray-600">Seedance, Google Veo3 등 최신 AI 모델로 고품질 영상 자동 생성</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="projects" size="lg" className="text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">통합 관리</h3>
                <p className="text-gray-600">시나리오부터 최종 영상까지 전체 워크플로우를 한 곳에서 관리</p>
              </div>
            </div>
            
            {/* 사용법 가이드 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 transition-all duration-200 overflow-hidden p-8">
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">사용법 가이드</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                                      <h3 className="text-lg font-semibold text-gray-900 mb-3">1단계: 시나리오 작성</h3>
                    <ul className="space-y-2 text-gray-600">
                    <li className="flex items-start space-x-2">
                      <span className="w-5 h-5 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mt-0.5">1</span>
                      <span>간단한 스토리 아이디어 입력</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-5 h-5 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mt-0.5">2</span>
                      <span>장르, 톤앤매너, 타겟 설정</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-5 h-5 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mt-0.5">3</span>
                      <span>AI가 4단계 스토리 구조 생성</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                                      <h3 className="text-lg font-semibold text-gray-900 mb-3">2단계: 영상 제작</h3>
                    <ul className="text-gray-600">
                    <li className="flex items-start space-x-2">
                      <span className="w-5 h-5 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mt-0.5">4</span>
                      <span>12개 숏트로 자동 분해</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-5 h-5 bg-primary-50 text-primary-500 rounded-full flex items-center justify-center text-xs font-medium mt-0.5">5</span>
                      <span>각 숏트별 콘티 이미지 생성</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-5 h-5 bg-primary-50 text-primary-500 rounded-full flex items-center justify-center text-xs font-medium mt-0.5">6</span>
                      <span>AI 영상 생성 및 최종 편집</span>
                    </li>
                  </ul>
                </div>
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
                <li><Link href="/wizard" className="hover:text-white">AI 위저드</Link></li>
                <li><span className="text-gray-500 cursor-not-allowed">문서 (준비 중)</span></li>
                <li><span className="text-gray-500 cursor-not-allowed">튜토리얼 (준비 중)</span></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">회사</h3>
              <ul className="space-y-2 text-gray-400">
                <li><span className="text-gray-500 cursor-not-allowed">소개 (준비 중)</span></li>
                <li><span className="text-gray-500 cursor-not-allowed">블로그 (준비 중)</span></li>
                <li><span className="text-gray-500 cursor-not-allowed">채용 (준비 중)</span></li>
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
