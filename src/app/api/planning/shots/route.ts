/**
 * 12-Shot Management API
 *
 * 12개 숏트 시퀀스 관리 및 백엔드 연동
 * CLAUDE.md 준수: FSD, 타입 안전성, TDD, 에러 처리
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// 숏트 시퀀스 스키마
const ShotSequenceSchema = z.object({
  id: z.string().uuid(),
  order: z.number().min(1).max(12),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  duration: z.number().min(1).max(30), // 초
  cameraAngle: z.enum(['wide', 'medium', 'close-up', 'extreme-close-up', 'birds-eye', 'low-angle']),
  movement: z.enum(['static', 'pan', 'tilt', 'zoom-in', 'zoom-out', 'dolly', 'tracking']),
  lighting: z.enum(['natural', 'dramatic', 'soft', 'harsh', 'low-key', 'high-key']),
  mood: z.enum(['neutral', 'happy', 'sad', 'tense', 'dramatic', 'peaceful', 'energetic']),
  visualPrompt: z.string().min(10).max(500),
  audioNotes: z.string().optional(),
  contiImageUrl: z.string().url().optional(),
  status: z.enum(['draft', 'approved', 'needs-revision']).default('draft'),
  metadata: z.object({
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    createdBy: z.string(),
    version: z.number().default(1)
  })
})

const ShotSequenceListSchema = z.array(ShotSequenceSchema).length(12)

const CreateShotSequenceRequestSchema = z.object({
  projectId: z.string().uuid(),
  storySteps: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string()
  })).min(1).max(4),
  metadata: z.object({
    tone: z.string().optional(),
    genre: z.string().optional(),
    targetAudience: z.string().optional()
  }).optional()
})

// 숏트 시퀀스 생성 서비스
class ShotSequenceService {

  /**
   * 4단계 스토리를 12개 숏트로 자동 분해
   */
  async generateShotSequences(storySteps: any[], metadata: any = {}): Promise<any[]> {
    const shotTemplates = [
      // Step 1에서 3개 숏트
      { order: 1, title: '오프닝 설정', cameraAngle: 'wide', movement: 'static', duration: 8 },
      { order: 2, title: '주인공 등장', cameraAngle: 'medium', movement: 'dolly', duration: 6 },
      { order: 3, title: '상황 제시', cameraAngle: 'close-up', movement: 'static', duration: 5 },

      // Step 2에서 3개 숏트
      { order: 4, title: '갈등 시작', cameraAngle: 'medium', movement: 'pan', duration: 7 },
      { order: 5, title: '긴장 고조', cameraAngle: 'close-up', movement: 'zoom-in', duration: 6 },
      { order: 6, title: '반전 포인트', cameraAngle: 'dramatic', movement: 'tilt', duration: 8 },

      // Step 3에서 3개 숏트
      { order: 7, title: '클라이맥스 1', cameraAngle: 'wide', movement: 'tracking', duration: 10 },
      { order: 8, title: '클라이맥스 2', cameraAngle: 'extreme-close-up', movement: 'static', duration: 5 },
      { order: 9, title: '해결 시작', cameraAngle: 'medium', movement: 'dolly', duration: 7 },

      // Step 4에서 3개 숏트
      { order: 10, title: '해결', cameraAngle: 'wide', movement: 'pan', duration: 8 },
      { order: 11, title: '여운', cameraAngle: 'medium', movement: 'zoom-out', duration: 6 },
      { order: 12, title: '엔딩', cameraAngle: 'wide', movement: 'static', duration: 10 }
    ]

    const now = new Date().toISOString()
    const userId = 'system' // 실제로는 JWT에서 추출

    const shotSequences = shotTemplates.map((template, index) => {
      const stepIndex = Math.floor(index / 3)
      const step = storySteps[stepIndex] || storySteps[storySteps.length - 1]

      return {
        id: crypto.randomUUID(),
        ...template,
        description: step.content.slice(0, 200) + (step.content.length > 200 ? '...' : ''),
        lighting: this.selectLighting(metadata.tone, template.order),
        mood: this.selectMood(metadata.tone, template.order),
        visualPrompt: this.generateVisualPrompt(step, template, metadata),
        audioNotes: this.generateAudioNotes(step, template),
        status: 'draft' as const,
        metadata: {
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          version: 1
        }
      }
    })

    return shotSequences
  }

  /**
   * 숏트 시퀀스 저장 (Supabase)
   */
  async saveShotSequences(projectId: string, shotSequences: any[]): Promise<any[]> {
    // 실제 구현에서는 Supabase 클라이언트 사용
    console.log(`Saving ${shotSequences.length} shots for project ${projectId}`)

    // 임시 응답
    return shotSequences.map(shot => ({
      ...shot,
      projectId,
      saved: true
    }))
  }

  /**
   * 프로젝트별 숏트 시퀀스 조회
   */
  async getShotSequences(projectId: string): Promise<any[]> {
    // 실제 구현에서는 Supabase에서 조회
    console.log(`Loading shots for project ${projectId}`)

    // 임시 더미 데이터
    return []
  }

  /**
   * 숏트 시퀀스 업데이트
   */
  async updateShotSequence(projectId: string, shotId: string, updates: Partial<any>): Promise<any> {
    // 실제 구현에서는 Supabase 업데이트
    console.log(`Updating shot ${shotId} in project ${projectId}`)

    return {
      ...updates,
      id: shotId,
      projectId,
      metadata: {
        ...updates.metadata,
        updatedAt: new Date().toISOString(),
        version: (updates.metadata?.version || 1) + 1
      }
    }
  }

  private selectLighting(tone?: string, order?: number): string {
    if (tone === 'dramatic') return order && order > 6 ? 'dramatic' : 'low-key'
    if (tone === 'light') return 'soft'
    if (tone === 'dark') return 'harsh'
    return 'natural'
  }

  private selectMood(tone?: string, order?: number): string {
    if (!tone) return 'neutral'
    if (order && order <= 3) return 'peaceful'
    if (order && order <= 6) return 'tense'
    if (order && order <= 9) return 'dramatic'
    return 'peaceful'
  }

  private generateVisualPrompt(step: any, template: any, metadata: any): string {
    const base = step.content.slice(0, 100)
    const cameraDesc = this.getCameraDescription(template.cameraAngle, template.movement)
    const moodDesc = metadata.tone ? `, ${metadata.tone} tone` : ''

    return `${base} ${cameraDesc}${moodDesc}. Cinematic composition, professional lighting.`
  }

  private generateAudioNotes(step: any, template: any): string {
    const audioTypes = ['ambient', 'music', 'sfx', 'dialogue']
    const selectedType = audioTypes[template.order % audioTypes.length]

    return `${selectedType}: Supporting ${step.title.toLowerCase()}`
  }

  private getCameraDescription(angle: string, movement: string): string {
    const descriptions = {
      wide: 'wide establishing shot',
      medium: 'medium shot',
      'close-up': 'close-up shot',
      'extreme-close-up': 'extreme close-up',
      'birds-eye': 'overhead birds-eye view',
      'low-angle': 'low-angle shot'
    }

    const movements = {
      static: 'static camera',
      pan: 'camera panning',
      tilt: 'camera tilting',
      'zoom-in': 'zoom in',
      'zoom-out': 'zoom out',
      dolly: 'dolly movement',
      tracking: 'tracking shot'
    }

    return `${descriptions[angle as keyof typeof descriptions]}, ${movements[movement as keyof typeof movements]}`
  }
}

