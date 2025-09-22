/**
 * Prompt History API Route
 *
 * 프롬프트 히스토리 조회 엔드포인트
 * CLAUDE.md 준수: API 라우트, 쿼리 파라미터 검증
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/db'

// 쿼리 파라미터 스키마
const HistoryQuerySchema = z.object({
  scenarioId: z.string().uuid().optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  offset: z.string().transform(Number).pipe(z.number().int().min(0)).optional(),
  status: z.enum(['completed', 'failed', 'pending']).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // 쿼리 파라미터 검증
    const query = HistoryQuerySchema.parse({
      scenarioId: searchParams.get('scenarioId') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
      status: searchParams.get('status') || undefined,
    })

    // Supabase 쿼리 구성
    let supabaseQuery = supabase
      .from('generated_prompts')
      .select(`
        id,
        scenario_id,
        prompt_name,
        generated_at,
        status,
        warnings,
        vlanet_prompt
      `)
      .order('generated_at', { ascending: false })

    // 필터 적용
    if (query.scenarioId) {
      supabaseQuery = supabaseQuery.eq('scenario_id', query.scenarioId)
    }

    if (query.status) {
      supabaseQuery = supabaseQuery.eq('status', query.status)
    }

    // 페이지네이션
    const limit = query.limit || 20
    const offset = query.offset || 0
    supabaseQuery = supabaseQuery.range(offset, offset + limit - 1)

    const { data: prompts, error, count } = await supabaseQuery

    if (error) {
      console.error('프롬프트 히스토리 조회 오류:', error)
      throw new Error('프롬프트 히스토리 조회에 실패했습니다.')
    }

    // 응답 데이터 가공
    const historyItems = prompts?.map((prompt) => ({
      id: prompt.id,
      scenarioId: prompt.scenario_id,
      promptName: prompt.prompt_name,
      generatedAt: prompt.generated_at,
      status: prompt.status,
      warnings: prompt.warnings,

      // 프롬프트 메타데이터만 포함 (전체 데이터는 별도 요청으로)
      metadata: {
        version: prompt.vlanet_prompt?.version,
        projectConfig: prompt.vlanet_prompt?.projectConfig,
        timelineCount: prompt.vlanet_prompt?.promptBlueprint?.timeline?.length || 0,
        durationMs: prompt.vlanet_prompt?.promptBlueprint?.metadata?.deliverySpec?.durationMs || 0,
        aspectRatio: prompt.vlanet_prompt?.promptBlueprint?.metadata?.deliverySpec?.aspectRatio,
      },

      // 프리뷰용 간단한 정보
      preview: {
        visualStyle: prompt.vlanet_prompt?.promptBlueprint?.metadata?.baseStyle?.visualStyle,
        genre: prompt.vlanet_prompt?.promptBlueprint?.metadata?.baseStyle?.genre,
        mood: prompt.vlanet_prompt?.promptBlueprint?.metadata?.baseStyle?.mood,
        charactersCount: prompt.vlanet_prompt?.promptBlueprint?.elements?.characters?.length || 0,
        objectsCount: prompt.vlanet_prompt?.promptBlueprint?.elements?.coreObjects?.length || 0,
      },
    })) || []

    return NextResponse.json({
      success: true,
      data: historyItems,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    })

  } catch (error) {
    console.error('프롬프트 히스토리 API 오류:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: '쿼리 파라미터가 올바르지 않습니다.',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: '서버 내부 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}