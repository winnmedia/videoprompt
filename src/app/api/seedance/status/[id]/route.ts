import { NextResponse } from 'next/server';
import { saveFileFromUrl } from '@/lib/utils/file-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Note: Avoid strict typing for the 2nd arg to satisfy Next.js route handler constraints
export async function GET(_req: Request, context: any) {
  const id: string | undefined = context?.params?.id;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  try {
    // Seedance 서비스 상태 확인
    return NextResponse.json(
      {
        ok: false,
        error: 'SERVICE_UNDER_DEVELOPMENT',
        message: 'Seedance 상태 조회 기능은 현재 개발 중입니다.',
        jobId: id,
        status: 'pending',
        progress: 0,
        details: 'Seedance API 연동이 완료되면 실시간 상태 조회가 가능합니다.',
        estimatedTime: '2-3주 후 서비스 예정',
      },
      { status: 501 },
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || 'unknown error',
        jobId: context?.params?.id,
        message: 'Seedance Status API 처리 중 오류가 발생했습니다.',
      },
      { status: 500 },
    );
  }
}
