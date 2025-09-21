/**
 * 업로드 기능 테스트 페이지
 */

'use client';

import { useState } from 'react';
import { FileUploadZone } from '@/features/upload';
import { logger } from '@/shared/lib/logger';

export default function UploadTestPage() {
  const [uploadResults, setUploadResults] = useState<Array<{
    id: string;
    fileName: string;
    downloadUrl: string;
    uploadId: string;
    uploadedAt: string;
  }>>([]);

  const [error, setError] = useState<string | null>(null);

  const handleUploadComplete = (result: { downloadUrl: string; uploadId: string }) => {
    const newResult = {
      id: crypto.randomUUID(),
      fileName: '업로드된 파일', // 실제로는 파일명을 전달받아야 함
      downloadUrl: result.downloadUrl,
      uploadId: result.uploadId,
      uploadedAt: new Date().toLocaleString('ko-KR'),
    };

    setUploadResults(prev => [newResult, ...prev]);
    setError(null);

    logger.info('✅ 업로드 완료:', newResult);
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
    logger.debug('❌ 업로드 에러:', errorMessage);
  };

  const clearResults = () => {
    setUploadResults([]);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            파일 업로드 테스트
          </h1>
          <p className="text-gray-600">
            S3 Presigned URL 기반 파일 업로드 기능을 테스트해보세요
          </p>
        </div>

        {/* 업로드 존 */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            파일 업로드
          </h2>

          <FileUploadZone
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
            acceptedTypes={['video/*', 'image/*', 'application/pdf']}
            maxFileSize={100 * 1024 * 1024} // 100MB (테스트용)
            showProgress={true}
          />

          {/* 에러 메시지 */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="text-red-800 font-medium mb-2">업로드 오류</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* 업로드 결과 */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              업로드 기록 ({uploadResults.length})
            </h2>
            {uploadResults.length > 0 && (
              <button
                onClick={clearResults}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                기록 지우기
              </button>
            )}
          </div>

          {uploadResults.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>아직 업로드된 파일이 없습니다.</p>
              <p className="text-sm mt-1">파일을 업로드하면 여기에 표시됩니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {uploadResults.map((result) => (
                <div
                  key={result.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-1">
                        {result.fileName}
                      </h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>업로드 ID: <code className="bg-gray-100 px-1 rounded">{result.uploadId}</code></p>
                        <p>업로드 시간: {result.uploadedAt}</p>
                      </div>
                    </div>
                    <div className="ml-4">
                      <a
                        href={result.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        파일 보기
                      </a>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 break-all">
                      URL: {result.downloadUrl}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API 정보 */}
        <div className="mt-8 bg-gray-900 text-white rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">API 엔드포인트</h3>
          <div className="space-y-2 text-sm font-mono">
            <div>
              <span className="text-green-400">POST</span>
              <span className="text-blue-400 ml-2">/api/upload/presigned-url</span>
              <span className="text-gray-400 ml-2">- S3 Presigned URL 생성</span>
            </div>
            <div>
              <span className="text-green-400">POST</span>
              <span className="text-blue-400 ml-2">/api/upload/chunk</span>
              <span className="text-gray-400 ml-2">- 청크 업로드 (대용량 파일)</span>
            </div>
            <div>
              <span className="text-green-400">POST</span>
              <span className="text-blue-400 ml-2">/api/upload/complete</span>
              <span className="text-gray-400 ml-2">- 업로드 완료 확인</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}