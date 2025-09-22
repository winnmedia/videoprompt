/**
 * Error Actions Client Component
 *
 * ErrorBoundary의 액션 버튼들을 위한 순수한 Client Component
 * Next.js 15 이벤트 핸들러 제한 해결
 */

'use client';

import React from 'react';

interface ErrorActionsProps {
  errorId?: string;
  onRetry: () => void;
  onReport?: () => void;
}

export function ErrorActions({ errorId, onRetry, onReport }: ErrorActionsProps) {
  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleReport = () => {
    if (!errorId || !onReport) return;

    if (typeof window !== 'undefined') {
      const subject = encodeURIComponent(`에러 신고: ${errorId}`);
      const body = encodeURIComponent(
        `에러 ID: ${errorId}\n` +
        `발생 시간: ${new Date().toLocaleString()}\n` +
        `URL: ${window.location.href}\n` +
        `추가 정보를 입력해주세요:`
      );
      window.open(`mailto:support@videoplanet.com?subject=${subject}&body=${body}`);
    }

    onReport();
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
      >
        다시 시도
      </button>

      <button
        onClick={handleReload}
        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
      >
        페이지 새로고침
      </button>

      {errorId && onReport && (
        <button
          onClick={handleReport}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          에러 신고
        </button>
      )}
    </div>
  );
}