'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
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
    return s.split(',').map(v => v.trim()).filter(Boolean);
  }, []);
  const clientJobActive = useMemo(() => !!(mounted && (jobId || (jobIds && jobIds.length))), [mounted, jobId, jobIds]);

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

  // Seedance polling status (unchanged)
  const [seedanceStatuses, setSeedanceStatuses] = useState<Record<string, { status: string; progress?: number; videoUrl?: string }>>({});
  useEffect(() => {
    const ids = jobIds.length ? jobIds : (jobId ? [jobId] : []);
    if (!ids.length) return;
    let cancel = false; let t: any; let interval = 2000;
    const pollOne = async (id: string) => {
      try {
        const res = await fetch(`/api/seedance/status/${encodeURIComponent(id)}`);
        const json = await res.json();
        if (!cancel) setSeedanceStatuses(prev => ({ ...prev, [id]: { status: json.status, progress: json.progress, videoUrl: json.videoUrl } }));
      } catch {}
    };
    const tick = async () => {
      await Promise.all(ids.map(pollOne));
      if (!cancel) { t = setTimeout(tick, interval); interval = Math.min(10000, Math.floor(interval * 1.3)); }
    };
    tick();
    return () => { cancel = true; if (t) clearTimeout(t); };
  }, [jobId, jobIds]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Icon name="edit" size="lg" className="text-primary-500" />
              <h1 className="text-2xl font-bold text-gray-900">에디터</h1>
              <span className="text-sm text-gray-500">프로젝트 ID: {id}</span>
            </div>
            <div className="flex items-center space-x-3">
              {lastPromptRaw && (
                <Button variant="outline" onClick={handleCopyVeo3} data-testid="editor-copy-veo3" title="최종 프롬프트 복사">
                  <Icon name="copy" size="sm" className="mr-2" />프롬프트 복사
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 gap-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Seedance 생성 상태</h2>
              <div className="text-xs text-gray-500">{jobIds.length ? `Jobs: ${jobIds.join(', ')}` : (jobId ? `Job ID: ${jobId}` : 'Job 없음')}</div>
            </div>

            {clientJobActive ? (
              jobIds.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {jobIds.map((jid) => (
                    <div key={jid} className="border rounded p-3 bg-white">
                      <div className="text-xs text-gray-500 mb-1">{jid}</div>
                      <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
                        <div className="bg-primary-500 h-2" style={{ width: `${Math.min(100, (seedanceStatuses[jid]?.progress ?? 5))}%` }} />
                      </div>
                      <div className="mt-2 text-sm text-gray-700">상태: {seedanceStatuses[jid]?.status || 'processing'}{seedanceStatuses[jid]?.progress != null ? ` • ${seedanceStatuses[jid]?.progress}%` : ''}</div>
                      <div className="mt-2">
                        {seedanceStatuses[jid]?.videoUrl ? (
                          <>
                            <video src={seedanceStatuses[jid]?.videoUrl} controls className="w-full rounded border" autoPlay muted />
                            <div className="mt-2 flex items-center gap-2">
                              <a href={seedanceStatuses[jid]?.videoUrl!} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline">새 탭에서 열기</a>
                              <a href={seedanceStatuses[jid]?.videoUrl!} download className="text-xs text-secondary-700 hover:underline">다운로드</a>
                            </div>
                          </>
                        ) : (
                          <div className="aspect-video w-full bg-gray-100 rounded border grid place-items-center text-sm text-gray-500">영상 준비 중…</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
                    <div className="bg-primary-500 h-2" style={{ width: `${Math.min(100, (seedanceStatuses[jobId]?.progress ?? 5))}%` }} />
                  </div>
                  <div className="mt-2 text-sm text-gray-700">상태: {seedanceStatuses[jobId]?.status || 'processing'}{seedanceStatuses[jobId]?.progress != null ? ` • ${seedanceStatuses[jobId]?.progress}%` : ''}</div>
                  <div className="mt-2">
                    {seedanceStatuses[jobId]?.videoUrl ? (
                      <>
                        <video src={seedanceStatuses[jobId]?.videoUrl} controls className="w-full rounded border" autoPlay muted />
                        <div className="mt-2 flex items-center gap-2">
                          <a href={seedanceStatuses[jobId]?.videoUrl} target="_blank" rel="noreferrer" className="text-sm text-primary-600 hover:underline">새 탭에서 열기</a>
                          <a href={seedanceStatuses[jobId]?.videoUrl} download className="text-sm text-secondary-700 hover:underline">다운로드</a>
                        </div>
                      </>
                    ) : (
                      <div className="aspect-video w-full bg-gray-100 rounded border grid place-items-center text-sm text-gray-500">영상 준비 중…</div>
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


