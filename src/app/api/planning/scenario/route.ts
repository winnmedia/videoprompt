import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import { createScenarioDual } from '@/shared/lib/dual-storage-service';

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

    console.log('🔄 시나리오 생성 요청 (Dual Storage):', {
      title,
      userId: userId || 'guest'
    });

    // 🔄 이중 저장 시스템 사용 (Prisma + Supabase 동시 저장)
    const result = await createScenarioDual({
      title,
      logline,
      structure4,
      shots12,
      pdfUrl,
      userId
    });

    if (!result.success) {
      console.error('❌ 이중 저장 시스템 시나리오 생성 실패:', result.error);

      // 부분 실패인지 완전 실패인지 확인
      const hasPartialSuccess = result.partialFailure &&
                               (result.prismaSuccess || result.supabaseSuccess);

      if (hasPartialSuccess) {
        // 부분 성공: 한쪽에는 저장됨 (경고와 함께 성공 반환)
        console.warn('⚠️ 부분 저장 성공:', result.partialFailure);

        return json({
          ok: true,
          data: result.data,
          warning: '일부 저장소에서 동기화 지연이 발생했습니다.',
          storageInfo: {
            prismaSuccess: result.prismaSuccess,
            supabaseSuccess: result.supabaseSuccess
          }
        });
      } else {
        // 완전 실패: 모든 저장소에서 실패
        return json({
          ok: false,
          code: 'STORAGE_ERROR',
          error: '시나리오 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
          details: result.error
        }, 500);
      }
    }

    // 성공: 양쪽 모두 저장됨
    console.log('✅ 이중 저장 시스템 시나리오 생성 성공:', {
      id: result.data?.id,
      title,
      prismaSuccess: result.prismaSuccess,
      supabaseSuccess: result.supabaseSuccess
    });

    return json({
      ok: true,
      data: result.data,
      storageInfo: {
        prismaSuccess: result.prismaSuccess,
        supabaseSuccess: result.supabaseSuccess,
        dataConsistency: result.prismaSuccess && result.supabaseSuccess ? 'full' : 'partial'
      }
    });

  } catch (e: any) {
    console.error('❌ 시나리오 API 예상치 못한 오류:', e);
    return json({ ok: false, code: 'UNKNOWN', error: e?.message || 'Server error' }, 500);
  }
}
