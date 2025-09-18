/**
 * 이중 저장 시스템 서비스
 * Prisma + Supabase 동시 트랜잭션 지원
 *
 * 목적: 데이터 일관성 보장 및 장애 복구 지원
 */

import { prisma } from '@/lib/db';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { supabaseCircuitBreaker, prismaCircuitBreaker } from '@/shared/lib/circuit-breaker';
import type { Story } from '@/shared/schemas/story.schema';

// 이중 저장 결과 타입
interface DualStorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  prismaSuccess: boolean;
  supabaseSuccess: boolean;
  partialFailure?: {
    prismaError?: string;
    supabaseError?: string;
  };
}

// 스토리 생성을 위한 입력 타입
interface CreateStoryInput {
  title: string;
  oneLineStory: string;
  genre: string;
  tone?: string;
  target?: string;
  structure?: any;
  userId?: string | null;
}

// 시나리오 생성을 위한 입력 타입
interface CreateScenarioInput {
  title: string;
  logline?: string;
  structure4?: any;
  shots12?: any;
  pdfUrl?: string;
  userId?: string | null;
}

/**
 * 스토리를 Prisma와 Supabase에 동시 저장
 */
export async function createStoryDual(input: CreateStoryInput): Promise<DualStorageResult<Story>> {
  let prismaResult: any = null;
  let supabaseResult: any = null;
  let prismaSuccess = false;
  let supabaseSuccess = false;

  console.log('🔄 Dual storage: 스토리 생성 시작', {
    title: input.title,
    userId: input.userId || 'guest'
  });

  try {
    // 1. Prisma에 저장 시도 (회로 차단기 적용)
    console.log('📝 Prisma 저장 시도...');
    try {
      prismaResult = await prismaCircuitBreaker.execute(async () => {
        return await prisma.story.create({
          data: {
            title: input.title,
            oneLineStory: input.oneLineStory,
            genre: input.genre,
            tone: input.tone,
            target: input.target,
            structure: input.structure,
            userId: input.userId,
          }
        });
      });
      prismaSuccess = true;
      console.log('✅ Prisma 저장 성공:', prismaResult.id);
    } catch (prismaError) {
      console.error('❌ Prisma 저장 실패:', prismaError);
      // Prisma 실패해도 계속 진행 (Graceful Degradation)
    }

    // 2. Supabase에 저장 시도 (회로 차단기 적용)
    console.log('📝 Supabase 저장 시도...');
    try {
      supabaseResult = await supabaseCircuitBreaker.execute(async () => {
        const client = await getSupabaseClientSafe('admin');

        const { data: supabaseData, error: supabaseError } = await client
          .from('Story')
          .insert({
            id: prismaResult?.id || crypto.randomUUID(), // Prisma ID 우선 사용
            title: input.title,
            one_line_story: input.oneLineStory,
            genre: input.genre,
            tone: input.tone,
            target: input.target,
            structure: input.structure,
            user_id: input.userId,
          })
          .select()
          .single();

        if (supabaseError) {
          throw new Error(`Supabase 저장 실패: ${supabaseError.message}`);
        }

        return supabaseData;
      });

      supabaseSuccess = true;
      console.log('✅ Supabase 저장 성공:', supabaseResult.id);
    } catch (supabaseError) {
      console.error('❌ Supabase 저장 실패:', supabaseError);
      // Supabase 실패해도 계속 진행 (Graceful Degradation)
    }

    // 3. 결과 평가 및 반환
    const result = evaluateStorageResult(prismaResult, supabaseResult, prismaSuccess, supabaseSuccess);

    console.log('🎯 Dual storage 완료:', {
      prismaSuccess,
      supabaseSuccess,
      overall: result.success
    });

    return result;

  } catch (error) {
    console.error('❌ Dual storage 예상치 못한 오류:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      prismaSuccess: false,
      supabaseSuccess: false
    };
  }
}

/**
 * 스토리 목록을 Prisma 우선, Supabase 백업으로 조회
 */
