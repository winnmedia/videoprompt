/**
 * Video Player Controls Widget - Phase 3.9
 *
 * CLAUDE.md 준수: widgets 레이어 UI 컴포넌트
 * 플레이어 하부 툴바 (Replace/Share/Snapshot/Feedback@TC) UI 구현
 */

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { usePlayerControls } from '../../features/video-feedback/hooks/usePlayerControls'
import { useVersionManager } from '../../features/video-feedback/hooks/useVersionManager'
import { useAdvancedSharing } from '../../features/video-feedback/hooks/useAdvancedSharing'

/**
 * 툴바 버튼 props
 */
interface ToolbarButtonProps {
  readonly icon: React.ReactNode
  readonly label: string
  readonly shortcut?: string
  readonly onClick: () => void
  readonly disabled?: boolean
  readonly loading?: boolean
  readonly className?: string
}

/**
 * 툴바 버튼 컴포넌트
 */
function ToolbarButton({
  icon,
  label,
  shortcut,
  onClick,
  disabled = false,
  loading = false,
  className = ''
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        relative flex items-center gap-2 px-4 py-2 rounded-lg
        bg-white/10 hover:bg-white/20 backdrop-blur-sm
        border border-white/20 hover:border-white/30
        text-white text-sm font-medium
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${loading ? 'cursor-wait' : 'cursor-pointer'}
        ${className}
      `}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        icon
      )}
      <span className="whitespace-nowrap">{label}</span>
      {shortcut && (
        <span className="text-xs text-white/60 ml-1">
          {shortcut}
        </span>
      )}
    </button>
  )
}

/**
 * 파일 드롭존 컴포넌트
 */
interface FileDropzoneProps {
  readonly onFileSelect: (file: File) => void
  readonly accept: string
  readonly disabled?: boolean
  readonly children: React.ReactNode
}

function FileDropzone({ onFileSelect, accept, disabled = false, children }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    const validFile = files.find(file => file.type.startsWith('video/'))

    if (validFile) {
      onFileSelect(validFile)
    }
  }, [disabled, onFileSelect])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
    // 파일 입력 초기화 (같은 파일 재선택 허용)
    e.target.value = ''
  }, [onFileSelect])

  const openFileDialog = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }, [disabled])

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={openFileDialog}
      className={`
        relative cursor-pointer
        ${isDragging ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />
      {children}
    </div>
  )
}

/**
 * 공유 빠른 메뉴 컴포넌트
 */
interface QuickShareMenuProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onQuickShare: (level: 'view' | 'comment') => void
  readonly onAdvancedShare: () => void
}

function QuickShareMenu({ isOpen, onClose, onQuickShare, onAdvancedShare }: QuickShareMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={menuRef}
      className="
        absolute bottom-full mb-2 left-0 z-50
        bg-gray-900 rounded-lg border border-gray-700
        shadow-xl min-w-48
      "
    >
      <div className="p-2 space-y-1">
        <button
          onClick={() => onQuickShare('view')}
          className="
            w-full text-left px-3 py-2 rounded-md
            text-sm text-white hover:bg-gray-800
            transition-colors duration-150
          "
        >
          <div className="font-medium">빠른 공유 (보기)</div>
          <div className="text-xs text-gray-400">7일 만료, 보기 전용</div>
        </button>

        <button
          onClick={() => onQuickShare('comment')}
          className="
            w-full text-left px-3 py-2 rounded-md
            text-sm text-white hover:bg-gray-800
            transition-colors duration-150
          "
        >
          <div className="font-medium">빠른 공유 (댓글)</div>
          <div className="text-xs text-gray-400">7일 만료, 댓글 허용</div>
        </button>

        <hr className="border-gray-700" />

        <button
          onClick={onAdvancedShare}
          className="
            w-full text-left px-3 py-2 rounded-md
            text-sm text-white hover:bg-gray-800
            transition-colors duration-150
          "
        >
          <div className="font-medium">고급 공유 설정</div>
          <div className="text-xs text-gray-400">권한, 만료, QR코드 등</div>
        </button>
      </div>
    </div>
  )
}

/**
 * 메인 비디오 플레이어 컨트롤 컴포넌트
 */
