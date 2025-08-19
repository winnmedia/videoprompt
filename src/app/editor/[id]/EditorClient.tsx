'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TimelineBead } from '@/types/api';
import { buildVeo3PromptFromScene } from '@/lib/veo3';
import { translateToEnglish } from '@/lib/ai-client';

interface EditorClientProps {
  id: string;
}

export default function EditorClient({ id }: EditorClientProps) {
  const [timeline, setTimeline] = useState<TimelineBead[]>([]);
  const [selectedBead, setSelectedBead] = useState<TimelineBead | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [lastPromptRaw, setLastPromptRaw] = useState<any | null>(null);
  const [mounted, setMounted] = useState(false);

  // query param: job
  const jobId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const p = new URLSearchParams(window.location.search);
    return p.get('job') || '';
  }, []);
  const jobIds = useMemo(() => {
    if (typeof window === 'undefined') return [] as string[];
    const p = new URLSearchParams(window.location.search);
    const s = p.get('jobs') || '';
    const arr = s.split(',').map(v => v.trim()).filter(Boolean);
    return arr;
  }, []);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('vp:lastPrompt') : null;
      if (raw) {
        setLastPromptRaw(JSON.parse(raw));
        const duration = 2;
        const initial: TimelineBead[] = [
          {
            id: 'bead-1',
            sequence: 1,
            startTime: 0,
            endTime: duration,
            duration,
            sceneId: 'scene-1',
            actions: [],
            audio: [],
            transitions: [],
          },
        ];
        setTimeline(initial);
        setTotalDuration(duration);
        return;
      }
    } catch (_) {}

    const sampleTimeline: TimelineBead[] = [
      { id: '1', sequence: 1, startTime: 0, endTime: 2, duration: 2, sceneId: 'scene-1', actions: [], audio: [], transitions: [] },
    ];
    setTimeline(sampleTimeline);
    setTotalDuration(2);
  }, []);

  const handlePlayPause = () => setIsPlaying(!isPlaying);
  const handleStop = () => { setIsPlaying(false); setCurrentTime(0); };
  const handleBeadClick = (bead: TimelineBead) => setSelectedBead(bead);

  const handleCopyVeo3 = async () => {
    try {
      if (!lastPromptRaw) {
        alert('마법사에서 불러온 프롬프트가 없습니다.');
        return;
      }
      const veo3 = buildVeo3PromptFromScene(lastPromptRaw);
      const english = await translateToEnglish(veo3);
      await navigator.clipboard.writeText(english);
      alert('Veo3용 프롬프트를 복사했습니다.');
    } catch (e) {
      console.error('copy failed', e);
      // no-op UI fallback
    }
  };

  // Seedance polling status
  const [seedanceStatus, setSeedanceStatus] = useState<{ status: string; progress?: number; videoUrl?: string } | null>(null);
  const [seedanceStatuses, setSeedanceStatuses] = useState<Record<string, { status: string; progress?: number; videoUrl?: string }>>({});
  useEffect(()=>{
    const ids = jobIds.length ? jobIds : (jobId ? [jobId] : []);
    if (!ids.length) return;
    let cancel = false;
    let timers: any[] = [];
    const state: Record<string, { status: string; progress?: number; videoUrl?: string }> = {};
    const pollOne = async (id: string) => {
      try {
        const res = await fetch(`/api/seedance/status/${encodeURIComponent(id)}`);
        const json = await res.json();
        state[id] = { status: json.status, progress: json.progress, videoUrl: json.videoUrl };
        if (!cancel) {
          setSeedanceStatuses(prev => ({ ...prev, [id]: state[id] }));
          setSeedanceStatus({ status: `multi`, progress: 0 });
        }
      } catch {}
    };
    let interval = 2000;
    const tick = async () => {
      await Promise.all(ids.map(pollOne));
      // 지수 백오프 (최대 10초)
      interval = Math.min(10000, Math.floor(interval * 1.3));
      if (!cancel) timers.push(setTimeout(tick, interval));
    };
    tick();
    return ()=>{ cancel = true; timers.forEach(clearTimeout); };
  }, [jobId, jobIds]);

  const recalcTotals = (beads: TimelineBead[]) => {
    const newTotal = beads.reduce((t, b) => Math.max(t, b.endTime), 0);
    setTotalDuration(newTotal || beads.reduce((t, b) => t + b.duration, 0));
  };

  const handleAddBead = () => {
    const newBead: TimelineBead = {
      id: `bead-${Date.now()}`,
      sequence: timeline.length + 1,
      startTime: totalDuration,
      endTime: totalDuration + 2,
      duration: 2,
      sceneId: `scene-${Date.now()}`,
      actions: [],
      audio: [],
      transitions: [],
    };
    const updated = [...timeline, newBead];
    setTimeline(updated);
    recalcTotals(updated);
  };

  const handleDeleteBead = (beadId: string) => {
    const updated = timeline.filter(b => b.id !== beadId).map((b, idx) => ({ ...b, sequence: idx + 1 }));
    setTimeline(updated);
    recalcTotals(updated);
    if (selectedBead?.id === beadId) setSelectedBead(null);
  };

  const handleBeadDurationChange = (beadId: string, newDuration: number) => {
    const updated = timeline.map(b => b.id === beadId ? { ...b, duration: Math.max(1, newDuration), endTime: b.startTime + Math.max(1, newDuration) } : b);
    setTimeline(updated);
    recalcTotals(updated);
    if (selectedBead && selectedBead.id === beadId) setSelectedBead(updated.find(b => b.id === beadId) || null);
  };

  const handleShiftBead = (beadId: string, deltaSeconds: number) => {
    const updated = timeline.map(b => {
      if (b.id !== beadId) return b;
      const newStart = Math.max(0, b.startTime + deltaSeconds);
      return { ...b, startTime: newStart, endTime: newStart + b.duration };
    });
    setTimeline(updated);
    recalcTotals(updated);
    if (selectedBead && selectedBead.id === beadId) setSelectedBead(updated.find(b => b.id === beadId) || null);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Icon name="edit" size="lg" className="text-primary-500" />
              <h1 className="text-2xl font-bold text-gray-900">타임라인 에디터</h1>
              <span className="text-sm text-gray-500">프로젝트 ID: {id}</span>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={handleStop} title="정지/처음으로"><Icon name="stop" size="sm" className="mr-2" />정지</Button>
              <Button onClick={handlePlayPause} title="타임라인 재생/일시정지"><Icon name={isPlaying ? 'pause' : 'play'} size="sm" className="mr-2" />{isPlaying ? '일시정지' : '재생'}</Button>
              <Button variant="outline" onClick={handleCopyVeo3} data-testid="editor-copy-veo3" title="최종 프롬프트를 복사합니다">
                <Icon name="copy" size="sm" className="mr-2" />프롬프트 복사
              </Button>
              <Button variant="outline" onClick={() => setShowHelp(!showHelp)} title="사용법 보기">
                <Icon name="gear" size="sm" className="mr-2" />도움말
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">{(mounted && (jobId || jobIds.length)) ? 'Seedance 생성 미리보기' : '타임라인'}</h2>
                {!(mounted && (jobId || jobIds.length)) && (
                  <Button onClick={handleAddBead} size="sm"><Icon name="plus" size="sm" className="mr-2" />구간 추가</Button>
                )}
              </div>

              {(mounted && (jobId || jobIds.length)) ? (
                <div className="relative bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium text-gray-900">Seedance 작업 진행상황</div>
                    <div className="text-xs text-gray-500">{jobIds.length ? `Jobs: ${jobIds.join(', ')}` : `Job ID: ${jobId}`}</div>
                  </div>
                  {jobIds.length ? (
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
                    <>
                      <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
                        <div className="bg-primary-500 h-2" style={{ width: `${Math.min(100, seedanceStatus?.progress ?? 5)}%` }} />
                      </div>
                      <div className="mt-2 text-sm text-gray-700">상태: {seedanceStatus?.status || 'processing'}{seedanceStatus?.progress != null ? ` • ${seedanceStatus.progress}%` : ''}</div>
                      <div className="mt-4">
                        {seedanceStatus?.videoUrl ? (
                          <>
                            <video src={seedanceStatus.videoUrl} controls className="w-full rounded border" autoPlay muted />
                            <div className="mt-2 flex items-center gap-2">
                              <a href={seedanceStatus.videoUrl} target="_blank" rel="noreferrer" className="text-sm text-primary-600 hover:underline">새 탭에서 열기</a>
                              <a href={seedanceStatus.videoUrl} download className="text-sm text-secondary-700 hover:underline">다운로드</a>
                            </div>
                          </>
                        ) : (
                          <div className="aspect-video w-full bg-gray-100 rounded border grid place-items-center text-sm text-gray-500">
                            영상 준비 중…
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="relative bg-gray-100 rounded-lg p-4 min-h-[200px]">
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (<span key={i}>{formatTime(i)}</span>))}
                  </div>

                  <div className="space-y-2">
                    {timeline.map((bead) => (
                      <div key={bead.id} className={`border rounded-lg bg-white p-3 flex items-center justify-between ${selectedBead?.id === bead.id ? 'border-primary-500' : 'border-gray-200'}`}
                           onClick={() => handleBeadClick(bead)}>
                        <div className="flex items-center gap-3">
                          <span className="text-xs px-2 py-1 rounded bg-gray-100">#{bead.sequence}</span>
                          <div className="text-sm text-gray-700">시작 {formatTime(bead.startTime)} • 길이 {bead.duration}s • 종료 {formatTime(bead.endTime)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleShiftBead(bead.id, -1); }}>
                            <Icon name="arrow-left" size="sm" /> -1s
                          </Button>
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleShiftBead(bead.id, 1); }}>
                            +1s <Icon name="arrow-left" size="sm" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleBeadDurationChange(bead.id, bead.duration - 1); }}>
                            길이 -1s
                          </Button>
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleBeadDurationChange(bead.id, bead.duration + 1); }}>
                            길이 +1s
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteBead(bead.id); }}>
                            삭제
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!jobId && (
                <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center"><span className="font-medium text-gray-700">총 지속시간</span><div className="text-lg font-bold text-primary-600">{formatTime(totalDuration)}</div></div>
                  <div className="text-center"><span className="font-medium text-gray-700">구간 개수</span><div className="text-lg font-bold text-gray-600">{timeline.length}</div></div>
                  <div className="text-center"><span className="font-medium text-gray-700">현재 시간</span><div className="text-lg font-bold text-red-600">{formatTime(currentTime)}</div></div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {showHelp && (
              <div className="bg-white rounded-lg shadow-sm border p-6" data-testid="editor-help">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">사용법</h3>
                <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700">
                  <li>구간 추가로 2초짜리 비트를 늘립니다.</li>
                  <li>구간을 클릭한 뒤 “시작 -1s/+1s, 길이 -1s/+1s”로 배치/길이를 조정합니다.</li>
                  <li>재생으로 흐름을 확인하고 필요 없는 구간은 삭제합니다.</li>
                  <li>완료되면 상단의 “프롬프트 복사”로 모델에 붙여넣습니다.</li>
                </ol>
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-1">예시(8초 완성)</h4>
                  <p className="text-sm text-gray-700">“구간 추가”를 3번 눌러 4개 구성 → 1구간 도입, 2구간 촉발, 3구간 추격, 4구간 마무리로 각 구간을 버튼으로 미세 조정 → 재생 확인 → 프롬프트 복사</p>
                </div>
              </div>
            )}
            {selectedBead ? (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">구간 {selectedBead.sequence} 편집</h3>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteBead(selectedBead.id)} className="text-red-600 hover:text-red-700"><Icon name="delete" size="sm" /></Button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleShiftBead(selectedBead.id, -1)}><Icon name="arrow-left" size="sm" /> 시작 -1s</Button>
                    <Button variant="outline" size="sm" onClick={() => handleShiftBead(selectedBead.id, 1)}>시작 +1s <Icon name="arrow-left" size="sm" /></Button>
                    <Button variant="outline" size="sm" onClick={() => handleBeadDurationChange(selectedBead.id, selectedBead.duration - 1)}>길이 -1s</Button>
                    <Button variant="outline" size="sm" onClick={() => handleBeadDurationChange(selectedBead.id, selectedBead.duration + 1)}>길이 +1s</Button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">현재 길이</label>
                    <div className="text-sm text-gray-600">{selectedBead.duration}s</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">시작/종료</label>
                    <div className="text-sm text-gray-600">{formatTime(selectedBead.startTime)} ~ {formatTime(selectedBead.endTime)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="text-center py-12 text-gray-500">
                  <Icon name="edit" size="xl" className="mx-auto mb-4 text-gray-300" />
                  <p>편집할 구간을 선택하세요</p>
                  <p className="text-sm mt-2">버튼으로 시작 시간과 길이를 조정할 수 있습니다</p>
                </div>
              </div>
            )}

            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">💡 편집 팁</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 버튼으로 구간의 시작 시간과 길이를 정밀 조정하세요</li>
                <li>• 필요 시 구간 추가/삭제를 통해 구조를 빠르게 구성하세요</li>
                <li>• 재생/정지로 결과를 반복 확인하세요</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


