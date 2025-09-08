import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId, standardErrors, ERROR_CODES } from '@/shared/lib/api-response';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 샘플 템플릿 데이터
const sampleTemplates = [
  {
    id: 'template-1',
    name: '브랜드 소개 영상',
    description: '회사나 제품을 소개하는 전문적인 영상 템플릿입니다. 로고, 제품 장면, 팀 소개 등을 포함합니다.',
    category: 'scenario',
    tags: ['브랜드', '소개', '기업', '마케팅'],
    thumbnailUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDMyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjMwMCIgaGVpZ2h0PSIxNjAiIHJ4PSI4IiBmaWxsPSIjMTYzMUY4Ii8+Cjx0ZXh0IHg9IjE2MCIgeT0iMTAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxOCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPkJSQU5EPC90ZXh0Pgo8L3N2Zz4K',
    data: {
      structure4: ['회사 소개', '제품/서비스 설명', '팀 소개', '연락처'],
      shots12: ['로고 애니메이션', '오피스 전경', '제품 클로즈업', '팀 회의', '고객 인터뷰', '제품 사용 장면', 'CEO 인사말', '연락처 정보']
    },
    isPublic: true,
    downloads: 157,
    rating: 4.8,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'template-2',
    name: '제품 리뷰 영상',
    description: '제품의 기능과 장점을 체계적으로 리뷰하는 영상 템플릿입니다.',
    category: 'scenario',
    tags: ['리뷰', '제품', '언박싱', '기능'],
    thumbnailUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDMyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjMwMCIgaGVpZ2h0PSIxNjAiIHJ4PSI4IiBmaWxsPSIjMTBCOTgxIi8+Cjx0ZXh0IHg9IjE2MCIgeT0iMTAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxOCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPlJFVklFVzwvdGV4dD4KPC9zdmc+Cg==',
    data: {
      structure4: ['언박싱', '첫인상', '기능 테스트', '총평'],
      shots12: ['패키지 오픈', '구성품 확인', '디자인 분석', '기능 시연', '성능 테스트', '비교 분석', '장점 정리', '아쉬운 점', '점수 평가', '구매 추천']
    },
    isPublic: true,
    downloads: 89,
    rating: 4.5,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'template-3',
    name: '신서트 스타일',
    description: '감성적이고 따뜻한 느낌의 영상을 위한 프롬프트 템플릿입니다.',
    category: 'prompt',
    tags: ['감성', '따뜻한', '자연광', '부드러운'],
    thumbnailUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDMyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjMwMCIgaGVpZ2h0PSIxNjAiIHJ4PSI4IiBmaWxsPSIjRkY2QjM1Ii8+Cjx0ZXh0IHg9IjE2MCIgeT0iMTAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxOCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPlNUWUxFPC90ZXh0Pgo8L3N2Zz4K',
    data: {
      baseStyle: ['cinematic', 'warm lighting', 'soft focus', 'natural colors'],
      keywords: ['golden hour', 'gentle breeze', 'cozy atmosphere', 'peaceful mood'],
      negativePrompts: ['harsh lighting', 'cold colors', 'aggressive', 'dark shadows']
    },
    isPublic: true,
    downloads: 203,
    rating: 4.7,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'template-4',
    name: '전체 워크플로우',
    description: '시나리오 작성부터 영상 생성, 피드백까지의 전체 워크플로우 템플릿입니다.',
    category: 'workflow',
    tags: ['워크플로우', '전체과정', '가이드', '초보자'],
    thumbnailUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDMyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjMwMCIgaGVpZ2h0PSIxNjAiIHJ4PSI4IiBmaWxsPSIjOEI1Q0Y2Ii8+Cjx0ZXh0IHg9IjE2MCIgeT0iMTAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxOCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPldPUktGTE9XPC90ZXh0Pgo8L3N2Zz4K',
    data: {
      steps: ['시나리오 기획', '프롬프트 생성', '영상 제작', '피드백 수집', '최종 편집'],
      checkpoints: ['기획 완료', '프롬프트 검증', '영상 생성 완료', '피드백 반영', '최종 승인']
    },
    isPublic: true,
    downloads: 134,
    rating: 4.6,
    createdAt: new Date().toISOString(),
  }
];

export async function GET(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'all';
    const search = searchParams.get('search') || '';

    // 실제 구현에서는 Prisma를 사용하여 데이터베이스에서 조회
    // 현재는 샘플 데이터를 사용
    let templates = sampleTemplates;

    // 카테고리 필터링
    if (category !== 'all') {
      templates = templates.filter(template => template.category === category);
    }

    // 검색 필터링
    if (search) {
      const searchLower = search.toLowerCase();
      templates = templates.filter(template => 
        template.name.toLowerCase().includes(searchLower) ||
        template.description.toLowerCase().includes(searchLower) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    return success(templates, 200, traceId);

  } catch (error: any) {
    console.error('❌ Templates GET API Error:', error);
    return failure(ERROR_CODES.UNKNOWN, '템플릿 목록을 불러오는 중 오류가 발생했습니다.', 500, error.message, traceId);
  }
}

export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return standardErrors.unauthorized(traceId);
    }

    const body = await req.json();
    const { name, description, category, tags, data } = body;

    if (!name) {
      return standardErrors.invalidInput('템플릿 이름', traceId);
    }
    if (!description) {
      return standardErrors.invalidInput('템플릿 설명', traceId);
    }
    if (!category) {
      return standardErrors.invalidInput('카테고리', traceId);
    }

    // 실제 구현에서는 Prisma를 사용하여 데이터베이스에 저장
    // 현재는 성공 응답만 반환
    const newTemplate = {
      id: `template-${Date.now()}`,
      name,
      description,
      category,
      tags: tags || [],
      data,
      isPublic: false,
      downloads: 0,
      rating: 0,
      createdAt: new Date().toISOString(),
    };

    return success(newTemplate, 201, traceId);

  } catch (error: any) {
    console.error('❌ Templates POST API Error:', error);
    return failure(ERROR_CODES.UNKNOWN, '템플릿 생성 중 오류가 발생했습니다.', 500, error.message, traceId);
  }
}