'use client';

import { useEffect } from 'react';

/**
 * 에러 바운더리 컴포넌트
 * 예상치 못한 에러 발생 시 표시
 *
 * CLAUDE.md 원칙:
 * - $300 사건 방지: useEffect 의존성 배열 빈 배열로 설정
 * - 사용자 친화적 에러 메시지
 * - 재시도 기능 제공
 */
interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // 에러 로깅 (프로덕션 환경에서는 에러 리포팅 서비스로 전송)
    console.error('Application Error:', error);
  }, []); // $300 사건 방지: 빈 의존성 배열

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="glass-card max-w-md w-full p-8 text-center">
        {/* 에러 아이콘 */}
        <div className="mb-6">
          <svg
            className="w-20 h-20 mx-auto text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>

        {/* 에러 메시지 */}
        <h1 className="text-2xl font-bold text-white mb-2">
          문제가 발생했습니다
        </h1>
        <p className="text-gray-400 mb-6">
          일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </p>

        {/* 에러 코드 (개발 환경에서만) */}
        {process.env.NODE_ENV === 'development' && error.digest && (
          <p className="text-xs text-gray-500 mb-6 font-mono">
            Error ID: {error.digest}
          </p>
        )}

        {/* 액션 버튼들 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="btn-neon px-6 py-3 rounded-lg font-medium"
          >
            다시 시도
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 rounded-lg font-medium border border-gray-700 hover:bg-gray-900 transition-colors"
          >
            홈으로 이동
          </button>
        </div>
      </div>
    </div>
  );
}