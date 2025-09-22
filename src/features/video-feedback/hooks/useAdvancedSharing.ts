/**
 * Advanced Sharing Hook - Phase 3.9
 *
 * CLAUDE.md 준수: features 레이어 비즈니스 로직
 * 고급 공유 기능 (권한별 링크, 만료 설정, QR코드 등)을 위한 React 훅
 */

import { useCallback, useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
  selectCurrentSession,
  type SharePermission,
  type ShareLinkToken,
  ShareConstants
} from '../../../entities/feedback'

/**
 * 공유 링크 생성 옵션
 */
export interface ShareLinkCreationOptions {
  readonly accessLevel: 'view' | 'comment' | 'react' | 'edit' | 'admin'
  readonly expiresAt?: Date
  readonly maxUses?: number
  readonly allowedDomains?: string[]
  readonly requiresAuth?: boolean
  readonly customAlias?: string
  readonly enableQrCode?: boolean
  readonly notifyOnAccess?: boolean
  readonly description?: string
}

/**
 * 공유 통계
 */
export interface ShareStats {
  readonly totalLinks: number
  readonly totalAccess: number
  readonly uniqueUsers: number
  readonly accessByLevel: Record<string, number>
  readonly accessByDate: Array<{
    readonly date: string
    readonly count: number
  }>
  readonly topDomains: Array<{
    readonly domain: string
    readonly count: number
  }>
}

/**
 * 공유 링크 액세스 로그
 */
export interface ShareAccessLog {
  readonly id: string
  readonly shareTokenId: string
  readonly accessedAt: Date
  readonly userAgent: string
  readonly ipAddress: string
  readonly country?: string
  readonly city?: string
  readonly referrer?: string
  readonly userId?: string
  readonly userName?: string
}

/**
 * 고급 공유 시스템 결과
 */
export interface AdvancedSharingReturn {
  // 현재 상태
  readonly shareLinks: ShareLinkToken[]
  readonly isCreating: boolean
  readonly isLoading: boolean
  readonly error: string | null

  // 공유 링크 관리
  readonly createShareLink: (
    options: ShareLinkCreationOptions
  ) => Promise<ShareLinkToken>
  readonly updateShareLink: (
    tokenId: string,
    updates: Partial<ShareLinkCreationOptions>
  ) => Promise<ShareLinkToken>
  readonly deactivateShareLink: (tokenId: string) => Promise<void>
  readonly deleteShareLink: (tokenId: string) => Promise<void>
  readonly regenerateToken: (tokenId: string) => Promise<ShareLinkToken>

  // 권한 관리
  readonly getPermissionDetails: (tokenId: string) => SharePermission | null
  readonly checkAccess: (token: string, action: string) => Promise<boolean>
  readonly revokeAccess: (tokenId: string) => Promise<void>

  // 통계 및 로그
  readonly getShareStats: () => Promise<ShareStats>
  readonly getAccessLogs: (tokenId?: string) => Promise<ShareAccessLog[]>
  readonly exportAccessLogs: (format: 'csv' | 'json') => Promise<Blob>

  // QR 코드
  readonly generateQrCode: (tokenId: string, size?: number) => Promise<string>
  readonly downloadQrCode: (tokenId: string, format?: 'png' | 'svg') => Promise<Blob>

  // 유틸리티
  readonly shortenUrl: (fullUrl: string) => Promise<string>
  readonly getShareableUrl: (tokenId: string) => string
  readonly validateDomain: (domain: string) => boolean
  readonly estimateUsage: (options: ShareLinkCreationOptions) => {
    readonly estimatedViews: number
    readonly storageImpact: string
    readonly securityLevel: 'low' | 'medium' | 'high'
  }

  // 벌크 작업
  readonly createMultipleLinks: (
    configs: ShareLinkCreationOptions[]
  ) => Promise<ShareLinkToken[]>
  readonly deactivateExpiredLinks: () => Promise<number>
  readonly cleanupUnusedLinks: (olderThan: Date) => Promise<number>
}

/**
 * 고급 공유 시스템 훅
 */