export function VideoPlayerControls() {
  const playerControls = usePlayerControls()
  const versionManager = useVersionManager()
  const sharingManager = useAdvancedSharing()

  // 로컬 상태
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false)
  const [showToast, setShowToast] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // 성공/에러 토스트 표시
  const showSuccessToast = useCallback((message: string) => {
    setShowToast({ type: 'success', message })
    setTimeout(() => setShowToast(null), 3000)
  }, [])

  const showErrorToast = useCallback((message: string) => {
    setShowToast({ type: 'error', message })
    setTimeout(() => setShowToast(null), 5000)
  }, [])

  // 영상 교체 핸들러
  const handleVideoReplace = useCallback(async (file: File) => {
    try {
      await playerControls.replaceVideo(file, {
        replaceReason: '사용자 업로드',
        autoActivate: true,
        notifyParticipants: true
      })
      showSuccessToast('영상이 성공적으로 교체되었습니다')
    } catch (error) {
      const message = error instanceof Error ? error.message : '영상 교체에 실패했습니다'
      showErrorToast(message)
    }
  }, [playerControls, showSuccessToast, showErrorToast])

  // 빠른 공유 핸들러
  const handleQuickShare = useCallback(async (level: 'view' | 'comment') => {
    try {
      const shareUrl = await playerControls.quickShare(level)
      await navigator.clipboard.writeText(shareUrl)
      showSuccessToast('공유 링크가 클립보드에 복사되었습니다')
      setIsShareMenuOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : '공유 링크 생성에 실패했습니다'
      showErrorToast(message)
    }
  }, [playerControls, showSuccessToast, showErrorToast])

  // 스크린샷 핸들러
  const handleScreenshot = useCallback(async () => {
    try {
      const screenshot = await playerControls.captureScreenshot({
        quality: 90,
        format: 'jpg',
        autoDownload: true
      })
      showSuccessToast('스크린샷이 저장되었습니다')
    } catch (error) {
      const message = error instanceof Error ? error.message : '스크린샷 캡처에 실패했습니다'
      showErrorToast(message)
    }
  }, [playerControls, showSuccessToast, showErrorToast])

  // 피드백 시작 핸들러
  const handleFeedbackStart = useCallback(() => {
    try {
      playerControls.startFeedbackAtCurrentTime()
      showSuccessToast('현재 시점에서 피드백을 시작합니다')
    } catch (error) {
      const message = error instanceof Error ? error.message : '피드백 시작에 실패했습니다'
      showErrorToast(message)
    }
  }, [playerControls, showSuccessToast, showErrorToast])

  // 키보드 단축키 등록
  useEffect(() => {
    const cleanup = playerControls.registerShortcuts()
    return cleanup
  }, [playerControls])

  // 에러 상태 모니터링
  useEffect(() => {
    if (playerControls.error) {
      showErrorToast(playerControls.error)
    }
  }, [playerControls.error, showErrorToast])

  return (
    <div className="relative">
      {/* 메인 툴바 */}
      <div className="
        flex items-center justify-between
        bg-black/50 backdrop-blur-md
        border border-white/10 rounded-lg
        px-4 py-3
      ">
        {/* 좌측 액션 버튼들 */}
        <div className="flex items-center gap-3">
          {/* 영상 교체 버튼 */}
          <FileDropzone
            onFileSelect={handleVideoReplace}
            accept="video/*"
            disabled={playerControls.isProcessing}
          >
            <ToolbarButton
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              }
              label="교체"
              shortcut="Ctrl+R"
              onClick={() => {}} // FileDropzone가 처리
              disabled={playerControls.isProcessing}
              loading={playerControls.isProcessing && playerControls.lastAction === 'replace'}
            />
          </FileDropzone>

          {/* 영상 공유 버튼 */}
          <div className="relative">
            <ToolbarButton
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
              }
              label="공유"
              shortcut="Ctrl+S"
              onClick={() => setIsShareMenuOpen(!isShareMenuOpen)}
              disabled={playerControls.isProcessing}
              loading={playerControls.isProcessing && playerControls.lastAction?.includes('share')}
            />

            <QuickShareMenu
              open={isShareMenuOpen}
              onClose={() => setIsShareMenuOpen(false)}
              onQuickShare={handleQuickShare}
              onAdvancedShare={playerControls.openShareModal}
            />
          </div>

          {/* 스크린샷 버튼 */}
          <ToolbarButton
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            label="스크린샷"
            shortcut="Ctrl+Shift+S"
            onClick={handleScreenshot}
            disabled={playerControls.isProcessing}
            loading={playerControls.isProcessing && playerControls.lastAction === 'screenshot'}
          />

          {/* 구분선 */}
          <div className="h-6 w-px bg-white/20" />

          {/* 현재 시점 피드백 버튼 */}
          <ToolbarButton
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
            label="피드백 @TC"
            shortcut="T"
            onClick={handleFeedbackStart}
            disabled={playerControls.isProcessing}
            className="bg-blue-600/20 border-blue-500/30 hover:bg-blue-600/30 hover:border-blue-500/50"
          />
        </div>

        {/* 우측 정보 */}
        <div className="flex items-center gap-4 text-sm text-white/70">
          {/* 현재 타임코드 */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-mono">
              {playerControls.getCurrentTimecodeString()}
            </span>
          </div>

          {/* 처리 상태 */}
          {playerControls.isProcessing && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-xs">
                {playerControls.lastAction === 'replace' && '영상 교체 중...'}
                {playerControls.lastAction?.includes('share') && '공유 링크 생성 중...'}
                {playerControls.lastAction === 'screenshot' && '스크린샷 캡처 중...'}
                {playerControls.lastAction?.includes('reaction') && '반응 추가 중...'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 토스트 알림 */}
      {showToast && (
        <div className={`
          fixed top-4 right-4 z-50
          px-4 py-3 rounded-lg shadow-lg
          text-white text-sm font-medium
          transform transition-all duration-300
          ${showToast.type === 'success'
            ? 'bg-green-600 border border-green-500'
            : 'bg-red-600 border border-red-500'
          }
        `}>
          <div className="flex items-center gap-2">
            {showToast.type === 'success' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span>{showToast.message}</span>
          </div>
        </div>
      )}
    </div>
  )
}