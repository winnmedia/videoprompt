'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/shared/ui';
import { safeFetch } from '@/shared/lib/api-retry';

export default function TestVideoPage() {
  const [prompt, setPrompt] = useState('a beautiful sunset over mountains');
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [provider, setProvider] = useState('auto');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 업로드 관련 상태
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateVideo = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await safeFetch('/api/video/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          duration,
          aspectRatio,
          provider,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
      setResult({ error: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 파일 타입 검증
      const allowedTypes = ['video/mp4', 'video/webm', 'video/mov', 'video/quicktime'];
      if (!allowedTypes.includes(file.type)) {
        alert('지원되지 않는 파일 형식입니다. MP4, WebM, MOV 파일만 업로드 가능합니다.');
        return;
      }

      // 파일 크기 검증 (100MB)
      const maxSize = 100 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('파일 크기가 100MB를 초과합니다.');
        return;
      }

      setUploadFile(file);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('video', uploadFile);
      formData.append('userId', 'test-user-' + Date.now());
      formData.append('slot', 'test-upload');

      // 진행률 시뮬레이션
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + Math.random() * 20, 90));
      }, 200);

      const response = await safeFetch('/api/upload/video', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();
      setUploadResult(data);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '업로드 중 오류가 발생했습니다';
      setUploadResult({ ok: false, error: errorMessage });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const resetUpload = () => {
    setUploadFile(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">AI 영상 생성 & 업로드 테스트</h1>

        {/* 영상 업로드 섹션 */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold">📹 영상 업로드 테스트</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                영상 파일 선택 (MP4, WebM, MOV | 최대 100MB)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/mov,video/quicktime"
                onChange={handleFileSelect}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {uploadFile && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm text-blue-800">
                  선택된 파일: {uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              </div>
            )}

            {uploading && uploadProgress > 0 && (
              <div className="w-full rounded-full bg-gray-200">
                <div
                  className="rounded-full bg-blue-600 p-0.5 text-center text-xs font-medium leading-none text-blue-100 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                >
                  {Math.round(uploadProgress)}%
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="bg-green-600 hover:bg-green-700"
              >
                {uploading ? '업로드 중...' : '업로드 시작'}
              </Button>

              {uploadFile && (
                <Button
                  onClick={resetUpload}
                  disabled={uploading}
                  className="bg-gray-600 hover:bg-gray-700"
                >
                  재설정
                </Button>
              )}
            </div>
          </div>

          {/* 업로드 결과 */}
          {uploadResult && (
            <div className="mt-4 space-y-4">
              <div className={`rounded-md border p-3 ${
                uploadResult.ok
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}>
                <p className="font-medium">
                  {uploadResult.ok ? '✅ 업로드 성공!' : '❌ 업로드 실패'}
                </p>
                {uploadResult.error && (
                  <p className="text-sm">{uploadResult.error}</p>
                )}
              </div>

              {uploadResult.ok && uploadResult.videoUrl && (
                <div>
                  <h3 className="mb-2 font-medium">업로드된 영상 재생:</h3>
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <video
                      src={uploadResult.videoUrl}
                      controls
                      className="w-full max-w-lg"
                      preload="metadata"
                    >
                      브라우저가 영상 재생을 지원하지 않습니다.
                    </video>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div><strong>업로드 ID:</strong> {uploadResult.uploadId}</div>
                    <div><strong>파일명:</strong> {uploadResult.fileName}</div>
                    <div><strong>크기:</strong> {(uploadResult.fileSize / (1024 * 1024)).toFixed(2)} MB</div>
                    <div><strong>타입:</strong> {uploadResult.fileType}</div>
                    <div><strong>저장 경로:</strong> {uploadResult.storagePath}</div>
                    <div><strong>업로드 방식:</strong> {uploadResult.uploadMethod}</div>
                  </div>

                  <div className="mt-2">
                    <a
                      href={uploadResult.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline text-sm"
                    >
                      새 탭에서 영상 보기 →
                    </a>
                  </div>
                </div>
              )}

              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                  전체 업로드 응답 데이터 보기
                </summary>
                <pre className="mt-2 overflow-auto rounded-md bg-gray-100 p-3 text-xs">
                  {JSON.stringify(uploadResult, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>

        <div className="mb-6 rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold">영상 생성 설정</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">프롬프트</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="영상 내용을 설명해주세요..."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  지속시간 (초)
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="30"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">비율</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="16:9">16:9 (와이드스크린)</option>
                  <option value="9:16">9:16 (세로)</option>
                  <option value="1:1">1:1 (정사각형)</option>
                  <option value="21:9">21:9 (울트라와이드)</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">제공자</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="auto">자동 선택</option>
                  <option value="seedance">Seedance</option>
                  <option value="veo" disabled>Google Veo3 (일시 중단)</option>
                  <option value="mock">Mock (테스트용)</option>
                </select>
              </div>
            </div>

            <Button onClick={handleCreateVideo} disabled={loading} className="w-full md:w-auto">
              {loading ? '생성 중...' : '영상 생성하기'}
            </Button>
          </div>
        </div>

        {result && (
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-semibold">생성 결과</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">상태:</span> {result.ok ? '성공' : '실패'}
                </div>
                <div>
                  <span className="font-medium">제공자:</span> {result.provider}
                </div>
                {result.jobId && (
                  <div>
                    <span className="font-medium">작업 ID:</span> {result.jobId}
                  </div>
                )}
                {result.status && (
                  <div>
                    <span className="font-medium">상태:</span> {result.status}
                  </div>
                )}
                {result.duration && (
                  <div>
                    <span className="font-medium">지속시간:</span> {result.duration}초
                  </div>
                )}
                {result.aspectRatio && (
                  <div>
                    <span className="font-medium">비율:</span> {result.aspectRatio}
                  </div>
                )}
              </div>

              {result.message && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                  <p className="text-blue-800">{result.message}</p>
                </div>
              )}

              {result.note && (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
                  <p className="text-yellow-800">{result.note}</p>
                </div>
              )}

              {result.videoUrl && (
                <div>
                  <h3 className="mb-2 font-medium">생성된 영상:</h3>
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <video
                      src={result.videoUrl}
                      controls
                      className="w-full max-w-lg"
                      preload="metadata"
                    >
                      브라우저가 영상 재생을 지원하지 않습니다.
                    </video>
                  </div>

                  <div className="mt-2">
                    <a
                      href={result.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline text-sm"
                    >
                      새 탭에서 영상 보기 →
                    </a>
                  </div>
                </div>
              )}

              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                  전체 응답 데이터 보기
                </summary>
                <pre className="mt-2 overflow-auto rounded-md bg-gray-100 p-3 text-xs">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
