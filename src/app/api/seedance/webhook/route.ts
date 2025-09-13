import { NextResponse, type NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { upsertJobState } from '@/lib/providers/seedanceStore';

/**
 * HMAC-SHA256 웹훅 서명 검증
 * GitHub 스타일 웹훅 호환
 */
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    // GitHub 스타일: sha256=<hash>
    const expectedSignature = 'sha256=' + createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    // 타이밍 공격 방지를 위한 안전한 비교
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (error) {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 요청 본문 읽기
    const rawBody = await request.text();
    let body: any;

    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      return NextResponse.json(
        { ok: false, error: 'invalid JSON payload' },
        { status: 400 }
      );
    }

    // HMAC-SHA256 서명 검증 (프로덕션에서 필수)
    const secret = process.env.SEEDANCE_WEBHOOK_SECRET;
    if (secret && secret !== 'your-webhook-secret-here') {
      const signature =
        request.headers.get('x-webhook-signature') ||
        request.headers.get('x-hub-signature-256') ||
        request.headers.get('x-seedance-signature');

      if (!signature) {
        return NextResponse.json(
          { ok: false, error: 'missing signature header' },
          { status: 401 }
        );
      }

      if (!verifyWebhookSignature(rawBody, signature, secret)) {
        return NextResponse.json(
          { ok: false, error: 'invalid signature' },
          { status: 401 }
        );
      }
    } else if (process.env.NODE_ENV === 'production') {
      // 프로덕션에서는 시크릿 설정이 필수
      return NextResponse.json(
        {
          ok: false,
          error: 'webhook secret not configured',
          message: '보안을 위해 웹훅 시크릿 설정이 필요합니다.'
        },
        { status: 503 }
      );
    }

    // 필수 필드 추출
    const jobId = body.jobId || body.job_id || body.id || body.data?.jobId || body.data?.id;
    const status = body.status || body.task_status || body.state || body.data?.status;
    const progress = body.progress || body.percent || body.data?.progress;
    const videoUrl =
      body.video_url || body.videoUrl || body.result?.video_url || body.data?.video_url;

    if (!jobId) {
      return NextResponse.json(
        { ok: false, error: 'no job id found in payload' },
        { status: 400 }
      );
    }

    // 상태 업데이트
    upsertJobState({
      jobId,
      status: status || 'unknown',
      progress: progress || 0,
      videoUrl
    });

    return NextResponse.json({
      ok: true,
      jobId,
      message: 'webhook processed successfully'
    });

  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'webhook processing failed'
      },
      { status: 500 }
    );
  }
}
