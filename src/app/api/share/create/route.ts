import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getUserIdFromRequest } from '@/shared/lib/auth';
// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return failure('UNAUTHORIZED', '인증이 필요합니다.', 401, undefined, traceId);
    }

    const body = await req.json();
    const { 
      targetType, 
      targetId, 
      role = 'viewer', 
      expiresInDays = 7,
      nickname 
    } = body;

    if (!targetType || !targetId) {
      return failure('INVALID_INPUT', '공유할 콘텐츠 정보가 필요합니다.', 400, undefined, traceId);
    }

    if (!['viewer', 'commenter'].includes(role)) {
      return failure('INVALID_INPUT', '유효하지 않은 권한입니다.', 400, undefined, traceId);
    }

    // 공유 토큰 생성
    const token = randomBytes(16).toString('hex');
    
    // 만료일 계산
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // 실제 구현에서는 ShareToken 테이블에 저장
    // 현재는 샘플 응답 반환
    const shareLink = {
      token,
      url: `${req.headers.get('origin') || 'http://localhost:3000'}/share/${token}`,
      role,
      expiresAt: expiresAt.toISOString(),
      targetType,
      targetId,
    };

    return success({
      message: '공유 링크가 생성되었습니다.',
      shareLink,
    }, 201, traceId);

  } catch (error: any) {
    return failure('UNKNOWN', error?.message || 'Server error', 500);
  }
}