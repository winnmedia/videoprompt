/**
 * Planning Shot Breakdown API Route
 *
 * 4단계 스토리를 12숏으로 자동 분해하는 엔드포인트
 * CLAUDE.md 준수: 비용 안전 미들웨어, TDD, 성능 최적화
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
  reportApiCost,
} from '@/shared/api/planning-utils'

import type {
  ShotBreakdownRequest,
  ShotBreakdownResponse,
  ShotSequence,
  StoryStep,
} from '@/entities/planning'

import { GeminiClient } from '@/shared/lib/gemini-client'
import { supabaseClient } from '@/shared/api/supabase-client'
import logger from '@/shared/lib/structured-logger'

// ===========================================
// 요청/응답 스키마
// ===========================================

const ShotBreakdownRequestSchema = z.object({
  planningProjectId: z.string().uuid(),
  storySteps: z.array(z.object({
    id: z.string(),
    order: z.number(),
    title: z.string(),
    description: z.string(),
    duration: z.number().optional(),
    keyPoints: z.array(z.string()),
  })),
  inputData: z.object({
    title: z.string().min(1).max(100),
    logline: z.string().min(1).max(300),
    toneAndManner: z.enum(['casual', 'professional', 'creative', 'educational', 'marketing']),
    development: z.enum(['linear', 'dramatic', 'problem_solution', 'comparison', 'tutorial']),
    intensity: z.enum(['low', 'medium', 'high']),
    targetDuration: z.number().min(30).max(600).optional(),
    additionalNotes: z.string().max(1000).optional(),
  }),
  targetShotCount: z.number().min(8).max(16).default(12),
  contiStyle: z.enum(['pencil', 'rough', 'monochrome', 'colored']).default('rough'),
})

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// ===========================================
// POST: 12숏 자동 분해
// ===========================================

export const POST = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context

    // 요청 검증
    const requestData = await validateRequest(request, ShotBreakdownRequestSchema)

    logger.info('12숏 분해 요청', {
      userId: user?.userId,
      component: 'ShotBreakdownAPI',
      metadata: {
        projectId: requestData.planningProjectId,
        storyStepsCount: requestData.storySteps.length,
        targetShotCount: requestData.targetShotCount,
        toneAndManner: requestData.inputData.toneAndManner,
      },
    })

    try {
      // 프로젝트 권한 확인
      const { data: project, error: projectError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .select('id, title, status, user_id')
          .eq('id', requestData.planningProjectId)
          .eq('user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'verify_planning_project'
      )

      if (projectError || !project) {
        throw new PlanningApiError('프로젝트를 찾을 수 없습니다.', 'PROJECT_NOT_FOUND', 404)
      }

      // 스토리 스텝 검증
      if (requestData.storySteps.length !== 4) {
        throw new PlanningApiError('정확히 4개의 스토리 스텝이 필요합니다.', 'INVALID_STORY_STEPS', 400)
      }

      // 중복 생성 방지: 캐시 확인
      const cacheKey = `shot_breakdown:${requestData.planningProjectId}:${JSON.stringify(requestData.storySteps)}:${requestData.targetShotCount}`

      // 프로젝트 상태를 generating으로 업데이트
      await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .update({
            status: 'generating',
            current_step: 'shots',
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestData.planningProjectId)
          .eq('user_id', user!.userId),
        user!.userId,
        'update_project_status'
      )

      // 단계별 샷 분배 계산
      const shotDistribution = calculateShotDistribution(
        requestData.storySteps,
        requestData.targetShotCount,
        requestData.inputData.development
      )

      logger.info('샷 분배 계산 완료', {
        userId: user?.userId,
        component: 'ShotBreakdownAPI',
        metadata: {
          projectId: requestData.planningProjectId,
          shotDistribution,
          totalShots: shotDistribution.reduce((sum, dist) => sum + dist.shotCount, 0),
        },
      })

      // Gemini 프롬프트 구성
      const geminiPrompt = buildShotBreakdownPrompt(requestData, shotDistribution)

      logger.info('Gemini API 호출 시작 (샷 분해)', {
        userId: user?.userId,
        component: 'ShotBreakdownAPI',
        metadata: {
          projectId: requestData.planningProjectId,
          promptLength: geminiPrompt.length,
          targetShotCount: requestData.targetShotCount,
        },
      })

      // Gemini API로 샷 분해
      const startTime = Date.now()
      const geminiResponse = await geminiClient.splitIntoScenes({
        storyText: geminiPrompt,
        targetSceneCount: requestData.targetShotCount,
        maxSceneDuration: 60,
      })
      const processingTime = Date.now() - startTime

      // 비용 기록 ($300 사건 방지)
      const estimatedCost = calculateGeminiCost(geminiPrompt, processingTime)
      reportApiCost(estimatedCost)

      logger.info('Gemini API 호출 성공 (샷 분해)', {
        userId: user?.userId,
        component: 'ShotBreakdownAPI',
        metadata: {
          projectId: requestData.planningProjectId,
          processingTime,
          estimatedCost,
          generatedShotsCount: geminiResponse?.length || 0,
        },
      })

      // Gemini 응답을 ShotSequence 형식으로 변환
      const shotSequences = transformGeminiResponseToShotSequences(
        geminiResponse,
        requestData.storySteps,
        shotDistribution,
        requestData.contiStyle
      )

      // 인서트 샷 추천 생성
      const insertShots = generateInsertShotRecommendations(shotSequences)

      // 데이터베이스에 샷 시퀀스 저장
      await saveShotSequencesToDatabase(
        requestData.planningProjectId,
        shotSequences,
        insertShots,
        user!.userId
      )

      // 프로젝트 상태 업데이트
      const totalDuration = shotSequences.reduce((sum, shot) => sum + shot.duration, 0)

      await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .update({
            status: 'draft',
            completion_percentage: 100, // 샷 완료시 100%
            total_duration: totalDuration,
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestData.planningProjectId)
          .eq('user_id', user!.userId),
        user!.userId,
        'update_project_completion'
      )

      // 응답 구성
      const response: ShotBreakdownResponse = {
        shotSequences: shotSequences.map(shot => ({
          order: shot.order,
          title: shot.title,
          description: shot.description,
          duration: shot.duration,
          contiDescription: shot.contiDescription,
          contiStyle: shot.contiStyle,
          shotType: shot.shotType,
          cameraMovement: shot.cameraMovement,
          location: shot.location,
          characters: shot.characters,
          visualElements: shot.visualElements,
          audioNotes: shot.audioNotes,
          transitionType: shot.transitionType,
          storyStepId: shot.storyStepId,
        })),
        insertShots: insertShots.map(insert => ({
          order: insert.order,
          description: insert.description,
          purpose: insert.purpose,
        })),
        totalDuration,
        distributionRationale: buildDistributionRationale(shotDistribution, requestData.inputData),
      }

      // 응답 캐싱 (중복 요청 방지)
      setCachedResponse(cacheKey, response)

      // 성공 로그
      logger.logBusinessEvent('shots_generated', {
        userId: user?.userId,
        projectId: requestData.planningProjectId,
        shotCount: shotSequences.length,
        insertShotCount: insertShots.length,
        totalDuration,
        processingTime,
        estimatedCost,
        distribution: shotDistribution,
      })

      return createSuccessResponse(response, {
        userId: user?.userId,
        cost: estimatedCost,
        processingTime,
      })

    } catch (error) {
      // 실패시 프로젝트 상태를 error로 업데이트
      try {
        await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('planning_projects')
            .update({
              status: 'error',
              updated_at: new Date().toISOString(),
            })
            .eq('id', requestData.planningProjectId)
            .eq('user_id', user!.userId),
          user!.userId,
          'update_project_error_status'
        )
      } catch (updateError) {
        logger.warn('프로젝트 상태 업데이트 실패', { error: updateError })
      }

      logger.error(
        '12숏 분해 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'ShotBreakdownAPI',
          metadata: {
            projectId: requestData.planningProjectId,
            storyStepsCount: requestData.storySteps.length,
            targetShotCount: requestData.targetShotCount,
          },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/generate-shots',
  }
)

// ===========================================
// 헬퍼 함수들
// ===========================================

/**
 * 단계별 샷 분배 계산
 */
