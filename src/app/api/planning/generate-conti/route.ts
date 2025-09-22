/**
 * Planning Conti Generation API Route
 *
 * ByteDance 기반 콘티 이미지 생성 엔드포인트
 * CLAUDE.md 준수: 비용 안전 미들웨어, JWT 검증, Supabase RLS, $300 사건 방지
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'

import {
  withApiHandler,
  validateRequest,
  createSuccessResponse,
  handleCorsPreflightRequest,
  PlanningApiError,
  setCachedResponse,
} from '@/shared/api/planning-utils'

import { supabaseClient } from '@/shared/api/supabase-client'
import logger from '@/shared/lib/structured-logger'
import { byteDanceImageClient, type ByteDanceImageParams } from '@/shared/lib/image-generation/bytedance-client'
import type { ShotSequence } from '@/entities/planning'

// ===========================================
// 요청/응답 스키마
// ===========================================

const ContiGenerationRequestSchema = z.object({
  projectId: z.string().uuid('유효하지 않은 프로젝트 ID입니다'),
  shotIds: z.array(z.string().uuid()).min(1, '최소 1개 이상의 샷 ID가 필요합니다').max(9, '최대 9개까지 동시 생성 가능합니다'),
  style: z.enum(['cinematic', 'artistic', 'realistic', 'cartoon', 'anime', 'sketch']).default('cinematic'),
  quality: z.enum(['standard', 'high', 'ultra']).default('high'),
  regenerateExisting: z.boolean().default(false),
})

interface ContiGenerationResult {
  shotId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  imageUrl?: string
  error?: string
  requestId: string
  estimatedTime?: number
}

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// ===========================================
// POST: 콘티 이미지 생성
// ===========================================

export const POST = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const requestData = await validateRequest(request, ContiGenerationRequestSchema)

    // 캐시 키 생성 (중복 요청 방지)
    const cacheKey = `conti-generation-${requestData.projectId}-${requestData.shotIds.sort().join(',')}-${requestData.style}`

    logger.info('콘티 이미지 생성 요청', {
      userId: user?.userId,
      component: 'ContiGenerationAPI',
      metadata: {
        projectId: requestData.projectId,
        shotIds: requestData.shotIds,
        style: requestData.style,
        quality: requestData.quality,
      },
    })

    try {
      // 1. 프로젝트 소유권 확인
      const { data: project, error: projectError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .select('id, title, status')
          .eq('id', requestData.projectId)
          .eq('user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'verify_project_ownership'
      )

      if (projectError || !project) {
        throw new PlanningApiError('프로젝트를 찾을 수 없습니다.', 'PROJECT_NOT_FOUND', 404)
      }

      // 2. 샷 시퀀스 조회
      const { data: shotSequences, error: shotsError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('shot_sequences')
          .select('id, title, description, conti_description, order')
          .eq('planning_project_id', requestData.projectId)
          .in('id', requestData.shotIds)
          .order('order', { ascending: true }),
        user!.userId,
        'get_shot_sequences_for_conti'
      )

      if (shotsError || !shotSequences || shotSequences.length !== requestData.shotIds.length) {
        throw new PlanningApiError(
          '일부 샷 시퀀스를 찾을 수 없습니다.',
          'SHOT_SEQUENCES_NOT_FOUND',
          404
        )
      }

      // 3. 기존 콘티 생성 상태 확인
      const { data: existingConti, error: contiError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('conti_generations')
          .select('shot_sequence_id, status, image_url')
          .eq('planning_project_id', requestData.projectId)
          .in('shot_sequence_id', requestData.shotIds),
        user!.userId,
        'check_existing_conti'
      )

      if (contiError) {
        logger.warn('기존 콘티 상태 조회 실패', { projectId: requestData.projectId, error: contiError })
      }

      const existingContiMap = new Map(
        (existingConti || []).map(conti => [conti.shot_sequence_id, conti])
      )

      // 4. 생성할 샷 필터링 (재생성 옵션 고려)
      const shotsToGenerate = shotSequences.filter(shot => {
        const existing = existingContiMap.get(shot.id)
        if (!existing) return true
        if (requestData.regenerateExisting) return true
        return existing.status === 'failed' // 실패한 것만 재생성
      })

      if (shotsToGenerate.length === 0) {
        // 모든 샷이 이미 완료된 경우
        const results: ContiGenerationResult[] = shotSequences.map(shot => {
          const existing = existingContiMap.get(shot.id)!
          return {
            shotId: shot.id,
            status: existing.status as any,
            progress: existing.status === 'completed' ? 100 : 0,
            imageUrl: existing.image_url || undefined,
            requestId: `existing-${shot.id}`,
          }
        })

        return createSuccessResponse({
          projectId: requestData.projectId,
          results,
          message: '모든 콘티가 이미 생성되었습니다.',
        }, {
          userId: user?.userId,
        })
      }

      // 5. ByteDance 이미지 생성 파라미터 준비
      const imageParams: ByteDanceImageParams[] = shotsToGenerate.map(shot => ({
        prompt: buildContiPrompt(shot, project.title),
        negative_prompt: 'low quality, blurry, distorted, watermark, text, signature',
        width: 1024,
        height: 768,
        style: requestData.style,
        quality: requestData.quality,
        seed: Math.floor(Math.random() * 1000000),
      }))

      // 6. 콘티 생성 레코드 초기화
      const contiRecords = shotsToGenerate.map(shot => ({
        planning_project_id: requestData.projectId,
        shot_sequence_id: shot.id,
        status: 'pending' as const,
        progress_percentage: 0,
        provider: 'bytedance',
        style: requestData.style,
        quality: requestData.quality,
        prompt: buildContiPrompt(shot, project.title),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))

      // 기존 레코드 삭제 후 새로 삽입
      if (requestData.regenerateExisting) {
        await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('conti_generations')
            .delete()
            .eq('planning_project_id', requestData.projectId)
            .in('shot_sequence_id', shotsToGenerate.map(s => s.id)),
          user!.userId,
          'delete_existing_conti'
        )
      }

      const { error: insertError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('conti_generations')
          .upsert(contiRecords, {
            onConflict: 'planning_project_id,shot_sequence_id'
          }),
        user!.userId,
        'insert_conti_records'
      )

      if (insertError) {
        throw new PlanningApiError('콘티 생성 레코드 저장 실패', 'CONTI_RECORD_SAVE_FAILED', 500)
      }

      // 7. ByteDance 배치 이미지 생성 (3개씩 병렬)
      logger.info('ByteDance 배치 이미지 생성 시작', {
        userId: user?.userId,
        component: 'ContiGenerationAPI',
        metadata: {
          projectId: requestData.projectId,
          shotCount: shotsToGenerate.length,
          batchCount: Math.ceil(shotsToGenerate.length / 3),
        },
      })

      const generationJobs = await byteDanceImageClient.generateBatch(imageParams)

      // 8. 생성 결과를 데이터베이스에 업데이트
      const updatePromises = generationJobs.map(async (job, index) => {
        const shot = shotsToGenerate[index]
        const updateData = {
          status: job.status,
          progress_percentage: job.progress,
          request_id: job.id,
          estimated_time: job.estimatedTime,
          error_message: job.error,
          updated_at: new Date().toISOString(),
          ...(job.resultUrls.length > 0 && { image_url: job.resultUrls[0] }),
        }

        return supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('conti_generations')
            .update(updateData)
            .eq('planning_project_id', requestData.projectId)
            .eq('shot_sequence_id', shot.id),
          user!.userId,
          `update_conti_${shot.id}`
        )
      })

      await Promise.allSettled(updatePromises)

      // 9. 응답 구성
      const results: ContiGenerationResult[] = []

      // 생성된 샷들
      generationJobs.forEach((job, index) => {
        const shot = shotsToGenerate[index]
        results.push({
          shotId: shot.id,
          status: job.status,
          progress: job.progress,
          imageUrl: job.resultUrls[0],
          error: job.error,
          requestId: job.id,
          estimatedTime: job.estimatedTime,
        })
      })

      // 기존 완료된 샷들 (재생성하지 않은 경우)
      shotSequences.forEach(shot => {
        if (!shotsToGenerate.find(s => s.id === shot.id)) {
          const existing = existingContiMap.get(shot.id)!
          results.push({
            shotId: shot.id,
            status: existing.status as any,
            progress: existing.status === 'completed' ? 100 : 0,
            imageUrl: existing.image_url || undefined,
            requestId: `existing-${shot.id}`,
          })
        }
      })

      // 결과를 샷 순서대로 정렬
      results.sort((a, b) => {
        const shotA = shotSequences.find(s => s.id === a.shotId)!
        const shotB = shotSequences.find(s => s.id === b.shotId)!
        return shotA.order - shotB.order
      })

      // 10. 캐시 저장 (성공한 경우만)
      setCachedResponse(cacheKey, {
        projectId: requestData.projectId,
        results,
        generatedCount: shotsToGenerate.length,
        totalCount: shotSequences.length,
      })

      // 성공 로그
      logger.logBusinessEvent('planning_conti_generation_started', {
        userId: user?.userId,
        projectId: requestData.projectId,
        shotIds: requestData.shotIds,
        generatedCount: shotsToGenerate.length,
        totalCount: shotSequences.length,
        style: requestData.style,
        quality: requestData.quality,
      })

      return createSuccessResponse({
        projectId: requestData.projectId,
        results,
        generatedCount: shotsToGenerate.length,
        totalCount: shotSequences.length,
        estimatedTotalTime: Math.max(...generationJobs.map(j => j.estimatedTime || 30)),
      }, {
        userId: user?.userId,
      })

    } catch (error) {
      logger.error(
        '콘티 이미지 생성 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'ContiGenerationAPI',
          metadata: {
            projectId: requestData.projectId,
            shotIds: requestData.shotIds,
          },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/generate-conti',
  }
)

// ===========================================
// GET: 콘티 생성 상태 조회
// ===========================================

const ContiStatusQuerySchema = z.object({
  projectId: z.string().uuid('유효하지 않은 프로젝트 ID입니다'),
  shotIds: z.string().optional().transform(val =>
    val ? val.split(',').filter(id => id.trim()) : undefined
  ),
})

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const { searchParams } = new URL(request.url)

    const queryData = ContiStatusQuerySchema.parse({
      projectId: searchParams.get('projectId'),
      shotIds: searchParams.get('shotIds'),
    })

    logger.info('콘티 생성 상태 조회', {
      userId: user?.userId,
      component: 'ContiGenerationAPI',
      metadata: {
        projectId: queryData.projectId,
        shotIds: queryData.shotIds,
      },
    })

    try {
      // 프로젝트 소유권 확인
      const { data: project, error: projectError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .select('id')
          .eq('id', queryData.projectId)
          .eq('user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'verify_project_ownership'
      )

      if (projectError || !project) {
        throw new PlanningApiError('프로젝트를 찾을 수 없습니다.', 'PROJECT_NOT_FOUND', 404)
      }

      // 콘티 생성 상태 조회
      let query = supabaseClient.raw
        .from('conti_generations')
        .select(`
          shot_sequence_id,
          status,
          progress_percentage,
          image_url,
          error_message,
          request_id,
          estimated_time,
          provider,
          style,
          quality,
          created_at,
          updated_at
        `)
        .eq('planning_project_id', queryData.projectId)

      if (queryData.shotIds) {
        query = query.in('shot_sequence_id', queryData.shotIds)
      }

      const { data: contiGenerations, error: contiError } = await supabaseClient.safeQuery(
        () => query,
        user!.userId,
        'get_conti_status'
      )

      if (contiError) {
        throw new PlanningApiError('콘티 상태 조회 실패', 'CONTI_STATUS_FETCH_FAILED', 500)
      }

      // 처리 중인 작업들의 최신 상태 업데이트
      const processingGenerations = (contiGenerations || []).filter(
        conti => conti.status === 'processing' && conti.request_id
      )

      if (processingGenerations.length > 0) {
        const statusUpdatePromises = processingGenerations.map(async (conti) => {
          try {
            const job = await byteDanceImageClient.getJobStatus(conti.request_id!)

            // 상태가 변경된 경우 데이터베이스 업데이트
            if (job.status !== conti.status || job.progress !== conti.progress_percentage) {
              const updateData = {
                status: job.status,
                progress_percentage: job.progress,
                error_message: job.error,
                updated_at: new Date().toISOString(),
                ...(job.resultUrls.length > 0 && { image_url: job.resultUrls[0] }),
              }

              await supabaseClient.safeQuery(
                () => supabaseClient.raw
                  .from('conti_generations')
                  .update(updateData)
                  .eq('planning_project_id', queryData.projectId)
                  .eq('shot_sequence_id', conti.shot_sequence_id),
                user!.userId,
                `update_conti_status_${conti.shot_sequence_id}`
              )

              // 메모리상 데이터도 업데이트
              Object.assign(conti, updateData)
            }
          } catch (error) {
            logger.warn('콘티 상태 업데이트 실패', {
              shotSequenceId: conti.shot_sequence_id,
              requestId: conti.request_id,
              error: error instanceof Error ? error.message : error
            })
          }
        })

        await Promise.allSettled(statusUpdatePromises)
      }

      // 응답 구성
      const results: ContiGenerationResult[] = (contiGenerations || []).map(conti => ({
        shotId: conti.shot_sequence_id,
        status: conti.status,
        progress: conti.progress_percentage,
        imageUrl: conti.image_url || undefined,
        error: conti.error_message || undefined,
        requestId: conti.request_id || `unknown-${conti.shot_sequence_id}`,
        estimatedTime: conti.estimated_time || undefined,
      }))

      return createSuccessResponse({
        projectId: queryData.projectId,
        results,
        totalCount: results.length,
        completedCount: results.filter(r => r.status === 'completed').length,
        failedCount: results.filter(r => r.status === 'failed').length,
        processingCount: results.filter(r => r.status === 'processing').length,
      }, {
        userId: user?.userId,
      })

    } catch (error) {
      logger.error(
        '콘티 상태 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'ContiGenerationAPI',
          metadata: {
            projectId: queryData.projectId,
            shotIds: queryData.shotIds,
          },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/generate-conti',
  }
)

// ===========================================
// 헬퍼 함수들
// ===========================================

/**
 * 샷 시퀀스 정보를 기반으로 콘티 생성 프롬프트 구성
 */
