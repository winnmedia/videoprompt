import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { logger } from '@/shared/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; code: string; error: string; details?: string };
type ApiResponse<T> = ApiSuccess<T> | ApiError;

function json<T>(body: ApiResponse<T>, status = 200) {
  return NextResponse.json(body, { status });
}

// 개선: Marp 스타일을 흉내낸 레이아웃으로 pdfkit 출력 향상(섹션 구분/타이틀/테이블 분위기)
export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const schema = z.object({
      scenario: z.any(),
      shots: z.array(z.any()).optional(),
      prompt: z.any().optional(),
      format: z.enum(['json', 'pdf']).optional(),
    });
    const { scenario, shots, prompt, format } = schema.parse(await req.json());
    if (!scenario)
      return json({ ok: false, code: 'INVALID_INPUT_FIELDS', error: 'scenario is required' }, 400);

    const exportPayload = {
      scenario,
      shots: shots ?? [],
      prompt: prompt ?? null,
      exportedAt: new Date().toISOString(),
    };
    // PDF 생성은 클라이언트 사이드에서 처리하도록 변경
    // 서버에서는 구조화된 데이터만 제공
    if (format === 'pdf') {
      // PDF용 구조화된 데이터 반환
      return NextResponse.json(success({
        ...exportPayload,
        format: 'pdf-data',
        title: 'VLANET • 기획안 내보내기',
        generatedAt: new Date().toLocaleString('ko-KR'),
      }), { status: 200 });
    }

    const jsonStr = JSON.stringify(exportPayload, null, 2);
    const b64 = Buffer.from(jsonStr, 'utf8').toString('base64');
    const dataUrl = `data:application/json;base64,${b64}`;

    logger.info('planning export json generated', { length: jsonStr.length }, traceId);
    return success({ jsonUrl: dataUrl }, 200, traceId);
  } catch (e: any) {
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}
