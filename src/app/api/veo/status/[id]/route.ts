export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { checkVeoVideoStatus } from '@/lib/providers/veo';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const operationId = params.id;
    
    if (!operationId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'MISSING_OPERATION_ID' 
      }, { status: 400 });
    }

    console.log('DEBUG: Veo status check for operation:', operationId);

    const result = await checkVeoVideoStatus(operationId);

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        operationId: result.operationId,
        videoUrl: result.videoUrl,
        status: result.status,
        progress: result.progress
      });
    } else {
      return NextResponse.json({
        ok: false,
        error: result.error || 'STATUS_CHECK_FAILED'
      }, { status: 502 });
    }

  } catch (error) {
    console.error('Veo status check error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
