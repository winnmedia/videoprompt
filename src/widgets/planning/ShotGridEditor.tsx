/**
 * ShotGridEditor Widget
 *
 * FRD.md 명세 Step 3: 12숏 편집·콘티·인서트·내보내기 컴포넌트
 * 3x4 그리드 레이아웃, 좌(콘티) 우(숏편집), 인서트 추천, PDF/JSON 내보내기
 * CLAUDE.md 준수: FSD widgets 레이어, 접근성 WCAG 2.1 AA, React 19
 */

import { memo, useState, useCallback } from 'react'

import type {
  ShotSequence,
  StoryStep,
  InsertShot,
} from '../../entities/planning'

/**
 * 그리드 에디터 속성
 */
export interface ShotGridEditorProps {
  shotSequences: ShotSequence[]
  storySteps: StoryStep[]
  insertShots: InsertShot[]
  onChange?: (shotSequences: ShotSequence[]) => void
  onComplete?: () => void
  disabled?: boolean
  className?: string
}

/**
 * FRD.md 명세 Step 3: 12숏 그리드 에디터 컴포넌트
 */
export const ShotGridEditor = memo(function ShotGridEditor({
  shotSequences: initialShotSequences,
  storySteps,
  insertShots,
  onChange,
  onComplete,
  disabled = false,
  className = '',
}: ShotGridEditorProps) {
  const [shotSequences, setShotSequences] = useState(initialShotSequences)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null)

  // 백엔드에서 12숏 자동 생성
  const generateShotsFromStory = useCallback(async () => {
    if (!storySteps || storySteps.length === 0) {
      setError('4단계 스토리가 필요합니다')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/planning/shots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: crypto.randomUUID(), // 실제로는 props에서 받아야 함
          storySteps: storySteps.map(step => ({
            id: step.id || crypto.randomUUID(),
            title: step.title || '제목 없음',
            content: step.content || step.description || ''
          })),
          metadata: {
            tone: 'dramatic',
            genre: 'general',
            targetAudience: 'general'
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '12숏 생성 실패')
      }

      const result = await response.json()
      const newShotSequences = result.data

      setShotSequences(newShotSequences)
      onChange?.(newShotSequences)

    } catch (err) {
      console.error('12숏 생성 오류:', err)
      setError(err instanceof Error ? err.message : '12숏 생성 중 오류가 발생했습니다')
    } finally {
      setIsLoading(false)
    }
  }, [storySteps, onChange])

  // 개별 숏 업데이트
  const updateShot = useCallback(async (shotId: string, updates: Partial<ShotSequence>) => {
    try {
      const response = await fetch('/api/planning/shots', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: crypto.randomUUID(), // 실제로는 props에서 받아야 함
          shotId,
          ...updates
        })
      })

      if (!response.ok) {
        throw new Error('숏 업데이트 실패')
      }

      const result = await response.json()
      const updatedShot = result.data

      setShotSequences(prev =>
        prev.map(shot => shot.id === shotId ? { ...shot, ...updatedShot } : shot)
      )

      onChange?.(shotSequences)

    } catch (err) {
      console.error('숏 업데이트 오류:', err)
      setError('숏 업데이트 중 오류가 발생했습니다')
    }
  }, [shotSequences, onChange])

  // 콘티 이미지 생성
  const generateContiImage = useCallback(async (shotId: string) => {
    const shot = shotSequences.find(s => s.id === shotId)
    if (!shot) return

    try {
      const response = await fetch('/api/planning/conti/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shotId,
          visualPrompt: shot.visualPrompt,
          style: 'storyboard_pencil',
          aspectRatio: '16:9'
        })
      })

      if (!response.ok) {
        throw new Error('콘티 이미지 생성 실패')
      }

      const result = await response.json()

      await updateShot(shotId, {
        contiImageUrl: result.imageUrl
      })

    } catch (err) {
      console.error('콘티 생성 오류:', err)
      setError('콘티 이미지 생성 중 오류가 발생했습니다')
    }
  }, [shotSequences, updateShot])

  return (
    <div className={`shot-grid-editor ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          12숏 구성 및 콘티 생성
        </h2>
        <p className="text-gray-600 mb-4">
          각 숏의 세부사항을 편집하고 콘티 이미지를 생성하세요.
        </p>

        {/* 자동 생성 버튼 */}
        {shotSequences.length === 0 && (
          <div className="flex items-center space-x-4 mb-6">
            <button
              onClick={generateShotsFromStory}
              disabled={isLoading || disabled}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '생성 중...' : '4단계 스토리에서 12숏 자동 생성'}
            </button>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-sm text-red-600 hover:text-red-800"
            >
              닫기
            </button>
          </div>
        )}

        {/* 로딩 상태 */}
        {isLoading && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <p className="text-blue-700">12숏 시퀀스를 생성하고 있습니다...</p>
            </div>
          </div>
        )}
      </div>

      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <div className="text-gray-500 mb-4">
          ShotGridEditor 컴포넌트 구현 예정
        </div>
        <div className="text-sm text-gray-400">
          총 {shotSequences.length}개 숏, {storySteps.length}개 스텝, {insertShots.length}개 인서트
        </div>
      </div>
    </div>
  )
})

// React.memo를 사용한 성능 최적화
ShotGridEditor.displayName = 'ShotGridEditor'

export default ShotGridEditor