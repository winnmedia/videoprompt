import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { signSessionToken } from '@/shared/lib/auth';
import { addCorsHeaders } from '@/shared/lib/cors-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  id: z.string().optional(),
  email: z.string().email().optional(),
  username: z.string().min(3).max(32).optional(),
  password: z.string().min(8).max(128),
}).refine((d) => !!(d.email || d.username || d.id), {
  message: 'Provide email or username or id',
});

// ✅ CORS OPTIONS 핸들러 - 프리플라이트 요청 처리
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}

export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const { email, username, id, password } = LoginSchema.parse(await req.json());

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(username ? [{ username }] : []),
          ...(id ? [{ id }] : []),
        ],
      },
      select: { id: true, email: true, username: true, passwordHash: true, createdAt: true },
    });
    if (!user) {
      const response = failure('NOT_FOUND', '사용자를 찾을 수 없습니다.', 404, undefined, traceId);
      return addCorsHeaders(response);
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const response = failure('UNAUTHORIZED', '비밀번호가 올바르지 않습니다.', 401, undefined, traceId);
      return addCorsHeaders(response);
    }

    // 세션 쿠키 발급 (HttpOnly)
    const token = signSessionToken({ userId: user.id, email: user.email, username: user.username });
    const res = success({ 
      id: user.id, 
      email: user.email, 
      username: user.username,
      token // 🚨 토큰 동기화: 클라이언트에서 localStorage에 저장할 수 있도록 토큰 포함
    }, 200, traceId);
    (res as NextResponse).cookies.set('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return addCorsHeaders(res);
  } catch (e: any) {
    const response = e instanceof z.ZodError 
      ? failure('INVALID_INPUT_FIELDS', e.message, 400)
      : failure('UNKNOWN', e?.message || 'Server error', 500);
    return addCorsHeaders(response);
  }
}


