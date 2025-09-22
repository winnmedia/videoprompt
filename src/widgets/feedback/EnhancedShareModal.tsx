/**
 * Enhanced Share Modal Widget - Phase 3.9
 *
 * CLAUDE.md 준수: widgets 레이어 UI 컴포넌트
 * 고급 공유 설정 (권한, 만료, QR코드 등) 모달 UI 구현
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAdvancedSharing } from '../../features/video-feedback/hooks/useAdvancedSharing'
import {
  type ShareLinkCreationOptions,
  type ShareLinkToken,
  type ShareStats,
  type ShareAccessLog
} from '../../features/video-feedback/hooks/useAdvancedSharing'

/**
 * 향상된 공유 모달 Props
 */
interface EnhancedShareModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

/**
 * 권한 레벨 옵션
 */
const ACCESS_LEVELS = [
  { value: 'view', label: '보기 전용', description: '영상만 볼 수 있음' },
  { value: 'comment', label: '댓글 작성', description: '댓글 작성 가능' },
  { value: 'react', label: '반응 표현', description: '감정 반응 추가 가능' },
  { value: 'edit', label: '편집 권한', description: '댓글 수정/삭제 가능' },
  { value: 'admin', label: '관리자', description: '모든 권한 포함' }
] as const

/**
 * 만료 시간 프리셋
 */
const EXPIRY_PRESETS = [
  { label: '1시간', value: 1 * 60 * 60 * 1000 },
  { label: '1일', value: 24 * 60 * 60 * 1000 },
  { label: '7일', value: 7 * 24 * 60 * 60 * 1000 },
  { label: '30일', value: 30 * 24 * 60 * 60 * 1000 },
  { label: '무제한', value: null }
] as const

/**
 * 공유 링크 생성 폼 컴포넌트
 */