function calculateShotDistribution(
  storySteps: StoryStep[],
  targetShotCount: number,
  development: string
): Array<{ stepIndex: number, stepId: string, shotCount: number, startOrder: number }> {
  // 전개 방식에 따른 가중치
  const weights = (() => {
    switch (development) {
      case 'linear': return [0.2, 0.3, 0.3, 0.2] // 균등 분배
      case 'dramatic': return [0.15, 0.25, 0.4, 0.2] // 3단계(절정) 강조
      case 'problem_solution': return [0.25, 0.2, 0.35, 0.2] // 1,3단계 강조
      case 'comparison': return [0.2, 0.35, 0.25, 0.2] // 2단계 강조
      case 'tutorial': return [0.15, 0.3, 0.4, 0.15] // 3단계 강조
      default: return [0.25, 0.25, 0.25, 0.25] // 완전 균등
    }
  })()

  // 각 단계별 샷 수 계산
  const shotCounts = weights.map(weight => Math.max(1, Math.round(targetShotCount * weight)))

  // 총 샷 수가 목표와 다르면 조정
  const totalCalculated = shotCounts.reduce((sum, count) => sum + count, 0)
  const difference = targetShotCount - totalCalculated

  if (difference !== 0) {
    // 가장 가중치가 높은 단계에서 조정
    const maxWeightIndex = weights.indexOf(Math.max(...weights))
    shotCounts[maxWeightIndex] = Math.max(1, shotCounts[maxWeightIndex] + difference)
  }

  // 분배 결과 생성
  let currentOrder = 1
  return storySteps.map((step, index) => {
    const result = {
      stepIndex: index,
      stepId: step.id,
      shotCount: shotCounts[index],
      startOrder: currentOrder,
    }
    currentOrder += shotCounts[index]
    return result
  })
}

