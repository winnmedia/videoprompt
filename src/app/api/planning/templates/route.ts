/**
 * Planning Templates API Route
 *
 * 기획 템플릿 관리 엔드포인트
 * CLAUDE.md 준수: 비용 안전 미들웨어, JWT 검증, Supabase RLS, $300 사건 방지
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'

import {
  withApiHandler,
  validateRequest,
  validateQueryParams,
  createSuccessResponse,
  createPaginatedResponse,
  handleCorsPreflightRequest,
  PlanningApiError,
} from '@/shared/api/planning-utils'

import { supabaseClient } from '@/shared/api/supabase-client'
import logger from '@/shared/lib/structured-logger'

// ===========================================
// 요청/응답 스키마
// ===========================================

const TemplateCreateSchema = z.object({
  name: z.string().min(1, '템플릿 이름은 필수입니다').max(100, '템플릿 이름은 100자를 초과할 수 없습니다'),
  description: z.string().max(500, '설명은 500자를 초과할 수 없습니다').optional(),
  category: z.enum(['commercial', 'drama', 'documentary', 'music-video', 'corporate', 'education', 'other']),
  isPublic: z.boolean().default(false),
  templateData: z.object({
    // 입력 데이터 템플릿
    inputTemplate: z.object({
      targetDuration: z.number().min(30).max(3600).optional(),
      toneAndManner: z.string().optional(),
      development: z.string().optional(),
      intensity: z.string().optional(),
      targetAudience: z.string().optional(),
      mainMessage: z.string().optional(),
      keywords: z.array(z.string()).optional(),
    }).optional(),

    // 스토리 구조 템플릿
    storyStructure: z.object({
      stepCount: z.number().min(3).max(8).default(4),
      steps: z.array(z.object({
        order: z.number(),
        title: z.string(),
        description: z.string().optional(),
        suggestedDuration: z.number().optional(),
        keyPoints: z.array(z.string()).optional(),
      })),
    }).optional(),

    // 샷 구성 템플릿
    shotTemplate: z.object({
      totalShots: z.number().min(6).max(24).default(12),
      distribution: z.record(z.string(), z.number()).optional(), // 스텝별 샷 분배
      defaultShotTypes: z.array(z.string()).optional(),
      cameraMovements: z.array(z.string()).optional(),
      transitionTypes: z.array(z.string()).optional(),
    }).optional(),

    // 스타일 가이드
    styleGuide: z.object({
      visualStyle: z.string().optional(),
      colorPalette: z.array(z.string()).optional(),
      typography: z.string().optional(),
      contiStyle: z.enum(['cinematic', 'artistic', 'realistic', 'cartoon', 'anime', 'sketch']).optional(),
    }).optional(),
  }),

  // 태그 시스템
  tags: z.array(z.string()).max(10, '최대 10개의 태그까지 등록 가능합니다').optional(),
})

const TemplateListQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(20),
  category: z.enum(['commercial', 'drama', 'documentary', 'music-video', 'corporate', 'education', 'other']).optional(),
  search: z.string().max(100).optional(),
  isPublic: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'name', 'usage_count']).default('updated_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  tags: z.string().optional().transform(val => val ? val.split(',').map(t => t.trim()) : undefined),
})

interface PlanningTemplate {
  id: string
  name: string
  description?: string
  category: string
  isPublic: boolean
  templateData: any
  tags: string[]
  usageCount: number
  createdBy: string
  createdAt: string
  updatedAt: string
  author?: {
    name?: string
    email?: string
  }
}

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// ===========================================
// GET: 템플릿 목록 조회
// ===========================================

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const queryData = validateQueryParams(request, TemplateListQuerySchema)

    logger.info('기획 템플릿 목록 조회', {
      userId: user?.userId,
      component: 'TemplatesAPI',
      metadata: {
        page: queryData.page,
        limit: queryData.limit,
        category: queryData.category,
        search: queryData.search,
        isPublic: queryData.isPublic,
      },
    })

    try {
      // 쿼리 구성
      let query = supabaseClient.raw
        .from('planning_templates')
        .select(`
          id,
          name,
          description,
          category,
          is_public,
          template_data,
          tags,
          usage_count,
          created_by,
          created_at,
          updated_at
        `, { count: 'exact' })

      // 필터 적용
      if (queryData.isPublic !== undefined) {
        query = query.eq('is_public', queryData.isPublic)
      } else {
        // 기본적으로 본인 템플릿 + 공개 템플릿
        query = query.or(`created_by.eq.${user!.userId},is_public.eq.true`)
      }

      if (queryData.category) {
        query = query.eq('category', queryData.category)
      }

      if (queryData.search) {
        query = query.or(`name.ilike.%${queryData.search}%,description.ilike.%${queryData.search}%`)
      }

      if (queryData.tags && queryData.tags.length > 0) {
        query = query.overlaps('tags', queryData.tags)
      }

      // 정렬
      query = query.order(queryData.sortBy, { ascending: queryData.sortOrder === 'asc' })

      // 페이지네이션
      const offset = (queryData.page - 1) * queryData.limit
      query = query.range(offset, offset + queryData.limit - 1)

      const { data: templates, error: templatesError, count } = await supabaseClient.safeQuery(
        () => query,
        user!.userId,
        'get_planning_templates'
      )

      if (templatesError) {
        throw new PlanningApiError('템플릿 목록 조회 실패', 'TEMPLATES_FETCH_FAILED', 500)
      }

      // 작성자 정보 추가 (공개 템플릿의 경우)
      const templatesWithAuthor: PlanningTemplate[] = (templates || []).map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        isPublic: template.is_public,
        templateData: template.template_data,
        tags: template.tags || [],
        usageCount: template.usage_count || 0,
        createdBy: template.created_by,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        author: template.is_public ? {
          name: '익명',
          email: '***@***.com'
        } : undefined,
      }))

      return createPaginatedResponse(
        templatesWithAuthor,
        {
          page: queryData.page,
          limit: queryData.limit,
          total: count || 0,
        },
        {
          userId: user?.userId,
        }
      )

    } catch (error) {
      logger.error(
        '템플릿 목록 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'TemplatesAPI',
          metadata: queryData,
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/templates',
  }
)

// ===========================================
// POST: 새 템플릿 생성
// ===========================================

export const POST = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const requestData = await validateRequest(request, TemplateCreateSchema)

    logger.info('기획 템플릿 생성', {
      userId: user?.userId,
      component: 'TemplatesAPI',
      metadata: {
        name: requestData.name,
        category: requestData.category,
        isPublic: requestData.isPublic,
      },
    })

    try {
      // 중복 이름 확인 (사용자별)
      const { data: existingTemplate, error: checkError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_templates')
          .select('id')
          .eq('name', requestData.name)
          .eq('created_by', user!.userId)
          .single(),
        user!.userId,
        'check_template_name_duplicate'
      )

      if (existingTemplate) {
        throw new PlanningApiError('동일한 이름의 템플릿이 이미 존재합니다.', 'TEMPLATE_NAME_DUPLICATE', 409)
      }

      // 템플릿 데이터 검증
      validateTemplateData(requestData.templateData)

      // 새 템플릿 생성
      const templateRecord = {
        name: requestData.name,
        description: requestData.description,
        category: requestData.category,
        is_public: requestData.isPublic,
        template_data: requestData.templateData,
        tags: requestData.tags || [],
        usage_count: 0,
        created_by: user!.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data: newTemplate, error: insertError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_templates')
          .insert(templateRecord)
          .select('*')
          .single(),
        user!.userId,
        'create_planning_template'
      )

      if (insertError || !newTemplate) {
        throw new PlanningApiError('템플릿 생성 실패', 'TEMPLATE_CREATE_FAILED', 500)
      }

      const result: PlanningTemplate = {
        id: newTemplate.id,
        name: newTemplate.name,
        description: newTemplate.description,
        category: newTemplate.category,
        isPublic: newTemplate.is_public,
        templateData: newTemplate.template_data,
        tags: newTemplate.tags || [],
        usageCount: newTemplate.usage_count || 0,
        createdBy: newTemplate.created_by,
        createdAt: newTemplate.created_at,
        updatedAt: newTemplate.updated_at,
      }

      // 성공 로그
      logger.logBusinessEvent('planning_template_created', {
        userId: user?.userId,
        templateId: newTemplate.id,
        name: requestData.name,
        category: requestData.category,
        isPublic: requestData.isPublic,
        tags: requestData.tags,
      })

      return createSuccessResponse(result, {
        userId: user?.userId,
      })

    } catch (error) {
      logger.error(
        '템플릿 생성 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'TemplatesAPI',
          metadata: requestData,
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/templates',
  }
)

// ===========================================
// 헬퍼 함수들
// ===========================================

/**
 * 템플릿 데이터 검증
 */
