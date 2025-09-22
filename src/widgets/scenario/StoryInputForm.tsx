/**
 * StoryInputForm Widget
 *
 * AI 스토리 생성을 위한 사용자 입력 폼 컴포넌트
 * CLAUDE.md 준수: FSD widgets 레이어, 접근성 WCAG 2.1 AA, React 19
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type {
  StoryGenerationRequest,
  ScenarioCreateInput
} from '../../entities/scenario'

import { useStoryGeneration, StoryGenerator } from '../../features/scenario'
import { Button, Card, Input, Select, Textarea } from '../../shared/ui'
import logger from '../../shared/lib/logger'

/**
 * 스토리 입력 폼 속성
 */
export interface StoryInputFormProps {
  onStoryGenerated?: (scenario: any) => void
  onError?: (error: string) => void
  disabled?: boolean
  className?: string
  defaultValues?: {
    title?: string
    description?: string
    genre?: string
    targetDuration?: number
    prompt?: string
    style?: string
    tone?: string
  }
}

/**
 * 폼 데이터 타입
 */
interface FormData {
  title: string
  description: string
  genre: string
  targetDuration: number
  prompt: string
  style: 'casual' | 'professional' | 'creative' | 'educational'
  tone: 'serious' | 'humorous' | 'dramatic' | 'informative'
}

/**
 * 스토리 입력 폼 컴포넌트
 *
 * AI 스토리 생성을 위한 사용자 입력 폼
 * CLAUDE.md 준수: FSD widgets 레이어, 접근성 WCAG 2.1 AA
 */
