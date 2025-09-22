/**
 * Prompt Generation API Route
 *
 * VLANET 프롬프트 생성 및 저장 엔드포인트
 * CLAUDE.md 준수: API 라우트, 에러 처리, Zod 검증
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/db'
import type { VLANETPrompt } from '@/entities/prompt'

// 요청 스키마 검증
const GeneratePromptRequestSchema = z.object({
  prompt: z.object({
    version: z.literal('1.0'),
    projectId: z.string().uuid(),
    createdAt: z.string(),
    userInput: z.object({
      oneLineScenario: z.string().min(1).max(500),
      targetAudience: z.string().optional(),
      referenceUrls: z.array(z.string().url()).optional(),
      referenceAudioUrl: z.string().url().optional(),
    }),
    projectConfig: z.object({
      creationMode: z.enum(['VISUAL_FIRST', 'SOUND_FIRST']),
      frameworkType: z.enum(['EVENT_DRIVEN', 'DIRECTION_DRIVEN', 'HYBRID']),
      aiAssistantPersona: z.enum(['ASSISTANT_DIRECTOR', 'CINEMATOGRAPHER', 'SCREENWRITER']),
      profileId: z.string().optional(),
    }),
    promptBlueprint: z.object({
      metadata: z.any(), // 복잡한 중첩 구조이므로 간소화
      elements: z.any(),
      timeline: z.array(z.any()),
    }),
    generationControl: z.object({
      directorEmphasis: z.array(z.any()),
      shotByShot: z.object({
        enabled: z.boolean(),
        lockedSegments: z.array(z.number()).optional(),
      }),
      seed: z.number().int().min(0).max(2147483647),
    }),
    finalOutputCompact: z.any().optional(),
  }),
  projectId: z.string().uuid(),
  customPromptName: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 요청 데이터 검증
    const validatedData = GeneratePromptRequestSchema.parse(body)

    const { prompt, projectId, customPromptName } = validatedData

    // 프롬프트 이름 설정
    if (customPromptName) {
      prompt.promptBlueprint.metadata.promptName = customPromptName
      if (prompt.finalOutputCompact) {
        prompt.finalOutputCompact.metadata.prompt_name = customPromptName
      }
    }

    // 추가 검증 수행
    const warnings: string[] = []

    if (prompt.promptBlueprint.timeline.length === 0) {
      warnings.push('타임라인이 비어있습니다.')
    }

    if (prompt.promptBlueprint.timeline.length > 12) {
      warnings.push('권장되는 최대 샷 수(12개)를 초과했습니다.')
    }

    // VLANET 스키마 추가 검증
    const totalDuration = prompt.promptBlueprint.metadata.deliverySpec?.durationMs || 0
    if (totalDuration > 300000) { // 5분 이상
      warnings.push('비디오 길이가 5분을 초과하면 생성 품질이 저하될 수 있습니다.')
    }

    // Supabase에 프롬프트 저장
    const { data: savedPrompt, error: saveError } = await supabase
      .from('generated_prompts')
      .insert({
        id: prompt.projectId,
        scenario_id: projectId,
        prompt_name: prompt.promptBlueprint.metadata.promptName,
        vlanet_prompt: prompt,
        generated_at: new Date().toISOString(),
        status: 'completed',
        warnings: warnings.length > 0 ? warnings : null,
      })
      .select()
      .single()

    if (saveError) {
      console.error('프롬프트 저장 오류:', saveError)
      throw new Error('프롬프트 저장에 실패했습니다.')
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      prompt: savedPrompt.vlanet_prompt,
      promptId: savedPrompt.id,
      warnings,
      message: '프롬프트가 성공적으로 생성되었습니다.',
    })

  } catch (error) {
    console.error('프롬프트 생성 API 오류:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: '요청 데이터가 올바르지 않습니다.',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('저장')) {
      return NextResponse.json(
        {
          success: false,
          error: 'DATABASE_ERROR',
          message: error.message,
        },
        { status: 500 }
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