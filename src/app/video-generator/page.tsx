/**
 * Video Generator Page
 *
 * 영상 생성 페이지 (/video-generator)
 * UserJourneyMap 15-18단계 통합 구현
 * - 15단계: 영상 생성 버튼을 통해 이동
 * - 16단계: 프롬프트와 콘티 이미지 기반 영상 생성
 * - 17단계: 로딩바와 생성 진행 상황 표시
 * - 18단계: 영상 플레이어, 피드백, 재생성 버튼
 */

'use client'

import { useState, useEffect } from 'react'
import { VideoGenerator, GenerationProgress, VideoPlayer, VideoControls } from '@/widgets/video'
import type { VideoGenerationData, VideoFeedback } from '@/widgets/video'

// 영상 생성 상태
type GenerationState = 'input' | 'generating' | 'completed' | 'error'

interface VideoGenerationResult {
  id: string
  url: string
  title: string
  createdAt: string
}

export default function VideoGeneratorPage() {
  const [state, setState] = useState<GenerationState>('input')
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [generationData, setGenerationData] = useState<VideoGenerationData | null>(null)
  const [result, setResult] = useState<VideoGenerationResult | null>(null)
  const [error, setError] = useState<string>('')

  // 더미 스토리보드 이미지 (실제로는 props나 상태에서 받아옴)
  const [storyboardImages] = useState<string[]>([
    'https://picsum.photos/400/225?random=1',
    'https://picsum.photos/400/225?random=2',
    'https://picsum.photos/400/225?random=3',
  ])

  // 영상 생성 시작
  const handleGenerationStart = async (data: VideoGenerationData) => {
    console.log('영상 생성 시작:', data)
    setGenerationData(data)
    setState('generating')
    setProgress(0)
    setCurrentStep('준비 중...')
    setError('')

    try {
      await executeVideoGeneration()
    } catch (err) {
      console.error('영상 생성 오류:', err)
      setError('영상 생성 중 오류가 발생했습니다. 다시 시도해주세요.')
      setState('error')
    }
  }

  // 실제 영상 생성 API 호출
  const generateVideoAPI = async () => {
    if (!generationData) {
      throw new Error('생성 데이터가 없습니다')
    }

    // $300 사건 방지: 비용 안전 체크
    const costCheckResponse = await fetch('/api/admin/cost-safety-check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cost-Safety': 'enabled'
      }
    })

    if (!costCheckResponse.ok) {
      throw new Error('비용 안전 체크 실패')
    }

    // 실제 영상 생성 API 호출
    const response = await fetch('/api/video/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cost-Safety': 'enabled',
        'X-Request-ID': crypto.randomUUID()
      },
      body: JSON.stringify({
        prompt: generationData.prompt,
        images: generationData.images,
        provider: generationData.provider || 'seedance',
        config: {
          aspectRatio: generationData.aspectRatio || '16:9',
          duration: generationData.duration || 30,
          quality: generationData.quality || 'hd'
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || '영상 생성 요청 실패')
    }

    const { jobId } = await response.json()

    // Server-Sent Events로 실시간 진행 상황 모니터링
    return new Promise<VideoGenerationResult>((resolve, reject) => {
      const eventSource = new EventSource(`/api/video/progress/${jobId}`)

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'progress') {
            setProgress(data.progress)
            setCurrentStep(data.message)
          } else if (data.type === 'completed') {
            eventSource.close()
            resolve({
              id: jobId,
              url: data.videoUrl,
              title: `AI 생성 영상 - ${new Date().toLocaleString()}`,
              createdAt: new Date().toISOString(),
            })
          } else if (data.type === 'error') {
            eventSource.close()
            reject(new Error(data.message || '영상 생성 실패'))
          }
        } catch (parseError) {
          console.error('SSE 데이터 파싱 오류:', parseError)
        }
      }

      eventSource.onerror = (event) => {
        console.error('SSE 연결 오류:', event)
        eventSource.close()
        reject(new Error('서버 연결 오류가 발생했습니다'))
      }

      // 5분 타임아웃
      const timeout = setTimeout(() => {
        eventSource.close()
        reject(new Error('영상 생성 시간 초과 (5분)'))
      }, 300000)

      // 성공/실패 시 타임아웃 클리어
      const originalResolve = resolve
      const originalReject = reject

      resolve = (value) => {
        clearTimeout(timeout)
        originalResolve(value)
      }

      reject = (reason) => {
        clearTimeout(timeout)
        originalReject(reason)
      }
    })
  }

  // 영상 생성 실행
  const executeVideoGeneration = async () => {
    try {
      const result = await generateVideoAPI()
      setResult(result)
      setState('completed')
    } catch (error) {
      console.error('영상 생성 오류:', error)
      setError(error instanceof Error ? error.message : '영상 생성 중 오류가 발생했습니다')
      setState('error')
    }
  }

  // 피드백 제출
  const handleFeedbackSubmit = async (feedback: VideoFeedback) => {
    console.log('피드백 제출:', feedback)

    // 실제로는 API 호출
    await new Promise(resolve => setTimeout(resolve, 1000))

    alert('피드백이 성공적으로 제출되었습니다. 감사합니다!')
  }

  // 재생성
  const handleRegenerate = () => {
    if (generationData) {
      handleGenerationStart(generationData)
    }
  }

  // 다운로드
  const handleDownload = () => {
    console.log('다운로드 시작')
    // 실제 다운로드 로직은 VideoControls에서 처리
  }

  // 공유
  const handleShare = () => {
    console.log('공유 시작')
    // 실제 공유 로직은 VideoControls에서 처리
  }

  // 에러 상태 처리
  const handleRetry = () => {
    setState('input')
    setError('')
    setProgress(0)
    setCurrentStep('')
  }

  // 새로 시작
  const handleStartOver = () => {
    setState('input')
    setGenerationData(null)
    setResult(null)
    setProgress(0)
    setCurrentStep('')
    setError('')
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-neutral-900">AI 영상 생성</h1>
              {state !== 'input' && (
                <div className="flex items-center space-x-2 text-sm text-neutral-600">
                  <span>단계:</span>
                  <span className="font-medium">
                    {state === 'generating' && '생성 중'}
                    {state === 'completed' && '완료'}
                    {state === 'error' && '오류'}
                  </span>
                </div>
              )}
            </div>

            {/* 네비게이션 */}
            <nav className="flex items-center space-x-4">
              <button
                onClick={handleStartOver}
                className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                처음부터 다시
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 입력 단계 (15-16단계) */}
        {state === 'input' && (
          <VideoGenerator
            storyboardImages={storyboardImages}
            onGenerationStart={handleGenerationStart}
            isLoading={false}
          />
        )}

        {/* 생성 중 단계 (17단계) */}
        {state === 'generating' && (
          <GenerationProgress
            progress={progress}
            currentStep={currentStep}
            estimatedTime={300} // 5분
            cancellable={true}
            onCancel={() => {
              setState('input')
              setProgress(0)
              setCurrentStep('')
            }}
          />
        )}

        {/* 완료 단계 (18단계) */}
        {state === 'completed' && result && (
          <div className="space-y-8">
            {/* 영상 플레이어 */}
            <div className="bg-white rounded-lg shadow-soft p-6">
              <VideoPlayer
                src={result.url}
                title={result.title}
                size="large"
                controls={true}
                onLoad={() => console.log('비디오 로드 완료')}
                onPlay={() => console.log('재생 시작')}
                onPause={() => console.log('재생 정지')}
                onEnded={() => console.log('재생 완료')}
                onError={(error) => console.error('재생 오류:', error)}
              />
            </div>

            {/* 비디오 컨트롤 */}
            <div className="bg-white rounded-lg shadow-soft">
              <VideoControls
                videoUrl={result.url}
                videoTitle={result.title}
                canRegenerate={true}
                canDownload={true}
                canShare={true}
                onFeedbackSubmit={handleFeedbackSubmit}
                onRegenerate={handleRegenerate}
                onDownload={handleDownload}
                onShare={handleShare}
              />
            </div>

            {/* 생성 정보 */}
            <div className="bg-white rounded-lg shadow-soft p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">생성 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-neutral-700">생성 시간:</span>
                  <span className="ml-2 text-neutral-600">
                    {new Date(result.createdAt).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-neutral-700">영상 길이:</span>
                  <span className="ml-2 text-neutral-600">
                    {generationData?.options.duration}초
                  </span>
                </div>
                <div>
                  <span className="font-medium text-neutral-700">화면 비율:</span>
                  <span className="ml-2 text-neutral-600">
                    {generationData?.options.aspectRatio}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-neutral-700">품질:</span>
                  <span className="ml-2 text-neutral-600">
                    {generationData?.options.quality === 'standard' ? '표준' : '고품질'}
                  </span>
                </div>
              </div>

              {generationData?.prompt && (
                <div className="mt-4">
                  <span className="font-medium text-neutral-700">사용된 프롬프트:</span>
                  <p className="mt-2 text-neutral-600 bg-neutral-50 p-3 rounded-md text-sm">
                    {generationData.prompt}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 에러 단계 */}
        {state === 'error' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-soft p-8 text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-error-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-error-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-xl font-bold text-neutral-900">영상 생성 실패</h2>
                <p className="mt-2 text-neutral-600">{error}</p>
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={handleRetry}
                  className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  다시 시도
                </button>
                <button
                  onClick={handleStartOver}
                  className="px-6 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  처음부터
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 푸터 */}
      <footer className="bg-white border-t border-neutral-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-neutral-500">
            <p>AI 영상 생성은 최신 기술을 사용하여 제공됩니다.</p>
            <p className="mt-1">
              문제가 발생하면{' '}
              <a href="/feedback" className="text-primary-600 hover:text-primary-700">
                피드백 페이지
              </a>
              를 통해 신고해주세요.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}