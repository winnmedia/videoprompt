import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSeedanceStatus } from '@/lib/providers/seedance';
import { getJobState, upsertJobState } from '@/lib/providers/seedanceStore';

// Note: Avoid strict typing for the 2nd arg to satisfy Next.js route handler constraints
export async function GET(_req: Request, context: any) {
  const id: string | undefined = context?.params?.id;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 200 });
  try {
    const cached = getJobState(id);
    if (cached) {
      return NextResponse.json({ ok: true, jobId: id, status: cached.status, progress: cached.progress, videoUrl: cached.videoUrl }, { status: 200 });
    }
    const res = await getSeedanceStatus(id);
    if (res.ok) upsertJobState({ jobId: id, status: res.status, progress: res.progress, videoUrl: res.videoUrl });
    // 안전 응답: raw 등 대용량/비직렬화 필드를 제거
    const safe = {
      ok: res.ok,
      jobId: id,
      status: res.status,
      progress: res.progress,
      videoUrl: res.videoUrl,
      dashboardUrl: (res as any).dashboardUrl,
      error: res.ok ? undefined : res.error,
    };
    return NextResponse.json(safe, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown error', jobId: context?.params?.id }, { status: 200 });
  }
}