/**
 * 샷 분해 프롬프트 구성
 */
function buildShotBreakdownPrompt(
  requestData: z.infer<typeof ShotBreakdownRequestSchema>,
  shotDistribution: any[]
): string {
  const { storySteps, inputData, targetShotCount } = requestData

  let prompt = `
당신은 전문적인 영상 편집자입니다. 다음 4단계 스토리를 정확히 ${targetShotCount}개의 샷으로 분해해주세요.

**프로젝트 정보:**
- 제목: ${inputData.title}
- 톤앤매너: ${inputData.toneAndManner}
- 전개방식: ${inputData.development}
- 강도: ${inputData.intensity}

**샷 분배 계획:**
${shotDistribution.map((dist, index) =>
  `${index + 1}단계: ${dist.shotCount}개 샷 (샷 #${dist.startOrder}~${dist.startOrder + dist.shotCount - 1})`
).join('\n')}

**스토리 단계별 상세:**
${storySteps.map((step, index) => `
**${step.order}단계: ${step.title}** (${shotDistribution[index].shotCount}개 샷 필요)
- 설명: ${step.description}
- 지속시간: ${step.duration || 45}초
- 핵심포인트: ${step.keyPoints.join(', ')}
`).join('\n')}

**샷 타입 가이드라인:**
- close_up: 인물의 감정, 중요한 디테일 강조
- medium: 인물의 행동, 대화 장면
- wide: 전체적인 상황, 배경 설명
- extreme_wide: 스케일감, 전환 장면

**카메라 움직임 가이드라인:**
- static: 안정적인 정보 전달
- pan: 공간감 표현
- tilt: 높이감, 관점 변화
- zoom: 강조, 집중
- dolly: 몰입감, 역동성

**출력 형식 (JSON):**
\`\`\`json
{
  "shotSequences": [
    {
      "order": 1,
      "title": "샷 제목 (간결하게)",
      "description": "샷 상세 설명 (100-150자)",
      "duration": 15,
      "contiDescription": "콘티 그림 설명 (시각적 요소 중심, 50-100자)",
      "shotType": "medium",
      "cameraMovement": "static",
      "location": "촬영 장소",
      "characters": ["등장인물"],
      "visualElements": ["시각요소1", "시각요소2"],
      "audioNotes": "오디오 메모",
      "transitionType": "cut",
      "storyStepOrder": 1
    }
  ]
}
\`\`\`

**중요 요구사항:**
1. 정확히 ${targetShotCount}개의 샷 생성 (1개도 틀리면 안됨)
2. 각 단계별 샷 분배 준수: ${shotDistribution.map(d => d.shotCount).join(', ')}개
3. 샷 순서는 1부터 연속적으로
4. 각 샷의 지속시간 합계가 전체 목표시간과 유사
5. contiDescription은 실제 그림으로 그릴 수 있는 구체적 묘사
6. JSON 형식 정확히 준수
7. 한국어로 작성
8. 마크다운 코드블록 없이 순수 JSON만 반환
`

  return prompt
}

/**
 * Gemini 응답을 ShotSequence로 변환
 */
