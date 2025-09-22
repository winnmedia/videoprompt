/**
 * StoryStepEditor Widget
 *
 * 영상 기획 2단계: 4단계 스토리 검토/수정 컴포넌트
 * CLAUDE.md 준수: FSD widgets 레이어, 접근성 WCAG 2.1 AA, React 19
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

import type {
  StoryStep,
  PlanningInputData,
  PLANNING_BUSINESS_RULES,
} from '../../entities/planning'

import { validateStorySteps, reorderStorySteps } from '../../entities/planning'
import { Button, Card, Input, Textarea, Badge } from '../../shared/ui'
import { DragDropList } from '../../shared/ui/DragDropList'
import { TimeDisplay } from '../../shared/ui/TimeDisplay'
import logger from '../../shared/lib/logger'

/**
 * 에디터 속성
 */
export interface StoryStepEditorProps {
  storySteps: StoryStep[]
  inputData: PlanningInputData
  onChange?: (storySteps: StoryStep[]) => void
  onGenerateShots?: () => void
  onRegenerate?: (improvementPrompt: string) => void
  isGenerating?: boolean
  disabled?: boolean
  className?: string
}

/**
 * 스토리 스텝 편집 상태
 */
interface EditingState {
  stepId: string | null
  field: 'title' | 'description' | 'duration' | 'keyPoints' | null
}

/**
 * 4단계 스토리 에디터 컴포넌트
 */
