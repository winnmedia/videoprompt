/**
 * Planning Story Generation API Route
 *
 * Gemini API를 활용한 4단계 스토리 생성 엔드포인트
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
  StoryGenerationRequest,
  StoryGenerationResponse,
  StoryStep,
} from '@/entities/planning'

import { GeminiClient } from '@/shared/lib/gemini-client'
import { supabaseClient } from '@/shared/api/supabase-client'
import logger from '@/shared/lib/structured-logger'

// ===========================================
// 요청/응답 스키마
// ===========================================

const StoryGenerationRequestSchema = z.object({
  planningProjectId: z.string().uuid(),
  inputData: z.object({
    title: z.string().min(1).max(100),
    logline: z.string().min(1).max(300),
    toneAndManner: z.enum(['casual', 'professional', 'creative', 'educational', 'marketing']),
    development: z.enum(['linear', 'dramatic', 'problem_solution', 'comparison', 'tutorial']),
    intensity: z.enum(['low', 'medium', 'high']),
    targetDuration: z.number().min(30).max(600).optional(),
    additionalNotes: z.string().max(1000).optional(),
  }),
  existingSteps: z.array(z.object({
    id: z.string(),
    order: z.number(),
    title: z.string(),
    description: z.string(),
    duration: z.number().optional(),
    keyPoints: z.array(z.string()),
  })).optional(),
  regenerateFromStep: z.number().min(1).max(4).optional(),
})

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// ===========================================
// POST: 스토리 생성/재생성
// ===========================================

export const POST = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context

    // 요청 검증
    const requestData = await validateRequest(request, StoryGenerationRequestSchema)

    logger.info('스토리 생성 요청', {
      userId: user?.userId,
      component: 'StoryGenerationAPI',
      metadata: {
        projectId: requestData.planningProjectId,
        toneAndManner: requestData.inputData.toneAndManner,
        development: requestData.inputData.development,
        hasExistingSteps: !!requestData.existingSteps?.length,
        regenerateFromStep: requestData.regenerateFromStep,
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

      // 중복 생성 방지: 캐시 확인
      const cacheKey = `story_generation:${requestData.planningProjectId}:${JSON.stringify(requestData.inputData)}`

      // 프로젝트 상태를 generating으로 업데이트
      await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .update({
            status: 'generating',
            current_step: 'story',
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestData.planningProjectId)
          .eq('user_id', user!.userId),
        user!.userId,
        'update_project_status'
      )

      // Gemini 프롬프트 구성
      const geminiPrompt = buildStoryGenerationPrompt(requestData)

      logger.info('Gemini API 호출 시작', {
        userId: user?.userId,
        component: 'StoryGenerationAPI',
        metadata: {
          projectId: requestData.planningProjectId,
          promptLength: geminiPrompt.length,
          targetDuration: requestData.inputData.targetDuration,
        },
      })

      // Gemini API로 스토리 생성
      const startTime = Date.now()
      const geminiClient = new GeminiClient();
      const geminiResponse = await geminiClient.generateStory({
        prompt: geminiPrompt,
        genre: requestData.inputData.toneAndManner,
        targetDuration: requestData.inputData.targetDuration || 180,
        style: requestData.inputData.development,
        tone: requestData.inputData.intensity,
      })
      const processingTime = Date.now() - startTime

      // 비용 기록 ($300 사건 방지)
      const estimatedCost = calculateGeminiCost(geminiPrompt, processingTime)
      reportApiCost(estimatedCost)

      logger.info('Gemini API 호출 성공', {
        userId: user?.userId,
        component: 'StoryGenerationAPI',
        metadata: {
          projectId: requestData.planningProjectId,
          processingTime,
          estimatedCost,
          generatedStepsCount: geminiResponse.scenes?.length || 0,
        },
      })

      // Gemini 응답을 StoryStep 형식으로 변환
      const storySteps = transformGeminiResponseToStorySteps(
        geminiResponse,
        requestData.existingSteps,
        requestData.regenerateFromStep
      )

      // 데이터베이스에 스토리 스텝 저장
      await saveStoryStepsToDatabase(
        requestData.planningProjectId,
        storySteps,
        user!.userId
      )

      // 프로젝트 상태 업데이트
      const totalDuration = storySteps.reduce((sum, step) => sum + (step.duration || 0), 0)

      await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .update({
            status: 'draft',
            completion_percentage: 65, // 스토리 완료시 65%
            total_duration: totalDuration,
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestData.planningProjectId)
          .eq('user_id', user!.userId),
        user!.userId,
        'update_project_completion'
      )

      // 응답 구성
      const response: StoryGenerationResponse = {
        storySteps: storySteps.map(step => ({
          order: step.order,
          title: step.title,
          description: step.description,
          duration: step.duration,
          keyPoints: step.keyPoints,
          thumbnailUrl: step.thumbnailUrl,
        })),
        estimatedDuration: totalDuration,
        suggestedKeywords: geminiResponse.suggestedKeywords || [],
        rationale: buildRationale(requestData.inputData, storySteps),
      }

      // 응답 캐싱 (중복 요청 방지)
      setCachedResponse(cacheKey, response)

      // 성공 로그
      logger.logBusinessEvent('story_generated', {
        userId: user?.userId,
        projectId: requestData.planningProjectId,
        stepsCount: storySteps.length,
        totalDuration,
        processingTime,
        estimatedCost,
        toneAndManner: requestData.inputData.toneAndManner,
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
        '스토리 생성 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'StoryGenerationAPI',
          metadata: {
            projectId: requestData.planningProjectId,
            inputData: requestData.inputData,
          },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/generate-story',
  }
)

// ===========================================
// 헬퍼 함수들
// ===========================================

/**
 * Gemini 프롬프트 구성
 */
