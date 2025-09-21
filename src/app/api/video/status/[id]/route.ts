export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { checkVideoStatus } from '@/lib/providers/video-generator';
import { logger } from '@/shared/lib/logger';


export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: operationId } = await params;
    const provider = req.nextUrl.searchParams.get('provider') as any;

    if (!operationId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'MISSING_OPERATION_ID',
        },
        { status: 400 },
      );
    }

    logger.info(
      'DEBUG: Unified video status check for operation:',
      operationId,
      'provider:',
      provider,
    );

    const result = await checkVideoStatus(operationId, provider);

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        provider: result.provider,
        operationId: result.operationId,
        videoUrl: result.videoUrl,
        status: result.status,
        progress: result.progress,
        estimatedTime: result.estimatedTime,
      });
    } else {
      return NextResponse.json(
        {
          ok: false,
          provider: result.provider,
          error: result.error || 'STATUS_CHECK_FAILED',
        },
        { status: 502 },
      );
    }
  } catch (error) {
    logger.error('Unified video status check error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      {
        ok: false,
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
