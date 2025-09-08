import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface StoryRecord {
  id: string;
  title: string;
  oneLineStory: string;
  genre: string;
  tone: string;
  target: string;
  structure?: {
    act1: {
      title: string;
      description: string;
      key_elements: string[];
      emotional_arc: string;
    };
    act2: {
      title: string;
      description: string;
      key_elements: string[];
      emotional_arc: string;
    };
    act3: {
      title: string;
      description: string;
      key_elements: string[];
      emotional_arc: string;
    };
    act4: {
      title: string;
      description: string;
      key_elements: string[];
      emotional_arc: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    
    // 사용자 인증 확인 (향후 추가 예정)
    // const user = await getCurrentUser(request);
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const skip = (page - 1) * limit;

    // 검색 조건 설정
    const whereCondition = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { logline: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // 생성된 스토리 목록 조회 (Story 테이블 사용)
    const whereConditionStory = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { oneLineStory: { contains: search, mode: 'insensitive' as const } },
            { genre: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [stories, totalCount] = await Promise.all([
      prisma.story.findMany({
        where: whereConditionStory,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.story.count({
        where: whereConditionStory,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    // StoryRecord 형식으로 변환
    const formattedStories = stories.map((story) => ({
      id: story.id,
      title: story.title,
      oneLineStory: story.oneLineStory,
      genre: story.genre,
      tone: story.tone || 'Neutral',
      target: story.target || 'General',
      structure: story.structure || null,
      createdAt: story.createdAt.toISOString(),
      updatedAt: story.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      stories: formattedStories,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('스토리 목록 조회 오류:', error);
    return NextResponse.json({ error: '스토리 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, oneLineStory, genre, tone, target, structure } = body;

    if (!title || !oneLineStory) {
      return NextResponse.json({ error: '제목과 스토리는 필수입니다.' }, { status: 400 });
    }

    // 사용자 인증 확인 (향후 추가 예정)
    // const user = await getCurrentUser(request);
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Story 테이블에 저장
    const story = await prisma.story.create({
      data: {
        title,
        oneLineStory,
        genre: genre || 'Drama',
        tone: tone || 'Neutral',
        target: target || 'General',
        structure: structure || null,
        // 사용자 인증 추가 시 userId 설정
      },
    });

    return NextResponse.json({
      id: story.id,
      title: story.title,
      oneLineStory: story.oneLineStory,
      genre: story.genre,
      tone: story.tone,
      target: story.target,
      structure,
      createdAt: story.createdAt.toISOString(),
      updatedAt: story.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('스토리 저장 오류:', error);
    return NextResponse.json({ error: '스토리 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}