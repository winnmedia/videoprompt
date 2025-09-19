'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-gray-900">오류가 발생했습니다</h1>
          <p className="mb-6 text-gray-600">예상치 못한 오류가 발생했습니다.</p>
          <button
            onClick={reset}
            className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}