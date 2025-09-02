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
    // PDF 요청 시 가능한 경우 pdfkit 사용, 없으면 JSON으로 폴백
    if (format === 'pdf') {
      try {
        // 번들 시 의존성 강제 해석을 피하기 위해 동적 require 사용
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const reqFn: any = (0, eval)('require');
        const PDFDocument = reqFn('pdfkit');
        const doc = new PDFDocument({ size: 'A4', margin: 36, layout: 'landscape' });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('error', () => {
          /* swallow */
        });
        doc.fontSize(22).text('VLANET • 기획안 내보내기', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`제목: ${scenario?.title ?? ''}`);
        doc.text(`로그라인: ${scenario?.oneLine ?? ''}`);
        doc.text(`버전: ${scenario?.version ?? ''}`);
        doc.moveDown();
        doc.fontSize(14).text('구성(4단계):');
        try {
          const s = Array.isArray(scenario?.structure4) ? scenario.structure4 : [];
          s.forEach((step: any, idx: number) => {
            doc.text(`  ${idx + 1}. ${step?.title ?? ''} - ${step?.summary ?? ''}`);
          });
        } catch {}
        doc.moveDown();
        doc.fontSize(14).text('숏트(요약):');
        try {
          const sh = Array.isArray(shots) ? shots : [];
          sh.slice(0, 12).forEach((shot: any, idx: number) => {
            doc.text(`  #${idx + 1} ${shot?.title ?? ''} — ${shot?.description ?? ''}`);
          });
        } catch {}
        doc.end();
        await new Promise((r) => doc.on('end', r));
        const pdfBuf = Buffer.concat(chunks);
        const pdfB64 = pdfBuf.toString('base64');
        const pdfUrl = `data:application/pdf;base64,${pdfB64}`;
        logger.info('planning export pdf generated', { size: pdfBuf.length }, traceId);
        return success({ pdfUrl }, 200, traceId);
      } catch {
        // 폴백: JSON 반환
      }
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
