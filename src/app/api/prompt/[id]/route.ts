/**
 * Individual Prompt Management API Route
 *
 * 개별 프롬프트 조회, 수정, 삭제 엔드포인트
 * CLAUDE.md 준수: API 라우트, RESTful 패턴
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/db'

// 프롬프트 업데이트 스키마
const UpdatePromptSchema = z.object({
  prompt_name: z.string().min(1).max(120).optional(),
  vlanet_prompt: z.any().optional(), // 복잡한 중첩 구조이므로 간소화
  status: z.enum(['completed', 'failed', 'pending']).optional(),
})

interface RouteParams {
  params: {
    id: string
  }
}

/**
 * 개별 프롬프트 조회
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const promptId = params.id

    // UUID 형식 검증
    if (!z.string().uuid().safeParse(promptId).success) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_ID',
          message: '올바르지 않은 프롬프트 ID입니다.',
        },
        { status: 400 }
      )
    }

    const { data: prompt, error } = await supabase
      .from('generated_prompts')
      .select('*')
      .eq('id', promptId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          {
            success: false,
            error: 'NOT_FOUND',
            message: '프롬프트를 찾을 수 없습니다.',
          },
          { status: 404 }
        )
      }

      console.error('프롬프트 조회 오류:', error)
      throw new Error('프롬프트 조회에 실패했습니다.')
    }

    return NextResponse.json({
      success: true,
      data: prompt,
    })

  } catch (error) {
    console.error('프롬프트 조회 API 오류:', error)

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

/**
 * 프롬프트 수정
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const promptId = params.id
    const body = await request.json()

    // UUID 형식 검증
    if (!z.string().uuid().safeParse(promptId).success) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_ID',
          message: '올바르지 않은 프롬프트 ID입니다.',
        },
        { status: 400 }
      )
    }

    // 요청 데이터 검증
    const validatedData = UpdatePromptSchema.parse(body)

    // 프롬프트 존재 여부 확인
    const { data: existingPrompt, error: findError } = await supabase
      .from('generated_prompts')
      .select('id')
      .eq('id', promptId)
      .single()

    if (findError && findError.code === 'PGRST116') {
      return NextResponse.json(
        {
          success: false,
          error: 'NOT_FOUND',
          message: '프롬프트를 찾을 수 없습니다.',
        },
        { status: 404 }
      )
    }

    if (findError) {
      console.error('프롬프트 조회 오류:', findError)
      throw new Error('프롬프트 조회에 실패했습니다.')
    }

    // 업데이트 데이터 준비
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (validatedData.prompt_name) {
      updateData.prompt_name = validatedData.prompt_name
    }

    if (validatedData.status) {
      updateData.status = validatedData.status
    }

    if (validatedData.vlanet_prompt) {
      // VLANET 프롬프트 내부의 promptName도 업데이트
      if (validatedData.prompt_name && validatedData.vlanet_prompt.promptBlueprint?.metadata) {
        validatedData.vlanet_prompt.promptBlueprint.metadata.promptName = validatedData.prompt_name
      }
      updateData.vlanet_prompt = validatedData.vlanet_prompt
    }

    // 프롬프트 업데이트
    const { data: updatedPrompt, error: updateError } = await supabase
      .from('generated_prompts')
      .update(updateData)
      .eq('id', promptId)
      .select()
      .single()

    if (updateError) {
      console.error('프롬프트 업데이트 오류:', updateError)
      throw new Error('프롬프트 수정에 실패했습니다.')
    }

    return NextResponse.json({
      success: true,
      data: updatedPrompt,
      message: '프롬프트가 성공적으로 수정되었습니다.',
    })

  } catch (error) {
    console.error('프롬프트 수정 API 오류:', error)

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

/**
 * 프롬프트 삭제
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const promptId = params.id

    // UUID 형식 검증
    if (!z.string().uuid().safeParse(promptId).success) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_ID',
          message: '올바르지 않은 프롬프트 ID입니다.',
        },
        { status: 400 }
      )
    }

    // 프롬프트 존재 여부 확인
    const { data: existingPrompt, error: findError } = await supabase
      .from('generated_prompts')
      .select('id, prompt_name')
      .eq('id', promptId)
      .single()

    if (findError && findError.code === 'PGRST116') {
      return NextResponse.json(
        {
          success: false,
          error: 'NOT_FOUND',
          message: '프롬프트를 찾을 수 없습니다.',
        },
        { status: 404 }
      )
    }

    if (findError) {
      console.error('프롬프트 조회 오류:', findError)
      throw new Error('프롬프트 조회에 실패했습니다.')
    }

    // 프롬프트 삭제 (소프트 삭제)
    const { error: deleteError } = await supabase
      .from('generated_prompts')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
      })
      .eq('id', promptId)

    if (deleteError) {
      console.error('프롬프트 삭제 오류:', deleteError)
      throw new Error('프롬프트 삭제에 실패했습니다.')
    }

    return NextResponse.json({
      success: true,
      message: `프롬프트 "${existingPrompt.prompt_name}"이 삭제되었습니다.`,
    })

  } catch (error) {
    console.error('프롬프트 삭제 API 오류:', error)

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