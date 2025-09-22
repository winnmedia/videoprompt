/**
 * StoryInputForm Widget
 *
 * 영상 기획 1단계: 입력/선택 폼 컴포넌트
 * CLAUDE.md 준수: FSD widgets 레이어, 접근성 WCAG 2.1 AA, React 19
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { z } from 'zod'

import type {
  PlanningInputData,
  ToneAndManner,
  StoryDevelopment,
  StoryIntensity,
  PLANNING_BUSINESS_RULES,
} from '../../entities/planning'

import { validatePlanningInput } from '../../entities/planning'
import { Button, Card, Input, Select, Textarea, RadioGroup } from '../../shared/ui'
import logger from '../../shared/lib/logger'

/**
 * 폼 속성
 */
export interface StoryInputFormProps {
  defaultValues?: Partial<PlanningInputData>
  onSubmit?: (inputData: PlanningInputData) => void
  onUseTemplate?: () => void
  onDraftSave?: (inputData: Partial<PlanningInputData>) => void
  isGenerating?: boolean
  disabled?: boolean
  className?: string
}

/**
 * 폼 검증 스키마
 */
const formSchema = z.object({
  title: z.string()
    .min(1, '제목을 입력해주세요')
    .max(PLANNING_BUSINESS_RULES.MAX_TITLE_LENGTH, `제목은 ${PLANNING_BUSINESS_RULES.MAX_TITLE_LENGTH}자를 초과할 수 없습니다`),

  logline: z.string()
    .min(1, '한 줄 스토리를 입력해주세요')
    .max(PLANNING_BUSINESS_RULES.MAX_LOGLINE_LENGTH, `한 줄 스토리는 ${PLANNING_BUSINESS_RULES.MAX_LOGLINE_LENGTH}자를 초과할 수 없습니다`),

  toneAndManner: z.enum(['casual', 'professional', 'creative', 'educational', 'marketing']),

  development: z.enum(['linear', 'dramatic', 'problem_solution', 'comparison', 'tutorial']),

  intensity: z.enum(['low', 'medium', 'high']),

  targetDuration: z.number().min(30, '최소 30초 이상이어야 합니다').max(600, '최대 10분을 초과할 수 없습니다').optional(),

  additionalNotes: z.string().max(PLANNING_BUSINESS_RULES.MAX_DESCRIPTION_LENGTH).optional(),
})

/**
 * 톤앤매너 옵션
 */
const toneAndMannerOptions: Array<{ value: ToneAndManner; label: string; description: string }> = [
  { value: 'casual', label: '캐주얼', description: '친근하고 편안한 분위기' },
  { value: 'professional', label: '전문적', description: '신뢰감 있는 비즈니스 톤' },
  { value: 'creative', label: '창의적', description: '독창적이고 실험적인 표현' },
  { value: 'educational', label: '교육적', description: '학습과 이해에 중점' },
  { value: 'marketing', label: '마케팅', description: '설득력 있는 홍보 톤' },
]

/**
 * 전개 방식 옵션
 */
const developmentOptions: Array<{ value: StoryDevelopment; label: string; description: string }> = [
  { value: 'linear', label: '선형적', description: '순차적으로 자연스럽게 전개' },
  { value: 'dramatic', label: '드라마틱', description: '긴장감과 감정적 몰입 유도' },
  { value: 'problem_solution', label: '문제-해결', description: '문제 제기 후 해결책 제시' },
  { value: 'comparison', label: '비교', description: '대조를 통한 차이점 강조' },
  { value: 'tutorial', label: '튜토리얼', description: '단계별 학습과 따라하기' },
]

/**
 * 스토리 강도 옵션
 */
const intensityOptions: Array<{ value: StoryIntensity; label: string; description: string }> = [
  { value: 'low', label: '차분함', description: '부드럽고 안정적인 전개' },
  { value: 'medium', label: '보통', description: '적절한 리듬감 유지' },
  { value: 'high', label: '역동적', description: '빠른 템포와 강한 임팩트' },
]

/**
 * 스토리 입력 폼 컴포넌트
 */
