'use client';

import React from 'react';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import { ScenarioForm } from '@/widgets/scenario.widget';

export default function ScenarioPage() {
  return (
    <Provider store={store}>
      <div className="min-h-screen bg-gradient-to-br from-black via-black-medium to-black-hard">
        {/* 헤더 */}
        <header className="border-b border-white-10 bg-black-soft bg-opacity-80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold text-white">
                  시나리오 생성
                </h1>
                <div className="h-6 w-px bg-white-20" />
                <p className="text-sm text-white-70">
                  상세한 시나리오를 작성하고 생성하세요
                </p>
              </div>

              {/* 브랜드 로고 영역 */}
              <div className="text-brand-primary font-display font-bold text-lg">
                VRIDGE
              </div>
            </div>
          </div>
        </header>

        {/* 메인 컨텐츠 */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 페이지 소개 */}
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              영상 시나리오 생성기
            </h2>
            <p className="text-lg text-white-70 max-w-2xl mx-auto">
              AI를 활용하여 창의적이고 전문적인 영상 시나리오를 생성하세요.
              <br className="hidden sm:block" />
              장르, 스타일, 전개 방식을 선택하여 맞춤형 시나리오를 만들어보세요.
            </p>
          </div>

          {/* 기능 하이라이트 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="text-center p-6 bg-black-medium bg-opacity-50 rounded-xl border border-white-10">
              <div className="w-12 h-12 bg-brand-primary bg-opacity-20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">다양한 장르</h3>
              <p className="text-sm text-white-70">
                드라마, 코미디, 스릴러 등 10가지 장르 지원
              </p>
            </div>

            <div className="text-center p-6 bg-black-medium bg-opacity-50 rounded-xl border border-white-10">
              <div className="w-12 h-12 bg-neon-green bg-opacity-20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-neon-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">전개 구조</h3>
              <p className="text-sm text-white-70">
                기승전결, 3막구조, 순환구조 등 6가지 구조
              </p>
            </div>

            <div className="text-center p-6 bg-black-medium bg-opacity-50 rounded-xl border border-white-10">
              <div className="w-12 h-12 bg-neon-cyan bg-opacity-20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">AI 생성</h3>
              <p className="text-sm text-white-70">
                고도화된 AI로 전문적인 시나리오 자동 생성
              </p>
            </div>
          </div>

          {/* 시나리오 폼 */}
          <div className="flex justify-center">
            <ScenarioForm />
          </div>

          {/* 도움말 섹션 */}
          <div className="mt-16 bg-black-medium bg-opacity-30 rounded-2xl p-8 border border-white-10">
            <h3 className="text-xl font-semibold text-white mb-6 text-center">
              시나리오 작성 가이드
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-medium text-white mb-3">📝 제목 작성 팁</h4>
                <ul className="space-y-2 text-sm text-white-70">
                  <li>• 명확하고 기억하기 쉬운 제목을 선택하세요</li>
                  <li>• 장르와 분위기를 암시하는 단어를 포함하세요</li>
                  <li>• 너무 길지 않게 10-20자 내외로 작성하세요</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-white mb-3">🎬 내용 작성 팁</h4>
                <ul className="space-y-2 text-sm text-white-70">
                  <li>• 주인공과 갈등 상황을 명확히 설명하세요</li>
                  <li>• 시각적으로 표현 가능한 요소를 포함하세요</li>
                  <li>• 감정과 분위기를 구체적으로 묘사하세요</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-white mb-3">🎭 설정 선택 가이드</h4>
                <ul className="space-y-2 text-sm text-white-70">
                  <li>• 장르: 시나리오의 기본 톤을 결정합니다</li>
                  <li>• 스타일: 영상의 시각적 느낌을 설정합니다</li>
                  <li>• 타겟: 시청자 층에 맞는 내용으로 조정됩니다</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-white mb-3">📊 구조 및 강도</h4>
                <ul className="space-y-2 text-sm text-white-70">
                  <li>• 전개 방식: 이야기의 흐름과 구성을 결정합니다</li>
                  <li>• 전개 강도: 긴장감과 감정의 정도를 조절합니다</li>
                  <li>• 조합에 따라 다양한 분위기 연출이 가능합니다</li>
                </ul>
              </div>
            </div>
          </div>
        </main>

        {/* 푸터 */}
        <footer className="border-t border-white-10 bg-black-soft bg-opacity-80 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center text-sm text-white-50">
              <p>© 2024 VRIDGE. 영상 기획 및 생성 전문 플랫폼</p>
            </div>
          </div>
        </footer>
      </div>
    </Provider>
  );
}