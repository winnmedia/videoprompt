/**
 * VideoGenerator Widget
 *
 * 영상 생성 메인 컴포넌트 (15-16단계 UserJourneyMap)
 * - 프롬프트와 콘티 이미지 기반 영상 생성
 * - 접근성 WCAG 2.1 AA 준수
 * - 반응형 디자인 (모바일 우선)
 */

import { useState } from 'react'

export interface VideoGeneratorProps {
  /** 스토리보드 이미지 데이터 */
  storyboardImages?: string[]
  /** 생성 프롬프트 */
  prompt?: string
  /** 영상 생성 시작 콜백 */
  onGenerationStart?: (data: VideoGenerationData) => void
  /** 에러 발생 콜백 */
  onError?: (error: string) => void
  /** 로딩 상태 */
  isLoading?: boolean
  /** 비활성화 상태 */
  disabled?: boolean
}

export interface VideoGenerationData {
  prompt: string
  storyboardImages: string[]
  options: {
    duration: number
    aspectRatio: string
    quality: string
  }
}

interface ValidationError {
  field: string
  message: string
}

export function VideoGenerator({
  storyboardImages = [],
  prompt: initialPrompt = '',
  onGenerationStart,
  onError,
  isLoading = false,
  disabled = false,
}: VideoGeneratorProps) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [duration, setDuration] = useState(10)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [quality, setQuality] = useState('standard')
  const [errors, setErrors] = useState<ValidationError[]>([])

  // 입력 검증
  const validateInputs = (): ValidationError[] => {
    const validationErrors: ValidationError[] = []

    if (!prompt.trim()) {
      validationErrors.push({
        field: 'prompt',
        message: '영상 생성을 위한 프롬프트를 입력해주세요.'
      })
    }

    if (prompt.length > 1000) {
      validationErrors.push({
        field: 'prompt',
        message: '프롬프트는 1000자를 초과할 수 없습니다.'
      })
    }

    if (storyboardImages.length === 0) {
      validationErrors.push({
        field: 'storyboard',
        message: '최소 1개 이상의 스토리보드 이미지가 필요합니다.'
      })
    }

    return validationErrors
  }

  // 영상 생성 시작
  const handleGenerationStart = () => {
    const validationErrors = validateInputs()

    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      // 첫 번째 오류 필드로 포커스 이동 (접근성)
      const firstErrorField = document.getElementById(validationErrors[0].field)
      firstErrorField?.focus()
      return
    }

    setErrors([])

    const generationData: VideoGenerationData = {
      prompt: prompt.trim(),
      storyboardImages,
      options: {
        duration,
        aspectRatio,
        quality,
      },
    }

    onGenerationStart?.(generationData)
  }

  // 에러 메시지 표시 헬퍼
  const getFieldError = (fieldName: string) => {
    return errors.find(error => error.field === fieldName)?.message
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-6">
      {/* 헤더 */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-neutral-900">
          AI 영상 생성
        </h1>
        <p className="text-lg text-neutral-600">
          스토리보드와 프롬프트를 기반으로 영상을 생성합니다
        </p>
      </div>

      {/* 스토리보드 미리보기 */}
      <section
        className="space-y-4"
        aria-labelledby="storyboard-heading"
      >
        <h2
          id="storyboard-heading"
          className="text-xl font-semibold text-neutral-800"
        >
          스토리보드 이미지 ({storyboardImages.length}개)
        </h2>

        {storyboardImages.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {storyboardImages.map((image, index) => (
              <div
                key={index}
                className="relative aspect-video rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200"
              >
                <img
                  src={image}
                  alt={`스토리보드 이미지 ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute top-2 left-2 bg-neutral-900 bg-opacity-75 text-white text-sm px-2 py-1 rounded">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center">
            <div className="text-neutral-500">
              <svg
                className="mx-auto h-12 w-12 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p>스토리보드 이미지가 없습니다</p>
              <p className="text-sm">시나리오 페이지에서 스토리보드를 생성해주세요</p>
            </div>
          </div>
        )}

        {getFieldError('storyboard') && (
          <div
            className="text-error-500 text-sm"
            role="alert"
            aria-live="polite"
          >
            {getFieldError('storyboard')}
          </div>
        )}
      </section>

      {/* 프롬프트 입력 */}
      <section
        className="space-y-4"
        aria-labelledby="prompt-heading"
      >
        <label
          id="prompt-heading"
          htmlFor="prompt"
          className="block text-xl font-semibold text-neutral-800"
        >
          영상 생성 프롬프트
        </label>

        <div className="space-y-2">
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="생성하고 싶은 영상의 스타일, 분위기, 효과 등을 자세히 설명해주세요..."
            className={`
              w-full h-32 px-4 py-3 border rounded-lg resize-none
              focus:ring-2 focus:ring-primary-500 focus:border-primary-500
              ${getFieldError('prompt')
                ? 'border-error-500 focus:ring-error-500 focus:border-error-500'
                : 'border-neutral-300'
              }
              ${disabled ? 'bg-neutral-100 cursor-not-allowed' : 'bg-white'}
            `}
            disabled={disabled || isLoading}
            maxLength={1000}
            aria-describedby="prompt-help prompt-error prompt-count"
            aria-invalid={!!getFieldError('prompt')}
          />

          <div className="flex justify-between items-center text-sm">
            <div
              id="prompt-help"
              className="text-neutral-500"
            >
              예: 영화 같은 느낌, 밝은 색조, 부드러운 전환 효과
            </div>
            <div
              id="prompt-count"
              className={`
                ${prompt.length > 900 ? 'text-warning-500' : 'text-neutral-400'}
              `}
            >
              {prompt.length}/1000
            </div>
          </div>
        </div>

        {getFieldError('prompt') && (
          <div
            id="prompt-error"
            className="text-error-500 text-sm"
            role="alert"
            aria-live="polite"
          >
            {getFieldError('prompt')}
          </div>
        )}
      </section>

      {/* 생성 옵션 */}
      <section
        className="space-y-4"
        aria-labelledby="options-heading"
      >
        <h2
          id="options-heading"
          className="text-xl font-semibold text-neutral-800"
        >
          생성 옵션
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 영상 길이 */}
          <div className="space-y-2">
            <label
              htmlFor="duration"
              className="block text-sm font-medium text-neutral-700"
            >
              영상 길이
            </label>
            <select
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={disabled || isLoading}
            >
              <option value={5}>5초</option>
              <option value={10}>10초</option>
              <option value={15}>15초</option>
              <option value={30}>30초</option>
            </select>
          </div>

          {/* 화면 비율 */}
          <div className="space-y-2">
            <label
              htmlFor="aspect-ratio"
              className="block text-sm font-medium text-neutral-700"
            >
              화면 비율
            </label>
            <select
              id="aspect-ratio"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={disabled || isLoading}
            >
              <option value="16:9">16:9 (가로형)</option>
              <option value="9:16">9:16 (세로형)</option>
              <option value="1:1">1:1 (정사각형)</option>
            </select>
          </div>

          {/* 품질 */}
          <div className="space-y-2">
            <label
              htmlFor="quality"
              className="block text-sm font-medium text-neutral-700"
            >
              품질
            </label>
            <select
              id="quality"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={disabled || isLoading}
            >
              <option value="standard">표준 (빠름)</option>
              <option value="high">고품질 (느림)</option>
            </select>
          </div>
        </div>
      </section>

      {/* 생성 버튼 */}
      <div className="flex justify-center pt-6">
        <button
          onClick={handleGenerationStart}
          disabled={disabled || isLoading}
          className={`
            px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-150
            focus:ring-4 focus:ring-primary-500 focus:ring-opacity-50
            ${disabled || isLoading
              ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
              : 'bg-primary-500 hover:bg-primary-600 text-white shadow-medium hover:shadow-hard'
            }
          `}
          aria-describedby="generation-help"
        >
          {isLoading ? (
            <span className="flex items-center space-x-2">
              <svg
                className="animate-spin h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>생성 중...</span>
            </span>
          ) : (
            'AI 영상 생성 시작'
          )}
        </button>
      </div>

      <div
        id="generation-help"
        className="text-center text-sm text-neutral-500"
      >
        생성에는 약 2-5분이 소요됩니다
      </div>
    </div>
  )
}