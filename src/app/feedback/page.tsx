'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Button } from '@/shared/ui/Button';
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

  const [comment, setComment] = useState('');

  const getCurrentTc = (): string => {
    const sec = Math.floor(videoRef.current?.currentTime ?? 0);
    const mm = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const ss = (sec % 60).toString().padStart(2, '0');
    const fff = '000';
    return `${mm}${ss}${fff}`; // mmssfff
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
    // scroll/focus handled by input ref if needed
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        {/* Version Switcher */}
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

        <div className="text-sm text-gray-500">
          업로더: {activeVersion.uploadedBy} · {new Date(activeVersion.uploadedAt).toLocaleString()}
        </div>
      </div>

      {/* Player: 빈 상태도 16:9 유지 */}
      <div className="overflow-hidden rounded-lg bg-black">
        <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
          <video
            ref={videoRef}
            src={activeVersion.src}
            controls
            className="absolute inset-0 h-full w-full"
          />
        </div>
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
                <li key={c.id} className="rounded-md border p-3">
                  <div className="whitespace-pre-wrap text-sm text-gray-700">{c.text}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {c.author ? `${c.author} · ` : ''}
                    {new Date(c.createdAt).toLocaleString()}{' '}
                    {c.timecode ? `· @TC${c.timecode}` : ''}
                  </div>
                </li>
              ))}
              {comments.length === 0 && (
                <li className="text-sm text-gray-500">아직 댓글이 없습니다</li>
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
              <input type="file" accept="video/*" className="block w-full" />
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              닫기
            </Button>
            <Button>업로드</Button>
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