export function StoryInputForm({
  defaultValues,
  onSubmit,
  onUseTemplate,
  onDraftSave,
  isGenerating = false,
  disabled = false,
  className = '',
}: StoryInputFormProps) {
  // 폼 상태
  const [formData, setFormData] = useState<Partial<PlanningInputData>>(() => ({
    title: '',
    logline: '',
    toneAndManner: 'professional',
    development: 'linear',
    intensity: 'medium',
    targetDuration: 180, // 3분 기본값
    additionalNotes: '',
    ...defaultValues,
  }))

  // 검증 에러
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 자동 저장을 위한 타이머
  const draftSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 폼 유효성 검사
  const validation = useMemo(() => {
    if (!formData.title && !formData.logline) {
      return { isValid: false, errors: {} } // 빈 폼은 검증 안 함
    }

    try {
      formSchema.parse(formData)
      return { isValid: true, errors: {} }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.errors.forEach(err => {
          const field = err.path[0] as string
          fieldErrors[field] = err.message
        })
        return { isValid: false, errors: fieldErrors }
      }
      return { isValid: false, errors: {} }
    }
  }, [formData])

  // 완성도 계산
  const completionPercentage = useMemo(() => {
    const fields = ['title', 'logline', 'toneAndManner', 'development', 'intensity']
    const completed = fields.filter(field => {
      const value = formData[field as keyof PlanningInputData]
      return value && String(value).trim() !== ''
    }).length
    return Math.round((completed / fields.length) * 100)
  }, [formData])

  /**
   * 폼 데이터 업데이트
   */
  const handleChange = useCallback((field: keyof PlanningInputData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // 해당 필드 에러 클리어
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }

    // 자동 저장 타이머 설정 - $300 사건 방지: 1회만 실행
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current)
    }

    draftSaveTimerRef.current = setTimeout(() => {
      onDraftSave?.({ ...formData, [field]: value })
    }, 2000) // 2초 후 자동 저장

    logger.debug('폼 필드 업데이트', { field, value: typeof value === 'string' ? value.slice(0, 50) : value })
  }, [formData, errors, onDraftSave])

  /**
   * 폼 제출
   */
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault()

    // 클라이언트 검증
    if (!validation.isValid) {
      setErrors(validation.errors)
      return
    }

    // 엔티티 레벨 검증
    const entityValidation = validatePlanningInput(formData as PlanningInputData)
    if (!entityValidation.isValid) {
      const fieldErrors: Record<string, string> = {}
      entityValidation.errors.forEach(error => {
        fieldErrors.general = error.message
      })
      setErrors(fieldErrors)
      return
    }

    try {
      await onSubmit?.(formData as PlanningInputData)

      logger.info('스토리 입력 폼 제출', {
        title: formData.title,
        toneAndManner: formData.toneAndManner,
        development: formData.development,
        loglineLength: formData.logline?.length || 0,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '제출 실패'
      setErrors({ general: errorMessage })

      logger.error('스토리 입력 폼 제출 실패', {
        error: errorMessage,
        formData,
      })
    }
  }, [formData, validation, onSubmit])

  /**
   * 기본 템플릿 사용
   */
  const handleUseTemplate = useCallback(() => {
    onUseTemplate?.()

    logger.info('기본 템플릿 사용', {
      currentFormData: formData,
    })
  }, [onUseTemplate, formData])

  /**
   * 컴포넌트 언마운트 시 타이머 정리
   */
  useEffect(() => {
    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current)
      }
    }
  }, [])

  const isFormDisabled = disabled || isGenerating

  return (
    <Card className={`story-input-form ${className}`}>
      <div className="p-6">
        {/* 헤더 */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            영상 기획 시작하기
          </h2>
          <p className="text-gray-600">
            기본 정보를 입력하면 AI가 4단계 스토리를 생성해드립니다.
          </p>

          {/* 진행률 표시 */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>입력 완성도</span>
              <span>{completionPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 전체 에러 메시지 */}
          {errors.general && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {errors.general}
            </div>
          )}

          {/* 제목 */}
          <div>
            <Input
              label="영상 제목"
              placeholder="예: 우리 회사 신제품 소개 영상"
              value={formData.title || ''}
              onChange={(value) => handleChange('title', value)}
              error={errors.title}
              disabled={isFormDisabled}
              required
              maxLength={PLANNING_BUSINESS_RULES.MAX_TITLE_LENGTH}
              aria-describedby="title-help"
            />
            <p id="title-help" className="mt-1 text-sm text-gray-500">
              시청자에게 어떤 영상인지 명확히 알려주는 제목을 입력하세요
            </p>
          </div>

          {/* 한 줄 스토리 (로그라인) */}
          <div>
            <Textarea
              label="한 줄 스토리 (로그라인)"
              placeholder="예: 혁신적인 기술력으로 만든 신제품의 특징과 장점을 고객의 관점에서 소개하는 영상"
              value={formData.logline || ''}
              onChange={(value) => handleChange('logline', value)}
              error={errors.logline}
              disabled={isFormDisabled}
              required
              rows={3}
              maxLength={PLANNING_BUSINESS_RULES.MAX_LOGLINE_LENGTH}
              aria-describedby="logline-help"
            />
            <p id="logline-help" className="mt-1 text-sm text-gray-500">
              영상의 핵심 메시지와 목적을 한 문장으로 요약해주세요
            </p>
          </div>

          {/* 톤앤매너 */}
          <div>
            <Select
              label="톤앤매너"
              options={toneAndMannerOptions}
              value={formData.toneAndManner || 'professional'}
              onChange={(value) => handleChange('toneAndManner', value)}
              disabled={isFormDisabled}
              required
              aria-describedby="tone-help"
            />
            <p id="tone-help" className="mt-1 text-sm text-gray-500">
              영상의 전체적인 분위기와 표현 방식을 선택하세요
            </p>
          </div>

          {/* 전개 방식 */}
          <div>
            <RadioGroup
              label="전개 방식"
              options={developmentOptions}
              value={formData.development || 'linear'}
              onChange={(value) => handleChange('development', value)}
              disabled={isFormDisabled}
              required
              aria-describedby="development-help"
            />
            <p id="development-help" className="mt-1 text-sm text-gray-500">
              스토리를 어떤 구조로 전개할지 선택하세요
            </p>
          </div>

          {/* 스토리 강도 */}
          <div>
            <RadioGroup
              label="스토리 강도"
              options={intensityOptions}
              value={formData.intensity || 'medium'}
              onChange={(value) => handleChange('intensity', value)}
              disabled={isFormDisabled}
              required
              aria-describedby="intensity-help"
            />
            <p id="intensity-help" className="mt-1 text-sm text-gray-500">
              영상의 리듬감과 임팩트 수준을 선택하세요
            </p>
          </div>

          {/* 목표 시간 */}
          <div>
            <Input
              type="number"
              label="목표 시간 (초)"
              placeholder="180"
              value={formData.targetDuration || ''}
              onChange={(value) => handleChange('targetDuration', Number(value))}
              error={errors.targetDuration}
              disabled={isFormDisabled}
              min={30}
              max={600}
              aria-describedby="duration-help"
            />
            <p id="duration-help" className="mt-1 text-sm text-gray-500">
              완성할 영상의 목표 길이를 초 단위로 입력하세요 (30초~10분)
            </p>
          </div>

          {/* 추가 요청사항 */}
          <div>
            <Textarea
              label="추가 요청사항 (선택)"
              placeholder="예: 젊은 층을 타겟으로 하며, 밝고 역동적인 느낌으로 제작해주세요"
              value={formData.additionalNotes || ''}
              onChange={(value) => handleChange('additionalNotes', value)}
              disabled={isFormDisabled}
              rows={3}
              maxLength={PLANNING_BUSINESS_RULES.MAX_DESCRIPTION_LENGTH}
              aria-describedby="notes-help"
            />
            <p id="notes-help" className="mt-1 text-sm text-gray-500">
              특별한 요구사항이나 고려사항이 있으면 자유롭게 작성하세요
            </p>
          </div>

          {/* 액션 버튼 */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={!validation.isValid || isFormDisabled}
              loading={isGenerating}
              className="flex-1"
            >
              {isGenerating ? 'AI 스토리 생성 중...' : '4단계 스토리 생성하기'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleUseTemplate}
              disabled={isFormDisabled}
              className="sm:w-auto"
            >
              기본 템플릿 사용
            </Button>
          </div>

          {/* 안내 메시지 */}
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            <p className="font-medium mb-1">💡 팁:</p>
            <ul className="space-y-1">
              <li>• 구체적이고 명확한 정보를 입력할수록 더 정확한 스토리가 생성됩니다</li>
              <li>• 생성된 스토리는 언제든지 수정하고 개선할 수 있습니다</li>
              <li>• 작성 중인 내용은 자동으로 임시 저장됩니다</li>
            </ul>
          </div>
        </form>
      </div>
    </Card>
  )
}

export default StoryInputForm