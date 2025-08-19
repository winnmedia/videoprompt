import { NextResponse } from 'next/server';
import { getSeedanceStatus } from '@/lib/providers/seedance';
import { getJobState, upsertJobState } from '@/lib/providers/seedanceStore';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { id } = params || {} as any;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  // 메모리 캐시 우선 반환
  const cached = getJobState(id);
  if (cached) {
    const payload = { ok: true, jobId: id, status: cached.status, progress: cached.progress, videoUrl: cached.videoUrl };
    // 백그라운드 갱신은 클라이언트 폴링 주기로 충분하므로 즉시 반환
    return NextResponse.json(payload);
  }
  const res = await getSeedanceStatus(id);
  if (res.ok) upsertJobState({ jobId: id, status: res.status, progress: res.progress, videoUrl: res.videoUrl });
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}