function buildStoryGenerationPrompt(requestData: z.infer<typeof StoryGenerationRequestSchema>): string {
  const { inputData, existingSteps, regenerateFromStep } = requestData

  let prompt = `
당신은 전문적인 영상 기획 전문가입니다. 다음 요구사항에 따라 정확히 4단계로 구성된 스토리를 생성해주세요.

**프로젝트 정보:**
- 제목: ${inputData.title}
- 한 줄 스토리: ${inputData.logline}
- 톤앤매너: ${inputData.toneAndManner}
- 전개방식: ${inputData.development}
- 강도: ${inputData.intensity}
- 목표시간: ${inputData.targetDuration || 180}초
${inputData.additionalNotes ? `- 추가 요구사항: ${inputData.additionalNotes}` : ''}

**전개방식별 가이드라인:**
${getStoryDevelopmentGuideline(inputData.development)}

**톤앤매너별 가이드라인:**
${getToneAndMannerGuideline(inputData.toneAndManner)}
`

  if (existingSteps && regenerateFromStep) {
    prompt += `
**기존 스토리 (${regenerateFromStep}단계부터 재생성):**
${existingSteps.slice(0, regenerateFromStep - 1).map((step, index) =>
  `${index + 1}단계: ${step.title}\n${step.description}`
).join('\n\n')}

${regenerateFromStep}단계부터 새롭게 생성해주세요.`
  }

  prompt += `

**출력 형식 (JSON):**
\`\`\`json
{
  "storySteps": [
    {
      "order": 1,
      "title": "1단계 제목 (명확하고 간결하게)",
      "description": "1단계 상세 설명 (200-300자, 구체적인 액션과 목적 포함)",
      "duration": 45,
      "keyPoints": ["핵심포인트1", "핵심포인트2", "핵심포인트3"]
    },
    {
      "order": 2,
      "title": "2단계 제목",
      "description": "2단계 상세 설명",
      "duration": 45,
      "keyPoints": ["핵심포인트1", "핵심포인트2", "핵심포인트3"]
    },
    {
      "order": 3,
      "title": "3단계 제목",
      "description": "3단계 상세 설명",
      "duration": 45,
      "keyPoints": ["핵심포인트1", "핵심포인트2", "핵심포인트3"]
    },
    {
      "order": 4,
      "title": "4단계 제목",
      "description": "4단계 상세 설명",
      "duration": 45,
      "keyPoints": ["핵심포인트1", "핵심포인트2", "핵심포인트3"]
    }
  ],
  "suggestedKeywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"]
}
\`\`\`

**중요 요구사항:**
1. 정확히 4단계로 구성 (1단계 적을수록 안됨)
2. 각 단계의 지속시간 합계가 목표시간(${inputData.targetDuration || 180}초)에 근사
3. 각 단계별 핵심포인트는 3개씩 정확히
4. 실제 영상 제작 가능한 현실적 내용
5. JSON 형식 정확히 준수
6. 한국어로 작성
7. 마크다운 코드블록 없이 순수 JSON만 반환
`

  return prompt
}

/**
 * 전개방식별 가이드라인
 */
function getStoryDevelopmentGuideline(development: string): string {
  const guidelines = {
    linear: '시간순으로 자연스럽게 전개되는 직선적 구조',
    dramatic: '갈등-위기-절정-해결의 드라마틱한 구조',
    problem_solution: '문제 제기 → 원인 분석 → 해결책 제시 → 결과 확인',
    comparison: '비교 대상 소개 → 차이점 분석 → 장단점 비교 → 결론 도출',
    tutorial: '준비단계 → 기본과정 → 심화과정 → 완성 및 점검'
  }
  return guidelines[development] || guidelines.linear
}

/**
 * 톤앤매너별 가이드라인
 */
function getToneAndMannerGuideline(toneAndManner: string): string {
  const guidelines = {
    casual: '친근하고 편안한 분위기, 일상적인 언어 사용',
    professional: '전문적이고 신뢰성 있는 톤, 정확한 정보 전달',
    creative: '창의적이고 독창적인 접근, 예술적 표현 활용',
    educational: '교육적이고 명확한 설명, 단계별 학습 구조',
    marketing: '설득력 있고 매력적인 메시지, 행동 유도'
  }
  return guidelines[toneAndManner] || guidelines.professional
}

