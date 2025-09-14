import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import { logger } from '@/shared/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const traceId = getTraceId(req);
  try {
    const userId = getUserIdFromRequest(req);
    
    const videos = await prisma.videoAsset.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        prompt: {
          select: {
            id: true,
            metadata: true,
            timeline: true,
          },
        },
      },
    });

    logger.info('videoAssets fetched', { count: videos.length, traceId });
    return success({ videos }, 200, traceId);
  } catch (e: any) {
    logger.error('videoAssets fetch failed', e, { traceId });
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}

export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);
  try {
    const schema = z.object({
      promptId: z.string().uuid(),
      provider: z.enum(['seedance', 'veo3', 'mock']).or(z.string()),
      status: z.enum(['queued', 'processing', 'completed', 'failed']).or(z.string()),
      url: z.string().url().nullable().optional(),
      codec: z.string().nullable().optional(),
      duration: z.number().int().nullable().optional(),
      version: z.number().int().min(1).default(1),
    });
    const { promptId, provider, status, url, codec, duration, version } = schema.parse(
      await req.json(),
    );

    const userId = getUserIdFromRequest(req);
    const created = await prisma.videoAsset.create({
      data: {
        promptId,
        provider,
        status,
        url: url ?? null,
        codec: codec ?? null,
        duration: duration ?? null,
        version,
        ...(userId ? { userId } : {}),
      },
    });
    logger.info(
      'videoAsset created',
      { id: created.id, status: created.status, provider, traceId }
    );
    return success({ id: created.id, status: created.status, url: created.url }, 200, traceId);
  } catch (e: any) {
    logger.error('videoAsset create failed', e, { traceId });
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
