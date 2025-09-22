/**
 * Version Switcher Widget - Phase 3.9
 *
 * CLAUDE.md 준수: widgets 레이어 UI 컴포넌트
 * v1/v2/v3 버전 전환 및 메타데이터 표시 UI 구현
 */

'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useVersionManager } from '../../features/video-feedback/hooks/useVersionManager'
import {
  type VideoSlot,
  type VersionMetadata,
  type VersionHistory
} from '../../entities/feedback'

/**
 * 버전 탭 Props
 */
interface VersionTabProps {
  readonly slot: VideoSlot
  readonly version: VersionMetadata | null
  readonly isActive: boolean
  readonly isLoading: boolean
  readonly onClick: () => void
  readonly onUpload: (file: File) => void
}

/**
 * 버전 탭 컴포넌트
 */
function VersionTab({ slot, version, isActive, isLoading, onClick, onUpload }: VersionTabProps) {
  const [isDragging, setIsDragging] = useState(false)

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
      onUpload(videoFile)
    }
  }, [onUpload])

  const formatFileSize = useCallback((bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(unitIndex > 0 ? 1 : 0)}${units[unitIndex]}`
  }, [])

  const formatDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }, [])

  const getSlotColor = useCallback((slot: VideoSlot, active: boolean) => {
    const colors = {
      v1: active ? 'bg-blue-600 border-blue-500' : 'bg-blue-600/20 border-blue-500/30',
      v2: active ? 'bg-green-600 border-green-500' : 'bg-green-600/20 border-green-500/30',
      v3: active ? 'bg-purple-600 border-purple-500' : 'bg-purple-600/20 border-purple-500/30'
    }
    return colors[slot]
  }, [])

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={onClick}
      className={`
        relative cursor-pointer select-none
        rounded-lg border-2 transition-all duration-200
        ${getSlotColor(slot, isActive)}
        ${isDragging ? 'ring-2 ring-white/50 scale-105' : ''}
        ${isLoading ? 'opacity-75 cursor-wait' : 'hover:scale-102'}
      `}
    >
      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="
          absolute inset-0 bg-black/50 rounded-lg
          flex items-center justify-center z-10
        ">
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
              <div className="
                px-2 py-1 bg-white/20 rounded-full
                text-xs text-white font-medium
              ">
                활성
              </div>
            )}
          </div>

          {version && (
            <div className="text-xs text-white/70">
              v{version.versionNumber}
            </div>
          )}
        </div>

        {/* 버전 정보 */}
        {version ? (
          <div className="space-y-2">
            {/* 썸네일 */}
            {version.thumbnailUrl && (
              <div className="
                w-full h-20 bg-black/30 rounded-md overflow-hidden
                flex items-center justify-center
              ">
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
              <div>{new Date(version.uploadedAt).toLocaleDateString()}</div>
            </div>

            {/* 교체 사유 */}
            {version.replaceReason && (
              <div className="
                px-2 py-1 bg-white/10 rounded text-xs text-white/70
              ">
                {version.replaceReason}
              </div>
            )}
          </div>
        ) : (
          /* 빈 슬롯 */
          <div className="
            h-32 border-2 border-dashed border-white/30 rounded-lg
            flex flex-col items-center justify-center
            text-white/60 text-sm
          ">
            <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <div>영상 업로드</div>
            <div className="text-xs mt-1">드래그 또는 클릭</div>
          </div>
        )}

        {/* 드래그 상태 오버레이 */}
        {isDragging && (
          <div className="
            absolute inset-0 bg-white/20 rounded-lg
            flex items-center justify-center
            border-2 border-white border-dashed
          ">
            <div className="text-white text-sm font-medium">
              여기에 영상을 놓아주세요
            </div>
          </div>
        )}
      </div>
    </div>
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
  readonly canActivate: boolean
  readonly canDelete: boolean
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
  canActivate,
  canDelete
}: VersionMetadataModalProps) {
  if (!isOpen || !version) return null

  return (
    <div className="
      fixed inset-0 bg-black/50 backdrop-blur-sm
      flex items-center justify-center z-50
    ">
      <div className="
        bg-gray-900 rounded-lg border border-gray-700
        max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto
      ">
        {/* 헤더 */}
        <div className="
          flex items-center justify-between
          px-6 py-4 border-b border-gray-700
        ">
          <h3 className="text-lg font-semibold text-white">
            버전 정보 - {version.slot.toUpperCase()} v{version.versionNumber}
          </h3>
          <button
            onClick={onClose}
            className="
              p-1 hover:bg-gray-800 rounded
              text-gray-400 hover:text-white
              transition-colors duration-150
            "
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
            <div className="
              w-full h-40 bg-black/30 rounded-lg overflow-hidden
              flex items-center justify-center
            ">
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
              <div className="text-white">
                {(version.fileSize / 1024 / 1024).toFixed(1)} MB
              </div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">해상도</div>
              <div className="text-white">
                {version.resolution.width} × {version.resolution.height}
              </div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">길이</div>
              <div className="text-white">
                {Math.floor(version.duration / 60)}분 {Math.floor(version.duration % 60)}초
              </div>
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
                <span className="text-white">
                  {new Date(version.uploadedAt).toLocaleString()}
                </span>
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
        <div className="
          flex justify-end gap-3
          px-6 py-4 border-t border-gray-700
        ">
          {canDelete && (
            <button
              onClick={onDelete}
              className="
                px-4 py-2 bg-red-600 hover:bg-red-700
                text-white text-sm font-medium rounded-lg
                transition-colors duration-150
              "
            >
              삭제
            </button>
          )}

          {canActivate && (
            <button
              onClick={onActivate}
              className="
                px-4 py-2 bg-blue-600 hover:bg-blue-700
                text-white text-sm font-medium rounded-lg
                transition-colors duration-150
              "
            >
              활성화
            </button>
          )}

          <button
            onClick={onClose}
            className="
              px-4 py-2 bg-gray-700 hover:bg-gray-600
              text-white text-sm font-medium rounded-lg
              transition-colors duration-150
            "
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 메인 버전 스위처 컴포넌트
 */
export function VersionSwitcher() {
  const versionManager = useVersionManager()

  // 로컬 상태
  const [selectedVersion, setSelectedVersion] = useState<VersionMetadata | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [uploadingSlot, setUploadingSlot] = useState<VideoSlot | null>(null)

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

  // 버전 업로드 핸들러
  const handleVersionUpload = useCallback(async (slot: VideoSlot, file: File) => {
    setUploadingSlot(slot)
    try {
      await versionManager.uploadVersion(slot, file, {
        autoActivate: true,
        generateThumbnail: true,
        notifyParticipants: true
      })
    } catch (error) {
      console.error('버전 업로드 실패:', error)
      // TODO: 에러 토스트 표시
    } finally {
      setUploadingSlot(null)
    }
  }, [versionManager])

  // 버전 활성화 핸들러
  const handleVersionActivate = useCallback(async (versionId: string) => {
    try {
      await versionManager.activateVersion(versionId)
      setIsModalOpen(false)
    } catch (error) {
      console.error('버전 활성화 실패:', error)
      // TODO: 에러 토스트 표시
    }
  }, [versionManager])

  // 버전 삭제 핸들러
  const handleVersionDelete = useCallback(async (versionId: string) => {
    if (confirm('정말로 이 버전을 삭제하시겠습니까?')) {
      try {
        await versionManager.deleteVersion(versionId)
        setIsModalOpen(false)
      } catch (error) {
        console.error('버전 삭제 실패:', error)
        // TODO: 에러 토스트 표시
      }
    }
  }, [versionManager])

  // 버전 상세 보기
  const handleVersionDetails = useCallback((version: VersionMetadata) => {
    setSelectedVersion(version)
    setIsModalOpen(true)
  }, [])

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          버전 관리
        </h3>
        <div className="text-sm text-white/60">
          클릭하여 전환, 드래그하여 업로드
        </div>
      </div>

      {/* 버전 탭들 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {slotData.map(({ slot, activeVersion, isActive }) => (
          <VersionTab
            key={slot}
            slot={slot}
            version={activeVersion}
            isActive={isActive}
            isLoading={uploadingSlot === slot}
            onClick={() => {
              if (activeVersion) {
                if (isActive) {
                  handleVersionDetails(activeVersion)
                } else {
                  versionManager.activateVersion(activeVersion.versionId)
                }
              }
            }}
            onUpload={(file) => handleVersionUpload(slot, file)}
          />
        ))}
      </div>

      {/* 버전 통계 */}
      <div className="
        bg-gray-800/50 rounded-lg border border-gray-700
        p-4 flex items-center justify-between
      ">
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
              {((versionManager.getStorageUsage()) / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/60">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>최대 300MB까지 업로드 가능</span>
        </div>
      </div>

      {/* 버전 메타데이터 모달 */}
      <VersionMetadataModal
        version={selectedVersion}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onActivate={() => selectedVersion && handleVersionActivate(selectedVersion.versionId)}
        onDelete={() => selectedVersion && handleVersionDelete(selectedVersion.versionId)}
        canActivate={selectedVersion ? !selectedVersion.isActive : false}
        canDelete={selectedVersion ? !selectedVersion.isActive : false}
      />
    </div>
  )
}