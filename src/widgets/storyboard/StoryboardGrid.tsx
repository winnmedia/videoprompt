/**
 * StoryboardGrid Widget
 *
 * 4x3 그리드 레이아웃으로 생성된 스토리보드 이미지를 표시하는 컴포넌트
 * 드래그앤드롭 순서 변경, 이미지 확대, 다운로드 기능 포함
 * CLAUDE.md 준수: FSD widgets 레이어, 접근성 WCAG 2.1 AA, React 19
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

import { Button, Card, Modal } from '../../shared/ui'
import logger from '../../shared/lib/logger'

/**
 * 스토리보드 이미지 타입
 */
export interface StoryboardImage {
  id: string
  url: string
  title: string
  description: string
  shotType: 'wide' | 'medium' | 'close' | 'extreme-close'
  angle: 'eye-level' | 'high' | 'low' | 'bird' | 'worm'
  composition: 'center' | 'rule-of-thirds' | 'frame-in-frame' | 'leading-lines'
  order: number
  status: 'generating' | 'completed' | 'error' | 'pending'
  error?: string
  metadata?: {
    width: number
    height: number
    fileSize: number
    format: string
    generatedAt: string
  }
}

/**
 * 스토리보드 그리드 속성
 */
export interface StoryboardGridProps {
  images: StoryboardImage[]
  title?: string
  onImageClick?: (image: StoryboardImage) => void
  onImageReorder?: (newOrder: string[]) => void
  onImageRegenerate?: (imageId: string) => void
  onImageDownload?: (image: StoryboardImage) => void
  onImageDelete?: (imageId: string) => void
  onDownloadAll?: () => void
  className?: string
  disabled?: boolean
  enableDragDrop?: boolean
  showMetadata?: boolean
  allowRegenerate?: boolean
}

/**
 * 개별 스토리보드 이미지 카드 속성
 */
interface StoryboardImageCardProps {
  image: StoryboardImage
  isDragging?: boolean
  onImageClick: (image: StoryboardImage) => void
  onImageRegenerate?: (imageId: string) => void
  onImageDownload?: (image: StoryboardImage) => void
  onImageDelete?: (imageId: string) => void
  disabled?: boolean
  showMetadata?: boolean
  allowRegenerate?: boolean
}

/**
 * 드래그 가능한 스토리보드 이미지 카드
 */