export function StoryInputForm({
  onStoryGenerated,
  onError,
  disabled = false,
  className = '',
  defaultValues = {}
}: StoryInputFormProps) {
  // Redux 상태 및 Hook
  const {
    generateStory,
    isGenerating,
    progress,
    currentStep,
    error,
    clearError
  } = useStoryGeneration({
    autoSave: true,
    onSuccess: (result) => {
      if (result.scenario) {
        onStoryGenerated?.(result.scenario)
        logger.info('스토리 생성 성공', {
          scenarioId: result.scenario.metadata.id
        })
      }
    },
    onError: (errorMsg) => {
      onError?.(errorMsg)
      logger.error('스토리 생성 실패', { error: errorMsg })
    }
  })

  // 폼 상태 관리
  const [formData, setFormData] = useState<FormData>({
    title: defaultValues.title || '',
    description: defaultValues.description || '',
    genre: defaultValues.genre || '브이로그',
    targetDuration: defaultValues.targetDuration || 300,
    prompt: defaultValues.prompt || '',
    style: (defaultValues.style as FormData['style']) || 'professional',
    tone: (defaultValues.tone as FormData['tone']) || 'informative'
  })

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)

  /**
   * 폼 데이터 업데이트
   */
  const updateFormData = useCallback((field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // 해당 필드 에러 제거
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const { [field]: removed, ...rest } = prev
        return rest
      })
    }
  }, [validationErrors])

  /**
   * 폼 검증
   */
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.title.trim()) {
      errors.title = '제목을 입력해주세요.'
    } else if (formData.title.length > 100) {
      errors.title = '제목은 100자 이하로 입력해주세요.'
    }

    if (!formData.prompt.trim()) {
      errors.prompt = '스토리 아이디어를 입력해주세요.'
    } else {
      const promptValidation = StoryGenerator.validatePrompt(formData.prompt)
      if (!promptValidation.isValid) {
        errors.prompt = promptValidation.issues.join(' ')
      }
    }

    if (formData.targetDuration < 30 || formData.targetDuration > 3600) {
      errors.targetDuration = '대상 지속시간은 30초~60분 사이로 설정해주세요.'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [formData])

  /**
   * 폼 제출 처리
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm() || isGenerating) {
      return
    }

    // 에러 상태 제거
    if (error) {
      clearError()
    }

    const scenarioInput: ScenarioCreateInput = {
      title: formData.title,
      description: formData.description,
      genre: formData.genre,
      targetDuration: formData.targetDuration,
      storyPrompt: formData.prompt,
      userId: 'current-user' // TODO: 실제 사용자 ID로 교체
    }

    const generationRequest: StoryGenerationRequest = {
      prompt: StoryGenerator.optimizePrompt(formData.prompt, {
        genre: formData.genre,
        platform: '온라인 비디오'
      }),
      genre: formData.genre,
      targetDuration: formData.targetDuration,
      style: formData.style,
      tone: formData.tone
    }

    await generateStory(scenarioInput, generationRequest)
  }, [formData, validateForm, isGenerating, error, clearError, generateStory])

  /**
   * 예상 비용 계산
   */
  const estimatedCost = useMemo(() => {
    if (!formData.prompt) return null
    return StoryGenerator.estimateGenerationCost(formData.prompt, formData.targetDuration)
  }, [formData.prompt, formData.targetDuration])

  /**
   * $300 사건 방지: useRef로 이전 값 추적하여 무한 루프 방지
   * 장르 변경 시 기본값 적용
   */
  const previousGenreRef = useRef<string>('')

  useEffect(() => {
    // 장르가 실제로 변경되었을 때만 실행 (무한 루프 방지)
    if (formData.genre && formData.genre !== previousGenreRef.current) {
      previousGenreRef.current = formData.genre
      const defaults = StoryGenerator.getGenreDefaults(formData.genre)
      setFormData(prev => ({
        ...prev,
        style: defaults.style,
        tone: defaults.tone,
        targetDuration: prev.targetDuration || defaults.targetDuration
      }))
    }
  }, [formData.genre]) // formData.genre만 의존성으로 유지 (setFormData는 React가 안정적으로 보장)

  return (
    <Card className={`p-6 ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-900">
            AI 스토리 생성
          </h2>

          {isGenerating && (
            <div className="flex items-center gap-2 text-primary-600">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">
                {currentStep === 'preparing' && '준비 중...'}
                {currentStep === 'generating_outline' && '아웃라인 생성 중...'}
                {currentStep === 'creating_scenes' && '씬 생성 중...'}
                {currentStep === 'validating' && '검증 중...'}
                {currentStep === 'finalizing' && '마무리 중...'}
              </span>
            </div>
          )}
        </div>

        {/* 진행률 바 */}
        {isGenerating && (
          <div className="w-full bg-neutral-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="스토리 생성 진행률"
            />
          </div>
        )}

        {/* 오류 메시지 */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">
                  스토리 생성 오류
                </h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <button
                  type="button"
                  onClick={clearError}
                  className="text-sm text-red-600 underline mt-2 hover:text-red-800"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 기본 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium text-neutral-700">
              제목 *
            </label>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => updateFormData('title', e.target.value)}
              placeholder="예: 내 첫 브이로그 영상"
              disabled={disabled || isGenerating}
              className={validationErrors.title ? 'border-red-500' : ''}
              maxLength={100}
              required
              data-testid="story-title-input"
            />
            {validationErrors.title && (
              <p className="text-sm text-red-600" role="alert">
                {validationErrors.title}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="genre" className="block text-sm font-medium text-neutral-700">
              장르
            </label>
            <Select
              id="genre"
              value={formData.genre}
              onChange={(value) => updateFormData('genre', value)}
              disabled={disabled || isGenerating}
              data-testid="story-genre-select"
            >
              <option value="브이로그">브이로그</option>
              <option value="교육">교육</option>
              <option value="마케팅">마케팅</option>
              <option value="엔터테인먼트">엔터테인먼트</option>
              <option value="뉴스">뉴스/리포팅</option>
              <option value="리뷰">리뷰</option>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="description" className="block text-sm font-medium text-neutral-700">
            간단한 설명
          </label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => updateFormData('description', e.target.value)}
            placeholder="이 영상에 대한 간단한 설명을 입력해주세요 (선택사항)"
            disabled={disabled || isGenerating}
            rows={2}
            maxLength={200}
            data-testid="story-description-input"
          />
        </div>

        {/* 스토리 아이디어 */}
        <div className="space-y-2">
          <label htmlFor="prompt" className="block text-sm font-medium text-neutral-700">
            스토리 아이디어 *
          </label>
          <Textarea
            id="prompt"
            value={formData.prompt}
            onChange={(e) => updateFormData('prompt', e.target.value)}
            placeholder="만들고 싶은 영상에 대해 자세히 설명해주세요. 예: 나의 일상을 담은 브이로그를 만들고 싶습니다. 아침에 일어나서 커피를 마시고, 운동을 하고, 일을 하는 모습을 보여주고 싶습니다."
            disabled={disabled || isGenerating}
            rows={4}
            className={validationErrors.prompt ? 'border-red-500' : ''}
            required
            data-testid="story-prompt-input"
          />
          {validationErrors.prompt && (
            <p className="text-sm text-red-600" role="alert">
              {validationErrors.prompt}
            </p>
          )}
        </div>

        {/* 대상 지속시간 */}
        <div className="space-y-2">
          <label htmlFor="duration" className="block text-sm font-medium text-neutral-700">
            대상 지속시간
            <span className="sr-only">
              현재 {Math.floor(formData.targetDuration / 60)}분 {formData.targetDuration % 60}초로 설정됨
            </span>
          </label>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <input
                id="duration"
                type="range"
                min="30"
                max="600"
                step="30"
                value={formData.targetDuration}
                onChange={(e) => updateFormData('targetDuration', parseInt(e.target.value))}
                disabled={disabled || isGenerating}
                className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                aria-valuemin={30}
                aria-valuemax={600}
                aria-valuenow={formData.targetDuration}
                aria-valuetext={`${Math.floor(formData.targetDuration / 60)}분 ${formData.targetDuration % 60}초`}
                aria-describedby="duration-description"
                data-testid="story-duration-slider"
              />
              <style jsx>{`
                input[type="range"]::-webkit-slider-thumb {
                  appearance: none;
                  height: 20px;
                  width: 20px;
                  border-radius: 50%;
                  background: #3b82f6;
                  cursor: pointer;
                  border: 2px solid white;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }
                input[type="range"]::-moz-range-thumb {
                  height: 20px;
                  width: 20px;
                  border-radius: 50%;
                  background: #3b82f6;
                  cursor: pointer;
                  border: 2px solid white;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }
                input[type="range"]:focus::-webkit-slider-thumb {
                  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
                }
              `}</style>
            </div>
            <div className="min-w-[80px] text-center">
              <span className="text-sm font-medium text-neutral-900 block">
                {Math.floor(formData.targetDuration / 60)}:{(formData.targetDuration % 60).toString().padStart(2, '0')}
              </span>
              <span className="text-xs text-neutral-500">분:초</span>
            </div>
          </div>
          <p id="duration-description" className="text-xs text-neutral-500">
            30초에서 10분 사이로 설정할 수 있습니다
          </p>
          {validationErrors.targetDuration && (
            <p className="text-sm text-red-600" role="alert" aria-live="polite">
              {validationErrors.targetDuration}
            </p>
          )}
        </div>

        {/* 고급 설정 */}
        <div className="border-t pt-6">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-sm p-1 -m-1 transition-colors"
            aria-expanded={showAdvanced}
            aria-controls="advanced-settings"
            aria-label={`고급 설정 ${showAdvanced ? '숨기기' : '보기'}`}
            data-testid="toggle-advanced-settings"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${showAdvanced ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            고급 설정
          </button>

          <div
            id="advanced-settings"
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              showAdvanced
                ? 'max-h-96 opacity-100 mt-4'
                : 'max-h-0 opacity-0'
            }`}
            aria-hidden={!showAdvanced}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label htmlFor="style" className="block text-sm font-medium text-neutral-700">
                  스타일
                  <span className="text-xs text-neutral-500 block font-normal">
                    영상의 전반적인 스타일을 선택하세요
                  </span>
                </label>
                <Select
                  id="style"
                  value={formData.style}
                  onChange={(value) => updateFormData('style', value)}
                  disabled={disabled || isGenerating}
                  aria-describedby="style-description"
                  data-testid="story-style-select"
                >
                  <option value="casual">캐주얼 - 편안하고 친근한 분위기</option>
                  <option value="professional">전문적 - 비즈니스 및 공식적인 톤</option>
                  <option value="creative">창의적 - 독창적이고 예술적인 접근</option>
                  <option value="educational">교육적 - 학습과 정보 전달 중심</option>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="tone" className="block text-sm font-medium text-neutral-700">
                  톤
                  <span className="text-xs text-neutral-500 block font-normal">
                    전달하고자 하는 감정이나 분위기를 선택하세요
                  </span>
                </label>
                <Select
                  id="tone"
                  value={formData.tone}
                  onChange={(value) => updateFormData('tone', value)}
                  disabled={disabled || isGenerating}
                  aria-describedby="tone-description"
                  data-testid="story-tone-select"
                >
                  <option value="serious">진지한 - 신중하고 중요한 메시지</option>
                  <option value="humorous">유머러스 - 재미있고 밝은 분위기</option>
                  <option value="dramatic">드라마틱 - 감동적이고 극적인 효과</option>
                  <option value="informative">정보 전달 - 명확하고 객관적인 설명</option>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* 비용 추정 */}
        {estimatedCost && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-800">
                  예상 비용
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  예상 토큰: {estimatedCost.estimatedTokens.toLocaleString()}개
                  {estimatedCost.warningLevel === 'high' && (
                    <span className="ml-2 text-orange-600 font-medium">
                      (비용 주의)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 제출 버튼 */}
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={disabled || isGenerating || !formData.title.trim() || !formData.prompt.trim()}
            className="flex-1"
            data-testid="generate-story-button"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                생성 중... ({progress}%)
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI 스토리 생성
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
}