'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSeedancePolling } from '@/features/seedance/status';
import { Button } from '@/shared/ui';
import { Icon } from '@/shared/ui';
import { buildVeo3PromptFromScene } from '@/lib/veo3';
import { translateToEnglish } from '@/lib/ai-client';

interface EditorClientProps {
  id: string;
}

export default function EditorClient({ id }: EditorClientProps) {
  const [lastPromptRaw, setLastPromptRaw] = useState<any | null>(null);
  const [mounted, setMounted] = useState(false);

  // query param: job(s)
  const jobId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const p = new URLSearchParams(window.location.search);
    return p.get('job') || '';
  }, []);
  const jobIds = useMemo(() => {
    if (typeof window === 'undefined') return [] as string[];
    const p = new URLSearchParams(window.location.search);
    const s = p.get('jobs') || '';
    return s
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }, []);
  const clientJobActive = useMemo(
    () => !!(mounted && (jobId || (jobIds && jobIds.length))),
    [mounted, jobId, jobIds],
  );

  useEffect(() => {
    setMounted(true);
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('vp:lastPrompt') : null;
      if (raw) setLastPromptRaw(JSON.parse(raw));
    } catch {}
  }, []);

  const handleCopyVeo3 = async () => {
    try {
      if (!lastPromptRaw) return;
      const veo3 = buildVeo3PromptFromScene(lastPromptRaw);
      const english = await translateToEnglish(veo3);
      await navigator.clipboard.writeText(english);
      alert('Veo3용 프롬프트를 복사했습니다.');
    } catch (e) {
      console.error('copy failed', e);
    }
  };

  // Seedance polling moved to features hook (FSD)
  const seedanceIdList = useMemo(
    () => (jobIds.length ? jobIds : jobId ? [jobId] : []),
    [jobId, jobIds],
  );
  const { statuses: seedanceStatuses } = useSeedancePolling(seedanceIdList);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <Icon name="edit" size="lg" className="text-primary-500" />
              <h1 className="text-2xl font-bold text-gray-900">타임라인 에디터</h1>
              <span className="text-sm text-gray-500">프로젝트 ID: {id}</span>
            </div>
            <div className="flex items-center space-x-3">
              {lastPromptRaw && (
                <Button
                  variant="outline"
                  onClick={handleCopyVeo3}
                  data-testid="editor-copy-veo3"
                  title="최종 프롬프트 복사"
                >
                  <Icon name="copy" size="sm" className="mr-2" />
                  프롬프트 복사
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Seedance 생성 상태</h2>
              <div className="text-xs text-gray-500">
                {jobIds.length
                  ? `Jobs: ${jobIds.join(', ')}`
                  : jobId
                    ? `Job ID: ${jobId}`
                    : 'Job 없음'}
              </div>
            </div>

            {clientJobActive ? (
              jobIds.length ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {jobIds.map((jid) => (
                    <div key={jid} className="rounded border bg-white p-3">
                      <div className="mb-1 text-xs text-gray-500">{jid}</div>
                      <div className="h-2 w-full overflow-hidden rounded bg-gray-200">
                        <div
                          className="h-2 bg-primary-500"
                          style={{
                            width: `${Math.min(100, seedanceStatuses[jid]?.progress ?? 5)}%`,
                          }}
                        />
                      </div>
                      <div className="mt-2 text-sm text-gray-700">
                        상태: {seedanceStatuses[jid]?.status || 'processing'}
                        {seedanceStatuses[jid]?.progress != null
                          ? ` • ${seedanceStatuses[jid]?.progress}%`
                          : ''}
                      </div>
                      <div className="mt-2">
                        {seedanceStatuses[jid]?.videoUrl ? (
                          <>
                            <video
                              src={seedanceStatuses[jid]?.videoUrl}
                              controls
                              className="w-full rounded border"
                              autoPlay
                              muted
                            />
                            <div className="mt-2 flex items-center gap-2">
                              <a
                                href={seedanceStatuses[jid]?.videoUrl!}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary-600 hover:underline"
                              >
                                새 탭에서 열기
                              </a>
                              <a
                                href={seedanceStatuses[jid]?.videoUrl!}
                                download
                                className="text-xs text-secondary-700 hover:underline"
                              >
                                다운로드
                              </a>
                            </div>
                          </>
                        ) : (
                          <div className="grid aspect-video w-full place-items-center rounded border bg-gray-100 text-sm text-gray-500">
                            영상 준비 중…
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <div className="h-2 w-full overflow-hidden rounded bg-gray-200">
                    <div
                      className="h-2 bg-primary-500"
                      style={{ width: `${Math.min(100, seedanceStatuses[jobId]?.progress ?? 5)}%` }}
                    />
                  </div>
                  <div className="mt-2 text-sm text-gray-700">
                    상태: {seedanceStatuses[jobId]?.status || 'processing'}
                    {seedanceStatuses[jobId]?.progress != null
                      ? ` • ${seedanceStatuses[jobId]?.progress}%`
                      : ''}
                  </div>
                  <div className="mt-2">
                    {seedanceStatuses[jobId]?.videoUrl ? (
                      <>
                        <video
                          src={seedanceStatuses[jobId]?.videoUrl}
                          controls
                          className="w-full rounded border"
                          autoPlay
                          muted
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <a
                            href={seedanceStatuses[jobId]?.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-primary-600 hover:underline"
                          >
                            새 탭에서 열기
                          </a>
                          <a
                            href={seedanceStatuses[jobId]?.videoUrl}
                            download
                            className="text-sm text-secondary-700 hover:underline"
                          >
                            다운로드
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className="grid aspect-video w-full place-items-center rounded border bg-gray-100 text-sm text-gray-500">
                        영상 준비 중…
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="text-sm text-gray-600">
                Seedance 작업 정보가 없습니다. 위저드에서 생성 후 "에디터로 열기"를 눌러주세요.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
