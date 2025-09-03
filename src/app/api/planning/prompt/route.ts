import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import { logger } from '@/shared/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const schema = z.object({
      scenarioId: z.string().uuid(),
      metadata: z.any(),
      timeline: z.any(), // Changed from z.array(z.any()) to z.any() for SQLite compatibility
      negative: z.any().optional(), // Changed from z.array(z.any()) to z.any() for SQLite compatibility
      version: z.number().int().min(1).default(1),
    });
    const { scenarioId, metadata, timeline, negative, version } = schema.parse(await req.json());

    const userId = getUserIdFromRequest(req);
    const created = await prisma.prompt.create({
      data: {
        scenarioId,
        metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
        timeline: typeof timeline === 'string' ? timeline : JSON.stringify(timeline),
        ...(typeof negative !== 'undefined' ? { negative: typeof negative === 'string' ? negative : JSON.stringify(negative) } : {}),
        version,
        ...(userId ? { userId } : {}),
      },
    });

    logger.info('prompt created', { id: created.id, version: created.version }, traceId);
    return success({ id: created.id, version: created.version }, 200, traceId);
  } catch (e: any) {
    logger.error('prompt create failed', { error: e?.message });
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const scenarioIdParam = req.nextUrl.searchParams.get('scenarioId');
    const list = await prisma.prompt.findMany({
      where: scenarioIdParam ? { scenarioId: z.string().uuid().parse(scenarioIdParam) } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        version: true,
        scenarioId: true,
        metadata: true,
        timeline: true,
        negative: true,
        createdAt: true,
      },
    });
    logger.info('prompt list', { count: list.length }, traceId);
    return success(list, 200, traceId);
  } catch (e: any) {
    logger.error('prompt list failed', { error: e?.message });
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}