// API 핸들러들

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = CreateShotSequenceRequestSchema.parse(body)

    const service = new ShotSequenceService()

    // 4단계 스토리를 12개 숏트로 변환
    const shotSequences = await service.generateShotSequences(
      validatedData.storySteps,
      validatedData.metadata
    )

    // 데이터베이스에 저장
    const savedShots = await service.saveShotSequences(
      validatedData.projectId,
      shotSequences
    )

    return NextResponse.json({
      success: true,
      data: savedShots,
      message: '12개 숏트 시퀀스가 성공적으로 생성되었습니다'
    })

  } catch (error) {
    console.error('12숏 생성 오류:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: '입력 데이터 검증 실패',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'SHOT_GENERATION_ERROR',
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId는 필수입니다' },
        { status: 400 }
      )
    }

    const service = new ShotSequenceService()
    const shotSequences = await service.getShotSequences(projectId)

    return NextResponse.json({
      success: true,
      data: shotSequences,
      count: shotSequences.length
    })

  } catch (error) {
    console.error('12숏 조회 오류:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'SHOT_FETCH_ERROR',
        message: '숏트 시퀀스 조회 중 오류가 발생했습니다'
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, shotId, ...updates } = body

    if (!projectId || !shotId) {
      return NextResponse.json(
        { error: 'projectId와 shotId는 필수입니다' },
        { status: 400 }
      )
    }

    const service = new ShotSequenceService()
    const updatedShot = await service.updateShotSequence(projectId, shotId, updates)

    return NextResponse.json({
      success: true,
      data: updatedShot,
      message: '숏트 시퀀스가 성공적으로 업데이트되었습니다'
    })

  } catch (error) {
    console.error('12숏 업데이트 오류:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'SHOT_UPDATE_ERROR',
        message: '숏트 시퀀스 업데이트 중 오류가 발생했습니다'
      },
      { status: 500 }
    )
  }
}