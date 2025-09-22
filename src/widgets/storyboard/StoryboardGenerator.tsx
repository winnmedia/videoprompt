/**
 * StoryboardGenerator Widget
 *
 * 12개 숏트 기반 스토리보드 이미지 생성 UI 컴포넌트
 * CLAUDE.md 준수: FSD widgets 레이어, 접근성 WCAG 2.1 AA, React 19
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Button, Card, Input, Select } from '../../shared/ui'
import logger from '../../shared/lib/logger'

/**
 * 스토리보드 생성 요청 타입
 */
export interface StoryboardGenerationRequest {
  title: string
  shots: Array<{
    id: string
    description: string
    shotType: 'wide' | 'medium' | 'close' | 'extreme-close'
    angle: 'eye-level' | 'high' | 'low' | 'bird' | 'worm'
    composition: 'center' | 'rule-of-thirds' | 'frame-in-frame' | 'leading-lines'
  }>
  style: 'pencil' | 'rough' | 'monochrome' | 'colored'
  quality: 'draft' | 'standard' | 'high'
  consistencyLevel: number // 1-10
  referenceImage?: File | null
}

/**
 * 스토리보드 생성기 속성
 */
export interface StoryboardGeneratorProps {
  scenarioTitle?: string
  initialShots?: Array<{
    id: string
    description: string
    shotType?: string
    angle?: string
    composition?: string
  }>
  onGenerate?: (request: StoryboardGenerationRequest) => void
  onCancel?: () => void
  onError?: (error: string) => void
  className?: string
  disabled?: boolean
  isGenerating?: boolean
  progress?: number
  currentStep?: string
}

/**
 * 기본 12개 숏트 템플릿
 */
const defaultShots = [
  { id: '1', description: '오프닝 숏 - 전체적인 상황 설정', shotType: 'wide', angle: 'eye-level', composition: 'center' },
  { id: '2', description: '주인공 등장 - 캐릭터 소개', shotType: 'medium', angle: 'eye-level', composition: 'rule-of-thirds' },
  { id: '3', description: '환경 설정 - 배경과 분위기', shotType: 'wide', angle: 'high', composition: 'leading-lines' },
  { id: '4', description: '감정 표현 - 주인공의 반응', shotType: 'close', angle: 'eye-level', composition: 'center' },
  { id: '5', description: '액션 시작 - 주요 사건 발생', shotType: 'medium', angle: 'low', composition: 'rule-of-thirds' },
  { id: '6', description: '디테일 포커스 - 중요한 요소', shotType: 'extreme-close', angle: 'eye-level', composition: 'frame-in-frame' },
  { id: '7', description: '상호작용 - 캐릭터 간 관계', shotType: 'medium', angle: 'eye-level', composition: 'rule-of-thirds' },
  { id: '8', description: '전환점 - 갈등 또는 변화', shotType: 'close', angle: 'high', composition: 'center' },
  { id: '9', description: '클라이맥스 - 가장 중요한 순간', shotType: 'wide', angle: 'bird', composition: 'leading-lines' },
  { id: '10', description: '해결 과정 - 문제 해결', shotType: 'medium', angle: 'eye-level', composition: 'rule-of-thirds' },
  { id: '11', description: '감정적 마무리 - 결과와 여운', shotType: 'close', angle: 'eye-level', composition: 'center' },
  { id: '12', description: '엔딩 숏 - 전체적인 마무리', shotType: 'wide', angle: 'eye-level', composition: 'center' }
]

/**
 * 스토리보드 생성기 컴포넌트
 */
