import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 샘플 공유 데이터 (실제로는 데이터베이스에서 조회)
const sampleSharedContent = {
  'demo-share-token-123': {
    id: 'content-1',
    type: 'scenario' as const,
    title: '브랜드 소개 영상 시나리오',
    description: '우리 회사를 소개하는 전문적인 영상을 위한 시나리오입니다.',
    data: {
      structure4: [
        '회사 소개 및 비전',
        '주요 제품/서비스 설명', 
        '팀과 문화 소개',
        '연락처 및 행동 유도'
      ],
      shots12: [
        '로고 애니메이션',
        '오피스 전경',
        'CEO 인사말',
        '주요 제품 소개',
        '제품 사용 장면',
        '고객 후기',
        '팀 미팅 장면',
        '워크플레이스',
        '회사 가치관',
        '성과 및 수상',
        '연락처 정보',
        '마무리 로고'
      ]
    },
    createdAt: '2024-01-15T10:30:00Z',
    owner: {
      username: '김대표',
      avatarUrl: undefined,
    },
    shareRole: 'commenter' as const,
    expiresAt: '2024-02-15T10:30:00Z',
  },
  'demo-video-share-456': {
    id: 'content-2',
    type: 'video' as const,
    title: '제품 소개 영상',
    description: '신제품 런칭을 위한 소개 영상입니다.',
    data: {
      videoUrl: `${process.env.RAILWAY_BACKEND_URL || 'https://your-railway-backend.railway.app'}/api/videos/shared-demo`,
      provider: 'seedance',
      duration: 30,
      aspectRatio: '16:9'
    },
    createdAt: '2024-01-16T14:20:00Z',
    owner: {
      username: '이마케팅',
      avatarUrl: undefined,
    },
    shareRole: 'viewer' as const,
    expiresAt: '2024-02-16T14:20:00Z',
  }
};

const sampleComments: Record<string, any[]> = {
  'demo-share-token-123': [
    {
      author: '박피드백',
      text: '전체적인 구성이 좋네요! 다만 고객 후기 부분을 좀 더 강조하면 어떨까요?',
      createdAt: '2024-01-16T09:15:00Z'
    },
    {
      author: '최검토',
      text: 'CEO 인사말 부분이 너무 길 것 같아요. 좀 더 간결하게 줄여도 될 것 같습니다.',
      createdAt: '2024-01-16T11:30:00Z'
    }
  ],
  'demo-video-share-456': []
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const traceId = getTraceId(req);
    const { token } = await params;

    // 실제 구현에서는 ShareToken 테이블에서 조회
    // 현재는 샘플 데이터 사용
    const sharedContent = sampleSharedContent[token as keyof typeof sampleSharedContent];
    
    if (!sharedContent) {
      return failure('NOT_FOUND', '공유 링크를 찾을 수 없습니다.', 404, undefined, traceId);
    }

    // 만료 확인
    const now = new Date();
    const expiresAt = new Date(sharedContent.expiresAt);
    if (now > expiresAt) {
      return failure('EXPIRED', '공유 링크가 만료되었습니다.', 410, undefined, traceId);
    }

    // 댓글 조회
    const comments = sampleComments[token] || [];

    return success({
      content: sharedContent,
      comments,
    }, 200, traceId);

  } catch (error: any) {
    return failure('UNKNOWN', error?.message || 'Server error', 500);
  }
}