/**
 * Enhanced Version Switcher Widget - Phase 3.9
 *
 * CLAUDE.md 준수: widgets 레이어 UI 컴포넌트
 * FRD.md 요구사항: 버전 관리, 되돌리기, 키보드 네비게이션, 접근성
 */

'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useVersionManager } from '../../features/video-feedback/hooks/useVersionManager'
import {
  type VideoSlot,
  type VersionMetadata,
  type VersionHistory
} from '../../entities/feedback'

// 날짜/파일 포맷팅 유틸리티 (임시 구현)
const formatDateTime = (date: string) => new Date(date).toLocaleString('ko-KR')
const formatFileSize = (bytes: number) => (bytes / 1024 / 1024).toFixed(1) + 'MB'
const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * 확인 다이얼로그 Props
 */
interface ConfirmDialogProps {
  readonly isOpen: boolean
  readonly title: string
  readonly message: string
  readonly confirmText: string
  readonly cancelText: string
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly variant: 'danger' | 'warning' | 'info'
}

/**
 * 확인 다이얼로그 컴포넌트
 */
function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  variant
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700',
    info: 'bg-blue-600 hover:bg-blue-700'
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg border border-gray-700 max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="p-6">
          <p className="text-gray-300">{message}</p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors duration-150"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors duration-150 ${variantStyles[variant]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 버전 탭 Props
 */
interface VersionTabProps {
  readonly slot: VideoSlot
  readonly version: VersionMetadata | null
  readonly isActive: boolean
  readonly isSelected: boolean
  readonly isLoading: boolean
  readonly onClick: () => void
  readonly onUpload: (file: File) => void
  readonly onKeyDown: (e: React.KeyboardEvent) => void
  readonly onMoreActions: () => void
  readonly tabIndex: number
  readonly 'aria-selected': boolean
  readonly 'aria-label': string
  readonly id: string
}

/**
 * 버전 탭 컴포넌트
 */
