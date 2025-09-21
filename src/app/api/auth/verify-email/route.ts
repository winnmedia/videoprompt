import { NextRequest } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { z } from 'zod';
// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화
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

    // 데이터베이스 비활성화로 인한 기능 비활성화
    return failure('SERVICE_UNAVAILABLE', '이메일 인증 기능이 비활성화되었습니다.', 503, undefined, traceId);
  } catch (e: any) {
    if (e.message === 'EMAIL_VERIFICATION_DISABLED') {
      return failure('SERVICE_UNAVAILABLE', '이메일 인증 기능이 비활성화되었습니다.', 503, undefined, getTraceId(req));
    }
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

    // 데이터베이스 비활성화로 인한 기능 비활성화
    return failure('SERVICE_UNAVAILABLE', '이메일 인증 기능이 비활성화되었습니다.', 503, undefined, traceId);

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