export function StoryStepEditor({
  storySteps,
  inputData,
  onChange,
  onGenerateShots,
  onRegenerate,
  isGenerating = false,
  disabled = false,
  className = '',
}: StoryStepEditorProps) {
  // 편집 상태
  const [editingState, setEditingState] = useState<EditingState>({
    stepId: null,
    field: null,
  })

  // 개선 요청 모달
  const [showImprovementModal, setShowImprovementModal] = useState(false)
  const [improvementPrompt, setImprovementPrompt] = useState('')

  // 로컬 스텝 상태 (편집 중 임시 저장)
  const [localSteps, setLocalSteps] = useState<StoryStep[]>(storySteps)

  // 자동 저장 타이머
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 스텝 변경 시 로컬 상태 동기화
  useEffect(() => {
    setLocalSteps(storySteps)
  }, [storySteps])

  // 검증 결과
  const validation = useMemo(() => {
    return validateStorySteps(localSteps)
  }, [localSteps])

  // 총 시간 계산
  const totalDuration = useMemo(() => {
    return localSteps.reduce((sum, step) => sum + (step.duration || 0), 0)
  }, [localSteps])

  // 평균 시간 계산
  const averageDuration = useMemo(() => {
    return Math.round(totalDuration / Math.max(localSteps.length, 1))
  }, [totalDuration, localSteps.length])

  /**
   * 자동 저장 트리거
   */
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // $300 사건 방지: 1회만 실행
    autoSaveTimerRef.current = setTimeout(() => {
      if (validation.isValid) {
        onChange?.(localSteps)
        logger.debug('스토리 스텝 자동 저장', {
          stepsCount: localSteps.length,
          totalDuration,
        })
      }
    }, 1000) // 1초 후 저장
  }, [localSteps, validation.isValid, onChange, totalDuration])

  /**
   * 스텝 업데이트
   */
  const updateStep = useCallback((stepId: string, updates: Partial<StoryStep>) => {
    setLocalSteps(prev => {
      const updated = prev.map(step =>
        step.id === stepId ? { ...step, ...updates } : step
      )
      return updated
    })

    triggerAutoSave()

    logger.debug('스토리 스텝 업데이트', {
      stepId,
      updates: Object.keys(updates),
    })
  }, [triggerAutoSave])

  /**
   * 편집 시작
   */
  const startEditing = useCallback((stepId: string, field: 'title' | 'description' | 'duration' | 'keyPoints') => {
    setEditingState({ stepId, field })
  }, [])

  /**
   * 편집 완료
   */
  const finishEditing = useCallback(() => {
    setEditingState({ stepId: null, field: null })
  }, [])

  /**
   * 스텝 순서 변경
   */
  const handleReorder = useCallback((reorderedSteps: StoryStep[]) => {
    const correctedSteps = reorderStorySteps(reorderedSteps)
    setLocalSteps(correctedSteps)
    triggerAutoSave()

    logger.info('스토리 스텝 순서 변경', {
      newOrder: correctedSteps.map(s => s.order),
    })
  }, [triggerAutoSave])

  /**
   * 키 포인트 추가
   */
  const addKeyPoint = useCallback((stepId: string) => {
    updateStep(stepId, {
      keyPoints: [...(localSteps.find(s => s.id === stepId)?.keyPoints || []), '새 포인트'],
    })
  }, [localSteps, updateStep])

  /**
   * 키 포인트 삭제
   */
  const removeKeyPoint = useCallback((stepId: string, index: number) => {
    const step = localSteps.find(s => s.id === stepId)
    if (step) {
      const newKeyPoints = step.keyPoints.filter((_, i) => i !== index)
      updateStep(stepId, { keyPoints: newKeyPoints })
    }
  }, [localSteps, updateStep])

  /**
   * 개선 요청 제출
   */
  const handleImprovementSubmit = useCallback(() => {
    if (improvementPrompt.trim()) {
      onRegenerate?.(improvementPrompt.trim())
      setShowImprovementModal(false)
      setImprovementPrompt('')

      logger.info('스토리 개선 요청', {
        promptLength: improvementPrompt.length,
      })
    }
  }, [improvementPrompt, onRegenerate])

  /**
   * 숏 생성 처리
   */
  const handleGenerateShots = useCallback(() => {
    if (!validation.isValid) {
      return
    }

    // 최신 상태 저장 후 숏 생성
    onChange?.(localSteps)
    onGenerateShots?.()

    logger.info('숏 생성 요청', {
      stepsCount: localSteps.length,
      totalDuration,
    })
  }, [validation.isValid, localSteps, onChange, onGenerateShots, totalDuration])

  /**
   * 컴포넌트 언마운트 시 타이머 정리
   */
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  const isFormDisabled = disabled || isGenerating

  return (
    <div className={`story-step-editor ${className}`}>
      {/* 헤더 */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          4단계 스토리 구성
        </h2>
        <p className="text-gray-600 mb-4">
          AI가 생성한 스토리를 검토하고 필요한 부분을 수정하세요.
        </p>

        {/* 통계 정보 */}
        <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">총 시간:</span>
            <TimeDisplay seconds={totalDuration} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">평균 시간:</span>
            <TimeDisplay seconds={averageDuration} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">목표 시간:</span>
            <TimeDisplay seconds={inputData.targetDuration || 180} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">상태:</span>
            <Badge variant={validation.isValid ? 'success' : 'warning'}>
              {validation.isValid ? '완료' : '수정 필요'}
            </Badge>
          </div>
        </div>
      </div>

      {/* 검증 에러 메시지 */}
      {!validation.isValid && validation.errors.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="font-medium text-amber-800 mb-2">수정이 필요한 항목:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-amber-700">
            {validation.errors.map((error, index) => (
              <li key={index}>{error.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 스토리 스텝 목록 */}
      <div className="space-y-6 mb-6">
        <DragDropList
          items={localSteps}
          onReorder={handleReorder}
          disabled={isFormDisabled}
          renderItem={(step, index) => (
            <Card key={step.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {step.order}
                  </div>
                  {editingState.stepId === step.id && editingState.field === 'title' ? (
                    <Input
                      value={step.title}
                      onChange={(value) => updateStep(step.id, { title: value })}
                      onBlur={finishEditing}
                      autoFocus
                      className="text-lg font-semibold"
                    />
                  ) : (
                    <h3
                      className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-blue-600"
                      onClick={() => startEditing(step.id, 'title')}
                      title="클릭하여 편집"
                    >
                      {step.title}
                    </h3>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {editingState.stepId === step.id && editingState.field === 'duration' ? (
                    <Input
                      type="number"
                      value={step.duration || ''}
                      onChange={(value) => updateStep(step.id, { duration: Number(value) })}
                      onBlur={finishEditing}
                      autoFocus
                      min={1}
                      className="w-20 text-right"
                    />
                  ) : (
                    <div
                      className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                      onClick={() => startEditing(step.id, 'duration')}
                      title="클릭하여 편집"
                    >
                      <TimeDisplay seconds={step.duration || 0} />
                    </div>
                  )}
                </div>
              </div>

              {/* 설명 */}
              <div className="mb-4">
                {editingState.stepId === step.id && editingState.field === 'description' ? (
                  <Textarea
                    value={step.description}
                    onChange={(value) => updateStep(step.id, { description: value })}
                    onBlur={finishEditing}
                    autoFocus
                    rows={3}
                  />
                ) : (
                  <p
                    className="text-gray-700 cursor-pointer hover:bg-gray-50 p-2 rounded"
                    onClick={() => startEditing(step.id, 'description')}
                    title="클릭하여 편집"
                  >
                    {step.description}
                  </p>
                )}
              </div>

              {/* 핵심 포인트 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700">핵심 포인트</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addKeyPoint(step.id)}
                    disabled={isFormDisabled}
                  >
                    + 추가
                  </Button>
                </div>

                <div className="space-y-2">
                  {step.keyPoints.map((point, pointIndex) => (
                    <div key={pointIndex} className="flex items-center gap-2">
                      <Input
                        value={point}
                        onChange={(value) => {
                          const newKeyPoints = [...step.keyPoints]
                          newKeyPoints[pointIndex] = value
                          updateStep(step.id, { keyPoints: newKeyPoints })
                        }}
                        disabled={isFormDisabled}
                        placeholder="핵심 포인트를 입력하세요"
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeKeyPoint(step.id, pointIndex)}
                        disabled={isFormDisabled}
                        className="text-red-500 hover:text-red-700"
                      >
                        삭제
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        />
      </div>

      {/* 액션 버튼 */}
      <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
        <Button
          onClick={handleGenerateShots}
          variant="primary"
          size="lg"
          disabled={!validation.isValid || isFormDisabled}
          loading={isGenerating}
          className="flex-1"
        >
          {isGenerating ? '12숏 생성 중...' : '12숏으로 자동 분해하기'}
        </Button>

        <Button
          onClick={() => setShowImprovementModal(true)}
          variant="outline"
          size="lg"
          disabled={isFormDisabled}
          className="sm:w-auto"
        >
          AI에게 개선 요청
        </Button>
      </div>

      {/* 개선 요청 모달 */}
      {showImprovementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">스토리 개선 요청</h3>

            <Textarea
              value={improvementPrompt}
              onChange={setImprovementPrompt}
              placeholder="어떤 부분을 어떻게 개선하고 싶은지 구체적으로 설명해주세요"
              rows={4}
              className="mb-4"
            />

            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowImprovementModal(false)
                  setImprovementPrompt('')
                }}
              >
                취소
              </Button>
              <Button
                onClick={handleImprovementSubmit}
                disabled={!improvementPrompt.trim()}
              >
                개선 요청
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 도움말 */}
      <div className="mt-6 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <p className="font-medium mb-1">💡 편집 팁:</p>
        <ul className="space-y-1">
          <li>• 제목, 설명, 시간을 클릭하면 바로 편집할 수 있습니다</li>
          <li>• 스텝을 드래그하여 순서를 변경할 수 있습니다</li>
          <li>• 목표 시간에 맞춰 각 단계의 시간을 조정해보세요</li>
          <li>• 변경사항은 자동으로 저장됩니다</li>
        </ul>
      </div>
    </div>
  )
}

export default StoryStepEditor