function DraggableStoryboardCard({
  image,
  onImageClick,
  onImageRegenerate,
  onImageDownload,
  onImageDelete,
  disabled,
  showMetadata,
  allowRegenerate
}: StoryboardImageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: image.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const handleImageClick = useCallback(() => {
    if (!disabled && image.status === 'completed') {
      onImageClick(image)
    }
  }, [disabled, image, onImageClick])

  const handleRegenerate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm(`${image.order}번 이미지를 다시 생성하시겠습니까?`)) {
      onImageRegenerate?.(image.id)
    }
  }, [image.id, image.order, onImageRegenerate])

  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onImageDownload?.(image)
  }, [image, onImageDownload])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm(`${image.order}번 이미지를 삭제하시겠습니까?`)) {
      onImageDelete?.(image.id)
    }
  }, [image.id, image.order, onImageDelete])

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`
        storyboard-card group relative
        ${isDragging ? 'z-50' : ''}
        ${image.status === 'completed' ? 'cursor-pointer' : ''}
      `}
      data-testid={`storyboard-card-${image.id}`}
    >
      <Card className={`
        aspect-video relative overflow-hidden transition-all duration-200
        ${image.status === 'completed' ? 'hover:shadow-lg hover:scale-105' : ''}
        ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
      `}>
        {/* 드래그 핸들 */}
        <button
          {...listeners}
          {...attributes}
          className="absolute top-2 right-2 p-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-grab active:cursor-grabbing hover:bg-black hover:bg-opacity-20 rounded focus:outline-none focus:ring-2 focus:ring-white focus:bg-black focus:bg-opacity-20"
          aria-label={`${image.order}번 이미지 순서 변경하기`}
          tabIndex={0}
        >
          <svg
            className="w-4 h-4 text-white drop-shadow-lg"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>

        {/* 이미지 순서 번호 */}
        <div className="absolute top-2 left-2 z-10">
          <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-black bg-opacity-70 rounded-full">
            {image.order}
          </span>
        </div>

        {/* 이미지 내용 */}
        <div className="relative w-full h-full" onClick={handleImageClick}>
          {image.status === 'generating' && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-100">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-neutral-600">생성 중...</p>
              </div>
            </div>
          )}

          {image.status === 'pending' && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-50">
              <div className="text-center">
                <svg className="w-8 h-8 text-neutral-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-neutral-600">대기 중...</p>
              </div>
            </div>
          )}

          {image.status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50">
              <div className="text-center p-4">
                <svg className="w-8 h-8 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-xs text-red-600 text-center">
                  {image.error || '생성 실패'}
                </p>
              </div>
            </div>
          )}

          {image.status === 'completed' && (
            <>
              <img
                src={image.url}
                alt={`스토리보드 ${image.order}번: ${image.description}`}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  logger.error('스토리보드 이미지 로드 실패', {
                    imageId: image.id,
                    url: image.url
                  })
                }}
              />

              {/* 이미지 오버레이 정보 */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-end">
                <div className="w-full p-3 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <h4 className="text-white text-sm font-medium line-clamp-1 mb-1">
                    {image.title}
                  </h4>
                  <p className="text-white text-xs opacity-90 line-clamp-2">
                    {image.description}
                  </p>
                  {showMetadata && image.metadata && (
                    <div className="flex items-center gap-2 mt-2 text-white text-xs opacity-75">
                      <span>{image.metadata.width}×{image.metadata.height}</span>
                      <span>•</span>
                      <span>{(image.metadata.fileSize / 1024).toFixed(1)}KB</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 액션 버튼 */}
        {image.status === 'completed' && (
          <div className="absolute top-2 right-12 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              onClick={handleDownload}
              disabled={disabled}
              className="p-2 text-white bg-black bg-opacity-50 hover:bg-opacity-70 rounded focus:outline-none focus:ring-2 focus:ring-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`${image.order}번 이미지 다운로드`}
              title="다운로드"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>

            {allowRegenerate && (
              <button
                onClick={handleRegenerate}
                disabled={disabled}
                className="p-2 text-white bg-black bg-opacity-50 hover:bg-opacity-70 rounded focus:outline-none focus:ring-2 focus:ring-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`${image.order}번 이미지 다시 생성`}
                title="다시 생성"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}

            <button
              onClick={handleDelete}
              disabled={disabled}
              className="p-2 text-white bg-red-600 bg-opacity-70 hover:bg-opacity-90 rounded focus:outline-none focus:ring-2 focus:ring-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`${image.order}번 이미지 삭제`}
              title="삭제"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}

        {/* 상태별 배지 */}
        {image.status !== 'completed' && (
          <div className="absolute bottom-2 right-2 z-10">
            <span className={`
              inline-flex items-center px-2 py-1 text-xs font-medium rounded-full
              ${image.status === 'generating' ? 'bg-blue-100 text-blue-800' : ''}
              ${image.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
              ${image.status === 'error' ? 'bg-red-100 text-red-800' : ''}
            `}>
              {image.status === 'generating' && '생성 중'}
              {image.status === 'pending' && '대기'}
              {image.status === 'error' && '오류'}
            </span>
          </div>
        )}
      </Card>
    </div>
  )
}

/**
 * 스토리보드 그리드 메인 컴포넌트
 */
export function StoryboardGrid({
  images,
  title = '스토리보드',
  onImageClick,
  onImageReorder,
  onImageRegenerate,
  onImageDownload,
  onImageDelete,
  onDownloadAll,
  className = '',
  disabled = false,
  enableDragDrop = true,
  showMetadata = false,
  allowRegenerate = true
}: StoryboardGridProps) {
  // 상태 관리
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<StoryboardImage | null>(null)

  // 드래그 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor)
  )

  // 이미지 ID 배열 (정렬용)
  const imageIds = useMemo(() =>
    images.map(image => image.id),
    [images]
  )

  // 통계 계산
  const stats = useMemo(() => {
    const total = images.length
    const completed = images.filter(img => img.status === 'completed').length
    const generating = images.filter(img => img.status === 'generating').length
    const errors = images.filter(img => img.status === 'error').length
    const pending = images.filter(img => img.status === 'pending').length

    return { total, completed, generating, errors, pending }
  }, [images])

  /**
   * 드래그 시작
   */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    logger.debug('스토리보드 이미지 드래그 시작', { imageId: event.active.id })
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

    const oldIndex = imageIds.indexOf(active.id as string)
    const newIndex = imageIds.indexOf(over.id as string)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(imageIds, oldIndex, newIndex)
      onImageReorder?.(newOrder)

      logger.info('스토리보드 이미지 순서 변경', {
        from: oldIndex + 1,
        to: newIndex + 1,
        imageId: active.id
      })
    }
  }, [imageIds, onImageReorder])

  /**
   * 이미지 클릭 처리
   */
  const handleImageClick = useCallback((image: StoryboardImage) => {
    setSelectedImage(image)
    onImageClick?.(image)
  }, [onImageClick])

  /**
   * 모달 닫기
   */
  const handleCloseModal = useCallback(() => {
    setSelectedImage(null)
  }, [])

  // 빈 상태
  if (images.length === 0) {
    return (
      <div className={`text-center py-16 px-4 ${className}`} role="region" aria-labelledby="empty-state-title">
        <svg
          className="w-16 h-16 text-neutral-400 mx-auto mb-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 id="empty-state-title" className="text-xl font-semibold text-neutral-900 mb-3">
          아직 스토리보드가 없습니다
        </h3>
        <p className="text-neutral-600 mb-6 max-w-md mx-auto">
          스토리보드 생성기를 사용하여 시나리오를 바탕으로 자동으로 스토리보드를 생성해보세요.
        </p>
      </div>
    )
  }

  return (
    <div className={`storyboard-grid ${className}`}>
      {/* 헤더 */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h3 id="storyboard-grid-title" className="text-lg font-semibold text-neutral-900">
            {title}
          </h3>
          <div className="flex items-center gap-4 mt-2 text-sm text-neutral-600">
            <span>총 {stats.total}개</span>
            {stats.completed > 0 && <span className="text-green-600">완료 {stats.completed}개</span>}
            {stats.generating > 0 && <span className="text-blue-600">생성 중 {stats.generating}개</span>}
            {stats.pending > 0 && <span className="text-yellow-600">대기 {stats.pending}개</span>}
            {stats.errors > 0 && <span className="text-red-600">오류 {stats.errors}개</span>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {stats.completed > 0 && onDownloadAll && (
            <Button
              onClick={onDownloadAll}
              variant="outline"
              size="sm"
              disabled={disabled}
              data-testid="download-all-button"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              전체 다운로드
            </Button>
          )}
        </div>
      </header>

      {/* 4x3 그리드 */}
      {enableDragDrop ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={imageIds} strategy={rectSortingStrategy}>
            <section
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              aria-labelledby="storyboard-grid-title"
              role="grid"
              aria-describedby="storyboard-grid-instructions"
            >
              <div id="storyboard-grid-instructions" className="sr-only">
                스토리보드 이미지들을 드래그앤드롭으로 순서를 변경할 수 있습니다.
                각 이미지를 클릭하여 확대하여 볼 수 있습니다.
              </div>
              {images.map((image, index) => (
                <div
                  key={image.id}
                  role="gridcell"
                  aria-rowindex={Math.floor(index / 4) + 1}
                  aria-colindex={(index % 4) + 1}
                >
                  <DraggableStoryboardCard
                    image={image}
                    onImageClick={handleImageClick}
                    onImageRegenerate={onImageRegenerate}
                    onImageDownload={onImageDownload}
                    onImageDelete={onImageDelete}
                    disabled={disabled}
                    showMetadata={showMetadata}
                    allowRegenerate={allowRegenerate}
                  />
                </div>
              ))}
            </section>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <DraggableStoryboardCard
              key={image.id}
              image={image}
              onImageClick={handleImageClick}
              onImageRegenerate={onImageRegenerate}
              onImageDownload={onImageDownload}
              onImageDelete={onImageDelete}
              disabled={disabled}
              showMetadata={showMetadata}
              allowRegenerate={allowRegenerate}
            />
          ))}
        </div>
      )}

      {/* 이미지 확대 모달 */}
      {selectedImage && selectedImage.status === 'completed' && (
        <Modal
          open={true}
          onClose={handleCloseModal}
          title={`스토리보드 ${selectedImage.order}번`}
          className="max-w-4xl"
        >
          <div className="space-y-4">
            <div className="relative">
              <img
                src={selectedImage.url}
                alt={`스토리보드 ${selectedImage.order}번: ${selectedImage.description}`}
                className="w-full h-auto max-h-96 object-contain rounded-lg"
              />
            </div>

            <div className="space-y-3">
              <h4 className="text-lg font-medium text-neutral-900">
                {selectedImage.title}
              </h4>
              <p className="text-neutral-700">
                {selectedImage.description}
              </p>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-neutral-700">숏트 타입:</span>
                  <p className="text-neutral-600">
                    {selectedImage.shotType === 'wide' && '와이드'}
                    {selectedImage.shotType === 'medium' && '미디엄'}
                    {selectedImage.shotType === 'close' && '클로즈업'}
                    {selectedImage.shotType === 'extreme-close' && '익스트림 클로즈업'}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-neutral-700">앵글:</span>
                  <p className="text-neutral-600">
                    {selectedImage.angle === 'eye-level' && '아이 레벨'}
                    {selectedImage.angle === 'high' && '하이 앵글'}
                    {selectedImage.angle === 'low' && '로우 앵글'}
                    {selectedImage.angle === 'bird' && '버드 뷰'}
                    {selectedImage.angle === 'worm' && '웜 뷰'}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-neutral-700">구도:</span>
                  <p className="text-neutral-600">
                    {selectedImage.composition === 'center' && '센터'}
                    {selectedImage.composition === 'rule-of-thirds' && '3분할'}
                    {selectedImage.composition === 'frame-in-frame' && '프레임 인 프레임'}
                    {selectedImage.composition === 'leading-lines' && '리딩 라인'}
                  </p>
                </div>
              </div>

              {showMetadata && selectedImage.metadata && (
                <div className="pt-3 border-t border-neutral-200">
                  <h5 className="font-medium text-neutral-700 mb-2">이미지 정보</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-neutral-600">
                    <div>해상도: {selectedImage.metadata.width}×{selectedImage.metadata.height}</div>
                    <div>파일 크기: {(selectedImage.metadata.fileSize / 1024).toFixed(1)}KB</div>
                    <div>형식: {selectedImage.metadata.format.toUpperCase()}</div>
                    <div>생성일: {new Date(selectedImage.metadata.generatedAt).toLocaleString()}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={() => onImageDownload?.(selectedImage)}
                className="flex-1"
                data-testid="modal-download-button"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                다운로드
              </Button>

              {allowRegenerate && (
                <Button
                  variant="outline"
                  onClick={() => {
                    handleCloseModal()
                    onImageRegenerate?.(selectedImage.id)
                  }}
                  data-testid="modal-regenerate-button"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  다시 생성
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}