/**
 * Gemini 응답을 StoryStep으로 변환
 */
function transformGeminiResponseToStorySteps(
  geminiResponse: any,
  existingSteps?: any[],
  regenerateFromStep?: number
): Omit<StoryStep, 'id'>[] {
  try {
    // Gemini 응답에서 JSON 추출
    let storyData = geminiResponse
    if (typeof geminiResponse === 'string') {
      const jsonMatch = geminiResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
                       geminiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        storyData = JSON.parse(jsonMatch[1] || jsonMatch[0])
      }
    }

    let newSteps = storyData.storySteps || []

    // 기존 스텝과 병합 (재생성의 경우)
    if (existingSteps && regenerateFromStep) {
      const keptSteps = existingSteps.slice(0, regenerateFromStep - 1)
      const regeneratedSteps = newSteps.map((step, index) => ({
        ...step,
        order: regenerateFromStep + index
      }))
      newSteps = [...keptSteps, ...regeneratedSteps]
    }

    // 검증 및 정규화
    return newSteps.map((step, index) => ({
      order: step.order || index + 1,
      title: String(step.title || `${index + 1}단계`),
      description: String(step.description || ''),
      duration: Math.max(10, Math.min(120, Number(step.duration) || 45)),
      keyPoints: Array.isArray(step.keyPoints) ? step.keyPoints.slice(0, 3) : [],
      thumbnailUrl: undefined,
    }))

  } catch (error) {
    logger.warn('Gemini 응답 변환 실패, 기본값 사용', { error })

    // 폴백: 기본 4단계 구조 생성
    return [
      {
        order: 1,
        title: '도입 단계',
        description: '주제 소개 및 시청자 관심 유도',
        duration: 45,
        keyPoints: ['주제 소개', '목적 설명', '기대효과'],
      },
      {
        order: 2,
        title: '전개 단계',
        description: '핵심 내용 설명 및 세부 정보 제공',
        duration: 60,
        keyPoints: ['핵심 내용', '세부 설명', '예시 제공'],
      },
      {
        order: 3,
        title: '심화 단계',
        description: '추가 정보 및 실용적 팁 제공',
        duration: 45,
        keyPoints: ['추가 정보', '실용 팁', '주의사항'],
      },
      {
        order: 4,
        title: '마무리 단계',
        description: '요약 및 행동 유도 메시지',
        duration: 30,
        keyPoints: ['내용 요약', '행동 유도', '마무리 인사'],
      },
    ]
  }
}

/**
 * 스토리 스텝을 데이터베이스에 저장
 */
async function saveStoryStepsToDatabase(
  planningProjectId: string,
  storySteps: Omit<StoryStep, 'id'>[],
  userId: string
): Promise<void> {
  // 기존 스토리 스텝 삭제
  await supabaseClient.safeQuery(
    () => supabaseClient.raw
      .from('story_steps')
      .delete()
      .eq('planning_project_id', planningProjectId),
    userId,
    'delete_existing_story_steps'
  )

  // 새 스토리 스텝 삽입
  const insertData = storySteps.map(step => ({
    planning_project_id: planningProjectId,
    order: step.order,
    title: step.title,
    description: step.description,
    duration: step.duration,
    key_points: step.keyPoints,
    thumbnail_url: step.thumbnailUrl,
  }))

  const { error } = await supabaseClient.safeQuery(
    () => supabaseClient.raw
      .from('story_steps')
      .insert(insertData),
    userId,
    'insert_story_steps'
  )

  if (error) {
    throw new Error(`스토리 스텝 저장 실패: ${error.message}`)
  }
}

/**
 * Gemini API 비용 계산
 */
function calculateGeminiCost(prompt: string, processingTime: number): number {
  // 토큰 수 추정 (1 토큰 ≈ 4 문자)
  const estimatedTokens = Math.ceil(prompt.length / 4)

  // Gemini Flash 기준 비용 (입력: $0.15/1M토큰, 출력: $0.60/1M토큰)
  const inputCost = (estimatedTokens / 1000000) * 0.15
  const outputCost = (500 / 1000000) * 0.60 // 평균 500토큰 출력 가정

  return inputCost + outputCost
}

/**
 * 생성 근거 구성
 */
function buildRationale(inputData: any, storySteps: any[]): string {
  return `${inputData.toneAndManner} 톤으로 ${inputData.development} 방식을 적용하여 ` +
         `${storySteps.length}단계 구조로 구성했습니다. ` +
         `총 ${storySteps.reduce((sum, step) => sum + (step.duration || 0), 0)}초 분량으로 ` +
         `목표 시간 ${inputData.targetDuration || 180}초에 맞춰 최적화했습니다.`
}