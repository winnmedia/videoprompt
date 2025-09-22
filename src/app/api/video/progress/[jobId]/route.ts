/**
 * Video Generation Progress WebSocket API
 *
 * 영상 생성 진행 상황을 실시간으로 스트리밍
 * CLAUDE.md 준수: 실시간 업데이트, 에러 처리
 */

import { NextRequest, NextResponse } from 'next/server'

// 진행 상황 모니터링 서비스
class ProgressMonitorService {
  private static instance: ProgressMonitorService
  private jobProgress: Map<string, {
    progress: number
    message: string
    status: 'processing' | 'completed' | 'error'
    videoUrl?: string
    error?: string
  }> = new Map()

  private constructor() {}

  static getInstance(): ProgressMonitorService {
    if (!ProgressMonitorService.instance) {
      ProgressMonitorService.instance = new ProgressMonitorService()
    }
    return ProgressMonitorService.instance
  }

  // 진행 상황 업데이트
  updateProgress(jobId: string, progress: number, message: string) {
    this.jobProgress.set(jobId, {
      progress,
      message,
      status: 'processing'
    })
  }

  // 완료 처리
  completeJob(jobId: string, videoUrl: string) {
    this.jobProgress.set(jobId, {
      progress: 100,
      message: '영상 생성이 완료되었습니다',
      status: 'completed',
      videoUrl
    })
  }

  // 에러 처리
  errorJob(jobId: string, error: string) {
    this.jobProgress.set(jobId, {
      progress: 0,
      message: error,
      status: 'error',
      error
    })
  }

  // 진행 상황 조회
  getProgress(jobId: string) {
    return this.jobProgress.get(jobId)
  }

  // 작업 시뮬레이션 (개발용)
  simulateProgress(jobId: string) {
    const steps = [
      { progress: 10, message: '프롬프트 분석 중...' },
      { progress: 25, message: '참조 이미지 처리 중...' },
      { progress: 40, message: 'AI 모델 초기화 중...' },
      { progress: 60, message: '영상 프레임 생성 중...' },
      { progress: 80, message: '영상 인코딩 중...' },
      { progress: 95, message: '최종 처리 중...' },
      { progress: 100, message: '영상 생성 완료!' }
    ]

    let currentStep = 0

    const interval = setInterval(() => {
      if (currentStep >= steps.length) {
        clearInterval(interval)
        this.completeJob(jobId, `https://example.com/video/${jobId}.mp4`)
        return
      }

      const step = steps[currentStep]
      this.updateProgress(jobId, step.progress, step.message)
      currentStep++
    }, 3000) // 3초마다 업데이트

    // 시뮬레이션 시작
    this.updateProgress(jobId, 0, '영상 생성을 시작합니다...')
  }
}

// SSE (Server-Sent Events) 구현
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params
  const progressMonitor = ProgressMonitorService.getInstance()

  // 개발 환경에서는 시뮬레이션 실행
  if (process.env.NODE_ENV === 'development') {
    progressMonitor.simulateProgress(jobId)
  }

  // SSE 스트림 설정
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const sendUpdate = () => {
        const progress = progressMonitor.getProgress(jobId)

        if (!progress) {
          const errorData = {
            type: 'error',
            message: '작업을 찾을 수 없습니다'
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`))
          controller.close()
          return
        }

        if (progress.status === 'processing') {
          const progressData = {
            type: 'progress',
            progress: progress.progress,
            message: progress.message
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData)}\n\n`))
        } else if (progress.status === 'completed') {
          const completedData = {
            type: 'completed',
            videoUrl: progress.videoUrl,
            message: progress.message
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(completedData)}\n\n`))
          controller.close()
          return
        } else if (progress.status === 'error') {
          const errorData = {
            type: 'error',
            message: progress.error || progress.message
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`))
          controller.close()
          return
        }

        // 1초마다 업데이트 확인
        setTimeout(sendUpdate, 1000)
      }

      sendUpdate()
    },

    cancel() {
      // 스트림 정리
      console.log(`Progress stream cancelled for job: ${jobId}`)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}

// 수동으로 진행 상황 업데이트 (테스트용)
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params
    const body = await request.json()
    const progressMonitor = ProgressMonitorService.getInstance()

    if (body.type === 'progress') {
      progressMonitor.updateProgress(jobId, body.progress, body.message)
    } else if (body.type === 'completed') {
      progressMonitor.completeJob(jobId, body.videoUrl)
    } else if (body.type === 'error') {
      progressMonitor.errorJob(jobId, body.message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: '진행 상황 업데이트 실패' },
      { status: 500 }
    )
  }
}