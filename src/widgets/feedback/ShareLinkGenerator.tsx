/**
 * ShareLinkGenerator Widget
 *
 * CLAUDE.md 준수: widgets 레이어 합성 컴포넌트
 * URL 공유 링크 생성, QR 코드 생성, 권한 설정을 제공하는 컴포넌트
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { selectCurrentSession } from '../../entities/feedback'
import type { ParticipantPermissions } from '../../entities/feedback'

/**
 * QR 코드 생성을 위한 간단한 구현
 * 프로덕션에서는 qrcode 라이브러리 사용 권장
 */
function generateQRCodeDataURL(text: string, size: number = 200): string {
  // 임시로 placeholder 이미지 반환
  // 실제로는 QR 코드 라이브러리를 사용해야 함
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="white"/>
      <text x="${size/2}" y="${size/2}" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="14" fill="black">
        QR Code
      </text>
      <text x="${size/2}" y="${size/2 + 20}" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="10" fill="gray">
        ${text.slice(0, 20)}...
      </text>
    </svg>
  `)}`
}

/**
 * 권한 프리셋
 */
const PERMISSION_PRESETS = {
  'view-only': {
    label: '보기만 가능',
    description: '영상만 시청할 수 있습니다',
    permissions: {
      canComment: false,
      canReact: false,
      canEditSession: false,
      canManageVideos: false,
      canInviteOthers: false
    }
  },
  'comment-only': {
    label: '댓글만 가능',
    description: '영상 시청과 댓글 작성이 가능합니다',
    permissions: {
      canComment: true,
      canReact: false,
      canEditSession: false,
      canManageVideos: false,
      canInviteOthers: false
    }
  },
  'full-feedback': {
    label: '피드백 전체',
    description: '댓글과 감정 반응 모두 가능합니다',
    permissions: {
      canComment: true,
      canReact: true,
      canEditSession: false,
      canManageVideos: false,
      canInviteOthers: false
    }
  },
  'collaborator': {
    label: '협업자',
    description: '세션 관리를 제외한 모든 기능이 가능합니다',
    permissions: {
      canComment: true,
      canReact: true,
      canEditSession: false,
      canManageVideos: true,
      canInviteOthers: true
    }
  }
} as const

/**
 * ShareLinkGenerator Props
 */
interface ShareLinkGeneratorProps {
  /** 현재 세션 ID */
  readonly sessionId?: string

  /** 기본 권한 설정 */
  readonly defaultPermissions?: keyof typeof PERMISSION_PRESETS

  /** 만료일 설정 허용 */
  readonly allowExpiration?: boolean

  /** 암호 보호 허용 */
  readonly allowPassword?: boolean

  /** QR 코드 표시 */
  readonly showQRCode?: boolean

  /** CSS 클래스명 */
  readonly className?: string

  /** 접근성 라벨 */
  readonly 'aria-label'?: string

  /** 링크 생성 완료 콜백 */
  readonly onLinkGenerated?: (link: string, options: ShareLinkOptions) => void

  /** 복사 완료 콜백 */
  readonly onCopySuccess?: (link: string) => void

  /** 오류 콜백 */
  readonly onError?: (error: string) => void
}

/**
 * 공유 링크 옵션
 */
interface ShareLinkOptions {
  readonly permissions: ParticipantPermissions
  readonly expiresAt?: Date
  readonly password?: string
  readonly allowGuests: boolean
  readonly maxUses?: number
}

/**
 * ShareLinkGenerator 컴포넌트
 */
