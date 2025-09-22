/**
 * Planning Projects API Route
 *
 * 기획 프로젝트 CRUD 엔드포인트
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
} from '@/shared/api/planning-utils'

import type {
  PlanningProjectCreateInput,
  PlanningSearchFilter,
  PlanningProject,
} from '@/entities/planning'

import { validatePlanningInput } from '@/entities/planning'
import { supabaseClient } from '@/shared/api/supabase-client'
import logger from '@/shared/lib/structured-logger'

// ===========================================
// 요청/응답 스키마
// ===========================================

const ProjectCreateSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  projectId: z.string().optional(),
  inputData: z.object({
    title: z.string().min(1).max(100),
    logline: z.string().min(1).max(300),
    toneAndManner: z.enum(['casual', 'professional', 'creative', 'educational', 'marketing']),
    development: z.enum(['linear', 'dramatic', 'problem_solution', 'comparison', 'tutorial']),
    intensity: z.enum(['low', 'medium', 'high']),
    targetDuration: z.number().min(30).max(600).optional(),
    additionalNotes: z.string().max(1000).optional(),
  }),
})

const ProjectSearchSchema = z.object({
  query: z.string().optional(),
  status: z.enum(['draft', 'generating', 'completed', 'error']).array().optional(),
  toneAndManner: z.enum(['casual', 'professional', 'creative', 'educational', 'marketing']).array().optional(),
  development: z.enum(['linear', 'dramatic', 'problem_solution', 'comparison', 'tutorial']).array().optional(),
  'duration.min': z.coerce.number().min(0).optional(),
  'duration.max': z.coerce.number().max(3600).optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'duration', 'status']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
})

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// ===========================================
// GET: 프로젝트 목록 조회
// ===========================================

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context

    // 쿼리 파라미터 검증
    const filters = validateQueryParams(request, ProjectSearchSchema)

    logger.info('기획 프로젝트 목록 조회', {
      userId: user?.userId,
      component: 'PlanningProjectAPI',
      metadata: {
        query: filters.query,
        limit: filters.limit,
        offset: filters.offset,
        sortBy: filters.sortBy,
      },
    })

    try {
      // Supabase 쿼리 구성
      let query = supabaseClient.raw
        .from('planning_projects')
        .select(`
          id,
          title,
          description,
          status,
          current_step,
          completion_percentage,
          total_duration,
          created_at,
          updated_at,
          user_id,
          project_id,
          input_data,
          story_steps_count:story_steps(count),
          shot_sequences_count:shot_sequences(count)
        `, { count: 'exact' })
        .eq('user_id', user!.userId)
        .eq('is_deleted', false)

      // 필터 적용
      if (filters.query) {
        query = query.or(`title.ilike.%${filters.query}%,description.ilike.%${filters.query}%`)
      }

      if (filters.status && filters.status.length > 0) {
        query = query.in('status', filters.status)
      }

      if (filters.toneAndManner && filters.toneAndManner.length > 0) {
        query = query.overlaps('input_data->toneAndManner', filters.toneAndManner)
      }

      if (filters.development && filters.development.length > 0) {
        query = query.overlaps('input_data->development', filters.development)
      }

      if (filters['duration.min']) {
        query = query.gte('total_duration', filters['duration.min'])
      }

      if (filters['duration.max']) {
        query = query.lte('total_duration', filters['duration.max'])
      }

      if (filters.createdAfter) {
        query = query.gte('created_at', filters.createdAfter.toISOString())
      }

      if (filters.createdBefore) {
        query = query.lte('created_at', filters.createdBefore.toISOString())
      }

      // 정렬 및 페이지네이션
      query = query.order(filters.sortBy, { ascending: filters.sortOrder === 'asc' })

      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + filters.limit - 1)
      }

      // 쿼리 실행 - $300 사건 방지: 안전한 쿼리
      const { data, error, count } = await supabaseClient.safeQuery(
        () => query,
        user!.userId,
        'get_planning_projects'
      )

      if (error) {
        throw error
      }

      // 데이터 변환
      const projects = (data || []).map(project => ({
        id: project.id,
        title: project.title,
        description: project.description,
        status: project.status,
        currentStep: project.current_step,
        completionPercentage: project.completion_percentage,
        totalDuration: project.total_duration,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        userId: project.user_id,
        projectId: project.project_id,
        inputData: project.input_data,
        storyStepsCount: project.story_steps_count?.[0]?.count || 0,
        shotSequencesCount: project.shot_sequences_count?.[0]?.count || 0,
      }))

      // 로그 기록
      logger.logBusinessEvent('planning_projects_listed', {
        userId: user?.userId,
        projectsCount: projects.length,
        totalCount: count || 0,
        filters,
      })

      // 응답 반환
      return createPaginatedResponse(
        projects,
        {
          page: Math.floor(filters.offset / filters.limit) + 1,
          limit: filters.limit,
          total: count || 0,
        },
        {
          userId: user?.userId,
        }
      )

    } catch (error) {
      logger.error(
        '기획 프로젝트 목록 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'PlanningProjectAPI',
          metadata: { filters },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/projects',
  }
)

// ===========================================
// POST: 새 프로젝트 생성
// ===========================================

export const POST = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context

    // 요청 검증
    const requestData = await validateRequest(request, ProjectCreateSchema)

    logger.info('기획 프로젝트 생성 요청', {
      userId: user?.userId,
      component: 'PlanningProjectAPI',
      metadata: {
        title: requestData.title,
        toneAndManner: requestData.inputData.toneAndManner,
        development: requestData.inputData.development,
      },
    })

    try {
      // 입력 데이터 검증
      const inputValidation = validatePlanningInput(requestData.inputData)
      if (!inputValidation.isValid) {
        throw new Error(inputValidation.errors[0]?.message || '입력 데이터가 유효하지 않습니다')
      }

      // 프로젝트 메타데이터 생성
      const projectData = {
        user_id: user!.userId,
        project_id: requestData.projectId,
        title: requestData.title,
        description: requestData.description,
        status: 'draft' as const,
        current_step: 'input' as const,
        completion_percentage: 0,
        total_duration: requestData.inputData.targetDuration || 180,
        input_data: requestData.inputData,
        story_steps: [],
        shot_sequences: [],
        insert_shots: [],
      }

      // DB에 프로젝트 생성
      const { data: projectResult, error: projectError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .insert(projectData)
          .select('*')
          .single(),
        user!.userId,
        'create_planning_project'
      )

      if (projectError || !projectResult) {
        throw projectError || new Error('프로젝트 생성 실패')
      }

      // 응답 데이터 변환
      const response: Partial<PlanningProject> = {
        metadata: {
          id: projectResult.id,
          title: projectResult.title,
          description: projectResult.description,
          createdAt: new Date(projectResult.created_at),
          updatedAt: new Date(projectResult.updated_at),
          userId: projectResult.user_id,
          projectId: projectResult.project_id,
          status: projectResult.status,
        },
        inputData: projectResult.input_data,
        storySteps: [],
        shotSequences: [],
        insertShots: [],
        totalDuration: projectResult.total_duration,
        completionPercentage: projectResult.completion_percentage,
        currentStep: projectResult.current_step,
      }

      // 성공 로그
      logger.logBusinessEvent('planning_project_created', {
        userId: user?.userId,
        projectId: response.metadata!.id,
        title: response.metadata!.title,
        toneAndManner: requestData.inputData.toneAndManner,
      })

      return createSuccessResponse(response, {
        userId: user?.userId,
      })

    } catch (error) {
      logger.error(
        '기획 프로젝트 생성 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'PlanningProjectAPI',
          metadata: {
            title: requestData.title,
          },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/projects',
  }
)

// ===========================================
// PUT: 프로젝트 업데이트
// ===========================================

const ProjectUpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['draft', 'generating', 'completed', 'error']).optional(),
  currentStep: z.enum(['input', 'story', 'shots']).optional(),
  inputData: z.object({
    title: z.string().min(1).max(100),
    logline: z.string().min(1).max(300),
    toneAndManner: z.enum(['casual', 'professional', 'creative', 'educational', 'marketing']),
    development: z.enum(['linear', 'dramatic', 'problem_solution', 'comparison', 'tutorial']),
    intensity: z.enum(['low', 'medium', 'high']),
    targetDuration: z.number().min(30).max(600).optional(),
    additionalNotes: z.string().max(1000).optional(),
  }).optional(),
  exportSettings: z.record(z.any()).optional(),
})

export const PUT = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context

    // 요청 검증
    const requestData = await validateRequest(request, ProjectUpdateSchema)

    logger.info('기획 프로젝트 업데이트 요청', {
      userId: user?.userId,
      component: 'PlanningProjectAPI',
      metadata: {
        projectId: requestData.id,
        title: requestData.title,
      },
    })

    try {
      // 기존 프로젝트 조회
      const { data: existingProject, error: fetchError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .select('*')
          .eq('id', requestData.id)
          .eq('user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'get_planning_project'
      )

      if (fetchError || !existingProject) {
        throw new PlanningApiError('프로젝트를 찾을 수 없습니다.', 'PROJECT_NOT_FOUND', 404)
      }

      // 업데이트 데이터 준비
      const updateData: any = {}

      if (requestData.title !== undefined) updateData.title = requestData.title
      if (requestData.description !== undefined) updateData.description = requestData.description
      if (requestData.status !== undefined) updateData.status = requestData.status
      if (requestData.currentStep !== undefined) updateData.current_step = requestData.currentStep
      if (requestData.inputData !== undefined) updateData.input_data = requestData.inputData
      if (requestData.exportSettings !== undefined) updateData.export_settings = requestData.exportSettings

      // 완료 퍼센티지 자동 계산
      if (requestData.currentStep) {
        const stepPercentages = { input: 25, story: 65, shots: 100 }
        updateData.completion_percentage = stepPercentages[requestData.currentStep]
      }

      updateData.updated_at = new Date().toISOString()

      // 입력 데이터 검증 (있는 경우)
      if (requestData.inputData) {
        const inputValidation = validatePlanningInput(requestData.inputData)
        if (!inputValidation.isValid) {
          throw new ValidationError(inputValidation.errors[0]?.message || '입력 데이터가 유효하지 않습니다')
        }
      }

      // 프로젝트 업데이트
      const { data: updatedProject, error: updateError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .update(updateData)
          .eq('id', requestData.id)
          .eq('user_id', user!.userId)
          .select('*')
          .single(),
        user!.userId,
        'update_planning_project'
      )

      if (updateError || !updatedProject) {
        throw updateError || new Error('프로젝트 업데이트 실패')
      }

      // 응답 데이터 변환
      const response: Partial<PlanningProject> = {
        metadata: {
          id: updatedProject.id,
          title: updatedProject.title,
          description: updatedProject.description,
          createdAt: new Date(updatedProject.created_at),
          updatedAt: new Date(updatedProject.updated_at),
          userId: updatedProject.user_id,
          projectId: updatedProject.project_id,
          status: updatedProject.status,
        },
        inputData: updatedProject.input_data,
        totalDuration: updatedProject.total_duration,
        completionPercentage: updatedProject.completion_percentage,
        currentStep: updatedProject.current_step,
        exportSettings: updatedProject.export_settings,
      }

      // 성공 로그
      logger.logBusinessEvent('planning_project_updated', {
        userId: user?.userId,
        projectId: response.metadata!.id,
        updatedFields: Object.keys(updateData),
        currentStep: response.currentStep,
      })

      return createSuccessResponse(response, {
        userId: user?.userId,
      })

    } catch (error) {
      logger.error(
        '기획 프로젝트 업데이트 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'PlanningProjectAPI',
          metadata: {
            projectId: requestData.id,
          },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/projects',
  }
)

// ===========================================
// DELETE: 프로젝트 삭제 (소프트 삭제)
// ===========================================

export const DELETE = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context

    // 쿼리에서 ID 추출
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('id')

    if (!projectId) {
      throw new ValidationError('프로젝트 ID가 필요합니다.')
    }

    logger.info('기획 프로젝트 삭제 요청', {
      userId: user?.userId,
      component: 'PlanningProjectAPI',
      metadata: {
        projectId,
      },
    })

    try {
      // 기존 프로젝트 조회 및 권한 확인
      const { data: existingProject, error: fetchError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .select('id, title, user_id')
          .eq('id', projectId)
          .eq('user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'get_planning_project'
      )

      if (fetchError || !existingProject) {
        throw new PlanningApiError('프로젝트를 찾을 수 없습니다.', 'PROJECT_NOT_FOUND', 404)
      }

      // 소프트 삭제 실행
      const { error: deleteError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId)
          .eq('user_id', user!.userId),
        user!.userId,
        'delete_planning_project'
      )

      if (deleteError) {
        throw deleteError
      }

      // 관련 데이터 삭제 (스토리, 샷, 콘티 등)
      await Promise.all([
        supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('conti_generations')
            .update({ status: 'cancelled' })
            .eq('planning_project_id', projectId),
          user!.userId,
          'cancel_conti_generations'
        ),
        supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('marp_exports')
            .update({ status: 'cancelled' })
            .eq('planning_project_id', projectId),
          user!.userId,
          'cancel_marp_exports'
        ),
      ])

      // 성공 로그
      logger.logBusinessEvent('planning_project_deleted', {
        userId: user?.userId,
        projectId,
        title: existingProject.title,
      })

      return createSuccessResponse(
        { id: projectId, message: '프로젝트가 성공적으로 삭제되었습니다.' },
        { userId: user?.userId }
      )

    } catch (error) {
      logger.error(
        '기획 프로젝트 삭제 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'PlanningProjectAPI',
          metadata: {
            projectId,
          },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/projects',
  }
)