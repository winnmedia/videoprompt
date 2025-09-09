import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { success, failure, getTraceId } from '@/shared/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VerifyEmailSchema = z.object({
  token: z.string().optional(),
  code: z.string().optional(),
  email: z.string().email().optional(),
}).refine(
  (data) => data.token || (data.code && data.email),
  { message: 'Either token or both code and email must be provided' }
);

export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const body = await req.json();
    const { token, code, email } = VerifyEmailSchema.parse(body);

    // Find verification record
    let verification;
    
    if (token) {
      // Verify by token
      verification = await prisma.emailVerification.findUnique({
        where: { token },
        include: { user: true },
      });
    } else if (code && email) {
      // Verify by code and email
      verification = await prisma.emailVerification.findFirst({
        where: { 
          email,
          code,
        },
        include: { user: true },
      });
    }

    if (!verification) {
      return failure('INVALID_VERIFICATION', '유효하지 않은 인증 정보입니다.', 400, undefined, traceId);
    }

    // Check if verification has expired
    if (new Date() > verification.expiresAt) {
      // Delete expired verification
      await prisma.emailVerification.delete({
        where: { id: verification.id },
      });
      return failure('VERIFICATION_EXPIRED', '인증 정보가 만료되었습니다. 다시 요청해주세요.', 400, undefined, traceId);
    }

    // Check if user exists
    if (!verification.user) {
      return failure('USER_NOT_FOUND', '사용자를 찾을 수 없습니다.', 404, undefined, traceId);
    }

    // Update user and delete verification in a transaction
    const user = await prisma.$transaction(async (tx) => {
      // Update user's email verification status
      const updatedUser = await tx.user.update({
        where: { id: verification.user!.id },
        data: {
          emailVerified: true,
          verifiedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          username: true,
          emailVerified: true,
          verifiedAt: true,
        },
      });

      // Delete all verification records for this user
      await tx.emailVerification.deleteMany({
        where: { userId: verification.user!.id },
      });

      return updatedUser;
    });

    return success({
      user,
      message: '이메일 인증이 완료되었습니다.',
    }, 200, traceId);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return failure('INVALID_INPUT_FIELDS', e.message, 400);
    }
    console.error('[VerifyEmail] Error:', e);
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}

// GET method for email link verification
export async function GET(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return failure('MISSING_TOKEN', '인증 토큰이 필요합니다.', 400, undefined, traceId);
    }

    // Find verification record
    const verification = await prisma.emailVerification.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!verification) {
      return failure('INVALID_VERIFICATION', '유효하지 않은 인증 토큰입니다.', 400, undefined, traceId);
    }

    // Check if verification has expired
    if (new Date() > verification.expiresAt) {
      // Delete expired verification
      await prisma.emailVerification.delete({
        where: { id: verification.id },
      });
      return failure('VERIFICATION_EXPIRED', '인증 토큰이 만료되었습니다.', 400, undefined, traceId);
    }

    // Check if user exists
    if (!verification.user) {
      return failure('USER_NOT_FOUND', '사용자를 찾을 수 없습니다.', 404, undefined, traceId);
    }

    // Update user and delete verification in a transaction
    const user = await prisma.$transaction(async (tx) => {
      // Update user's email verification status
      const updatedUser = await tx.user.update({
        where: { id: verification.user!.id },
        data: {
          emailVerified: true,
          verifiedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          username: true,
          emailVerified: true,
          verifiedAt: true,
        },
      });

      // Delete all verification records for this user
      await tx.emailVerification.deleteMany({
        where: { userId: verification.user!.id },
      });

      return updatedUser;
    });

    // Return HTML response for browser
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>이메일 인증 완료</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 2rem;
              border-radius: 10px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 400px;
            }
            h1 {
              color: #333;
              margin-bottom: 1rem;
            }
            p {
              color: #666;
              margin-bottom: 1.5rem;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background: #667eea;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              transition: background 0.3s;
            }
            .button:hover {
              background: #5a67d8;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ 이메일 인증 완료</h1>
            <p>이메일 인증이 성공적으로 완료되었습니다.<br>이제 로그인하실 수 있습니다.</p>
            <a href="/login" class="button">로그인 페이지로 이동</a>
          </div>
        </body>
      </html>
    `;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (e: any) {
    console.error('[VerifyEmail GET] Error:', e);
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}