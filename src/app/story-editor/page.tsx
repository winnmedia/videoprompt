/**
 * 스토리 편집 전용 페이지
 * UserJourneyMap 6단계 - 스토리 편집 및 썸네일 생성
 * 임시 구현 - Phase 8.2에서 완성 예정
 */

'use client';

export default function StoryEditorPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                스토리 편집
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                생성된 스토리를 편집하고 개선하세요
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="mx-auto h-24 w-24 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">스토리 편집 기능</h2>
            <p className="text-gray-600 mb-6">
              이 기능은 Phase 8.2에서 완전히 구현될 예정입니다.<br/>
              실시간 편집, 자동 저장, 버전 관리 기능을 제공합니다.
            </p>

            <div className="inline-flex rounded-md shadow">
              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                이전으로
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}