function ShareLinkForm({
  onSubmit,
  isSubmitting
}: {
  onSubmit: (options: ShareLinkCreationOptions) => void
  isSubmitting: boolean
}) {
  const [formData, setFormData] = useState<ShareLinkCreationOptions>({
    accessLevel: 'view',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
    requiresAuth: false,
    enableQrCode: true,
    notifyOnAccess: false,
    description: ''
  })

  const [customExpiry, setCustomExpiry] = useState('')
  const [allowedDomains, setAllowedDomains] = useState('')
  const [maxUses, setMaxUses] = useState<string>('')

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()

    const options: ShareLinkCreationOptions = {
      ...formData,
      allowedDomains: allowedDomains.trim()
        ? allowedDomains.split(',').map(d => d.trim()).filter(Boolean)
        : undefined,
      maxUses: maxUses ? parseInt(maxUses) : undefined
    }

    onSubmit(options)
  }, [formData, allowedDomains, maxUses, onSubmit])

  const handleExpiryPreset = useCallback((value: number | null) => {
    if (value === null) {
      setFormData(prev => ({ ...prev, expiresAt: undefined }))
    } else {
      setFormData(prev => ({ ...prev, expiresAt: new Date(Date.now() + value) }))
    }
  }, [])

  const handleCustomExpiryChange = useCallback((value: string) => {
    setCustomExpiry(value)
    if (value) {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        setFormData(prev => ({ ...prev, expiresAt: date }))
      }
    }
  }, [])

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 권한 레벨 */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          액세스 권한
        </label>
        <div className="space-y-2">
          {ACCESS_LEVELS.map(level => (
            <label key={level.value} className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="accessLevel"
                value={level.value}
                checked={formData.accessLevel === level.value}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  accessLevel: e.target.value as any
                }))}
                className="mt-1 text-blue-600 bg-gray-700 border-gray-600"
              />
              <div>
                <div className="text-white font-medium">{level.label}</div>
                <div className="text-sm text-gray-400">{level.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 만료 설정 */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          만료 시간
        </label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {EXPIRY_PRESETS.map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleExpiryPreset(preset.value)}
              className={`
                px-3 py-2 text-sm rounded-lg border transition-colors duration-150
                ${formData.expiresAt === undefined && preset.value === null
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                }
              `}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <input
          type="datetime-local"
          value={customExpiry}
          onChange={(e) => handleCustomExpiryChange(e.target.value)}
          className="
            w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg
            text-white placeholder-gray-400
            focus:border-blue-500 focus:ring-1 focus:ring-blue-500
          "
          placeholder="사용자 정의 만료 시간"
        />
      </div>

      {/* 최대 사용 횟수 */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          최대 사용 횟수 (선택사항)
        </label>
        <input
          type="number"
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          min="1"
          placeholder="무제한"
          className="
            w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg
            text-white placeholder-gray-400
            focus:border-blue-500 focus:ring-1 focus:ring-blue-500
          "
        />
      </div>

      {/* 허용 도메인 */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          허용 도메인 (선택사항)
        </label>
        <input
          type="text"
          value={allowedDomains}
          onChange={(e) => setAllowedDomains(e.target.value)}
          placeholder="example.com, company.co.kr"
          className="
            w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg
            text-white placeholder-gray-400
            focus:border-blue-500 focus:ring-1 focus:ring-blue-500
          "
        />
        <div className="text-xs text-gray-400 mt-1">
          쉼표로 구분하여 여러 도메인 입력 가능
        </div>
      </div>

      {/* 추가 옵션 */}
      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.requiresAuth || false}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              requiresAuth: e.target.checked
            }))}
            className="text-blue-600 bg-gray-700 border-gray-600"
          />
          <div>
            <div className="text-white font-medium">로그인 필요</div>
            <div className="text-sm text-gray-400">로그인한 사용자만 접근 가능</div>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.enableQrCode || false}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              enableQrCode: e.target.checked
            }))}
            className="text-blue-600 bg-gray-700 border-gray-600"
          />
          <div>
            <div className="text-white font-medium">QR 코드 생성</div>
            <div className="text-sm text-gray-400">모바일 접근을 위한 QR 코드</div>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.notifyOnAccess || false}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              notifyOnAccess: e.target.checked
            }))}
            className="text-blue-600 bg-gray-700 border-gray-600"
          />
          <div>
            <div className="text-white font-medium">접근 알림</div>
            <div className="text-sm text-gray-400">누군가 링크에 접근할 때 알림</div>
          </div>
        </label>
      </div>

      {/* 설명 */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          설명 (선택사항)
        </label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            description: e.target.value
          }))}
          rows={3}
          placeholder="이 공유 링크에 대한 설명을 입력하세요..."
          className="
            w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg
            text-white placeholder-gray-400 resize-none
            focus:border-blue-500 focus:ring-1 focus:ring-blue-500
          "
        />
      </div>

      {/* 제출 버튼 */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="
          w-full py-3 bg-blue-600 hover:bg-blue-700
          text-white font-medium rounded-lg
          transition-colors duration-150
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-2
        "
      >
        {isSubmitting && (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        )}
        <span>공유 링크 생성</span>
      </button>
    </form>
  )
}

/**
 * 공유 링크 목록 컴포넌트
 */