function buildContiPrompt(shot: ShotSequence, projectTitle: string): string {
  const basePrompt = shot.conti_description || shot.description || shot.title

  // 콘티 전용 프롬프트 구성
  const contiElements = [
    'storyboard panel',
    'cinematic composition',
    'professional lighting',
    'detailed scene layout',
  ]

  // 샷 타입별 카메라 앵글 추가
  const cameraAngles: Record<string, string> = {
    'close-up': 'close-up shot, facial details',
    'medium': 'medium shot, upper body view',
    'wide': 'wide shot, full scene view',
    'extreme-wide': 'extreme wide shot, environmental context',
    'over-shoulder': 'over-shoulder shot, conversation angle',
    'bird-eye': 'bird eye view, top-down perspective',
    'low-angle': 'low angle shot, dramatic upward view',
    'high-angle': 'high angle shot, downward perspective',
  }

  const shotTypePrompt = shot.shot_type ? cameraAngles[shot.shot_type] || shot.shot_type : ''

  // 카메라 무브먼트 추가
  const cameraMovement = shot.camera_movement ? `camera movement: ${shot.camera_movement}` : ''

  // 최종 프롬프트 조합
  const promptParts = [
    basePrompt,
    shotTypePrompt,
    cameraMovement,
    ...contiElements,
    'high quality, detailed, professional storyboard illustration'
  ].filter(Boolean)

  return promptParts.join(', ')
}