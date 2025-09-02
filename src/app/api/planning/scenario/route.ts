import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { getUserIdFromRequest } from '@/shared/lib/auth';

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
    const created = await prisma.scenario.create({
      data: {
        title,
        logline: logline ?? null,
        structure4: structure4 ?? null,
        shots12: shots12 ?? null,
        pdfUrl: pdfUrl ?? null,
        ...(userId ? { userId } : {}),
      },
      select: { id: true, title: true, createdAt: true },
    });
    return json({ ok: true, data: created });
  } catch (e: any) {
    return json({ ok: false, code: 'UNKNOWN', error: e?.message || 'Server error' }, 500);
  }
}