function ShareLinkList({
  links,
  onCopy,
  onDeactivate,
  onDelete,
  onRegenerate
}: {
  links: ShareLinkToken[]
  onCopy: (link: ShareLinkToken) => void
  onDeactivate: (tokenId: string) => void
  onDelete: (tokenId: string) => void
  onRegenerate: (tokenId: string) => void
}) {
  const [expandedLink, setExpandedLink] = useState<string | null>(null)

  const formatExpiry = useCallback((date?: Date) => {
    if (!date) return '무제한'
    return new Date(date).toLocaleString()
  }, [])

  const isExpired = useCallback((date?: Date) => {
    if (!date) return false
    return new Date(date) <= new Date()
  }, [])

  const getAccessLevelLabel = useCallback((level: string) => {
    return ACCESS_LEVELS.find(l => l.value === level)?.label || level
  }, [])

  if (links.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        생성된 공유 링크가 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {links.map(link => (
        <div
          key={link.token}
          className="
            bg-gray-800 rounded-lg border border-gray-700
            hover:border-gray-600 transition-colors duration-150
          "
        >
          {/* 링크 헤더 */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`
                  px-2 py-1 rounded text-xs font-medium
                  ${link.permissions.isActive
                    ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                    : 'bg-red-600/20 text-red-400 border border-red-500/30'
                  }
                `}>
                  {link.permissions.isActive ? '활성' : '비활성'}
                </span>
                <span className="text-gray-400 text-sm">
                  {getAccessLevelLabel(link.permissions.accessLevel)}
                </span>
                {isExpired(link.permissions.expiresAt) && (
                  <span className="px-2 py-1 bg-red-600/20 text-red-400 border border-red-500/30 rounded text-xs">
                    만료됨
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onCopy(link)}
                  className="
                    p-2 text-gray-400 hover:text-white
                    transition-colors duration-150
                  "
                  title="링크 복사"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>

                <button
                  onClick={() => setExpandedLink(
                    expandedLink === link.token ? null : link.token
                  )}
                  className="
                    p-2 text-gray-400 hover:text-white
                    transition-colors duration-150
                  "
                  title="상세 정보"
                >
                  <svg
                    className={`w-4 h-4 transition-transform duration-150 ${
                      expandedLink === link.token ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 링크 URL */}
            <div className="
              bg-gray-900 rounded border border-gray-600
              px-3 py-2 text-sm font-mono text-gray-300
              flex items-center justify-between
            ">
              <span className="truncate mr-2">
                {link.shortUrl || link.fullUrl}
              </span>
              <button
                onClick={() => onCopy(link)}
                className="
                  px-2 py-1 bg-gray-700 hover:bg-gray-600
                  text-xs rounded transition-colors duration-150
                "
              >
                복사
              </button>
            </div>

            {/* 기본 정보 */}
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400">만료</div>
                <div className="text-white">{formatExpiry(link.permissions.expiresAt)}</div>
              </div>
              <div>
                <div className="text-gray-400">사용 횟수</div>
                <div className="text-white">
                  {link.permissions.usedCount}
                  {link.permissions.maxUses && ` / ${link.permissions.maxUses}`}
                </div>
              </div>
            </div>
          </div>

          {/* 확장된 정보 */}
          {expandedLink === link.token && (
            <div className="border-t border-gray-700 p-4 space-y-4">
              {/* QR 코드 */}
              {link.qrCodeUrl && (
                <div className="text-center">
                  <div className="text-sm font-medium text-white mb-2">QR 코드</div>
                  <img
                    src={link.qrCodeUrl}
                    alt="QR 코드"
                    className="w-32 h-32 mx-auto bg-white rounded"
                  />
                </div>
              )}

              {/* 상세 정보 */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">생성일</div>
                  <div className="text-white">
                    {new Date(link.permissions.createdAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">마지막 사용</div>
                  <div className="text-white">
                    {link.permissions.lastUsedAt
                      ? new Date(link.permissions.lastUsedAt).toLocaleString()
                      : '사용 안함'
                    }
                  </div>
                </div>
              </div>

              {/* 허용 도메인 */}
              {link.permissions.allowedDomains && link.permissions.allowedDomains.length > 0 && (
                <div>
                  <div className="text-gray-400 text-sm mb-2">허용 도메인</div>
                  <div className="flex flex-wrap gap-2">
                    {link.permissions.allowedDomains.map(domain => (
                      <span
                        key={domain}
                        className="
                          px-2 py-1 bg-gray-700 rounded text-xs text-gray-300
                        "
                      >
                        {domain}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => onRegenerate(link.token)}
                  className="
                    px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700
                    text-white text-sm rounded
                    transition-colors duration-150
                  "
                >
                  토큰 재생성
                </button>

                {link.permissions.isActive ? (
                  <button
                    onClick={() => onDeactivate(link.token)}
                    className="
                      px-3 py-1.5 bg-orange-600 hover:bg-orange-700
                      text-white text-sm rounded
                      transition-colors duration-150
                    "
                  >
                    비활성화
                  </button>
                ) : (
                  <button
                    onClick={() => onDelete(link.token)}
                    className="
                      px-3 py-1.5 bg-red-600 hover:bg-red-700
                      text-white text-sm rounded
                      transition-colors duration-150
                    "
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * 메인 향상된 공유 모달 컴포넌트
 */
export function EnhancedShareModal({ isOpen, onClose }: EnhancedShareModalProps) {
  const advancedSharing = useAdvancedSharing()
  const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'stats'>('create')
  const [stats, setStats] = useState<ShareStats | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // 클릭 외부 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
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

  // ESC 키 처리
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeydown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeydown)
    }
  }, [isOpen, onClose])

  // 통계 로드
  useEffect(() => {
    if (isOpen && activeTab === 'stats') {
      advancedSharing.getShareStats()
        .then(setStats)
        .catch(console.error)
    }
  }, [isOpen, activeTab, advancedSharing])

  // 공유 링크 생성
  const handleCreateLink = useCallback(async (options: ShareLinkCreationOptions) => {
    try {
      await advancedSharing.createShareLink(options)
      setActiveTab('manage')
    } catch (error) {
      console.error('공유 링크 생성 실패:', error)
    }
  }, [advancedSharing])

  // 링크 복사
  const handleCopyLink = useCallback(async (link: ShareLinkToken) => {
    try {
      await navigator.clipboard.writeText(link.shortUrl || link.fullUrl)
      // TODO: 성공 토스트 표시
    } catch (error) {
      console.error('링크 복사 실패:', error)
    }
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="
          bg-gray-900 rounded-lg border border-gray-700
          max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto
        "
      >
        {/* 헤더 */}
        <div className="
          flex items-center justify-between
          px-6 py-4 border-b border-gray-700
        ">
          <h2 className="text-xl font-semibold text-white">
            고급 공유 설정
          </h2>
          <button
            onClick={onClose}
            className="
              p-2 hover:bg-gray-800 rounded
              text-gray-400 hover:text-white
              transition-colors duration-150
            "
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="
          flex border-b border-gray-700
          bg-gray-800/50
        ">
          {[
            { key: 'create', label: '새 링크 생성' },
            { key: 'manage', label: '링크 관리' },
            { key: 'stats', label: '통계' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`
                px-6 py-3 text-sm font-medium
                transition-colors duration-150
                ${activeTab === tab.key
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-white'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 내용 */}
        <div className="p-6">
          {activeTab === 'create' && (
            <ShareLinkForm
              onSubmit={handleCreateLink}
              isSubmitting={advancedSharing.isCreating}
            />
          )}

          {activeTab === 'manage' && (
            <ShareLinkList
              links={advancedSharing.shareLinks}
              onCopy={handleCopyLink}
              onDeactivate={advancedSharing.deactivateShareLink}
              onDelete={advancedSharing.deleteShareLink}
              onRegenerate={advancedSharing.regenerateToken}
            />
          )}

          {activeTab === 'stats' && (
            <div>
              {stats ? (
                <div className="space-y-6">
                  {/* 전체 통계 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-800 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        {stats.totalLinks}
                      </div>
                      <div className="text-sm text-gray-400">총 링크</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-400">
                        {stats.totalAccess}
                      </div>
                      <div className="text-sm text-gray-400">총 접근</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-purple-400">
                        {stats.uniqueUsers}
                      </div>
                      <div className="text-sm text-gray-400">고유 사용자</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-orange-400">
                        {stats.uniqueUsers > 0 ? (stats.totalAccess / stats.uniqueUsers).toFixed(1) : '0'}
                      </div>
                      <div className="text-sm text-gray-400">평균 접근</div>
                    </div>
                  </div>

                  {/* 권한별 접근 */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">
                      권한별 접근 현황
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(stats.accessByLevel).map(([level, count]) => (
                        <div key={level} className="flex justify-between items-center">
                          <span className="text-gray-300">
                            {getAccessLevelLabel(level)}
                          </span>
                          <span className="text-white font-medium">{count}회</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 상위 도메인 */}
                  {stats.topDomains.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">
                        상위 접근 도메인
                      </h3>
                      <div className="space-y-2">
                        {stats.topDomains.map(({ domain, count }) => (
                          <div key={domain} className="flex justify-between items-center">
                            <span className="text-gray-300">{domain}</span>
                            <span className="text-white font-medium">{count}회</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  통계를 불러오는 중...
                </div>
              )}
            </div>
          )}
        </div>

        {/* 에러 표시 */}
        {advancedSharing.error && (
          <div className="
            mx-6 mb-6 px-4 py-3 bg-red-600/20 border border-red-500/30
            rounded-lg text-red-400 text-sm
          ">
            {advancedSharing.error}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 권한 레벨 레이블 조회 유틸리티
 */
function getAccessLevelLabel(level: string): string {
  return ACCESS_LEVELS.find(l => l.value === level)?.label || level
}