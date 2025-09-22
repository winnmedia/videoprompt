/**
 * PlanningInputForm Widget
 *
 * FRD.md 명세 Step 1: 입력/선택 - 제목, 로그라인, 톤앤매너, 전개방식, 강도, 프리셋
 * CLAUDE.md 준수: FSD widgets 레이어, 접근성 WCAG 2.1 AA, React 19
 */

import { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react'
import type {
  PlanningInputData,
  ToneAndManner,
  StoryDevelopment,
  StoryIntensity,
  PlanningTemplate,
} from '../../entities/planning'

import { Button, Card, Input, Select, Textarea } from '../../shared/ui'
import logger from '../../shared/lib/logger'

/**
 * 기획 입력 폼 속성
 */
export interface PlanningInputFormProps {
  defaultValues?: Partial<PlanningInputData>
  onSubmit?: (inputData: PlanningInputData) => Promise<void>
  onUseTemplate?: (templateId: string) => Promise<void>
  isGenerating?: boolean
  disabled?: boolean
  className?: string
  enableKeyboardNavigation?: boolean
}

/**
 * 프리셋 템플릿 정의 (FRD.md 명세)
 */
const PRESET_TEMPLATES: Record<string, Partial<PlanningInputData>> = {
  drama: {
    toneAndManner: 'professional',
    development: 'dramatic',
    intensity: 'high',
    targetDuration: 900, // 15분
  },
  action: {
    toneAndManner: 'creative',
    development: 'dramatic',
    intensity: 'high',
    targetDuration: 1200, // 20분
  },
  romance: {
    toneAndManner: 'casual',
    development: 'linear',
    intensity: 'medium',
    targetDuration: 600, // 10분
  },
  comedy: {
    toneAndManner: 'casual',
    development: 'problem_solution',
    intensity: 'low',
    targetDuration: 480, // 8분
  },
  education: {
    toneAndManner: 'educational',
    development: 'tutorial',
    intensity: 'medium',
    targetDuration: 720, // 12분
  },
  marketing: {
    toneAndManner: 'marketing',
    development: 'problem_solution',
    intensity: 'high',
    targetDuration: 300, // 5분
  },
}

/**
 * 톤앤매너 옵션 정의
 */
const TONE_AND_MANNER_OPTIONS: { value: ToneAndManner; label: string; description: string }[] = [
  { value: 'casual', label: '캐주얼', description: '편안하고 친근한 분위기' },
  { value: 'professional', label: '전문적', description: '비즈니스 및 공식적인 톤' },
  { value: 'creative', label: '창의적', description: '독창적이고 예술적인 접근' },
  { value: 'educational', label: '교육적', description: '학습과 정보 전달 중심' },
  { value: 'marketing', label: '마케팅', description: '판매와 홍보에 최적화' },
]

/**
 * 전개방식 옵션 정의
 */
const DEVELOPMENT_OPTIONS: { value: StoryDevelopment; label: string; description: string }[] = [
  { value: 'linear', label: '선형적', description: '순차적이고 논리적인 전개' },
  { value: 'dramatic', label: '드라마틱', description: '감정적 기복과 갈등 중심' },
  { value: 'problem_solution', label: '문제-해결', description: '문제 제시 후 해결책 제시' },
  { value: 'comparison', label: '비교', description: '여러 옵션을 비교 분석' },
  { value: 'tutorial', label: '튜토리얼', description: '단계별 학습과 실습' },
]

/**
 * 강도 옵션 정의
 */
const INTENSITY_OPTIONS: { value: StoryIntensity; label: string; description: string }[] = [
  { value: 'low', label: '낮음', description: '차분하고 부드러운 진행' },
  { value: 'medium', label: '보통', description: '적절한 긴장감과 리듬' },
  { value: 'high', label: '높음', description: '강렬하고 빠른 전개' },
]

/**
 * 유효성 검증 규칙
 */
const VALIDATION_RULES = {
  title: {
    required: true,
    minLength: 2,
    maxLength: 100,
  },
  logline: {
    required: true,
    minLength: 10,
    maxLength: 300,
  },
  targetDuration: {
    min: 60, // 1분
    max: 3600, // 60분
  },
}

/**
 * FRD.md 명세 Step 1: 입력/선택 컴포넌트
 */
export const PlanningInputForm = memo(function PlanningInputForm({
  defaultValues = {},
  onSubmit,
  onUseTemplate,
  isGenerating = false,
  disabled = false,
  className = '',
  enableKeyboardNavigation = true,
}: PlanningInputFormProps) {
  // 폼 상태 관리
  const [formData, setFormData] = useState<PlanningInputData>({
    title: defaultValues.title || '',
    logline: defaultValues.logline || '',
    toneAndManner: defaultValues.toneAndManner || 'professional',
    development: defaultValues.development || 'linear',
    intensity: defaultValues.intensity || 'medium',
    targetDuration: defaultValues.targetDuration || 600,
    additionalNotes: defaultValues.additionalNotes || '',
  })

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)

  // $300 사건 방지: 이전 값 추적
  const previousTemplateRef = useRef<string>('')

  /**
   * 폼 데이터 업데이트
   */
  const updateFormData = useCallback((field: keyof PlanningInputData, value: any) => {
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

    // 제목 검증
    if (!formData.title.trim()) {
      errors.title = '제목을 입력해주세요'
    } else if (formData.title.length < VALIDATION_RULES.title.minLength) {
      errors.title = `제목은 최소 ${VALIDATION_RULES.title.minLength}자 이상이어야 합니다`
    } else if (formData.title.length > VALIDATION_RULES.title.maxLength) {
      errors.title = `제목은 최대 ${VALIDATION_RULES.title.maxLength}자까지 입력 가능합니다`
    }

    // 로그라인 검증
    if (!formData.logline.trim()) {
      errors.logline = '로그라인을 입력해주세요'
    } else if (formData.logline.length < VALIDATION_RULES.logline.minLength) {
      errors.logline = `로그라인은 최소 ${VALIDATION_RULES.logline.minLength}자 이상이어야 합니다`
    } else if (formData.logline.length > VALIDATION_RULES.logline.maxLength) {
      errors.logline = `로그라인은 최대 ${VALIDATION_RULES.logline.maxLength}자까지 입력 가능합니다`
    }

    // 목표 시간 검증
    if (formData.targetDuration &&
        (formData.targetDuration < VALIDATION_RULES.targetDuration.min ||
         formData.targetDuration > VALIDATION_RULES.targetDuration.max)) {
      errors.targetDuration = `목표 시간은 ${VALIDATION_RULES.targetDuration.min / 60}분~${VALIDATION_RULES.targetDuration.max / 60}분 사이로 설정해주세요`
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [formData])

  /**
   * 프리셋 적용
   */
  const handlePresetSelect = useCallback(async (presetKey: string) => {
    if (disabled || isGenerating) return

    const preset = PRESET_TEMPLATES[presetKey]
    if (!preset) return

    // 기존 값 유지하면서 프리셋 값 병합
    setFormData(prev => ({
      ...prev,
      ...preset,
      // 제목과 로그라인은 유지
      title: prev.title,
      logline: prev.logline,
    }))

    logger.info('프리셋 적용', { presetKey, preset })
  }, [disabled, isGenerating])

  /**
   * 폼 제출 처리
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm() || isGenerating || disabled) {
      return
    }

    try {
      await onSubmit?.(formData)
      logger.info('기획 입력 데이터 제출', { formData })
    } catch (error) {
      logger.error('기획 입력 데이터 제출 실패', {
        error: error instanceof Error ? error.message : String(error),
        formData,
      })
    }
  }, [validateForm, isGenerating, disabled, onSubmit, formData])

  /**
   * 예상 완성 시간 계산
   */
  const estimatedCompletionTime = useMemo(() => {
    if (!formData.title || !formData.logline) return null

    // 복잡도 기반 예상 시간 계산 (분 단위)
    const baseTime = 3 // 기본 3분
    const complexityFactor = formData.intensity === 'high' ? 1.5 : formData.intensity === 'low' ? 0.8 : 1
    const durationFactor = Math.min(formData.targetDuration ? formData.targetDuration / 600 : 1, 2)

    return Math.ceil(baseTime * complexityFactor * durationFactor)
  }, [formData.title, formData.logline, formData.intensity, formData.targetDuration])

  return (
    <Card className={`p-6 ${className}`} data-testid="story-input-form">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            1단계: 기본 정보 입력
          </h2>
          <p className="text-gray-600">
            영상의 기본 컨셉과 방향성을 설정해주세요
          </p>
        </div>

        {/* 진행률 표시 */}
        {isGenerating && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-primary-600">
                AI가 스토리를 생성하고 있습니다...
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: '45%' }}
                role="progressbar"
                aria-valuenow={45}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="스토리 생성 진행률"
              />
            </div>
          </div>
        )}

        {/* 프리셋 버튼 그룹 */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            빠른 시작 (프리셋)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {Object.entries(PRESET_TEMPLATES).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => handlePresetSelect(key)}
                disabled={disabled || isGenerating}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid={`preset-${key}`}
              >
                {key === 'drama' && '드라마'}
                {key === 'action' && '액션'}
                {key === 'romance' && '로맨스'}
                {key === 'comedy' && '코미디'}
                {key === 'education' && '교육'}
                {key === 'marketing' && '마케팅'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            프리셋을 선택하면 아래 옵션이 자동으로 설정됩니다
          </p>
        </div>

        {/* 기본 정보 */}
        <div className="grid grid-cols-1 gap-6">
          {/* 제목 */}
          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
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
              maxLength={VALIDATION_RULES.title.maxLength}
              required
              data-testid="story-title-input"
            />
            {validationErrors.title && (
              <p className="text-sm text-red-600" role="alert">
                {validationErrors.title}
              </p>
            )}
          </div>

          {/* 로그라인 */}
          <div className="space-y-2">
            <label htmlFor="logline" className="block text-sm font-medium text-gray-700">
              로그라인 (한 줄 스토리) *
            </label>
            <Textarea
              id="logline"
              value={formData.logline}
              onChange={(e) => updateFormData('logline', e.target.value)}
              placeholder="한 문장으로 영상의 핵심 내용을 설명해주세요. 예: 평범한 대학생이 첫 해외여행에서 겪는 좌충우돌 어드벤처"
              disabled={disabled || isGenerating}
              rows={3}
              className={validationErrors.logline ? 'border-red-500' : ''}
              maxLength={VALIDATION_RULES.logline.maxLength}
              required
              data-testid="story-logline-input"
            />
            {validationErrors.logline && (
              <p className="text-sm text-red-600" role="alert">
                {validationErrors.logline}
              </p>
            )}
            <p className="text-xs text-gray-500">
              {formData.logline.length}/{VALIDATION_RULES.logline.maxLength}자
            </p>
          </div>
        </div>

        {/* 드롭다운 옵션들 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 톤앤매너 */}
          <div className="space-y-2">
            <label htmlFor="toneAndManner" className="block text-sm font-medium text-gray-700">
              톤앤매너
            </label>
            <Select
              id="toneAndManner"
              value={formData.toneAndManner}
              onChange={(value) => updateFormData('toneAndManner', value as ToneAndManner)}
              disabled={disabled || isGenerating}
              data-testid="tone-manner-select"
            >
              {TONE_AND_MANNER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </Select>
          </div>

          {/* 전개방식 */}
          <div className="space-y-2">
            <label htmlFor="development" className="block text-sm font-medium text-gray-700">
              전개방식
            </label>
            <Select
              id="development"
              value={formData.development}
              onChange={(value) => updateFormData('development', value as StoryDevelopment)}
              disabled={disabled || isGenerating}
              data-testid="development-select"
            >
              {DEVELOPMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </Select>
          </div>

          {/* 강도 */}
          <div className="space-y-2">
            <label htmlFor="intensity" className="block text-sm font-medium text-gray-700">
              강도
            </label>
            <Select
              id="intensity"
              value={formData.intensity}
              onChange={(value) => updateFormData('intensity', value as StoryIntensity)}
              disabled={disabled || isGenerating}
              data-testid="intensity-select"
            >
              {INTENSITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* 목표 시간 설정 */}
        <div className="space-y-3">
          <label htmlFor="targetDuration" className="block text-sm font-medium text-gray-700">
            목표 시간
          </label>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                id="targetDuration"
                type="range"
                min="60"
                max="3600"
                step="60"
                value={formData.targetDuration || 600}
                onChange={(e) => updateFormData('targetDuration', parseInt(e.target.value))}
                disabled={disabled || isGenerating}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                data-testid="target-duration-slider"
              />
            </div>
            <div className="min-w-[80px] text-center">
              <span className="text-sm font-medium text-gray-900 block">
                {Math.floor((formData.targetDuration || 600) / 60)}분
              </span>
            </div>
          </div>
        </div>

        {/* 고급 설정 */}
        <div className="border-t pt-6">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            aria-expanded={showAdvanced}
            data-testid="toggle-advanced-settings"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            고급 설정
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label htmlFor="additionalNotes" className="block text-sm font-medium text-gray-700">
                  추가 요청사항
                </label>
                <Textarea
                  id="additionalNotes"
                  value={formData.additionalNotes || ''}
                  onChange={(e) => updateFormData('additionalNotes', e.target.value)}
                  placeholder="특별한 요구사항이나 참고사항을 입력해주세요"
                  disabled={disabled || isGenerating}
                  rows={3}
                  maxLength={500}
                />
              </div>
            </div>
          )}
        </div>

        {/* 예상 완성 시간 */}
        {estimatedCompletionTime && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-blue-800">
                  예상 완성 시간
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  약 {estimatedCompletionTime}분 후 4단계 스토리가 완성됩니다
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 제출 버튼 */}
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={disabled || isGenerating || !formData.title.trim() || !formData.logline.trim()}
            className="flex-1"
            data-testid="generate-story-button"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                스토리 생성 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                4단계 스토리 생성
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
})

PlanningInputForm.displayName = 'PlanningInputForm'