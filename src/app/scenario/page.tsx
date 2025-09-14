'use client';

import React from 'react';

/**
 * 시나리오 페이지 - 임시 구현
 * 빌드 오류 해결을 위한 기본 페이지
 */
export default function ScenarioPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900">AI 영상 기획</h1>
        <p className="mt-4 text-gray-600">스토리 입력을 통한 영상 기획 시스템</p>
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500">기획 도구를 준비 중입니다...</p>
          </div>
        </div>
      </div>
    </div>
  );
}