export function ShareLinkGenerator(props: ShareLinkGeneratorProps) {
  const {
    sessionId,
    defaultPermissions = 'full-feedback',
    allowExpiration = true,
    allowPassword = false,
    showQRCode = true,
    className = '',
    'aria-label': ariaLabel = '공유 링크 생성기',
    onLinkGenerated,
    onCopySuccess,
    onError
  } = props

  // Redux 상태
  const currentSession = useSelector(selectCurrentSession)

  // 로컬 상태
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof PERMISSION_PRESETS>(defaultPermissions)
  const [customPermissions, setCustomPermissions] = useState<ParticipantPermissions>(
    PERMISSION_PRESETS[defaultPermissions].permissions
  )
  const [expirationDate, setExpirationDate] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [allowGuests, setAllowGuests] = useState(true)
  const [maxUses, setMaxUses] = useState<number | undefined>(undefined)
  const [generatedLink, setGeneratedLink] = useState<string>('')
  const [qrCodeURL, setQRCodeURL] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Refs
  const linkInputRef = useRef<HTMLInputElement>(null)

  // 현재 세션 ID
  const effectiveSessionId = sessionId || currentSession?.metadata.id

  // 만료일 최소값 (오늘 + 1일)
  const minExpirationDate = useMemo(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }, [])

  // 권한 프리셋 변경 처리
  const handlePresetChange = useCallback((preset: keyof typeof PERMISSION_PRESETS) => {
    setSelectedPreset(preset)
    setCustomPermissions(PERMISSION_PRESETS[preset].permissions)
  }, [])

  // 개별 권한 변경 처리
  const handlePermissionChange = useCallback((permission: keyof ParticipantPermissions, value: boolean) => {
    setCustomPermissions(prev => ({
      ...prev,
      [permission]: value
    }))
    setSelectedPreset('full-feedback') // 커스텀 변경 시 프리셋 초기화
  }, [])

  // 링크 생성
  const generateShareLink = useCallback(async () => {
    if (!effectiveSessionId) {
      onError?.('세션 ID가 없습니다')
      return
    }

    setIsGenerating(true)

    try {
      const options: ShareLinkOptions = {
        permissions: customPermissions,
        expiresAt: expirationDate ? new Date(expirationDate) : undefined,
        password: password || undefined,
        allowGuests,
        maxUses
      }

      // API 호출하여 공유 링크 생성
      const response = await fetch('/api/feedback/share-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: effectiveSessionId,
          options
        })
      })

      if (!response.ok) {
        throw new Error('링크 생성에 실패했습니다')
      }

      const { shareToken } = await response.json()
      const baseURL = window.location.origin
      const shareLink = `${baseURL}/feedback/share/${shareToken}`

      setGeneratedLink(shareLink)

      // QR 코드 생성
      if (showQRCode) {
        const qrURL = generateQRCodeDataURL(shareLink, 150)
        setQRCodeURL(qrURL)
      }

      onLinkGenerated?.(shareLink, options)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '링크 생성에 실패했습니다'
      onError?.(errorMessage)
    } finally {
      setIsGenerating(false)
    }
  }, [
    effectiveSessionId,
    customPermissions,
    expirationDate,
    password,
    allowGuests,
    maxUses,
    showQRCode,
    onLinkGenerated,
    onError
  ])

  // 링크 복사
  const copyToClipboard = useCallback(async () => {
    if (!generatedLink) return

    try {
      await navigator.clipboard.writeText(generatedLink)
      setCopySuccess(true)
      onCopySuccess?.(generatedLink)

      // 3초 후 복사 성공 상태 초기화
      setTimeout(() => setCopySuccess(false), 3000)
    } catch (error) {
      // Fallback: 수동 복사
      if (linkInputRef.current) {
        linkInputRef.current.select()
        document.execCommand('copy')
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 3000)
      }
    }
  }, [generatedLink, onCopySuccess])

  // 새 링크 생성
  const resetLink = useCallback(() => {
    setGeneratedLink('')
    setQRCodeURL('')
    setCopySuccess(false)
  }, [])

  // 컴포넌트 마운트 시 권한 동기화
  useEffect(() => {
    setCustomPermissions(PERMISSION_PRESETS[selectedPreset].permissions)
  }, [selectedPreset])

  if (!effectiveSessionId) {
    return (
      <div className={`text-center text-gray-500 py-8 ${className}`}>
        <p>세션이 로드되지 않았습니다</p>
      </div>
    )
  }

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}
      aria-label={ariaLabel}
      data-testid="share-link-generator"
    >
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">공유 링크 생성</h3>
        <p className="text-sm text-gray-500 mt-1">
          다른 사용자가 피드백 세션에 참여할 수 있는 링크를 생성합니다
        </p>
      </div>

      <div className="px-6 py-4 space-y-6">
        {/* 권한 프리셋 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            접근 권한 설정
          </label>
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(PERMISSION_PRESETS).map(([key, preset]) => (
              <label
                key={key}
                className={`relative flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                  selectedPreset === key
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="permission-preset"
                  value={key}
                  checked={selectedPreset === key}
                  onChange={(e) => handlePresetChange(e.target.value as keyof typeof PERMISSION_PRESETS)}
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                  data-testid={`preset-${key}`}
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">
                    {preset.label}
                  </div>
                  <div className="text-sm text-gray-500">
                    {preset.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 고급 설정 토글 */}
        <div className="flex items-center justify-between py-2 border-t border-gray-200">
          <span className="text-sm font-medium text-gray-700">고급 설정</span>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:text-blue-800"
            data-testid="advanced-toggle"
          >
            {showAdvanced ? '숨기기' : '표시'}
          </button>
        </div>

        {/* 고급 설정 */}
        {showAdvanced && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            {/* 개별 권한 설정 */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">세부 권한</div>
              <div className="space-y-2">
                {Object.entries(customPermissions).map(([key, value]) => (
                  <label key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => handlePermissionChange(key as keyof ParticipantPermissions, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      data-testid={`permission-${key}`}
                    />
                    <span className="ml-2 text-sm text-gray-600">
                      {key === 'canComment' && '댓글 작성'}
                      {key === 'canReact' && '감정 반응'}
                      {key === 'canEditSession' && '세션 편집'}
                      {key === 'canManageVideos' && '영상 관리'}
                      {key === 'canInviteOthers' && '다른 사용자 초대'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 만료일 설정 */}
            {allowExpiration && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  만료일 (선택사항)
                </label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  min={minExpirationDate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  data-testid="expiration-date"
                />
              </div>
            )}

            {/* 암호 설정 */}
            {allowPassword && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  암호 (선택사항)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="링크 접근을 위한 암호"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  data-testid="password-input"
                />
              </div>
            )}

            {/* 게스트 허용 */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allowGuests}
                  onChange={(e) => setAllowGuests(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  data-testid="allow-guests"
                />
                <span className="ml-2 text-sm text-gray-600">게스트 접근 허용</span>
              </label>
            </div>

            {/* 최대 사용 횟수 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                최대 사용 횟수 (선택사항)
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={maxUses || ''}
                onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="제한 없음"
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                data-testid="max-uses"
              />
            </div>
          </div>
        )}

        {/* 링크 생성 버튼 */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={generateShareLink}
            disabled={isGenerating}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="generate-link-button"
          >
            {isGenerating ? '생성 중...' : '공유 링크 생성'}
          </button>
        </div>

        {/* 생성된 링크 */}
        {generatedLink && (
          <div className="space-y-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-green-800">공유 링크가 생성되었습니다</h4>
              <button
                type="button"
                onClick={resetLink}
                className="text-sm text-green-600 hover:text-green-800"
                data-testid="reset-link-button"
              >
                새로 생성
              </button>
            </div>

            {/* 링크 입력 필드 */}
            <div className="flex space-x-2">
              <input
                ref={linkInputRef}
                type="text"
                value={generatedLink}
                readOnly
                className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm"
                data-testid="generated-link"
              />
              <button
                type="button"
                onClick={copyToClipboard}
                className={`px-4 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  copySuccess
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                data-testid="copy-link-button"
              >
                {copySuccess ? '복사됨!' : '복사'}
              </button>
            </div>

            {/* QR 코드 */}
            {showQRCode && qrCodeURL && (
              <div className="flex justify-center">
                <div className="text-center">
                  <img
                    src={qrCodeURL}
                    alt="QR 코드"
                    className="w-32 h-32 border border-gray-200 rounded-md"
                    data-testid="qr-code"
                  />
                  <p className="text-xs text-gray-500 mt-2">QR 코드로 공유</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}