'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/Modal';
import { Camera, MessageSquare, Share2, Repeat, Upload } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useProjectStore } from '@/entities/project';

interface VideoVersionMeta {
  id: string;
  label: string; // v1, v2, ...
  uploadedBy: string;
  uploadedAt: string; // ISO
  src: string;
  durationSec?: number;
  codec?: string;
  originalFilename?: string;
}

export default function FeedbackPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const project = useProjectStore();
  const [tokenInfo, setTokenInfo] = useState<{
    valid: boolean;
    role: string;
    nickname?: string;
  } | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Mock versions
  const versions: VideoVersionMeta[] = useMemo(() => {
    if (project.versions && project.versions.length > 0) {
      return project.versions.map((v) => ({
        id: v.id,
        label: v.label,
        uploadedBy: 'you',
        uploadedAt: v.uploadedAt,
        src: v.src,
      }));
    }
    return [
      {
        id: 'v1',
        label: 'v1',
        uploadedBy: 'demo',
        uploadedAt: new Date().toISOString(),
        src: project.video.videoUrl || '/sample-video.mp4',
      },
    ];
  }, [project.versions, project.video.videoUrl]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get('token');
    setToken(t);
    if (!t) return;
    (async () => {
      try {
        const res = await fetch(`/api/shares/${t}`);
        const json = await res.json();
        if (json?.ok)
          setTokenInfo({
            valid: true,
            role: json.data.role,
            nickname: json.data.nickname || undefined,
          });
        else setTokenInfo({ valid: false, role: 'viewer' });
      } catch {
        setTokenInfo({ valid: false, role: 'viewer' });
      }
    })();
  }, []);

  // 댓글 목록 & 폴링
  const [comments, setComments] = useState<
    Array<{
      id: string;
      author?: string | null;
      text: string;
      timecode?: string | null;
      createdAt: string;
    }>
  >([]);
  useEffect(() => {
    let timer: any;
    const videoId = new URL(window.location.href).searchParams.get('videoId') || versions[0]?.id;
    const fetchComments = async () => {
      try {
        if (!videoId) return;
        const res = await fetch(
          `/api/comments?targetType=video&targetId=${encodeURIComponent(videoId)}`,
        );
        const js = await res.json();
        if (js?.ok && Array.isArray(js.data)) setComments(js.data);
      } catch {}
    };
    fetchComments();
    timer = setInterval(fetchComments, 5000);
    return () => timer && clearInterval(timer);
  }, [versions]);

  const [activeVersionId, setActiveVersionId] = useState<string>(versions[0].id);
  const activeVersion = versions.find((v) => v.id === activeVersionId)!;

  const [shareOpen, setShareOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [comment, setComment] = useState('');
  const [showVersionComparison, setShowVersionComparison] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);

  const handleVideoUpload = async (slotIndex: number) => {
    const input = document.getElementById(`upload-slot-${slotIndex}`) as HTMLInputElement;
    const file = input?.files?.[0];
    
    if (!file) {
      alert('업로드할 비디오 파일을 선택해주세요.');
      return;
    }
    
    if (!file.type.startsWith('video/')) {
      alert('비디오 파일만 업로드 가능합니다.');
      return;
    }
    
    // 파일 크기 체크 (100MB 제한)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      alert('파일 크기가 너무 큽니다. 100MB 이하의 파일을 선택해주세요.');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // FormData 생성
      const formData = new FormData();
      formData.append('video', file);
      formData.append('slot', `v${slotIndex + 1}`);
      if (token) formData.append('token', token);
      
      // 업로드 API 호출 (추후 구현될 API 엔드포인트)
      const response = await fetch('/api/video/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`업로드 실패: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.ok) {
        // 업로드 성공 시 프로젝트 상태 업데이트
        project.updateVideo({
          provider: 'upload',
          videoUrl: result.videoUrl || URL.createObjectURL(file), // 임시로 blob URL 사용
          status: 'succeeded'
        });
        
        alert(`V${slotIndex + 1} 슬롯에 비디오가 성공적으로 업로드되었습니다.`);
        setUploadOpen(false);
        
        // 입력 필드 초기화
        if (input) input.value = '';
      } else {
        throw new Error(result.error || '업로드 중 오류가 발생했습니다.');
      }
    } catch (error: any) {
      console.error('비디오 업로드 오류:', error);
      
      // 오류 타입별 메시지
      let errorMessage = '비디오 업로드에 실패했습니다.';
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage += ' 네트워크 연결을 확인해주세요.';
      } else if (error.message.includes('413')) {
        errorMessage += ' 파일 크기가 너무 큽니다.';
      } else if (error.message.includes('415')) {
        errorMessage += ' 지원되지 않는 파일 형식입니다.';
      } else if (error.message.includes('timeout')) {
        errorMessage += ' 업로드 시간이 초과되었습니다.';
      }
      
      alert(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const getCurrentTc = (): string => {
    const time = videoRef.current?.currentTime ?? 0;
    const mm = Math.floor(time / 60).toString().padStart(2, '0');
    const ss = Math.floor(time % 60).toString().padStart(2, '0');
    const fff = Math.floor((time % 1) * 1000).toString().padStart(3, '0');
    return `${mm}:${ss}.${fff}`; // mm:ss.fff 형식으로 변경
  };

  // 타임코드 파싱 및 점프 기능
  const parseTimecode = (tc: string): number => {
    const match = tc.match(/(\d{1,2}):(\d{1,2})\.(\d{3})/);
    if (!match) return 0;
    const [, mm, ss, fff] = match;
    return parseInt(mm) * 60 + parseInt(ss) + parseInt(fff) / 1000;
  };

  const jumpToTimecode = (timecode: string) => {
    if (!videoRef.current) return;
    const time = parseTimecode(timecode);
    videoRef.current.currentTime = time;
    videoRef.current.play();
  };

  const formatScreenshotName = (): string => {
    const slug = 'project-demo';
    const tc = getCurrentTc();
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toISOString().slice(11, 19).replace(/:/g, '');
    return `project-${slug}_TC${tc}_${date}T${time}.jpg`;
  };

  const takeScreenshot = async () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = formatScreenshotName();
        a.click();
        URL.revokeObjectURL(a.href);
      },
      'image/jpeg',
      0.92,
    );
  };

  const focusFeedbackAtCurrentTime = () => {
    const tc = getCurrentTc();
    setComment((prev) => (prev ? `${prev} \n@TC${tc} ` : `@TC${tc} `));
    // 댓글 입력창에 포커스
    const textarea = document.querySelector('textarea[data-testid="feedback-textarea"]') as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
      textarea.scrollTop = textarea.scrollHeight;
    }
  };

  // T 키 단축키 처리
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // T 키를 눌렀을 때 (입력창에 포커스가 없을 때만)
      if (e.key === 'T' && 
          document.activeElement?.tagName !== 'INPUT' && 
          document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        focusFeedbackAtCurrentTime();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  // 댓글 텍스트에서 타임코드를 찾아서 클릭 가능한 링크로 변환
  const renderCommentWithTimecodes = (text: string) => {
    const timecodeRegex = /@TC(\d{1,2}:\d{1,2}\.\d{3})/g;
    const parts = text.split(timecodeRegex);
    
    return parts.map((part, index) => {
      if (timecodeRegex.test(`@TC${part}`)) {
        // 타임코드 부분
        return (
          <button
            key={index}
            onClick={() => jumpToTimecode(part)}
            className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-sm bg-blue-50 px-1 rounded"
            title={`${part}로 이동`}
          >
            @TC{part}
          </button>
        );
      } else if (index > 0 && parts[index - 1] && timecodeRegex.test(`@TC${parts[index - 1]}`)) {
        // 타임코드 다음 부분은 그냥 텍스트
        return part;
      } else {
        // 일반 텍스트 부분
        return part;
      }
    });
  };

  return (
    <div className="mx-auto max-w-7xl p-6" aria-live="polite">
      <div className="mb-6 flex items-center justify-between">
        {/* Version Switcher */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">버전</span>
            <div className="relative">
              <select
                className="rounded-md border bg-white px-3 py-2"
                value={activeVersionId}
                onChange={(e) => setActiveVersionId(e.target.value)}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Version Comparison Toggle */}
          {versions.length > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant={showVersionComparison ? "default" : "outline"}
                size="sm"
                onClick={() => setShowVersionComparison(!showVersionComparison)}
              >
                {showVersionComparison ? '비교 모드 해제' : '버전 비교'}
              </Button>
              
              {showVersionComparison && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">vs</span>
                  <select
                    className="rounded-md border bg-white px-2 py-1 text-sm"
                    value={compareVersionId || ''}
                    onChange={(e) => setCompareVersionId(e.target.value || null)}
                  >
                    <option value="">비교 버전 선택</option>
                    {versions
                      .filter((v) => v.id !== activeVersionId)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500">
          업로더: {activeVersion.uploadedBy} · {new Date(activeVersion.uploadedAt).toLocaleString()}
        </div>
      </div>

      {/* Player: 버전 비교 모드 지원 */}
      <div className={cn(
        "overflow-hidden rounded-lg bg-black",
        showVersionComparison && compareVersionId ? "grid grid-cols-2 gap-2" : ""
      )}>
        {showVersionComparison && compareVersionId ? (
          // 비교 모드: 두 비디오 나란히 표시
          <>
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <div className="absolute inset-x-0 top-2 z-10 text-center">
                <span className="bg-black/50 px-2 py-1 text-xs text-white rounded">
                  {activeVersion.label}
                </span>
              </div>
              {activeVersion.src ? (
                <video
                  ref={videoRef}
                  src={activeVersion.src}
                  controls
                  className="absolute inset-0 h-full w-full"
                  aria-label={`${activeVersion.label} 플레이어`}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <Button onClick={() => setUploadOpen(true)} size="sm" className="bg-white text-gray-900 hover:bg-gray-100">
                    영상 업로드
                  </Button>
                </div>
              )}
            </div>
            
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <div className="absolute inset-x-0 top-2 z-10 text-center">
                <span className="bg-black/50 px-2 py-1 text-xs text-white rounded">
                  {versions.find(v => v.id === compareVersionId)?.label}
                </span>
              </div>
              {(() => {
                const compareVersion = versions.find(v => v.id === compareVersionId);
                return compareVersion?.src ? (
                  <video
                    src={compareVersion.src}
                    controls
                    className="absolute inset-0 h-full w-full"
                    aria-label={`${compareVersion.label} 비교 플레이어`}
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="text-white text-sm">영상 없음</span>
                  </div>
                );
              })()}
            </div>
          </>
        ) : (
          // 일반 모드: 단일 비디오
          <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
            {activeVersion.src ? (
              <video ref={videoRef} src={activeVersion.src} controls className="absolute inset-0 h-full w-full" aria-label="피드백 플레이어" />
            ) : (
              <div className="absolute inset-0 grid place-items-center">
                <Button onClick={() => setUploadOpen(true)} className="bg-white text-gray-900 hover:bg-gray-100" aria-label="영상 업로드 열기">
                  영상 업로드
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="default"
          onClick={() => setUploadOpen(true)}
          leftIcon={<Upload className="h-4 w-4" />}
        >
          영상 업로드
        </Button>
        <Button
          variant="outline"
          onClick={() => setReplaceOpen(true)}
          leftIcon={<Repeat className="h-4 w-4" />}
        >
          영상 교체
        </Button>
        <Button
          variant="outline"
          onClick={() => setShareOpen(true)}
          leftIcon={<Share2 className="h-4 w-4" />}
        >
          영상 공유
        </Button>
        <Button
          variant="outline"
          onClick={takeScreenshot}
          leftIcon={<Camera className="h-4 w-4" />}
        >
          스크린샷
        </Button>
        <Button
          variant="outline"
          onClick={focusFeedbackAtCurrentTime}
          leftIcon={<MessageSquare className="h-4 w-4" />}
        >
          현재 시점 피드백
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Comments */}
        <section className="lg:col-span-2">
          <div className="rounded-lg border bg-white p-4">
            <h3 data-testid="feedback-comments-title" className="mb-3 font-semibold">
              코멘트
            </h3>
            <textarea
              data-testid="feedback-textarea"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="피드백을 입력하세요. T 키 또는 '현재 시점 피드백' 버튼으로 타임코드 삽입."
              rows={4}
              className="w-full rounded-md border px-3 py-2"
            />
            <div className="mt-3 flex justify-end">
              <Button
                onClick={async () => {
                  try {
                    const t = token;
                    if (!t) return alert('공유 토큰이 필요합니다');
                    await fetch('/api/comments', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        token: t,
                        targetType: 'video',
                        targetId: versions[0]?.id || 'unknown',
                        text: comment,
                        timecode: getCurrentTc(),
                      }),
                    });
                    setComment('');
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                등록
              </Button>
            </div>
          </div>
          {/* 댓글 리스트 */}
          <div className="mt-4 rounded-lg border bg-white p-4">
            <h4 className="mb-3 font-medium">댓글 목록</h4>
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="rounded-md border p-3 hover:bg-gray-50 transition-colors">
                  <div className="whitespace-pre-wrap text-sm text-gray-700">
                    {renderCommentWithTimecodes(c.text)}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    {c.author && (
                      <span className="font-medium">{c.author}</span>
                    )}
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                    {c.timecode && (
                      <button
                        onClick={() => jumpToTimecode(c.timecode!)}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-mono bg-blue-50 px-1 rounded"
                        title={`${c.timecode}로 이동`}
                      >
                        @TC{c.timecode}
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {comments.length === 0 && (
                <li className="text-sm text-gray-500 text-center py-6">
                  아직 댓글이 없습니다. 첫 댓글을 작성해보세요!
                </li>
              )}
            </ul>
          </div>
        </section>

        {/* Right: Tabs (stub) */}
        <aside>
          <div className="rounded-lg border bg-white">
            <div className="flex border-b">
              <button className="px-4 py-2 text-sm font-medium">팀원</button>
              <button className="px-4 py-2 text-sm font-medium">프로젝트 정보</button>
            </div>
            <div className="p-4 text-sm text-gray-600">우측 탭 컨텐츠는 추후 연동합니다.</div>
          </div>
        </aside>
      </div>

      {/* Share Modal */}
      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="영상 공유"
        description="링크/권한/만료 설정을 구성합니다."
      >
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-700">닉네임</label>
            <input
              id="nickname"
              type="text"
              className="mt-1 block w-full rounded-md border px-3 py-2"
              placeholder="(선택) 초대 대상 표기명"
            />
          </div>
          <div>
            <label className="text-sm text-gray-700">만료일(일)</label>
            <input
              id="expire-days"
              type="number"
              min={1}
              max={30}
              defaultValue={7}
              className="mt-1 block w-full rounded-md border px-3 py-2"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">권한</span>
            <select id="role" className="rounded-md border px-3 py-2">
              <option value="commenter">댓글 작성 가능</option>
              <option value="viewer">보기 전용</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShareOpen(false)}>
              닫기
            </Button>
            <Button
              onClick={async () => {
                try {
                  const vid =
                    new URL(window.location.href).searchParams.get('videoId') || versions[0]?.id;
                  if (!vid) return alert('videoId가 필요합니다');
                  const nickname =
                    (document.getElementById('nickname') as HTMLInputElement)?.value || undefined;
                  const expireDays = parseInt(
                    (document.getElementById('expire-days') as HTMLInputElement)?.value || '7',
                    10,
                  );
                  const role =
                    (document.getElementById('role') as HTMLSelectElement)?.value || 'commenter';
                  const res = await fetch('/api/shares', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      targetType: 'video',
                      targetId: vid,
                      nickname,
                      role,
                      expiresIn: expireDays * 24 * 3600,
                    }),
                  });
                  const js = await res.json();
                  if (js?.ok && js?.data?.token) {
                    const shareUrl = `${window.location.origin}/feedback?videoId=${encodeURIComponent(vid)}&token=${js.data.token}`;
                    await navigator.clipboard.writeText(shareUrl);
                    alert('공유 링크가 클립보드에 복사되었습니다');
                    setShareOpen(false);
                  } else {
                    alert('링크 발급 실패');
                  }
                } catch (e) {
                  console.error(e);
                  alert('링크 발급 중 오류');
                }
              }}
            >
              링크 발급
            </Button>
          </div>
        </div>
      </Modal>

      {/* Upload Modal (3 Slots: V1/V2/V3) */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="영상 업로드"
        description="V1/V2/V3 중 하나의 슬롯에 영상을 업로드합니다."
      >
        <div className="space-y-4">
          {['V1', 'V2', 'V3'].map((label, idx) => (
            <div key={label} className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium">{label}</div>
                <div className="text-xs text-gray-500">슬롯 {idx + 1}</div>
              </div>
              <label className="mb-1 block text-sm text-gray-700" htmlFor={`upload-slot-${idx}`}>파일 선택</label>
              <input id={`upload-slot-${idx}`} type="file" accept="video/*" className="block w-full" />
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)} aria-label="업로드 닫기">
              닫기
            </Button>
            <Button aria-busy={false}>업로드</Button>
          </div>
        </div>
      </Modal>

      {/* Replace Modal */}
      <Modal
        open={replaceOpen}
        onClose={() => setReplaceOpen(false)}
        title="영상 교체"
        description="새 파일 업로드 또는 기존 버전을 선택하여 교체합니다."
      >
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-700">파일 업로드</label>
            <input type="file" accept="video/*" className="mt-1 block w-full" />
          </div>
          <div>
            <label className="text-sm text-gray-700">기존 버전 선택</label>
            <select className="mt-1 block w-full rounded-md border px-3 py-2">
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} · {new Date(v.uploadedAt).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
