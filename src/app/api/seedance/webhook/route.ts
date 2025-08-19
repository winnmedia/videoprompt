import { NextResponse } from 'next/server';
import { upsertJobState } from '@/lib/providers/seedanceStore';

// TODO: 서명 검증 추가 (헤더 검증)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const jobId = body.jobId || body.job_id || body.id || body.data?.jobId || body.data?.id;
    const status = body.status || body.task_status || body.state || body.data?.status;
    const progress = body.progress || body.percent || body.data?.progress;
    const videoUrl = body.video_url || body.videoUrl || body.result?.video_url || body.data?.video_url;
    if (!jobId) return NextResponse.json({ ok: false, error: 'no job id' }, { status: 400 });
    upsertJobState({ jobId, status: status || 'unknown', progress, videoUrl });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'invalid' }, { status: 400 });
  }
}