export function useAdvancedSharing(): AdvancedSharingReturn {
  // Redux 상태
  const currentSession = useSelector(selectCurrentSession)

  // 로컬 상태
  const [shareLinks, setShareLinks] = useState<ShareLinkToken[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 공유 링크 생성
   */
  const createShareLink = useCallback(async (
    options: ShareLinkCreationOptions
  ): Promise<ShareLinkToken> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    // 옵션 검증
    if (options.maxUses !== undefined && options.maxUses <= 0) {
      throw new Error('최대 사용 횟수는 1 이상이어야 합니다')
    }

    if (options.expiresAt && options.expiresAt <= new Date()) {
      throw new Error('만료 시간은 현재 시간 이후여야 합니다')
    }

    if (options.allowedDomains) {
      const invalidDomains = options.allowedDomains.filter(domain => !validateDomain(domain))
      if (invalidDomains.length > 0) {
        throw new Error(`유효하지 않은 도메인: ${invalidDomains.join(', ')}`)
      }
    }

    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/feedback/share/advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          ...options,
          expiresAt: options.expiresAt?.toISOString(),
          maxUses: options.maxUses || ShareConstants.MAX_USES_UNLIMITED,
          requiresAuth: options.requiresAuth ?? false,
          enableQrCode: options.enableQrCode ?? true,
          notifyOnAccess: options.notifyOnAccess ?? false
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '공유 링크 생성에 실패했습니다')
      }

      const newShareLink: ShareLinkToken = await response.json()

      // QR 코드 생성
      if (options.enableQrCode) {
        try {
          newShareLink.qrCodeUrl = await generateQrCode(newShareLink.token)
        } catch (qrError) {
          console.warn('QR 코드 생성 실패:', qrError)
        }
      }

      // 로컬 상태 업데이트
      setShareLinks(prev => [...prev, newShareLink])

      return newShareLink

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '공유 링크 생성에 실패했습니다'
      setError(errorMessage)
      throw err
    } finally {
      setIsCreating(false)
    }
  }, [currentSession])

  /**
   * 공유 링크 업데이트
   */
  const updateShareLink = useCallback(async (
    tokenId: string,
    updates: Partial<ShareLinkCreationOptions>
  ): Promise<ShareLinkToken> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const response = await fetch(`/api/feedback/share/${tokenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          ...updates,
          expiresAt: updates.expiresAt?.toISOString()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '공유 링크 업데이트에 실패했습니다')
      }

      const updatedShareLink: ShareLinkToken = await response.json()

      // 로컬 상태 업데이트
      setShareLinks(prev =>
        prev.map(link =>
          link.token === tokenId ? updatedShareLink : link
        )
      )

      return updatedShareLink

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '공유 링크 업데이트에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 공유 링크 비활성화
   */
  const deactivateShareLink = useCallback(async (tokenId: string): Promise<void> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const response = await fetch(`/api/feedback/share/${tokenId}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '공유 링크 비활성화에 실패했습니다')
      }

      // 로컬 상태 업데이트
      setShareLinks(prev =>
        prev.map(link =>
          link.token === tokenId
            ? { ...link, permissions: { ...link.permissions, isActive: false } }
            : link
        )
      )

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '공유 링크 비활성화에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 공유 링크 삭제
   */
  const deleteShareLink = useCallback(async (tokenId: string): Promise<void> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const response = await fetch(`/api/feedback/share/${tokenId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '공유 링크 삭제에 실패했습니다')
      }

      // 로컬 상태 업데이트
      setShareLinks(prev => prev.filter(link => link.token !== tokenId))

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '공유 링크 삭제에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 토큰 재생성
   */
  const regenerateToken = useCallback(async (tokenId: string): Promise<ShareLinkToken> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const response = await fetch(`/api/feedback/share/${tokenId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '토큰 재생성에 실패했습니다')
      }

      const regeneratedLink: ShareLinkToken = await response.json()

      // 로컬 상태 업데이트
      setShareLinks(prev =>
        prev.map(link =>
          link.token === tokenId ? regeneratedLink : link
        )
      )

      return regeneratedLink

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '토큰 재생성에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 권한 상세 정보 조회
   */
  const getPermissionDetails = useCallback((tokenId: string): SharePermission | null => {
    const shareLink = shareLinks.find(link => link.token === tokenId)
    return shareLink ? shareLink.permissions : null
  }, [shareLinks])

  /**
   * 액세스 권한 확인
   */
  const checkAccess = useCallback(async (token: string, action: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/feedback/share/${token}/check-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (response.ok) {
        const { hasAccess } = await response.json()
        return hasAccess
      }

      return false

    } catch (err) {
      console.error('액세스 권한 확인 실패:', err)
      return false
    }
  }, [])

  /**
   * 액세스 권한 취소
   */
  const revokeAccess = useCallback(async (tokenId: string): Promise<void> => {
    await deactivateShareLink(tokenId)
  }, [deactivateShareLink])

  /**
   * 공유 통계 조회
   */
  const getShareStats = useCallback(async (): Promise<ShareStats> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const response = await fetch(`/api/feedback/sessions/${currentSession.id}/share/stats`)

      if (!response.ok) {
        throw new Error('공유 통계 조회에 실패했습니다')
      }

      return await response.json()

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '공유 통계 조회에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 액세스 로그 조회
   */
  const getAccessLogs = useCallback(async (tokenId?: string): Promise<ShareAccessLog[]> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const url = tokenId
        ? `/api/feedback/share/${tokenId}/logs`
        : `/api/feedback/sessions/${currentSession.id}/share/logs`

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('액세스 로그 조회에 실패했습니다')
      }

      return await response.json()

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '액세스 로그 조회에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 액세스 로그 내보내기
   */
  const exportAccessLogs = useCallback(async (format: 'csv' | 'json'): Promise<Blob> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const response = await fetch(
        `/api/feedback/sessions/${currentSession.id}/share/logs/export?format=${format}`
      )

      if (!response.ok) {
        throw new Error('액세스 로그 내보내기에 실패했습니다')
      }

      return await response.blob()

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '액세스 로그 내보내기에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * QR 코드 생성
   */
  const generateQrCode = useCallback(async (
    tokenId: string,
    size: number = ShareConstants.QR_CODE_SIZE
  ): Promise<string> => {
    try {
      const shareLink = shareLinks.find(link => link.token === tokenId)
      if (!shareLink) {
        throw new Error('공유 링크를 찾을 수 없습니다')
      }

      const response = await fetch('/api/feedback/share/qr-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: shareLink.fullUrl,
          size
        })
      })

      if (!response.ok) {
        throw new Error('QR 코드 생성에 실패했습니다')
      }

      const { qrCodeUrl } = await response.json()
      return qrCodeUrl

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'QR 코드 생성에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [shareLinks])

  /**
   * QR 코드 다운로드
   */
  const downloadQrCode = useCallback(async (
    tokenId: string,
    format: 'png' | 'svg' = 'png'
  ): Promise<Blob> => {
    try {
      const shareLink = shareLinks.find(link => link.token === tokenId)
      if (!shareLink) {
        throw new Error('공유 링크를 찾을 수 없습니다')
      }

      const response = await fetch(`/api/feedback/share/${tokenId}/qr-code/download?format=${format}`)

      if (!response.ok) {
        throw new Error('QR 코드 다운로드에 실패했습니다')
      }

      return await response.blob()

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'QR 코드 다운로드에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [shareLinks])

  /**
   * URL 단축
   */
  const shortenUrl = useCallback(async (fullUrl: string): Promise<string> => {
    try {
      const response = await fetch('/api/feedback/share/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fullUrl })
      })

      if (!response.ok) {
        throw new Error('URL 단축에 실패했습니다')
      }

      const { shortUrl } = await response.json()
      return shortUrl

    } catch (err) {
      console.error('URL 단축 실패:', err)
      return fullUrl // 실패 시 원본 URL 반환
    }
  }, [])

  /**
   * 공유 가능한 URL 생성
   */
  const getShareableUrl = useCallback((tokenId: string): string => {
    const shareLink = shareLinks.find(link => link.token === tokenId)
    return shareLink ? shareLink.shortUrl || shareLink.fullUrl : ''
  }, [shareLinks])

  /**
   * 도메인 검증
   */
  const validateDomain = useCallback((domain: string): boolean => {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    return domainRegex.test(domain)
  }, [])

  /**
   * 사용량 추정
   */
  const estimateUsage = useCallback((options: ShareLinkCreationOptions) => {
    const baseViews = 10
    let estimatedViews = baseViews

    // 액세스 레벨에 따른 사용량 추정
    const accessMultiplier = {
      view: 1,
      comment: 0.7,
      react: 0.8,
      edit: 0.3,
      admin: 0.1
    }

    estimatedViews *= accessMultiplier[options.accessLevel] || 1

    // 인증 요구 시 사용량 감소
    if (options.requiresAuth) {
      estimatedViews *= 0.6
    }

    // 도메인 제한 시 사용량 감소
    if (options.allowedDomains && options.allowedDomains.length > 0) {
      estimatedViews *= 0.4
    }

    // 스토리지 영향 계산 (대략적)
    const storageImpact = estimatedViews < 50 ? 'Low' : estimatedViews < 200 ? 'Medium' : 'High'

    // 보안 레벨 계산
    let securityLevel: 'low' | 'medium' | 'high' = 'low'

    if (options.requiresAuth) securityLevel = 'medium'
    if (options.allowedDomains && options.allowedDomains.length > 0) securityLevel = 'high'
    if (options.maxUses && options.maxUses <= 10) securityLevel = 'high'

    return {
      estimatedViews: Math.round(estimatedViews),
      storageImpact,
      securityLevel
    }
  }, [])

  /**
   * 다중 링크 생성
   */
  const createMultipleLinks = useCallback(async (
    configs: ShareLinkCreationOptions[]
  ): Promise<ShareLinkToken[]> => {
    const results: ShareLinkToken[] = []

    for (const config of configs) {
      try {
        const link = await createShareLink(config)
        results.push(link)
      } catch (err) {
        console.error(`링크 생성 실패 (${config.description}):`, err)
      }
    }

    return results
  }, [createShareLink])

  /**
   * 만료된 링크 비활성화
   */
  const deactivateExpiredLinks = useCallback(async (): Promise<number> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const response = await fetch(`/api/feedback/sessions/${currentSession.id}/share/cleanup/expired`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('만료된 링크 정리에 실패했습니다')
      }

      const { deactivatedCount } = await response.json()

      // 로컬 상태 업데이트
      setShareLinks(prev =>
        prev.map(link =>
          link.permissions.expiresAt && new Date(link.permissions.expiresAt) <= new Date()
            ? { ...link, permissions: { ...link.permissions, isActive: false } }
            : link
        )
      )

      return deactivatedCount

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '만료된 링크 정리에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 미사용 링크 정리
   */
  const cleanupUnusedLinks = useCallback(async (olderThan: Date): Promise<number> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const response = await fetch(`/api/feedback/sessions/${currentSession.id}/share/cleanup/unused`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          olderThan: olderThan.toISOString()
        })
      })

      if (!response.ok) {
        throw new Error('미사용 링크 정리에 실패했습니다')
      }

      const { deletedCount } = await response.json()

      // 로컬 상태 업데이트
      setShareLinks(prev =>
        prev.filter(link =>
          link.permissions.usedCount > 0 ||
          new Date(link.permissions.createdAt) > olderThan
        )
      )

      return deletedCount

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '미사용 링크 정리에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 세션 변경 시 공유 링크 로드
   */
  useEffect(() => {
    if (currentSession) {
      loadShareLinks(currentSession.id)
    }
  }, [currentSession])

  /**
   * 공유 링크 로드 (비동기)
   */
  const loadShareLinks = async (sessionId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/feedback/sessions/${sessionId}/share`)
      if (response.ok) {
        const links: ShareLinkToken[] = await response.json()
        setShareLinks(links)
      }
    } catch (err) {
      setError('공유 링크 로드에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    // 현재 상태
    shareLinks,
    isCreating,
    isLoading,
    error,

    // 공유 링크 관리
    createShareLink,
    updateShareLink,
    deactivateShareLink,
    deleteShareLink,
    regenerateToken,

    // 권한 관리
    getPermissionDetails,
    checkAccess,
    revokeAccess,

    // 통계 및 로그
    getShareStats,
    getAccessLogs,
    exportAccessLogs,

    // QR 코드
    generateQrCode,
    downloadQrCode,

    // 유틸리티
    shortenUrl,
    getShareableUrl,
    validateDomain,
    estimateUsage,

    // 벌크 작업
    createMultipleLinks,
    deactivateExpiredLinks,
    cleanupUnusedLinks
  }
}