function validateTemplateData(templateData: any): void {
  // 스토리 구조 검증
  if (templateData.storyStructure) {
    const { stepCount, steps } = templateData.storyStructure

    if (steps && steps.length !== stepCount) {
      throw new PlanningApiError(
        '스토리 스텝 개수와 실제 스텝 데이터가 일치하지 않습니다.',
        'INVALID_STORY_STRUCTURE',
        400
      )
    }

    if (steps) {
      const orders = steps.map((step: any) => step.order)
      const uniqueOrders = new Set(orders)

      if (orders.length !== uniqueOrders.size) {
        throw new PlanningApiError(
          '스토리 스텝 순서가 중복되었습니다.',
          'DUPLICATE_STEP_ORDER',
          400
        )
      }
    }
  }

  // 샷 템플릿 검증
  if (templateData.shotTemplate) {
    const { totalShots, distribution } = templateData.shotTemplate

    if (distribution) {
      const totalDistribution = Object.values(distribution).reduce((sum: number, count: any) => sum + count, 0)

      if (totalDistribution !== totalShots) {
        throw new PlanningApiError(
          '샷 분배 합계가 총 샷 개수와 일치하지 않습니다.',
          'INVALID_SHOT_DISTRIBUTION',
          400
        )
      }
    }
  }

  // 스타일 가이드 검증
  if (templateData.styleGuide?.colorPalette) {
    const { colorPalette } = templateData.styleGuide

    const validColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    const invalidColors = colorPalette.filter((color: string) => !validColorRegex.test(color))

    if (invalidColors.length > 0) {
      throw new PlanningApiError(
        `유효하지 않은 색상 코드가 포함되어 있습니다: ${invalidColors.join(', ')}`,
        'INVALID_COLOR_PALETTE',
        400
      )
    }
  }
}