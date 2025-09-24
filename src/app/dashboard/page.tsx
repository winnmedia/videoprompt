/**
 * DashboardPage - 대시보드 페이지
 * 로그인 후 메인 작업 공간
 */

'use client';

import { useAuth } from '@/features/auth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { isAuthenticated, user, loginAsGuest } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      // 인증되지 않은 사용자는 게스트 로그인 시도
      loginAsGuest().catch(() => {
        // 게스트 로그인도 실패하면 홈으로 리다이렉트
        router.push('/');
      });
    }
  }, [isAuthenticated]); // $300 사건 방지: 함수를 의존성 배열에서 제거

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 페이지 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                대시보드
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                {user?.isGuest ? '게스트 모드로 ' : ''}프로젝트를 관리하고 새로운 콘텐츠를 만들어보세요
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 새 시나리오 만들기 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">새 시나리오</h3>
              <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              AI를 활용하여 창의적인 시나리오를 생성하세요
            </p>
            <a
              href="/scenario"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              시작하기
            </a>
          </div>

          {/* 스토리 생성 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">스토리 생성</h3>
              <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              4단계 구조로 완성된 스토리를 만들어보세요
            </p>
            <a
              href="/story-generator"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              시작하기
            </a>
          </div>

          {/* 12단계 숏트 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">숏트 생성</h3>
              <svg className="h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              12단계 숏트와 콘티를 생성하고 관리하세요
            </p>
            <a
              href="/shots"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            >
              시작하기
            </a>
          </div>

          {/* 콘텐츠 관리 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">콘텐츠 관리</h3>
              <svg className="h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              생성된 모든 콘텐츠를 한 곳에서 관리하세요
            </p>
            <button
              disabled
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-400 cursor-not-allowed"
            >
              준비 중
            </button>
          </div>
        </div>

        {/* 최근 활동 */}
        <div className="mt-8">
          <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">최근 활동</h2>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:p-6">
              <p className="text-sm text-gray-500 text-center">
                아직 활동 기록이 없습니다. 새로운 프로젝트를 시작해보세요!
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
