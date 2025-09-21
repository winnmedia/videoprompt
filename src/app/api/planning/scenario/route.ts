import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';

// Prisma 제거됨 - Supabase 단일 저장소 사용
import { z } from 'zod';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import { saveScenario } from '@/shared/lib/planning-storage.service';
import { createSuccessResponse } from '@/shared/schemas/api.schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; code: string; error: string; details?: string };
type ApiResponse<T> = ApiSuccess<T> | ApiError;

function json<T>(body: ApiResponse<T>, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  try {
    const schema = z.object({
      title: z.string().min(1),
      logline: z.string().optional(),
      structure4: z.any().optional(),
      shots12: z.any().optional(),
      pdfUrl: z.string().url().optional(),
    });
    const { title, logline, structure4, shots12, pdfUrl } = schema.parse(await req.json());

    const userId = getUserIdFromRequest(req);

    logger.info('🔄 시나리오 생성 요청 (Dual Storage):', {
      title,
      userId: userId || 'guest'
    });

    // 🔄 Supabase 단일 저장소 사용
    const result = await saveScenario({
      title,
      logline,
      structure4,
      shots12,
      pdfUrl,
      userId
    });

    if (!result.success) {
      logger.debug('❌ 시나리오 생성 실패:', result.error);

      return json({
          ok: false,
          code: 'STORAGE_ERROR',
          error: '시나리오 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
          details: result.error
        }, 500);
    }

    // 성공: Supabase에 저장됨
    logger.info('✅ 시나리오 생성 성공:', {
      id: result.data?.id,
      title
    });

    return json(createSuccessResponse(result.data, '시나리오 저장 성공'));

  } catch (e: any) {
    logger.debug('❌ 시나리오 API 예상치 못한 오류:', e);
    return json({ ok: false, code: 'UNKNOWN', error: e?.message || 'Server error' }, 500);
  }
}
