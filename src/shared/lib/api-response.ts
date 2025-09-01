import { NextRequest, NextResponse } from 'next/server';

export type ApiSuccess<T> = { ok: true; data: T; traceId?: string };
export type ApiError = {
  ok: false;
  code: string;
  error: string;
  details?: string;
  traceId?: string;
};
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function success<T>(data: T, status = 200, traceId?: string) {
  return NextResponse.json({ ok: true, data, ...(traceId ? { traceId } : {}) } as ApiSuccess<T>, {
    status,
  });
}

export function failure(
  code: string,
  error: string,
  status = 400,
  details?: string,
  traceId?: string,
) {
  return NextResponse.json(
    {
      ok: false,
      code,
      error,
      ...(details ? { details } : {}),
      ...(traceId ? { traceId } : {}),
    } as ApiError,
    { status },
  );
}

export function getTraceId(req: NextRequest): string {
  return (
    req.headers.get('x-trace-id') ||
    (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
  );
}
