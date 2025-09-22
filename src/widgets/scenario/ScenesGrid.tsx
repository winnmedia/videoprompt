/**
 * ScenesGrid Widget
 *
 * 드래그앤드롭 기능이 포함된 씬 그리드 컴포넌트
 * CLAUDE.md 준수: FSD widgets 레이어, 접근성, 드래그앤드롭 UX
 */

import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { Scene } from '../../entities/scenario'
import { useSceneEditing, type SceneEditMode } from '../../features/scenario'
import { Button, Card } from '../../shared/ui'
import logger from '../../shared/lib/logger'

/**
 * 씬 그리드 속성
 */
export interface ScenesGridProps {
  scenes: Scene[]
  selectedSceneIds?: string[]
  editMode?: SceneEditMode
  onSceneSelect?: (sceneId: string) => void
  onSceneEdit?: (scene: Scene) => void
  onSceneDelete?: (sceneId: string) => void
  onOrderChange?: (newOrder: string[]) => void
  className?: string
  disabled?: boolean
  enableMultiSelect?: boolean
  enableDragDrop?: boolean
}

/**
 * 개별 씬 카드 속성
 */
interface SceneCardProps {
  scene: Scene
  isSelected: boolean
  isEditing: boolean
  isDragging?: boolean
  onSelect: (sceneId: string) => void
  onEdit: (scene: Scene) => void
  onDelete: (sceneId: string) => void
  disabled?: boolean
}

/**
 * 드래그 가능한 씬 카드 컴포넌트
 */
