/**
 * Planning Project Detail API Route
 *
 * 개별 기획 프로젝트 상세 조회 엔드포인트
 * CLAUDE.md 준수: 비용 안전 미들웨어, JWT 검증, Supabase RLS, $300 사건 방지
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'

import {
  withApiHandler,
  validateQueryParams,
  createSuccessResponse,
  handleCorsPreflightRequest,
  PlanningApiError,
} from '@/shared/api/planning-utils'

import type { PlanningProject } from '@/entities/planning'
import { supabaseClient } from '@/shared/api/supabase-client'
import logger from '@/shared/lib/structured-logger'

// ===========================================
// 요청/응답 스키마
// ===========================================

const ProjectDetailQuerySchema = z.object({
  includeSteps: z.enum(['true', 'false']).transform(val => val === 'true').default('true'),
  includeShots: z.enum(['true', 'false']).transform(val => val === 'true').default('true'),
  includeInserts: z.enum(['true', 'false']).transform(val => val === 'true').default('false'),
  includeConti: z.enum(['true', 'false']).transform(val => val === 'true').default('false'),
})

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// ===========================================
// GET: 개별 프로젝트 상세 조회
// ===========================================

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { user, params } = context
    const projectId = params?.id

    if (!projectId) {
      throw new PlanningApiError('프로젝트 ID가 필요합니다.', 'MISSING_PROJECT_ID', 400)
    }

    // 쿼리 파라미터 검증
    const options = validateQueryParams(request, ProjectDetailQuerySchema)

    logger.info('기획 프로젝트 상세 조회', {
      userId: user?.userId,
      component: 'PlanningProjectDetailAPI',
      metadata: {
        projectId,
        includeSteps: options.includeSteps,
        includeShots: options.includeShots,
      },
    })

    try {
      // 기본 프로젝트 정보 조회
      const { data: project, error: projectError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'get_planning_project_detail'
      )

      if (projectError || !project) {
        throw new PlanningApiError('프로젝트를 찾을 수 없습니다.', 'PROJECT_NOT_FOUND', 404)
      }

      // 기본 응답 구성
      const response: PlanningProject = {
        metadata: {
          id: project.id,
          title: project.title,
          description: project.description,
          createdAt: new Date(project.created_at),
          updatedAt: new Date(project.updated_at),
          userId: project.user_id,
          projectId: project.project_id,
          status: project.status,
        },
        inputData: project.input_data,
        storySteps: [],
        shotSequences: [],
        insertShots: [],
        totalDuration: project.total_duration,
        completionPercentage: project.completion_percentage,
        currentStep: project.current_step,
        exportSettings: project.export_settings,
      }

      // 스토리 스텝 조회
      if (options.includeSteps) {
        const { data: storySteps, error: stepsError } = await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('story_steps')
            .select('*')
            .eq('planning_project_id', projectId)
            .order('order', { ascending: true }),
          user!.userId,
          'get_story_steps'
        )

        if (stepsError) {
          logger.warn('스토리 스텝 조회 실패', { projectId, error: stepsError })
        } else {
          response.storySteps = (storySteps || []).map(step => ({
            id: step.id,
            order: step.order,
            title: step.title,
            description: step.description,
            duration: step.duration,
            keyPoints: step.key_points || [],
            thumbnailUrl: step.thumbnail_url,
          }))
        }
      }

      // 샷 시퀀스 조회
      if (options.includeShots) {
        const { data: shotSequences, error: shotsError } = await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('shot_sequences')
            .select('*')
            .eq('planning_project_id', projectId)
            .order('order', { ascending: true }),
          user!.userId,
          'get_shot_sequences'
        )

        if (shotsError) {
          logger.warn('샷 시퀀스 조회 실패', { projectId, error: shotsError })
        } else {
          response.shotSequences = (shotSequences || []).map(shot => ({
            id: shot.id,
            order: shot.order,
            title: shot.title,
            description: shot.description,
            duration: shot.duration,
            contiDescription: shot.conti_description,
            contiImageUrl: shot.conti_image_url,
            contiStyle: shot.conti_style,
            shotType: shot.shot_type,
            cameraMovement: shot.camera_movement,
            location: shot.location,
            characters: shot.characters || [],
            visualElements: shot.visual_elements || [],
            audioNotes: shot.audio_notes,
            transitionType: shot.transition_type,
            storyStepId: shot.story_step_id,
          }))
        }
      }

      // 인서트 샷 조회
      if (options.includeInserts) {
        const { data: insertShots, error: insertsError } = await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('insert_shots')
            .select('*')
            .eq('planning_project_id', projectId)
            .order('shot_sequence_id, order', { ascending: true }),
          user!.userId,
          'get_insert_shots'
        )

        if (insertsError) {
          logger.warn('인서트 샷 조회 실패', { projectId, error: insertsError })
        } else {
          response.insertShots = (insertShots || []).map(insert => ({
            id: insert.id,
            shotSequenceId: insert.shot_sequence_id,
            order: insert.order,
            description: insert.description,
            purpose: insert.purpose,
            imageUrl: insert.image_url,
          }))
        }
      }

      // 콘티 생성 정보 조회
      if (options.includeConti) {
        const { data: contiGenerations, error: contiError } = await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('conti_generations')
            .select('*')
            .eq('planning_project_id', projectId)
            .order('created_at', { ascending: false }),
          user!.userId,
          'get_conti_generations'
        )

        if (contiError) {
          logger.warn('콘티 생성 정보 조회 실패', { projectId, error: contiError })
        } else {
          // 샷 시퀀스에 콘티 정보 매핑
          const contiMap = new Map(
            (contiGenerations || []).map(conti => [conti.shot_sequence_id, conti])
          )

          response.shotSequences = response.shotSequences.map(shot => ({
            ...shot,
            contiGeneration: contiMap.get(shot.id) ? {
              id: contiMap.get(shot.id)!.id,
              status: contiMap.get(shot.id)!.status,
              imageUrl: contiMap.get(shot.id)!.image_url,
              progress: contiMap.get(shot.id)!.progress_percentage,
              provider: contiMap.get(shot.id)!.provider,
              createdAt: new Date(contiMap.get(shot.id)!.created_at),
            } : undefined
          }))
        }
      }

      // 성공 로그
      logger.logBusinessEvent('planning_project_detail_viewed', {
        userId: user?.userId,
        projectId,
        title: response.metadata.title,
        currentStep: response.currentStep,
        includeOptions: options,
      })

      return createSuccessResponse(response, {
        userId: user?.userId,
      })

    } catch (error) {
      logger.error(
        '기획 프로젝트 상세 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'PlanningProjectDetailAPI',
          metadata: {
            projectId,
            options,
          },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/projects/[id]',
  }
)

// ===========================================
// PATCH: 프로젝트 진행 상태 업데이트
// ===========================================

const ProgressUpdateSchema = z.object({
  currentStep: z.enum(['input', 'story', 'shots']),
  completionPercentage: z.number().min(0).max(100).optional(),
  status: z.enum(['draft', 'generating', 'completed', 'error']).optional(),
})

export const PATCH = withApiHandler(
  async (request: NextRequest, context) => {
    const { user, params } = context
    const projectId = params?.id

    if (!projectId) {
      throw new PlanningApiError('프로젝트 ID가 필요합니다.', 'MISSING_PROJECT_ID', 400)
    }

    const updateData = await request.json()
    const validatedData = ProgressUpdateSchema.parse(updateData)

    logger.info('기획 프로젝트 진행 상태 업데이트', {
      userId: user?.userId,
      component: 'PlanningProjectDetailAPI',
      metadata: {
        projectId,
        currentStep: validatedData.currentStep,
        status: validatedData.status,
      },
    })

    try {
      // 프로젝트 존재 확인
      const { data: existingProject, error: fetchError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .select('id, status, current_step, completion_percentage')
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

      // 업데이트 데이터 준비
      const updateFields: any = {
        current_step: validatedData.currentStep,
        updated_at: new Date().toISOString(),
      }

      if (validatedData.status !== undefined) {
        updateFields.status = validatedData.status
      }

      // 완료 퍼센티지 자동 계산 (제공되지 않은 경우)
      if (validatedData.completionPercentage !== undefined) {
        updateFields.completion_percentage = validatedData.completionPercentage
      } else {
        const stepPercentages = { input: 25, story: 65, shots: 100 }
        updateFields.completion_percentage = stepPercentages[validatedData.currentStep]
      }

      // 상태 업데이트
      const { data: updatedProject, error: updateError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .update(updateFields)
          .eq('id', projectId)
          .eq('user_id', user!.userId)
          .select('*')
          .single(),
        user!.userId,
        'update_planning_progress'
      )

      if (updateError || !updatedProject) {
        throw updateError || new Error('프로젝트 진행 상태 업데이트 실패')
      }

      const response = {
        id: updatedProject.id,
        currentStep: updatedProject.current_step,
        status: updatedProject.status,
        completionPercentage: updatedProject.completion_percentage,
        updatedAt: updatedProject.updated_at,
      }

      // 성공 로그
      logger.logBusinessEvent('planning_project_progress_updated', {
        userId: user?.userId,
        projectId,
        fromStep: existingProject.current_step,
        toStep: validatedData.currentStep,
        completionPercentage: updateFields.completion_percentage,
      })

      return createSuccessResponse(response, {
        userId: user?.userId,
      })

    } catch (error) {
      logger.error(
        '기획 프로젝트 진행 상태 업데이트 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'PlanningProjectDetailAPI',
          metadata: {
            projectId,
            updateData: validatedData,
          },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/projects/[id]',
  }
)