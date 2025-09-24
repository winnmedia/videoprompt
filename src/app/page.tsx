/**
 * HomePage - 메인 랜딩 페이지
 * 사용자가 처음 방문하는 페이지
 */

'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth';

export default function HomePage() {
  const router = useRouter();
  const { loginAsGuest, isLoading, isAuthenticated, user } = useAuth();

  const handleGuestStart = async () => {
    try {
      await loginAsGuest();
      router.push('/scenario');
    } catch (error) {
      console.error('게스트 로그인 실패:', error);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">

      <main>
        {/* Hero section */}
        <div className="relative">
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gray-100" />
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div className="relative shadow-xl sm:rounded-2xl sm:overflow-hidden">
              <div className="absolute inset-0">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 mix-blend-multiply" />
              </div>
              <div className="relative px-4 py-16 sm:px-6 sm:py-24 lg:py-32 lg:px-8">
                <h1 className="text-center text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                  <span className="block text-white">AI 기반</span>
                  <span className="block text-indigo-200">비디오 기획 플랫폼</span>
                </h1>
                <p className="mt-6 max-w-lg mx-auto text-center text-xl text-indigo-200 sm:max-w-3xl">
                  아이디어에서 완성된 영상까지, AI가 도와주는 창의적 여정을 시작하세요.
                  시나리오부터 스토리보드까지 한 번에 완성하세요.
                </p>
                <div className="mt-10 max-w-sm mx-auto sm:max-w-none sm:flex sm:justify-center">
                  <div className="space-y-4 sm:space-y-0 sm:mx-auto sm:inline-grid sm:grid-cols-2 sm:gap-5">
                    {isAuthenticated ? (
                      <a
                        href="/dashboard"
                        className="flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-indigo-700 bg-white hover:bg-indigo-50 sm:px-8"
                      >
                        대시보드로 이동
                      </a>
                    ) : (
                      <button
                        onClick={handleGuestStart}
                        disabled={isLoading}
                        className="flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-indigo-700 bg-white hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed sm:px-8"
                      >
                        {isLoading ? '로그인 중...' : '게스트로 시작하기'}
                      </button>
                    )}
                    <a
                      href={isAuthenticated ? "/scenario" : "/login"}
                      className="flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-500 bg-opacity-60 hover:bg-opacity-70 sm:px-8"
                    >
                      {isAuthenticated ? '시나리오 만들기' : '로그인'}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature section */}
        <div className="relative bg-white py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-md px-4 text-center sm:max-w-3xl sm:px-6 lg:px-8 lg:max-w-7xl">
            <h2 className="text-base font-semibold tracking-wide text-indigo-600 uppercase">
              VideoPlanet
            </h2>
            <p className="mt-2 text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
              영상 제작의 모든 과정을 한 곳에서
            </p>
            <p className="mt-5 max-w-prose mx-auto text-xl text-gray-500">
              AI의 도움을 받아 아이디어를 완성된 영상 기획안으로 변환하세요.
            </p>

            <div className="mt-12">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                <div className="pt-6">
                  <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8">
                    <div className="-mt-6">
                      <div>
                        <span className="inline-flex items-center justify-center p-3 bg-indigo-500 rounded-md shadow-lg">
                          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </span>
                      </div>
                      <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                        AI 시나리오 생성
                      </h3>
                      <p className="mt-5 text-base text-gray-500">
                        아이디어만 제공하면 AI가 완성도 높은 시나리오를 생성합니다.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8">
                    <div className="-mt-6">
                      <div>
                        <span className="inline-flex items-center justify-center p-3 bg-indigo-500 rounded-md shadow-lg">
                          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </span>
                      </div>
                      <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                        4단계 스토리 구성
                      </h3>
                      <p className="mt-5 text-base text-gray-500">
                        기승전결 구조로 체계적인 스토리텔링을 구현합니다.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8">
                    <div className="-mt-6">
                      <div>
                        <span className="inline-flex items-center justify-center p-3 bg-indigo-500 rounded-md shadow-lg">
                          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </span>
                      </div>
                      <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                        스토리보드 제작
                      </h3>
                      <p className="mt-5 text-base text-gray-500">
                        자동으로 생성된 12단계 숏트와 시각적 콘티를 제공합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 md:flex md:items-center md:justify-between lg:px-8">
          <div className="md:flex md:order-1">
            <p className="text-center text-base text-gray-400">
              &copy; 2024 VideoPlanet. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
