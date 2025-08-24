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
      return NextResponse.json({ 
        ok: true, 
        jobId: id, 
        status: cached.status, 
        progress: cached.progress, 
        videoUrl: cached.videoUrl 
      }, { status: 200 });
    }
    
    // 폴백: 외부 조회는 최소화. 실패해도 200 + 에러만 전달
    const res = await getSeedanceStatus(id);
    
    if (res.ok) {
      upsertJobState({ 
        jobId: id, 
        status: res.status, 
        progress: res.progress, 
        videoUrl: res.videoUrl 
      });
    }
    
    // Header overflow 방지: raw 등 대용량/비직렬화 필드를 제거하고 안전한 응답만 전송
    const safe = {
      ok: res.ok,
      jobId: id,
      status: res.status || 'unknown',
      progress: res.progress || 0,
      videoUrl: res.videoUrl,
      dashboardUrl: (res as any).dashboardUrl,
      error: res.ok ? undefined : (res.error || 'Unknown error'),
    };
    
    // 응답 크기 검증 (추가 안전장치)
    const responseSize = JSON.stringify(safe).length;
    if (responseSize > 5000) {
      console.warn('DEBUG: API 응답이 너무 큽니다:', responseSize);
      return NextResponse.json({ 
        ok: false, 
        error: 'Response too large - potential header overflow prevented',
        jobId: id 
      }, { status: 200 });
    }
    
    return NextResponse.json(safe, { status: 200 });
    
  } catch (e: any) {
    console.error('DEBUG: Seedance status API 에러:', e);
    return NextResponse.json({ 
      ok: false, 
      error: e?.message || 'unknown error', 
      jobId: context?.params?.id 
    }, { status: 200 });
  }
}


