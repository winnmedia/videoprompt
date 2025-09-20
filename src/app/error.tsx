'use client';

import React from 'react';
import Link from 'next/link';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log error for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('Page error:', error);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8 text-center">
      <h1 className="mb-2 text-4xl font-bold text-gray-900">오류가 발생했습니다</h1>
      <p className="mb-6 text-gray-600">페이지를 처리하는 중 문제가 발생했습니다.</p>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          홈으로 돌아가기
        </Link>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
            개발자 정보
          </summary>
          <pre className="mt-2 text-xs text-red-600 overflow-auto whitespace-pre-wrap">
            {error.message}
          </pre>
        </details>
      )}
    </div>
  );
}