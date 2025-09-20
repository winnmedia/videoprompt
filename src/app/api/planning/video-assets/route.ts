import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Define a type for the selected fields from the VideoAsset model
type VideoAssetListPayload = {
  id: string;
  provider: string;
  status: string;
  url: string | null;
  codec: string | null;
  duration: number | null;
  version: number;
  created_at: string;
};

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; code: string; error: string; details?: string };

export async function GET(_req: NextRequest) {
  try {
    // Supabase 클라이언트 초기화
    const supabase = await getSupabaseClientSafe('service-role');

    // 비디오 에셋 데이터 조회
    const { data: rows, error } = await supabase
      .from('video_assets')
      .select('id, provider, status, url, codec, duration, version, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const list = (rows || []).map((v: VideoAssetListPayload) => ({
      id: v.id,
      title: v.url?.split('/').pop() || '영상',
      provider: v.provider as any,
      status: v.status as any,
      videoUrl: v.url || undefined,
      codec: v.codec || undefined,
      duration: v.duration || 0,
      aspectRatio: '16:9',
      version: `V${v.version}`,
      prompt: '-',
      createdAt: v.created_at,
    }));

    return NextResponse.json({ ok: true, data: list } as ApiSuccess<typeof list>);

  } catch (e: any) {
    console.error('Video assets fetch error:', e);

    // Supabase 관련 에러 처리
    if (e.message?.includes('connection')) {
      return NextResponse.json(
        {
          ok: false,
          code: 'DATABASE_UNREACHABLE',
          error: 'Cannot reach database server. The service is temporarily unavailable.',
          details: 'Database server is unreachable or not responding'
        } as ApiError,
        { status: 503 }
      );
    }

    if (e.message?.includes('auth') || e.message?.includes('permission')) {
      return NextResponse.json(
        {
          ok: false,
          code: 'DATABASE_ERROR',
          error: 'Database operation failed. Please try again.',
          details: e.message
        } as ApiError,
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        code: 'UNKNOWN',
        error: 'An unexpected error occurred. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? e.message : undefined
      } as ApiError,
      { status: 500 },
    );
  }
}