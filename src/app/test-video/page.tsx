'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/ui';

export default function TestVideoPage() {
  const [prompt, setPrompt] = useState('a beautiful sunset over mountains');
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [provider, setProvider] = useState('auto');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleCreateVideo = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/video/create', {
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">AI 영상 생성 테스트</h1>

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
                  <option value="veo">Google Veo3</option>
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
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                    <img
                      src={result.videoUrl}
                      alt="Generated video"
                      className="h-auto max-w-full"
                    />
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