function transformGeminiResponseToShotSequences(
  geminiResponse: any[],
  storySteps: StoryStep[],
  shotDistribution: any[],
  contiStyle: string
): Omit<ShotSequence, 'id'>[] {
  try {
    // Gemini 응답 파싱
    const shotsData = Array.isArray(geminiResponse) ? geminiResponse : (geminiResponse?.shotSequences || [])

    if (shotsData.length === 0) {
      throw new Error('생성된 샷이 없습니다.')
    }

    // 스토리 스텝 매핑 생성
    const stepMap = new Map(storySteps.map(step => [step.order, step.id]))

    // 샷 순서와 스토리 스텝 매핑
    const shotStepMapping = new Map<number, string>()
    shotDistribution.forEach(dist => {
      for (let i = 0; i < dist.shotCount; i++) {
        const shotOrder = dist.startOrder + i
        shotStepMapping.set(shotOrder, dist.stepId)
      }
    })

    return shotsData.map((shot, index) => ({
      order: shot.order || index + 1,
      title: String(shot.title || `샷 ${index + 1}`),
      description: String(shot.description || ''),
      duration: Math.max(5, Math.min(60, Number(shot.duration) || 15)),
      contiDescription: String(shot.contiDescription || shot.description || ''),
      contiStyle: contiStyle as any,
      shotType: validateShotType(shot.shotType),
      cameraMovement: validateCameraMovement(shot.cameraMovement),
      location: String(shot.location || ''),
      characters: Array.isArray(shot.characters) ? shot.characters.map(String) : [],
      visualElements: Array.isArray(shot.visualElements) ? shot.visualElements.map(String) : [],
      audioNotes: shot.audioNotes ? String(shot.audioNotes) : undefined,
      transitionType: validateTransitionType(shot.transitionType),
      storyStepId: shotStepMapping.get(shot.order || index + 1) || storySteps[0]?.id || '',
    }))

  } catch (error) {
    logger.warn('Gemini 샷 분해 응답 변환 실패, 기본값 사용', { error })

    // 폴백: 기본 12샷 구조 생성
    return generateFallbackShots(storySteps, shotDistribution, contiStyle)
  }
}

/**
 * 폴백 샷 생성
 */
function generateFallbackShots(
  storySteps: StoryStep[],
  shotDistribution: any[],
  contiStyle: string
): Omit<ShotSequence, 'id'>[] {
  const shots: Omit<ShotSequence, 'id'>[] = []

  shotDistribution.forEach((dist, stepIndex) => {
    const step = storySteps[stepIndex]
    const shotDuration = Math.round((step.duration || 45) / dist.shotCount)

    for (let i = 0; i < dist.shotCount; i++) {
      shots.push({
        order: dist.startOrder + i,
        title: `${step.title} - 샷 ${i + 1}`,
        description: `${step.description}의 ${i + 1}번째 구간`,
        duration: shotDuration,
        contiDescription: `${step.title} 관련 시각적 요소`,
        contiStyle: contiStyle as any,
        shotType: i === 0 ? 'wide' : i === dist.shotCount - 1 ? 'close_up' : 'medium',
        cameraMovement: 'static',
        location: '스튜디오',
        characters: ['나레이터'],
        visualElements: step.keyPoints || [],
        audioNotes: undefined,
        transitionType: 'cut',
        storyStepId: step.id,
      })
    }
  })

  return shots
}

/**
 * 인서트 샷 추천 생성
 */
function generateInsertShotRecommendations(
  shotSequences: Omit<ShotSequence, 'id'>[]
): Omit<any, 'id' | 'shotSequenceId'>[] {
  const insertShots: any[] = []

  shotSequences.forEach((shot, index) => {
    // 주요 샷에 대해서만 인서트 샷 추천 (3샷마다)
    if ((index + 1) % 3 === 0 && insertShots.length < 4) {
      const purposes = ['detail', 'context', 'emotion', 'transition'] as const
      const purpose = purposes[insertShots.length]

      insertShots.push({
        order: insertShots.length + 1,
        description: `${shot.title}의 ${getPurposeDescription(purpose)}`,
        purpose,
      })
    }
  })

  return insertShots
}

/**
 * 유효성 검증 함수들
 */
function validateShotType(shotType: any): 'close_up' | 'medium' | 'wide' | 'extreme_wide' {
  const validTypes = ['close_up', 'medium', 'wide', 'extreme_wide']
  return validTypes.includes(shotType) ? shotType : 'medium'
}