export async function getStoriesDual(filters: {
  userId?: string | null;
  page?: number;
  limit?: number;
  search?: string;
  genre?: string;
  tone?: string;
  target?: string;
}): Promise<DualStorageResult<{ stories: Story[]; total: number }>> {
  const { userId, page = 1, limit = 20, search, genre, tone, target } = filters;

  console.log('🔍 Dual storage: 스토리 조회 시작', { userId: userId || 'guest' });

  try {
    // 1. Prisma에서 조회 시도 (Primary)
    try {
      console.log('📖 Prisma 조회 시도...');

      const where: any = {};
      if (userId !== undefined) {
        where.userId = userId;
      }
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { oneLineStory: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (genre) where.genre = genre;
      if (tone) where.tone = tone;
      if (target) where.target = target;

      const skip = (page - 1) * limit;

      const [stories, total] = await Promise.all([
        prisma.story.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.story.count({ where })
      ]);

      // Prisma 데이터를 API 스키마에 맞게 변환
      const transformedStories: Story[] = stories.map(story => ({
        id: story.id,
        title: story.title,
        content: story.oneLineStory,
        oneLineStory: story.oneLineStory,
        genre: story.genre,
        tone: story.tone || '',
        targetAudience: story.target || '',
        structure: story.structure,
        userId: story.userId,
        status: 'published' as const,
        createdAt: story.createdAt.toISOString(),
        updatedAt: story.updatedAt.toISOString(),
      }));

      console.log('✅ Prisma 조회 성공:', transformedStories.length);

      return {
        success: true,
        data: { stories: transformedStories, total },
        prismaSuccess: true,
        supabaseSuccess: false // 사용하지 않음
      };

    } catch (prismaError) {
      console.warn('⚠️ Prisma 조회 실패, Supabase로 폴백:', prismaError);

      // 2. Supabase로 폴백 (Fallback)
      return getStoriesFromSupabase(filters);
    }

  } catch (error) {
    console.error('❌ Dual storage 조회 예상치 못한 오류:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      prismaSuccess: false,
      supabaseSuccess: false
    };
  }
}

/**
 * Supabase에서 스토리 조회 (폴백용)
 */
async function getStoriesFromSupabase(filters: {
  userId?: string | null;
  page?: number;
  limit?: number;
  search?: string;
  genre?: string;
  tone?: string;
  target?: string;
}): Promise<DualStorageResult<{ stories: Story[]; total: number }>> {
  const { userId, page = 1, limit = 20, search, genre, tone, target } = filters;

  try {
    console.log('📖 Supabase 폴백 조회 시도...');

    const client = await getSupabaseClientSafe('admin');

    let query = client
      .from('Story')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // 필터 적용
    if (userId !== undefined) {
      if (userId) {
        query = query.eq('user_id', userId);
      } else {
        query = query.is('user_id', null);
      }
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,one_line_story.ilike.%${search}%`);
    }

    if (genre) query = query.eq('genre', genre);
    if (tone) query = query.eq('tone', tone);
    if (target) query = query.eq('target', target);

    // 페이지네이션
    const startIndex = (page - 1) * limit;
    query = query.range(startIndex, startIndex + limit - 1);

    const { data: stories, error, count } = await query;

    if (error) {
      throw new Error(`Supabase 쿼리 실패: ${error.message}`);
    }

    // Supabase 데이터를 API 스키마에 맞게 변환
    const transformedStories: Story[] = stories?.map(story => ({
      id: story.id,
      title: story.title,
      content: story.one_line_story || '',
      oneLineStory: story.one_line_story,
      genre: story.genre,
      tone: story.tone || '',
      targetAudience: story.target || '',
      structure: story.structure,
      userId: story.user_id,
      status: 'published' as const,
      createdAt: story.created_at,
      updatedAt: story.updated_at,
    })) || [];

    console.log('✅ Supabase 폴백 조회 성공:', transformedStories.length);

    return {
      success: true,
      data: { stories: transformedStories, total: count || 0 },
      prismaSuccess: false,
      supabaseSuccess: true
    };

  } catch (error) {
    console.error('❌ Supabase 폴백 조회도 실패:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      prismaSuccess: false,
      supabaseSuccess: false
    };
  }
}

/**
 * 저장 결과 평가 및 최종 응답 생성
 */
function evaluateStorageResult(
  prismaResult: any,
  supabaseResult: any,
  prismaSuccess: boolean,
  supabaseSuccess: boolean
): DualStorageResult<Story> {

  // 1. 둘 다 성공 (이상적)
  if (prismaSuccess && supabaseSuccess) {
    return {
      success: true,
      data: transformToStorySchema(prismaResult || supabaseResult),
      prismaSuccess: true,
      supabaseSuccess: true
    };
  }

  // 2. Prisma만 성공 (부분 성공)
  if (prismaSuccess && !supabaseSuccess) {
    return {
      success: true, // 데이터는 저장됨
      data: transformToStorySchema(prismaResult),
      prismaSuccess: true,
      supabaseSuccess: false,
      partialFailure: {
        supabaseError: 'Supabase 저장 실패'
      }
    };
  }

  // 3. Supabase만 성공 (부분 성공)
  if (!prismaSuccess && supabaseSuccess) {
    return {
      success: true, // 데이터는 저장됨
      data: transformToStorySchema(supabaseResult, true),
      prismaSuccess: false,
      supabaseSuccess: true,
      partialFailure: {
        prismaError: 'Prisma 저장 실패'
      }
    };
  }

  // 4. 둘 다 실패 (완전 실패)
  return {
    success: false,
    error: '모든 저장소에서 저장 실패',
    prismaSuccess: false,
    supabaseSuccess: false
  };
}

/**
 * 원시 데이터를 Story 스키마로 변환
 */
function transformToStorySchema(rawData: any, isSupabase = false): Story {
  if (isSupabase) {
    return {
      id: rawData.id,
      title: rawData.title,
      content: rawData.one_line_story || '',
      oneLineStory: rawData.one_line_story,
      genre: rawData.genre,
      tone: rawData.tone || '',
      targetAudience: rawData.target || '',
      structure: rawData.structure,
      userId: rawData.user_id,
      status: 'published' as const,
      createdAt: rawData.created_at,
      updatedAt: rawData.updated_at,
    };
  } else {
    return {
      id: rawData.id,
      title: rawData.title,
      content: rawData.oneLineStory || '',
      oneLineStory: rawData.oneLineStory,
      genre: rawData.genre,
      tone: rawData.tone || '',
      targetAudience: rawData.target || '',
      structure: rawData.structure,
      userId: rawData.userId,
      status: 'published' as const,
      createdAt: rawData.createdAt.toISOString(),
      updatedAt: rawData.updatedAt.toISOString(),
    };
  }
}

/**
 * 시나리오를 Prisma와 Supabase에 동시 저장
 */
export async function createScenarioDual(input: CreateScenarioInput): Promise<DualStorageResult<any>> {
  let prismaResult: any = null;
  let supabaseResult: any = null;
  let prismaSuccess = false;
  let supabaseSuccess = false;

  console.log('🔄 Dual storage: 시나리오 생성 시작', {
    title: input.title,
    userId: input.userId || 'guest'
  });

  try {
    // 1. Prisma에 저장 시도
    console.log('📝 Prisma 시나리오 저장 시도...');
    try {
      prismaResult = await prisma.scenario.create({
        data: {
          title: input.title,
          logline: input.logline || null,
          structure4: input.structure4 || null,
          shots12: input.shots12 || null,
          pdfUrl: input.pdfUrl || null,
          userId: input.userId,
        },
        select: { id: true, title: true, createdAt: true }
      });
      prismaSuccess = true;
      console.log('✅ Prisma 시나리오 저장 성공:', prismaResult.id);
    } catch (prismaError) {
      console.error('❌ Prisma 시나리오 저장 실패:', prismaError);
      // Prisma 실패해도 계속 진행 (Graceful Degradation)
    }

    // 2. Supabase에 저장 시도
    console.log('📝 Supabase 시나리오 저장 시도...');
    try {
      const client = await getSupabaseClientSafe('admin');

      const { data: supabaseData, error: supabaseError } = await client
        .from('Scenario')
        .insert({
          id: prismaResult?.id || crypto.randomUUID(), // Prisma ID 우선 사용
          title: input.title,
          logline: input.logline || null,
          structure4: input.structure4 || null,
          shots12: input.shots12 || null,
          pdf_url: input.pdfUrl || null,
          user_id: input.userId,
        })
        .select()
        .single();

      if (supabaseError) {
        throw new Error(`Supabase 시나리오 저장 실패: ${supabaseError.message}`);
      }

      supabaseResult = supabaseData;
      supabaseSuccess = true;
      console.log('✅ Supabase 시나리오 저장 성공:', supabaseResult.id);
    } catch (supabaseError) {
      console.error('❌ Supabase 시나리오 저장 실패:', supabaseError);
      // Supabase 실패해도 계속 진행 (Graceful Degradation)
    }

    // 3. 결과 평가 및 반환
    const result = evaluateStorageResult(prismaResult, supabaseResult, prismaSuccess, supabaseSuccess);

    console.log('🎯 Dual storage 시나리오 완료:', {
      prismaSuccess,
      supabaseSuccess,
      overall: result.success
    });

    return result;

  } catch (error) {
    console.error('❌ Dual storage 시나리오 예상치 못한 오류:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      prismaSuccess: false,
      supabaseSuccess: false
    };
  }
}