function VersionTab({
  slot,
  version,
  isActive,
  isSelected,
  isLoading,
  onClick,
  onUpload,
  onKeyDown,
  onMoreActions,
  tabIndex,
  'aria-selected': ariaSelected,
  'aria-label': ariaLabel,
  id
}: VersionTabProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const videoFile = files.find(file => file.type.startsWith('video/'))

    if (videoFile) {
      // 파일 크기 검증 (300MB)
      if (videoFile.size > 300 * 1024 * 1024) {
        alert('파일 크기가 300MB를 초과했습니다. 더 작은 파일을 선택해주세요.')
        return
      }
      onUpload(videoFile)
    }
  }, [onUpload])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // 파일 크기 검증 (300MB)
      if (file.size > 300 * 1024 * 1024) {
        alert('파일 크기가 300MB를 초과했습니다. 더 작은 파일을 선택해주세요.')
        return
      }
      onUpload(file)
    }
    // 파일 입력 초기화
    e.target.value = ''
  }, [onUpload])

  const handleClick = useCallback((e: React.MouseEvent) => {
    // 더보기 버튼이 아닌 경우에만 처리
    if ((e.target as HTMLElement).closest('[data-more-button]')) {
      return
    }

    // 빈 슬롯인 경우 파일 선택 다이얼로그 열기
    if (!version && !isLoading) {
      e.preventDefault()
      fileInputRef.current?.click()
    } else {
      onClick()
    }
  }, [version, isLoading, onClick])

  const getSlotColor = useCallback((slot: VideoSlot, active: boolean) => {
    const colors = {
      v1: active ? 'bg-blue-600 border-blue-500' : 'bg-blue-600/20 border-blue-500/30',
      v2: active ? 'bg-green-600 border-green-500' : 'bg-green-600/20 border-green-500/30',
      v3: active ? 'bg-purple-600 border-purple-500' : 'bg-purple-600/20 border-purple-500/30'
    }
    return colors[slot]
  }, [])

  return (
    <button
      id={id}
      role="tab"
      tabIndex={tabIndex}
      aria-selected={ariaSelected}
      aria-label={ariaLabel}
      data-testid={`version-tab-${slot}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={onKeyDown}
      className={`
        relative cursor-pointer select-none w-full text-left
        rounded-lg border-2 transition-all duration-200
        ${getSlotColor(slot, isActive)}
        ${isSelected ? 'ring-2 ring-blue-400' : ''}
        ${isDragging ? 'ring-2 ring-white/50 scale-105' : ''}
        ${isLoading ? 'opacity-75 cursor-wait' : 'hover:scale-102'}
        focus:outline-none focus:ring-2 focus:ring-blue-400
      `}
    >
      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        disabled={isLoading}
        className="hidden"
        aria-hidden="true"
      />

      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center z-10">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      <div className="p-4">
        {/* 슬롯 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-lg uppercase">
              {slot}
            </span>
            {version && isActive && (
              <div className="px-2 py-1 bg-white/20 rounded-full text-xs text-white font-medium">
                현재 활성 버전
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {version && (
              <div className="text-xs text-white/70">
                v{version.versionNumber}
              </div>
            )}
            {version && (
              <button
                data-more-button
                onClick={(e) => {
                  e.stopPropagation()
                  onMoreActions()
                }}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title="더보기"
                aria-label={`${slot} 더보기`}
              >
                <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 버전 정보 */}
        {version ? (
          <div className="space-y-2">
            {/* 썸네일 */}
            {version.thumbnailUrl && (
              <div className="w-full h-20 bg-black/30 rounded-md overflow-hidden flex items-center justify-center">
                <img
                  src={version.thumbnailUrl}
                  alt={`${slot} 썸네일`}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* 파일 정보 */}
            <div className="space-y-1 text-xs text-white/80">
              <div className="truncate" title={version.originalFilename}>
                {version.originalFilename}
              </div>
              <div className="flex justify-between">
                <span>{formatFileSize(version.fileSize)}</span>
                <span>{formatDuration(version.duration)}</span>
              </div>
              <div className="flex justify-between">
                <span>{version.resolution.width}×{version.resolution.height}</span>
                <span>{version.codec}</span>
              </div>
            </div>

            {/* 업로더 정보 */}
            <div className="text-xs text-white/60">
              <div>{version.uploader.name}</div>
              <div>{formatDateTime(version.uploadedAt)}</div>
            </div>

            {/* 교체 사유 */}
            {version.replaceReason && (
              <div className="px-2 py-1 bg-white/10 rounded text-xs text-white/70">
                {version.replaceReason}
              </div>
            )}
          </div>
        ) : (
          /* 빈 슬롯 */
          <div className="h-32 border-2 border-dashed border-white/30 rounded-lg flex flex-col items-center justify-center text-white/60 text-sm">
            <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <div>영상 업로드</div>
            <div className="text-xs mt-1">드래그 또는 클릭</div>
          </div>
        )}

        {/* 드래그 상태 오버레이 */}
        {isDragging && (
          <div className="absolute inset-0 bg-white/20 rounded-lg flex items-center justify-center border-2 border-white border-dashed">
            <div className="text-white text-sm font-medium">
              여기에 영상을 놓아주세요
            </div>
          </div>
        )}
      </div>
    </button>
  )
}

/**
 * 버전 메타데이터 모달 Props
 */
interface VersionMetadataModalProps {
  readonly version: VersionMetadata | null
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onActivate: () => void
  readonly onDelete: () => void
  readonly onRevert: () => void
  readonly canActivate: boolean
  readonly canDelete: boolean
  readonly canRevert: boolean
}

/**
 * 버전 메타데이터 모달 컴포넌트
 */
function VersionMetadataModal({
  version,
  isOpen,
  onClose,
  onActivate,
  onDelete,
  onRevert,
  canActivate,
  canDelete,
  canRevert
}: VersionMetadataModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showRevertConfirm, setShowRevertConfirm] = useState(false)

  if (!isOpen || !version) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg border border-gray-700 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">
            버전 정보 - {version.slot.toUpperCase()} v{version.versionNumber}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors duration-150"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6 space-y-4">
          {/* 썸네일 */}
          {version.thumbnailUrl && (
            <div className="w-full h-40 bg-black/30 rounded-lg overflow-hidden flex items-center justify-center">
              <img
                src={version.thumbnailUrl}
                alt="썸네일"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400 mb-1">파일명</div>
              <div className="text-white break-all">{version.originalFilename}</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">파일 크기</div>
              <div className="text-white">{formatFileSize(version.fileSize)}</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">해상도</div>
              <div className="text-white">
                {version.resolution.width} × {version.resolution.height}
              </div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">길이</div>
              <div className="text-white">{formatDuration(version.duration)}</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">코덱</div>
              <div className="text-white">{version.codec}</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">상태</div>
              <div className="text-white">
                {version.isActive ? (
                  <span className="text-green-400">활성</span>
                ) : (
                  <span className="text-gray-400">비활성</span>
                )}
              </div>
            </div>
          </div>

          {/* 업로드 정보 */}
          <div className="border-t border-gray-700 pt-4">
            <div className="text-gray-400 mb-2">업로드 정보</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">업로더</span>
                <span className="text-white">{version.uploader.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">타입</span>
                <span className="text-white">{version.uploader.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">업로드 시간</span>
                <span className="text-white">{formatDateTime(version.uploadedAt)}</span>
              </div>
            </div>
          </div>

          {/* 교체 사유 */}
          {version.replaceReason && (
            <div className="border-t border-gray-700 pt-4">
              <div className="text-gray-400 mb-2">교체 사유</div>
              <div className="text-white text-sm bg-gray-800 rounded p-3">
                {version.replaceReason}
              </div>
            </div>
          )}

          {/* 해시 정보 */}
          <div className="border-t border-gray-700 pt-4">
            <div className="text-gray-400 mb-2">파일 해시</div>
            <div className="text-white text-xs font-mono break-all bg-gray-800 rounded p-2">
              {version.fileHash}
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-between px-6 py-4 border-t border-gray-700">
          <div className="flex gap-3">
            {canRevert && (
              <button
                onClick={() => setShowRevertConfirm(true)}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg transition-colors duration-150"
                data-testid="revert-version-button"
              >
                이 버전으로 되돌리기
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {canDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors duration-150"
                data-testid="delete-version-button"
              >
                버전 삭제
              </button>
            )}

            {canActivate && (
              <button
                onClick={onActivate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-150"
                data-testid="activate-version-button"
              >
                활성화
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors duration-150"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="버전 삭제 확인"
        message={`정말로 ${version?.slot.toUpperCase()} v${version?.versionNumber} 버전을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        cancelText="취소"
        variant="danger"
        onConfirm={() => {
          onDelete()
          setShowDeleteConfirm(false)
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* 되돌리기 확인 다이얼로그 */}
      <ConfirmDialog
        open={showRevertConfirm}
        title="버전 되돌리기 확인"
        message={`${version?.slot.toUpperCase()} v${version?.versionNumber}으로 되돌리시겠습니까? 현재 활성 버전이 비활성화됩니다.`}
        confirmText="되돌리기"
        cancelText="취소"
        variant="warning"
        onConfirm={() => {
          onRevert()
          setShowRevertConfirm(false)
        }}
        onCancel={() => setShowRevertConfirm(false)}
      />
    </div>
  )
}

/**
 * 메인 향상된 버전 스위처 컴포넌트
 */
export function EnhancedVersionSwitcher() {
  const versionManager = useVersionManager()

  // 로컬 상태
  const [selectedVersion, setSelectedVersion] = useState<VersionMetadata | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [uploadingSlot, setUploadingSlot] = useState<VideoSlot | null>(null)
  const [focusedSlotIndex, setFocusedSlotIndex] = useState(0)
  const [showAllVersions, setShowAllVersions] = useState(false)
  const [toastMessage, setToastMessage] = useState<{type: 'success' | 'error', message: string} | null>(null)

  // Ref for managing focus
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // 버전 데이터 계산
  const slots: VideoSlot[] = ['v1', 'v2', 'v3']
  const activeVersionId = versionManager.activeVersionId

  const slotData = useMemo(() => {
    return slots.map(slot => {
      const history = versionManager.getVersionHistory(slot)
      const activeVersion = versionManager.getActiveVersion(slot)
      return {
        slot,
        history,
        activeVersion,
        isActive: activeVersion?.versionId === activeVersionId
      }
    })
  }, [slots, versionManager, activeVersionId])

  // 토스트 표시 헬퍼
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToastMessage({ type, message })
    setTimeout(() => setToastMessage(null), type === 'error' ? 5000 : 3000)
  }, [])

  // 버전 업로드 핸들러
  const handleVersionUpload = useCallback(async (slot: VideoSlot, file: File) => {
    setUploadingSlot(slot)
    try {
      await versionManager.uploadVersion(slot, file, {
        autoActivate: true,
        generateThumbnail: true,
        notifyParticipants: true
      })
      showToast('success', `${slot.toUpperCase()} 버전이 성공적으로 업로드되었습니다`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '업로드에 실패했습니다'
      showToast('error', message)
    } finally {
      setUploadingSlot(null)
    }
  }, [versionManager, showToast])

  // 버전 활성화 핸들러
  const handleVersionActivate = useCallback(async (versionId: string) => {
    try {
      await versionManager.activateVersion(versionId)
      setIsModalOpen(false)
      showToast('success', '버전이 활성화되었습니다')
    } catch (error) {
      const message = error instanceof Error ? error.message : '버전 활성화에 실패했습니다'
      showToast('error', message)
    }
  }, [versionManager, showToast])

  // 버전 삭제 핸들러
  const handleVersionDelete = useCallback(async (versionId: string) => {
    try {
      await versionManager.deleteVersion(versionId)
      setIsModalOpen(false)
      showToast('success', '버전이 삭제되었습니다')
    } catch (error) {
      const message = error instanceof Error ? error.message : '버전 삭제에 실패했습니다'
      showToast('error', message)
    }
  }, [versionManager, showToast])

  // 버전 되돌리기 핸들러
  const handleVersionRevert = useCallback(async (versionId: string) => {
    try {
      await versionManager.activateVersion(versionId)
      setIsModalOpen(false)
      showToast('success', '버전이 되돌려졌습니다')
    } catch (error) {
      const message = error instanceof Error ? error.message : '버전 되돌리기에 실패했습니다'
      showToast('error', message)
    }
  }, [versionManager, showToast])

  // 버전 상세 보기
  const handleVersionDetails = useCallback((version: VersionMetadata) => {
    setSelectedVersion(version)
    setIsModalOpen(true)
  }, [])

  // 키보드 네비게이션 핸들러
  const handleKeyDown = useCallback((e: React.KeyboardEvent, slotIndex: number) => {
    const slots = ['v1', 'v2', 'v3']

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        const prevIndex = slotIndex > 0 ? slotIndex - 1 : slots.length - 1
        setFocusedSlotIndex(prevIndex)
        tabRefs.current[slots[prevIndex]]?.focus()
        break

      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        const nextIndex = slotIndex < slots.length - 1 ? slotIndex + 1 : 0
        setFocusedSlotIndex(nextIndex)
        tabRefs.current[slots[nextIndex]]?.focus()
        break

      case 'Enter':
      case ' ':
        e.preventDefault()
        const version = slotData[slotIndex].activeVersion
        if (version) {
          if (slotData[slotIndex].isActive) {
            handleVersionDetails(version)
          } else {
            versionManager.activateVersion(version.versionId)
          }
        }
        break

      case 'Delete':
        e.preventDefault()
        const versionToDelete = slotData[slotIndex].activeVersion
        if (versionToDelete && !slotData[slotIndex].isActive) {
          handleVersionDelete(versionToDelete.versionId)
        }
        break
    }
  }, [slotData, handleVersionDetails, versionManager, handleVersionDelete])

  // 숫자 키 단축키 (1/2/3)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.target !== document.body) return

      const num = parseInt(e.key)
      if (num >= 1 && num <= 3) {
        e.preventDefault()
        const slotIndex = num - 1
        const version = slotData[slotIndex]?.activeVersion
        if (version) {
          versionManager.activateVersion(version.versionId)
        }
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [slotData, versionManager])

  return (
    <div className="space-y-4" role="tablist" aria-label="버전 스위처">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          버전 관리
        </h3>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-white/60">
            <input
              type="checkbox"
              checked={showAllVersions}
              onChange={(e) => setShowAllVersions(e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
            />
            모든 버전 보기
          </label>
          <div className="text-sm text-white/60">
            클릭: 전환 | 드래그: 업로드 | 1/2/3: 단축키
          </div>
        </div>
      </div>

      {/* 버전 탭들 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" role="tabpanel">
        {slotData.map(({ slot, activeVersion, isActive }, index) => {
          const ariaLabel = activeVersion
            ? `${slot} 버전 (${activeVersion.uploader.name}, ${formatDateTime(activeVersion.uploadedAt)})`
            : `${slot} 빈 슬롯`

          return (
            <VersionTab
              key={slot}
              id={`version-tab-${slot}`}
              slot={slot}
              version={activeVersion}
              isActive={isActive}
              isSelected={focusedSlotIndex === index}
              isLoading={uploadingSlot === slot}
              tabIndex={index === 0 ? 0 : -1}
              aria-selected={isActive}
              aria-label={ariaLabel}
              onClick={() => {
                setFocusedSlotIndex(index)
                if (activeVersion) {
                  if (isActive) {
                    handleVersionDetails(activeVersion)
                  } else {
                    versionManager.activateVersion(activeVersion.versionId)
                  }
                }
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onUpload={(file) => handleVersionUpload(slot, file)}
              onMoreActions={() => activeVersion && handleVersionDetails(activeVersion)}
            />
          )
        })}
      </div>

      {/* 에러/로딩 상태 */}
      {versionManager.error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4" role="alert">
          <div className="flex items-center gap-2 text-red-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">버전 정보를 불러올 수 없습니다</span>
          </div>
          <p className="text-red-300 text-sm mt-1">{versionManager.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
          >
            다시 시도
          </button>
        </div>
      )}

      {versionManager.isLoading && (
        <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3" />
          <span className="text-white/70">버전을 불러오는 중...</span>
        </div>
      )}

      {/* 버전 통계 */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-gray-400">총 버전: </span>
            <span className="text-white font-medium">
              {slotData.reduce((total, { history }) =>
                total + (history?.totalVersions || 0), 0
              )}
            </span>
          </div>
          <div>
            <span className="text-gray-400">사용 중인 스토리지: </span>
            <span className="text-white font-medium">
              {formatFileSize(versionManager.getStorageUsage())}
            </span>
          </div>
          <div>
            <span className="text-gray-400">활성 버전: </span>
            <span className="text-white font-medium">
              {slotData.find(s => s.isActive)?.slot.toUpperCase() || '없음'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-white/60">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>최대 300MB까지 업로드 가능</span>
          </div>
          <div className="text-white/40">|</div>
          <div>키보드: ←→ 탐색, Enter 선택, Del 삭제</div>
        </div>
      </div>

      {/* 버전 메타데이터 모달 */}
      <VersionMetadataModal
        version={selectedVersion}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onActivate={() => selectedVersion && handleVersionActivate(selectedVersion.versionId)}
        onDelete={() => selectedVersion && handleVersionDelete(selectedVersion.versionId)}
        onRevert={() => selectedVersion && handleVersionRevert(selectedVersion.versionId)}
        canActivate={selectedVersion ? !selectedVersion.isActive : false}
        canDelete={selectedVersion ? !selectedVersion.isActive : false}
        canRevert={selectedVersion ? !selectedVersion.isActive : false}
      />

      {/* 토스트 알림 */}
      {toastMessage && (
        <div className={`
          fixed top-4 right-4 z-50
          px-4 py-3 rounded-lg shadow-lg
          text-white text-sm font-medium
          transform transition-all duration-300
          ${toastMessage.type === 'success'
            ? 'bg-green-600 border border-green-500'
            : 'bg-red-600 border border-red-500'
          }
        `}>
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span>{toastMessage.message}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// 현재 활성 버전 표시를 위한 스크린 리더 전용 텍스트
EnhancedVersionSwitcher.displayName = 'EnhancedVersionSwitcher'