export function StoryboardGenerator({
  scenarioTitle = '',
  initialShots = [],
  onGenerate,
  onCancel,
  onError,
  className = '',
  disabled = false,
  isGenerating = false,
  progress = 0,
  currentStep = ''
}: StoryboardGeneratorProps) {
  // 폼 상태 관리
  const [title, setTitle] = useState(scenarioTitle)
  const [shots, setShots] = useState(() => {
    if (initialShots.length > 0) {
      return initialShots.map((shot, index) => ({
        ...shot,
        shotType: (shot.shotType as any) || defaultShots[index]?.shotType || 'medium',
        angle: (shot.angle as any) || defaultShots[index]?.angle || 'eye-level',
        composition: (shot.composition as any) || defaultShots[index]?.composition || 'center'
      }))
    }
    return defaultShots
  })

  const [style, setStyle] = useState<'pencil' | 'rough' | 'monochrome' | 'colored'>('pencil')
  const [quality, setQuality] = useState<'draft' | 'standard' | 'high'>('standard')
  const [consistencyLevel, setConsistencyLevel] = useState(5)
  const [referenceImage, setReferenceImage] = useState<File | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  /**
   * 숏트 업데이트
   */
  const updateShot = useCallback((index: number, field: string, value: string) => {
    setShots(prev => prev.map((shot, i) =>
      i === index ? { ...shot, [field]: value } : shot
    ))

    // 해당 필드 에러 제거
    const errorKey = `shot-${index}-${field}`
    if (validationErrors[errorKey]) {
      setValidationErrors(prev => {
        const { [errorKey]: removed, ...rest } = prev
        return rest
      })
    }
  }, [validationErrors])

  /**
   * 폼 검증
   */
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {}

    if (!title.trim()) {
      errors.title = '스토리보드 제목을 입력해주세요.'
    } else if (title.length > 100) {
      errors.title = '제목은 100자 이하로 입력해주세요.'
    }

    shots.forEach((shot, index) => {
      if (!shot.description.trim()) {
        errors[`shot-${index}-description`] = `${index + 1}번 숏트 설명을 입력해주세요.`
      } else if (shot.description.length > 200) {
        errors[`shot-${index}-description`] = `${index + 1}번 숏트 설명은 200자 이하로 입력해주세요.`
      }
    })

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [title, shots])

  /**
   * 생성 요청 처리
   */
  const handleGenerate = useCallback(async () => {
    if (!validateForm() || isGenerating) {
      return
    }

    const request: StoryboardGenerationRequest = {
      title,
      shots: shots.map(shot => ({
        ...shot,
        shotType: shot.shotType as any,
        angle: shot.angle as any,
        composition: shot.composition as any
      })),
      style,
      quality,
      consistencyLevel,
      referenceImage
    }

    try {
      onGenerate?.(request)
      logger.info('스토리보드 생성 요청', {
        title,
        shotsCount: shots.length,
        style,
        quality,
        consistencyLevel
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '스토리보드 생성 요청 중 오류가 발생했습니다.'
      onError?.(errorMessage)
      logger.error('스토리보드 생성 요청 실패', { error: errorMessage })
    }
  }, [title, shots, style, quality, consistencyLevel, referenceImage, validateForm, isGenerating, onGenerate, onError])

  /**
   * 취소 처리
   */
  const handleCancel = useCallback(() => {
    if (window.confirm('스토리보드 생성을 취소하시겠습니까? 입력한 내용이 사라집니다.')) {
      onCancel?.()
    }
  }, [onCancel])

  /**
   * 참조 이미지 업로드 처리
   */
  const handleReferenceImageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // 이미지 파일 검증
      if (!file.type.startsWith('image/')) {
        onError?.('이미지 파일만 업로드할 수 있습니다.')
        return
      }

      // 파일 크기 검증 (10MB 제한)
      if (file.size > 10 * 1024 * 1024) {
        onError?.('이미지 파일 크기는 10MB 이하여야 합니다.')
        return
      }

      setReferenceImage(file)
      logger.debug('참조 이미지 업로드', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      })
    }
  }, [onError])

  /**
   * 예상 생성 시간 계산
   */
  const estimatedTime = useMemo(() => {
    const baseTime = quality === 'draft' ? 2 : quality === 'standard' ? 5 : 10 // 분
    const consistencyMultiplier = 1 + (consistencyLevel / 10)
    return Math.ceil(baseTime * consistencyMultiplier)
  }, [quality, consistencyLevel])

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-900">
            스토리보드 생성
          </h2>

          {isGenerating && (
            <div className="flex items-center gap-2 text-primary-600">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">
                {currentStep === 'preparing' && '준비 중...'}
                {currentStep === 'analyzing' && '시나리오 분석 중...'}
                {currentStep === 'generating' && '이미지 생성 중...'}
                {currentStep === 'optimizing' && '일관성 최적화 중...'}
                {currentStep === 'finalizing' && '마무리 중...'}
                {!currentStep && '생성 중...'}
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
              aria-label="스토리보드 생성 진행률"
            />
            <div className="text-xs text-neutral-600 mt-1 text-center">
              {progress}% 완료 (예상 시간: {estimatedTime}분)
            </div>
          </div>
        )}

        {/* 기본 설정 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="storyboard-title" className="block text-sm font-medium text-neutral-700">
              스토리보드 제목 *
            </label>
            <Input
              id="storyboard-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 브이로그 영상 스토리보드"
              disabled={disabled || isGenerating}
              className={validationErrors.title ? 'border-red-500' : ''}
              maxLength={100}
              required
              data-testid="storyboard-title-input"
            />
            {validationErrors.title && (
              <p className="text-sm text-red-600" role="alert">
                {validationErrors.title}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label htmlFor="storyboard-style" className="block text-sm font-medium text-neutral-700">
                스타일
              </label>
              <Select
                id="storyboard-style"
                value={style}
                onChange={(value) => setStyle(value as any)}
                disabled={disabled || isGenerating}
                data-testid="storyboard-style-select"
              >
                <option value="pencil">연필 스케치</option>
                <option value="rough">러프 스케치</option>
                <option value="monochrome">흑백</option>
                <option value="colored">컬러</option>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="storyboard-quality" className="block text-sm font-medium text-neutral-700">
                품질
              </label>
              <Select
                id="storyboard-quality"
                value={quality}
                onChange={(value) => setQuality(value as any)}
                disabled={disabled || isGenerating}
                data-testid="storyboard-quality-select"
              >
                <option value="draft">초안 (빠름)</option>
                <option value="standard">표준 (권장)</option>
                <option value="high">고품질 (느림)</option>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="consistency-level" className="block text-sm font-medium text-neutral-700">
                일관성 레벨: {consistencyLevel}
              </label>
              <input
                id="consistency-level"
                type="range"
                min="1"
                max="10"
                step="1"
                value={consistencyLevel}
                onChange={(e) => setConsistencyLevel(parseInt(e.target.value))}
                disabled={disabled || isGenerating}
                className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                aria-valuemin={1}
                aria-valuemax={10}
                aria-valuenow={consistencyLevel}
                aria-label={`일관성 레벨 ${consistencyLevel}/10`}
                data-testid="consistency-level-slider"
              />
              <div className="flex justify-between text-xs text-neutral-500">
                <span>낮음 (빠름)</span>
                <span>높음 (느림)</span>
              </div>
            </div>
          </div>

          {/* 참조 이미지 */}
          <div className="space-y-2">
            <label htmlFor="reference-image" className="block text-sm font-medium text-neutral-700">
              참조 이미지 (선택사항)
            </label>
            <div className="flex items-center gap-4">
              <input
                id="reference-image"
                type="file"
                accept="image/*"
                onChange={handleReferenceImageChange}
                disabled={disabled || isGenerating}
                className="text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
                data-testid="reference-image-input"
              />
              {referenceImage && (
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {referenceImage.name}
                  <button
                    type="button"
                    onClick={() => setReferenceImage(null)}
                    className="text-red-600 hover:text-red-800 focus:outline-none"
                    aria-label="참조 이미지 제거"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 12개 숏트 설정 */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-neutral-900">
            스토리보드 구성 (12개 숏트)
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {shots.map((shot, index) => (
              <Card key={shot.id} className="p-4 bg-neutral-50">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium text-white bg-primary-600 rounded-full">
                      {index + 1}
                    </span>
                    <h4 className="text-sm font-medium text-neutral-800">
                      숏트 {index + 1}
                    </h4>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor={`shot-${index}-description`} className="block text-xs font-medium text-neutral-700">
                      설명 *
                    </label>
                    <textarea
                      id={`shot-${index}-description`}
                      value={shot.description}
                      onChange={(e) => updateShot(index, 'description', e.target.value)}
                      placeholder="이 숏트에서 보여줄 내용을 설명해주세요"
                      disabled={disabled || isGenerating}
                      className={`w-full px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed ${
                        validationErrors[`shot-${index}-description`] ? 'border-red-500' : 'border-neutral-300'
                      }`}
                      rows={2}
                      maxLength={200}
                      required
                      data-testid={`shot-${index}-description`}
                    />
                    {validationErrors[`shot-${index}-description`] && (
                      <p className="text-xs text-red-600" role="alert">
                        {validationErrors[`shot-${index}-description`]}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label htmlFor={`shot-${index}-shotType`} className="block text-xs font-medium text-neutral-700">
                        숏트 타입
                      </label>
                      <select
                        id={`shot-${index}-shotType`}
                        value={shot.shotType}
                        onChange={(e) => updateShot(index, 'shotType', e.target.value)}
                        disabled={disabled || isGenerating}
                        className="w-full px-2 py-1 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
                        data-testid={`shot-${index}-shotType`}
                      >
                        <option value="wide">와이드</option>
                        <option value="medium">미디엄</option>
                        <option value="close">클로즈업</option>
                        <option value="extreme-close">익스트림 클로즈업</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor={`shot-${index}-angle`} className="block text-xs font-medium text-neutral-700">
                        앵글
                      </label>
                      <select
                        id={`shot-${index}-angle`}
                        value={shot.angle}
                        onChange={(e) => updateShot(index, 'angle', e.target.value)}
                        disabled={disabled || isGenerating}
                        className="w-full px-2 py-1 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
                        data-testid={`shot-${index}-angle`}
                      >
                        <option value="eye-level">아이 레벨</option>
                        <option value="high">하이 앵글</option>
                        <option value="low">로우 앵글</option>
                        <option value="bird">버드 뷰</option>
                        <option value="worm">웜 뷰</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor={`shot-${index}-composition`} className="block text-xs font-medium text-neutral-700">
                        구도
                      </label>
                      <select
                        id={`shot-${index}-composition`}
                        value={shot.composition}
                        onChange={(e) => updateShot(index, 'composition', e.target.value)}
                        disabled={disabled || isGenerating}
                        className="w-full px-2 py-1 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
                        data-testid={`shot-${index}-composition`}
                      >
                        <option value="center">센터</option>
                        <option value="rule-of-thirds">3분할</option>
                        <option value="frame-in-frame">프레임 인 프레임</option>
                        <option value="leading-lines">리딩 라인</option>
                      </select>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={disabled || isGenerating || !title.trim()}
            className="flex-1"
            data-testid="generate-storyboard-button"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                생성 중... ({progress}%)
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                스토리보드 생성 시작
              </>
            )}
          </Button>

          {(isGenerating || onCancel) && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={disabled}
              data-testid="cancel-generation-button"
            >
              {isGenerating ? '중단' : '취소'}
            </Button>
          )}
        </div>

        {/* 비용/시간 정보 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-800">
                생성 정보
              </h3>
              <div className="text-sm text-blue-700 mt-1 space-y-1">
                <p>• 예상 시간: {estimatedTime}분</p>
                <p>• 품질: {
                  quality === 'draft' ? '초안 (빠름)' :
                  quality === 'standard' ? '표준 (권장)' :
                  '고품질 (느림)'
                }</p>
                <p>• 일관성 레벨: {consistencyLevel}/10</p>
                <p>• 총 이미지 수: 12개</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}