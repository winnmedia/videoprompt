import { NextRequest, NextResponse } from 'next/server';
import { prisma, checkDatabaseConnection } from '@/lib/db';

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
  createdAt: Date;
};

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; code: string; error: string; details?: string };

export async function GET(_req: NextRequest) {
  try {
    // 데이터베이스 연결 상태 체크
    const isConnected = await checkDatabaseConnection(prisma);
    if (!isConnected) {
      return NextResponse.json(
        { 
          ok: false, 
          code: 'DATABASE_UNAVAILABLE', 
          error: 'Database connection is currently unavailable. Please try again later.',
          details: 'Unable to establish connection to the database server'
        } as ApiError,
        { status: 503 }
      );
    }

    const rows = await prisma.videoAsset.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        status: true,
        url: true,
        codec: true,
        duration: true,
        version: true,
        createdAt: true,
      },
    });

    const list = rows.map((v: VideoAssetListPayload) => ({
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
      createdAt: v.createdAt,
    }));

    return NextResponse.json({ ok: true, data: list } as ApiSuccess<typeof list>);
  } catch (e: any) {
    console.error('❌ API Error (/api/planning/video-assets):', e);
    
    // 특정 에러 타입에 따른 처리
    if (e.code === 'P1001') {
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
    
    if (e.code?.startsWith('P')) {
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
