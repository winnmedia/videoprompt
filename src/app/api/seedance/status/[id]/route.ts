import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Note: Avoid strict typing for the 2nd arg to satisfy Next.js route handler constraints
export async function GET(_req: Request, context: any) {
  const id: string | undefined = context?.params?.id;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 200 });
  try {
    // 동적 import로 초기 로딩/ESM 환경 이슈 회피
    const { getJobState, upsertJobState } = await import('@/lib/providers/seedanceStore');
    const { getSeedanceStatus } = await import('@/lib/providers/seedance');
    const cached = getJobState(id);
    if (cached) {
      return NextResponse.json({ ok: true, jobId: id, status: cached.status, progress: cached.progress, videoUrl: cached.videoUrl }, { status: 200 });
    }
    // 폴백: 외부 조회는 최소화. 실패해도 200 + 에러만 전달
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


