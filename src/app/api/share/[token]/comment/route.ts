import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    token: string;
  };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const traceId = getTraceId(req);
    const { token } = params;
    const body = await req.json();
    const { nickname, comment } = body;

    if (!nickname || !comment) {
      return failure('INVALID_INPUT', '닉네임과 댓글을 모두 입력해주세요.', 400, undefined, traceId);
    }

    // 실제 구현에서는:
    // 1. ShareToken 테이블에서 토큰 유효성 확인
    // 2. 권한이 'commenter'인지 확인
    // 3. Comment 테이블에 댓글 저장

    // 현재는 성공 응답만 반환 (샘플 데이터이므로 실제 저장하지 않음)
    const newComment = {
      id: `comment-${Date.now()}`,
      author: nickname,
      text: comment,
      createdAt: new Date().toISOString(),
    };

    return success({
      message: '댓글이 작성되었습니다.',
      comment: newComment,
    }, 201, traceId);

  } catch (error: any) {
    return failure('UNKNOWN', error?.message || 'Server error', 500);
  }
}