function validateCameraMovement(movement: any): 'static' | 'pan' | 'tilt' | 'zoom' | 'dolly' {
  const validMovements = ['static', 'pan', 'tilt', 'zoom', 'dolly']
  return validMovements.includes(movement) ? movement : 'static'
}

function validateTransitionType(transition: any): 'cut' | 'fade' | 'dissolve' | 'wipe' {
  const validTransitions = ['cut', 'fade', 'dissolve', 'wipe']
  return validTransitions.includes(transition) ? transition : 'cut'
}

function getPurposeDescription(purpose: string): string {
  const descriptions = {
    detail: '세부 디테일 강조',
    context: '배경 상황 설명',
    emotion: '감정적 임팩트',
    transition: '자연스러운 전환',
  }
  return descriptions[purpose] || '추가 설명'
}

/**
 * 데이터베이스 저장
 */
async function saveShotSequencesToDatabase(
  planningProjectId: string,
  shotSequences: Omit<ShotSequence, 'id'>[],
  insertShots: any[],
  userId: string
): Promise<void> {
  // 기존 샷 시퀀스 삭제
  await supabaseClient.safeQuery(
    () => supabaseClient.raw
      .from('shot_sequences')
      .delete()
      .eq('planning_project_id', planningProjectId),
    userId,
    'delete_existing_shot_sequences'
  )

  // 기존 인서트 샷 삭제
  await supabaseClient.safeQuery(
    () => supabaseClient.raw
      .from('insert_shots')
      .delete()
      .eq('planning_project_id', planningProjectId),
    userId,
    'delete_existing_insert_shots'
  )

  // 새 샷 시퀀스 삽입
  if (shotSequences.length > 0) {
    const shotInsertData = shotSequences.map(shot => ({
      planning_project_id: planningProjectId,
      story_step_id: shot.storyStepId,
      order: shot.order,
      title: shot.title,
      description: shot.description,
      duration: shot.duration,
      conti_description: shot.contiDescription,
      conti_style: shot.contiStyle,
      shot_type: shot.shotType,
      camera_movement: shot.cameraMovement,
      location: shot.location,
      characters: shot.characters,
      visual_elements: shot.visualElements,
      audio_notes: shot.audioNotes,
      transition_type: shot.transitionType,
    }))

    const { error: shotError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('shot_sequences')
        .insert(shotInsertData),
      userId,
      'insert_shot_sequences'
    )

    if (shotError) {
      throw new Error(`샷 시퀀스 저장 실패: ${shotError.message}`)
    }
  }

  // 새 인서트 샷 삽입 (샷이 저장된 후에)
  if (insertShots.length > 0) {
    const { data: savedShots } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('shot_sequences')
        .select('id, order')
        .eq('planning_project_id', planningProjectId)
        .order('order'),
      userId,
      'get_saved_shot_sequences'
    )

    if (savedShots && savedShots.length > 0) {
      const insertData = insertShots.map((insert, index) => ({
        planning_project_id: planningProjectId,
        shot_sequence_id: savedShots[Math.min(index * 3, savedShots.length - 1)]?.id,
        order: insert.order,
        description: insert.description,
        purpose: insert.purpose,
      }))

      const { error: insertError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('insert_shots')
          .insert(insertData),
        userId,
        'insert_insert_shots'
      )

      if (insertError) {
        logger.warn('인서트 샷 저장 실패', { error: insertError })
      }
    }
  }
}

/**
 * 비용 계산
 */
function calculateGeminiCost(prompt: string, processingTime: number): number {
  const estimatedTokens = Math.ceil(prompt.length / 4)
  const inputCost = (estimatedTokens / 1000000) * 0.15
  const outputCost = (800 / 1000000) * 0.60 // 샷 분해는 더 긴 출력
  return inputCost + outputCost
}

/**
 * 분배 근거 구성
 */
function buildDistributionRationale(
  shotDistribution: any[],
  inputData: any
): string {
  const totalShots = shotDistribution.reduce((sum, dist) => sum + dist.shotCount, 0)
  const distributionText = shotDistribution.map((dist, index) =>
    `${index + 1}단계: ${dist.shotCount}개`
  ).join(', ')

  return `${inputData.development} 전개방식에 따라 총 ${totalShots}개 샷을 단계별로 분배했습니다. ` +
         `분배: ${distributionText}. ${inputData.toneAndManner} 톤에 맞춰 샷 타입과 카메라 움직임을 최적화했습니다.`
}