function DraggableSceneCard({
  scene,
  isSelected,
  isEditing,
  onSelect,
  onEdit,
  onDelete,
  disabled
}: SceneCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: scene.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`
        scene-card group relative
        ${isDragging ? 'z-50' : ''}
        ${isSelected ? 'ring-2 ring-primary-500 ring-offset-2' : ''}
      `}
      data-testid={`scene-card-${scene.id}`}
    >
      <Card className={`
        p-4 h-full transition-all duration-200
        ${isSelected ? 'bg-primary-50 border-primary-200' : 'hover:shadow-md'}
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
      `}>
        {/* 드래그 핸들 */}
        <button
          {...listeners}
          {...attributes}
          className="absolute top-2 right-2 p-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-grab active:cursor-grabbing hover:bg-neutral-100 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-neutral-100"
          aria-label={`씬 ${scene.order} 순서 변경하기. 스페이스나 엔터 키를 눌러 드래그를 시작하고 화살표 키로 이동 후 스페이스나 엔터 키로 놓기`}
          aria-describedby={`scene-${scene.id}-description`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              // 키보드 드래그 시작 로직
            }
          }}
        >
          <svg
            className="w-4 h-4 text-neutral-400"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>

        {/* 씬 헤더 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span
              className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium text-white bg-neutral-500 rounded-full flex-shrink-0"
              aria-label={`씬 번호 ${scene.order}`}
            >
              {scene.order}
            </span>
            <div className="min-w-0 flex-1">
              <h3
                id={`scene-${scene.id}-title`}
                className="text-sm font-medium text-neutral-900 line-clamp-1"
              >
                {scene.title}
              </h3>
              <div className="flex items-center gap-2 mt-1" id={`scene-${scene.id}-description`}>
                <span
                  className={`
                    inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full
                    ${scene.type === 'dialogue' ? 'bg-blue-100 text-blue-800' : ''}
                    ${scene.type === 'action' ? 'bg-green-100 text-green-800' : ''}
                    ${scene.type === 'transition' ? 'bg-purple-100 text-purple-800' : ''}
                    ${scene.type === 'montage' ? 'bg-orange-100 text-orange-800' : ''}
                    ${scene.type === 'voiceover' ? 'bg-pink-100 text-pink-800' : ''}
                  `}
                  aria-label={`씬 타입: ${
                    scene.type === 'dialogue' ? '대화' :
                    scene.type === 'action' ? '액션' :
                    scene.type === 'transition' ? '전환' :
                    scene.type === 'montage' ? '몽타주' :
                    scene.type === 'voiceover' ? '내레이션' : scene.type
                  }`}
                >
                  {scene.type === 'dialogue' && '대화'}
                  {scene.type === 'action' && '액션'}
                  {scene.type === 'transition' && '전환'}
                  {scene.type === 'montage' && '몽타주'}
                  {scene.type === 'voiceover' && '내레이션'}
                </span>
                {scene.duration && (
                  <span
                    className="text-xs text-neutral-500"
                    aria-label={`지속시간 ${Math.floor(scene.duration / 60)}분 ${scene.duration % 60}초`}
                  >
                    {Math.floor(scene.duration / 60)}:{(scene.duration % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit(scene)
              }}
              disabled={disabled}
              className="p-2 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:text-primary-600 focus:bg-primary-50 transition-all disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`씬 ${scene.order} "${scene.title}" 편집하기`}
              aria-describedby={`scene-${scene.id}-title`}
              tabIndex={0}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (window.confirm(`씬 ${scene.order} "${scene.title}"를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
                  onDelete(scene.id)
                }
              }}
              disabled={disabled}
              className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:text-red-600 focus:bg-red-50 transition-all disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`씬 ${scene.order} "${scene.title}" 삭제하기`}
              aria-describedby={`scene-${scene.id}-title`}
              tabIndex={0}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* 씬 내용 */}
        <div className="space-y-2">
          <p className="text-sm text-neutral-600 line-clamp-2">
            {scene.description}
          </p>

          {scene.location && (
            <div className="flex items-center gap-1 text-xs text-neutral-500">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {scene.location}
            </div>
          )}

          {scene.characters && scene.characters.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-neutral-500">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h-3m3 0v3m-3-3v3" />
              </svg>
              {scene.characters.join(', ')}
            </div>
          )}

          {scene.dialogue && (
            <div className="mt-2 p-2 bg-neutral-50 rounded text-xs text-neutral-600 italic line-clamp-2">
              "{scene.dialogue}"
            </div>
          )}
        </div>

        {/* 선택 상태 표시 */}
        {isSelected && (
          <div className="absolute top-2 left-2">
            <div className="w-4 h-4 bg-primary-600 rounded-full flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}

        {/* 편집 모드 오버레이 */}
        {isEditing && (
          <div className="absolute inset-0 bg-primary-600 bg-opacity-10 border-2 border-primary-600 rounded-lg pointer-events-none">
            <div className="absolute top-2 left-2 px-2 py-1 bg-primary-600 text-white text-xs rounded">
              편집 중
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

/**
 * 씬 그리드 메인 컴포넌트
 */
export function ScenesGrid({
  scenes,
  selectedSceneIds = [],
  editMode = 'view',
  onSceneSelect,
  onSceneEdit,
  onSceneDelete,
  onOrderChange,
  className = '',
  disabled = false,
  enableMultiSelect = true,
  enableDragDrop = true
}: ScenesGridProps) {
  const {
    reorderScenes,
    toggleSceneSelection,
    clearSelection,
    isProcessing
  } = useSceneEditing({
    enableMultiSelect,
    enableUndo: true
  })

  // 드래그 상태
  const [activeId, setActiveId] = useState<string | null>(null)

  // 드래그 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor)
  )

  // 씬 ID 배열 (정렬용)
  const sceneIds = useMemo(() =>
    scenes.map(scene => scene.id),
    [scenes]
  )

  /**
   * 드래그 시작
   */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    logger.debug('드래그 시작', { sceneId: event.active.id })
  }, [])

  /**
   * 드래그 오버
   */
  const handleDragOver = useCallback((event: DragOverEvent) => {
    // 필요시 드래그 오버 로직 추가
  }, [])

  /**
   * 드래그 끝
   */
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = sceneIds.indexOf(active.id as string)
    const newIndex = sceneIds.indexOf(over.id as string)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(sceneIds, oldIndex, newIndex)

      // 내부 상태 업데이트
      reorderScenes(newOrder)

      // 외부 콜백 호출
      onOrderChange?.(newOrder)

      logger.info('씬 순서 변경', {
        from: oldIndex + 1,
        to: newIndex + 1,
        sceneId: active.id
      })
    }
  }, [sceneIds, reorderScenes, onOrderChange])

  /**
   * 씬 선택 처리
   */
  const handleSceneSelect = useCallback((sceneId: string) => {
    if (enableMultiSelect) {
      toggleSceneSelection(sceneId)
    }
    onSceneSelect?.(sceneId)
  }, [enableMultiSelect, toggleSceneSelection, onSceneSelect])

  /**
   * 씬 편집 처리
   */
  const handleSceneEdit = useCallback((scene: Scene) => {
    onSceneEdit?.(scene)
    logger.debug('씬 편집 요청', { sceneId: scene.id, title: scene.title })
  }, [onSceneEdit])

  /**
   * 씬 삭제 처리
   */
  const handleSceneDelete = useCallback((sceneId: string) => {
    if (window.confirm('이 씬을 삭제하시겠습니까?')) {
      onSceneDelete?.(sceneId)
      logger.info('씬 삭제', { sceneId })
    }
  }, [onSceneDelete])

  // 빈 상태
  if (scenes.length === 0) {
    return (
      <div className={`text-center py-16 px-4 ${className}`} role="region" aria-labelledby="empty-state-title">
        <svg
          className="w-16 h-16 text-neutral-400 mx-auto mb-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2M7 4h10l-1 12H8L7 4zm5-2v12" />
        </svg>
        <h3 id="empty-state-title" className="text-xl font-semibold text-neutral-900 mb-3">
          아직 씬이 없습니다
        </h3>
        <p className="text-neutral-600 mb-6 max-w-md mx-auto">
          AI 스토리 생성을 통해 자동으로 씬을 만들거나, 직접 씬을 추가해보세요.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => {
              // 스토리 생성 탭으로 이동하는 로직
              const createTab = document.querySelector('[data-testid="tab-create"]') as HTMLElement
              createTab?.click()
            }}
            className="inline-flex items-center"
            data-testid="goto-story-creation"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI 스토리 생성
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`scenes-grid ${className}`}>
      {/* 그리드 헤더 */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h3 id="scenes-grid-title" className="text-lg font-semibold text-neutral-900">
            씬 목록
            <span className="text-sm font-normal text-neutral-600 ml-2">
              ({scenes.length}개)
            </span>
          </h3>

          {selectedSceneIds.length > 0 && (
            <div className="flex items-center gap-3 p-2 bg-primary-50 rounded-lg border">
              <span className="text-sm text-primary-700 font-medium">
                {selectedSceneIds.length}개 씬 선택됨
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                aria-label={`선택된 ${selectedSceneIds.length}개 씬 선택 해제`}
                data-testid="clear-selection"
              >
                선택 해제
              </Button>
            </div>
          )}
        </div>

        {/* 총 지속시간 */}
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            총 시간: {Math.floor(scenes.reduce((sum, scene) => sum + (scene.duration || 0), 0) / 60)}분
          </span>
        </div>
      </header>

      {/* 드래그앤드롭 컨텍스트 */}
      {enableDragDrop ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sceneIds} strategy={rectSortingStrategy}>
            <section
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              aria-labelledby="scenes-grid-title"
              role="grid"
              aria-describedby="scenes-grid-instructions"
            >
              <div id="scenes-grid-instructions" className="sr-only">
                씬 카드들을 드래그앤드롭으로 순서를 변경할 수 있습니다.
                각 씬 카드를 클릭하여 선택하거나,
                편집 및 삭제 버튼을 사용할 수 있습니다.
              </div>
              {scenes.map((scene, index) => (
                <div
                  key={scene.id}
                  role="gridcell"
                  aria-rowindex={Math.floor(index / 4) + 1}
                  aria-colindex={(index % 4) + 1}
                >
                  <DraggableSceneCard
                    scene={scene}
                    isSelected={selectedSceneIds.includes(scene.id)}
                    isEditing={editMode === 'edit' && selectedSceneIds.includes(scene.id)}
                    onSelect={handleSceneSelect}
                    onEdit={handleSceneEdit}
                    onDelete={handleSceneDelete}
                    disabled={disabled || isProcessing}
                  />
                </div>
              ))}
            </section>
          </SortableContext>
        </DndContext>
      ) : (
        // 드래그 없는 정적 그리드
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {scenes.map((scene) => (
            <div
              key={scene.id}
              onClick={() => handleSceneSelect(scene.id)}
              className={`
                scene-card cursor-pointer
                ${selectedSceneIds.includes(scene.id) ? 'ring-2 ring-primary-500 ring-offset-2' : ''}
              `}
              data-testid={`scene-card-${scene.id}`}
            >
              <Card className={`
                p-4 h-full transition-all duration-200
                ${selectedSceneIds.includes(scene.id) ? 'bg-primary-50 border-primary-200' : 'hover:shadow-md'}
                ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
              `}>
                {/* 정적 씬 카드 내용 (위와 동일하지만 드래그 핸들 제외) */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium text-white bg-neutral-500 rounded-full">
                      {scene.order}
                    </span>
                    <div>
                      <h3 className="text-sm font-medium text-neutral-900 line-clamp-1">
                        {scene.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`
                          inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full
                          ${scene.type === 'dialogue' ? 'bg-blue-100 text-blue-800' : ''}
                          ${scene.type === 'action' ? 'bg-green-100 text-green-800' : ''}
                          ${scene.type === 'transition' ? 'bg-purple-100 text-purple-800' : ''}
                          ${scene.type === 'montage' ? 'bg-orange-100 text-orange-800' : ''}
                          ${scene.type === 'voiceover' ? 'bg-pink-100 text-pink-800' : ''}
                        `}>
                          {scene.type === 'dialogue' && '대화'}
                          {scene.type === 'action' && '액션'}
                          {scene.type === 'transition' && '전환'}
                          {scene.type === 'montage' && '몽타주'}
                          {scene.type === 'voiceover' && '내레이션'}
                        </span>
                        {scene.duration && (
                          <span className="text-xs text-neutral-500">
                            {Math.floor(scene.duration / 60)}:{(scene.duration % 60).toString().padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-neutral-600 line-clamp-2">
                    {scene.description}
                  </p>
                  {/* 나머지 내용들... */}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* 로딩 상태 */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <span>씬 처리 중...</span>
          </div>
        </div>
      )}
    </div>
  )
}