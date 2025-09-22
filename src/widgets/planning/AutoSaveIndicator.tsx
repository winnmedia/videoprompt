/**
 * AutoSaveIndicator Widget
 *
 * 자동 저장 상태 표시 컴포넌트
 * CLAUDE.md 준수: FSD widgets 레이어, 접근성 WCAG 2.1 AA, React 19
 */

import { memo, useMemo, useEffect, useState } from 'react'

/**
 * 자동 저장 표시 속성
 */
export interface AutoSaveIndicatorProps {
  hasUnsavedChanges: boolean
  lastSavedAt?: Date | null
  isLoading?: boolean
  className?: string
  showLastSavedTime?: boolean
  autoHideDelay?: number // ms 단위
}

/**
 * 저장 상태 타입
 */
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

/**
 * 자동 저장 상태 표시 컴포넌트
 */
export const AutoSaveIndicator = memo(function AutoSaveIndicator({
  hasUnsavedChanges,
  lastSavedAt,
  isLoading = false,
  className = '',
  showLastSavedTime = true,
  autoHideDelay = 3000,
}: AutoSaveIndicatorProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [lastChangeTime, setLastChangeTime] = useState<Date | null>(null)

  // 저장 상태 결정
  const saveStatus: SaveStatus = useMemo(() => {
    if (isLoading) return 'saving'
    if (hasUnsavedChanges) return 'unsaved'
    return 'saved'
  }, [hasUnsavedChanges, isLoading])

  // 변경사항 발생 시점 기록
  useEffect(() => {
    if (hasUnsavedChanges && !lastChangeTime) {
      setLastChangeTime(new Date())
    }
    if (!hasUnsavedChanges) {
      setLastChangeTime(null)
    }
  }, [hasUnsavedChanges, lastChangeTime])

  // 저장 완료 후 자동 숨김
  useEffect(() => {
    if (saveStatus === 'saved' && autoHideDelay > 0) {
      setIsVisible(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, autoHideDelay)

      return () => clearTimeout(timer)
    } else {
      setIsVisible(true)
    }
  }, [saveStatus, autoHideDelay])

  // 마지막 저장 시간 포맷팅
  const lastSavedTimeFormatted = useMemo(() => {
    if (!lastSavedAt) return null

    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - lastSavedAt.getTime()) / (1000 * 60))

    if (diffMinutes === 0) return '방금 전'
    if (diffMinutes === 1) return '1분 전'
    if (diffMinutes < 60) return `${diffMinutes}분 전`

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours === 1) return '1시간 전'
    if (diffHours < 24) return `${diffHours}시간 전`

    return lastSavedAt.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [lastSavedAt])

  // 상태별 스타일 및 메시지
  const statusConfig = useMemo(() => {
    switch (saveStatus) {
      case 'saving':
        return {
          icon: (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          ),
          message: '저장 중...',
          textColor: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
        }
      case 'saved':
        return {
          icon: (
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          ),
          message: '저장됨',
          textColor: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
        }
      case 'unsaved':
        return {
          icon: (
            <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          ),
          message: '저장되지 않음',
          textColor: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
        }
      case 'error':
        return {
          icon: (
            <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          ),
          message: '저장 실패',
          textColor: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
        }
      default:
        return {
          icon: null,
          message: '',
          textColor: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
        }
    }
  }, [saveStatus])

  // 컴포넌트가 숨겨진 상태면 렌더링하지 않음
  if (!isVisible && saveStatus === 'saved') {
    return null
  }

  return (
    <div
      className={`auto-save-indicator inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${statusConfig.bgColor} ${statusConfig.borderColor} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`자동 저장 상태: ${statusConfig.message}`}
      data-testid="auto-save-indicator"
    >
      {/* 상태 아이콘 */}
      {statusConfig.icon}

      {/* 상태 메시지 */}
      <span className={`text-sm font-medium ${statusConfig.textColor}`}>
        {statusConfig.message}
      </span>

      {/* 마지막 저장 시간 */}
      {showLastSavedTime && lastSavedTimeFormatted && saveStatus === 'saved' && (
        <span className="text-xs text-gray-500">
          ({lastSavedTimeFormatted})
        </span>
      )}

      {/* 변경사항 있음 표시 */}
      {saveStatus === 'unsaved' && lastChangeTime && (
        <span className="text-xs text-gray-500">
          • 변경됨
        </span>
      )}

      {/* 접근성을 위한 숨김 텍스트 */}
      <span className="sr-only">
        {saveStatus === 'saving' && '자동 저장이 진행 중입니다.'}
        {saveStatus === 'saved' && '모든 변경사항이 저장되었습니다.'}
        {saveStatus === 'unsaved' && '저장되지 않은 변경사항이 있습니다.'}
        {saveStatus === 'error' && '저장 중 오류가 발생했습니다.'}
      </span>
    </div>
  )
})

/**
 * 자동 저장 인디케이터 훅
 * 컴포넌트에서 쉽게 사용할 수 있도록 도우미 훅 제공
 */
export function useAutoSaveIndicator(
  hasUnsavedChanges: boolean,
  isLoading: boolean = false
) {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  // 저장 완료 시 호출할 함수
  const markAsSaved = () => {
    setLastSavedAt(new Date())
  }

  // 자동 저장 상태 업데이트
  useEffect(() => {
    if (!hasUnsavedChanges && !isLoading && lastSavedAt === null) {
      markAsSaved()
    }
  }, [hasUnsavedChanges, isLoading, lastSavedAt])

  return {
    lastSavedAt,
    markAsSaved,
    AutoSaveIndicator: (props: Partial<AutoSaveIndicatorProps>) => (
      <AutoSaveIndicator
        hasUnsavedChanges={hasUnsavedChanges}
        lastSavedAt={lastSavedAt}
        isLoading={isLoading}
        {...props}
      />
    ),
  }
}

AutoSaveIndicator.displayName = 'AutoSaveIndicator'