/**
 * Feedback Security & Permission Manager
 *
 * CLAUDE.md 준수: shared/lib 레이어 보안 및 권한 관리
 * 피드백 시스템의 보안 정책 및 권한 검증
 */

import { createHash, randomBytes } from 'crypto'
import type {
  FeedbackParticipant,
  FeedbackSessionMetadata,
  ParticipantType,
  ParticipantPermissions
} from '../../entities/feedback'

/**
 * 보안 토큰 정보
 */
export interface SecurityToken {
  readonly token: string
  readonly type: 'session' | 'guest' | 'admin'
  readonly sessionId: string
  readonly userId?: string
  readonly permissions: ParticipantPermissions
  readonly expiresAt: Date
  readonly createdAt: Date
  readonly ipAddress?: string
  readonly userAgent?: string
}

/**
 * 접근 제어 결과
 */
export interface AccessControlResult {
  readonly allowed: boolean
  readonly reason?: string
  readonly requiredPermission?: string
  readonly suggestedAction?: string
}

/**
 * Rate Limit 설정
 */
export interface RateLimitConfig {
  readonly windowMs: number // 시간 윈도우 (밀리초)
  readonly maxRequests: number // 최대 요청 수
  readonly blockDurationMs: number // 차단 지속 시간
}

/**
 * 보안 정책 설정
 */
export interface SecurityConfig {
  readonly tokenTTL: number // 토큰 유효 시간 (초)
  readonly maxGuestSessions: number // 게스트 최대 동시 세션 수
  readonly rateLimits: Record<string, RateLimitConfig>
  readonly allowedOrigins: string[]
  readonly requireHTTPS: boolean
  readonly maxFileSize: number // 바이트
  readonly allowedFileTypes: string[]
}

/**
 * IP 기반 Rate Limiting
 */
class RateLimiter {
  private requests = new Map<string, { count: number; windowStart: number; blockedUntil?: number }>()

  isAllowed(identifier: string, config: RateLimitConfig): boolean {
    const now = Date.now()
    const record = this.requests.get(identifier)

    // 차단 상태 확인
    if (record?.blockedUntil && now < record.blockedUntil) {
      return false
    }

    // 새 윈도우 시작 또는 첫 요청
    if (!record || now - record.windowStart >= config.windowMs) {
      this.requests.set(identifier, {
        count: 1,
        windowStart: now
      })
      return true
    }

    // 요청 수 증가
    record.count++

    // 제한 초과 시 차단
    if (record.count > config.maxRequests) {
      record.blockedUntil = now + config.blockDurationMs
      return false
    }

    return true
  }

  reset(identifier: string): void {
    this.requests.delete(identifier)
  }

  getStats(identifier: string): { count: number; remaining: number; resetTime: number } | null {
    const record = this.requests.get(identifier)
    if (!record) return null

    return {
      count: record.count,
      remaining: Math.max(0, 10 - record.count), // 기본 제한값
      resetTime: record.windowStart + 60000 // 1분 윈도우
    }
  }
}

/**
 * 피드백 보안 매니저
 */
export class FeedbackSecurityManager {
  private rateLimiter = new RateLimiter()
  private tokenStore = new Map<string, SecurityToken>()
  private config: SecurityConfig

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      tokenTTL: 24 * 60 * 60, // 24시간
      maxGuestSessions: 5,
      rateLimits: {
        'comment_create': { windowMs: 60000, maxRequests: 10, blockDurationMs: 300000 },
        'reaction_create': { windowMs: 60000, maxRequests: 20, blockDurationMs: 60000 },
        'file_upload': { windowMs: 300000, maxRequests: 3, blockDurationMs: 600000 },
        'session_create': { windowMs: 3600000, maxRequests: 5, blockDurationMs: 3600000 }
      },
      allowedOrigins: ['https://videoprompt.vercel.app', 'http://localhost:3000'],
      requireHTTPS: process.env.NODE_ENV === 'production',
      maxFileSize: 300 * 1024 * 1024, // 300MB
      allowedFileTypes: ['mp4', 'webm', 'mov', 'avi'],
      ...config
    }
  }

  /**
   * 보안 토큰 생성
   */
  generateSecurityToken(
    sessionId: string,
    type: SecurityToken['type'],
    permissions: ParticipantPermissions,
    userId?: string,
    customTTL?: number
  ): SecurityToken {
    const token = this.generateSecureToken()
    const ttl = customTTL || this.config.tokenTTL

    const securityToken: SecurityToken = {
      token,
      type,
      sessionId,
      userId,
      permissions,
      expiresAt: new Date(Date.now() + ttl * 1000),
      createdAt: new Date()
    }

    this.tokenStore.set(token, securityToken)
    return securityToken
  }

  /**
   * 토큰 검증
   */
  validateToken(token: string): SecurityToken | null {
    const securityToken = this.tokenStore.get(token)

    if (!securityToken) {
      return null
    }

    // 만료 확인
    if (new Date() > securityToken.expiresAt) {
      this.tokenStore.delete(token)
      return null
    }

    return securityToken
  }

  /**
   * 토큰 폐기
   */
  revokeToken(token: string): void {
    this.tokenStore.delete(token)
  }

  /**
   * 세션 접근 권한 검증
   */
  checkSessionAccess(
    sessionId: string,
    participant: FeedbackParticipant,
    session: FeedbackSessionMetadata
  ): AccessControlResult {
    // 세션 만료 확인
    if (session.expiresAt && new Date() > session.expiresAt) {
      return {
        allowed: false,
        reason: '세션이 만료되었습니다',
        suggestedAction: '새로운 세션을 요청하세요'
      }
    }

    // 세션 소유자는 항상 접근 가능
    if (participant.userId === session.ownerId) {
      return { allowed: true }
    }

    // 게스트 접근 정책 확인
    if (participant.type === 'guest') {
      if (!session.isPublic) {
        return {
          allowed: false,
          reason: '비공개 세션입니다',
          suggestedAction: '초대를 요청하거나 공개 세션을 이용하세요'
        }
      }
    }

    return { allowed: true }
  }

  /**
   * 특정 작업에 대한 권한 검증
   */
  checkPermission(
    participant: FeedbackParticipant,
    session: FeedbackSessionMetadata,
    action: 'comment' | 'react' | 'upload' | 'edit' | 'delete' | 'invite'
  ): AccessControlResult {
    // 기본 세션 접근 권한 확인
    const sessionAccess = this.checkSessionAccess(session.id, participant, session)
    if (!sessionAccess.allowed) {
      return sessionAccess
    }

    // 작업별 권한 확인
    switch (action) {
      case 'comment':
        if (participant.type === 'guest' && !session.allowGuestComments) {
          return {
            allowed: false,
            reason: '게스트 댓글이 허용되지 않습니다',
            requiredPermission: 'allowGuestComments'
          }
        }
        if (!participant.permissions.canComment) {
          return {
            allowed: false,
            reason: '댓글 작성 권한이 없습니다',
            requiredPermission: 'canComment'
          }
        }
        break

      case 'react':
        if (participant.type === 'guest' && !session.allowGuestEmotions) {
          return {
            allowed: false,
            reason: '게스트 감정 표현이 허용되지 않습니다',
            requiredPermission: 'allowGuestEmotions'
          }
        }
        if (!participant.permissions.canReact) {
          return {
            allowed: false,
            reason: '감정 표현 권한이 없습니다',
            requiredPermission: 'canReact'
          }
        }
        break

      case 'upload':
        if (!participant.permissions.canManageVideos) {
          return {
            allowed: false,
            reason: '파일 업로드 권한이 없습니다',
            requiredPermission: 'canManageVideos'
          }
        }
        break

      case 'edit':
        if (!participant.permissions.canEditSession) {
          return {
            allowed: false,
            reason: '세션 편집 권한이 없습니다',
            requiredPermission: 'canEditSession'
          }
        }
        break

      case 'delete':
        // 삭제는 소유자만 가능
        if (participant.userId !== session.ownerId) {
          return {
            allowed: false,
            reason: '소유자만 삭제할 수 있습니다',
            requiredPermission: 'owner'
          }
        }
        break

      case 'invite':
        if (!participant.permissions.canInviteOthers) {
          return {
            allowed: false,
            reason: '초대 권한이 없습니다',
            requiredPermission: 'canInviteOthers'
          }
        }
        break
    }

    return { allowed: true }
  }

  /**
   * Rate Limiting 검증
   */
  checkRateLimit(identifier: string, action: string): boolean {
    const config = this.config.rateLimits[action]
    if (!config) return true

    return this.rateLimiter.isAllowed(identifier, config)
  }

  /**
   * 파일 업로드 보안 검증
   */
  validateFileUpload(file: { name: string; size: number; type: string }): AccessControlResult {
    // 파일 크기 검증
    if (file.size > this.config.maxFileSize) {
      return {
        allowed: false,
        reason: `파일 크기가 최대 제한(${this.config.maxFileSize / 1024 / 1024}MB)을 초과합니다`
      }
    }

    // 파일 형식 검증
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !this.config.allowedFileTypes.includes(extension)) {
      return {
        allowed: false,
        reason: `지원되지 않는 파일 형식입니다. 허용 형식: ${this.config.allowedFileTypes.join(', ')}`
      }
    }

    // MIME 타입 검증
    const allowedMimeTypes = [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo'
    ]

    if (!allowedMimeTypes.includes(file.type)) {
      return {
        allowed: false,
        reason: `지원되지 않는 MIME 타입입니다: ${file.type}`
      }
    }

    return { allowed: true }
  }

  /**
   * Origin 검증 (CORS)
   */
  validateOrigin(origin: string): boolean {
    if (this.config.allowedOrigins.includes('*')) {
      return true
    }

    return this.config.allowedOrigins.includes(origin)
  }

  /**
   * HTTPS 요구사항 검증
   */
  validateHTTPS(protocol: string): boolean {
    if (!this.config.requireHTTPS) {
      return true
    }

    return protocol === 'https:'
  }

  /**
   * 사용자 입력 삭제 (XSS 방지)
   */
  sanitizeInput(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim()
  }

  /**
   * 콘텐츠 보안 정책 (CSP) 헤더 생성
   */
  generateCSPHeader(): string {
    const policies = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "connect-src 'self' wss: https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ]

    return policies.join('; ')
  }

  /**
   * 보안 토큰 생성 (암호학적으로 안전)
   */
  private generateSecureToken(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * 데이터 해시 생성
   */
  generateDataHash(data: string): string {
    return createHash('sha256').update(data).digest('hex')
  }

  /**
   * 토큰 만료 정리 (주기적 실행 권장)
   */
  cleanupExpiredTokens(): number {
    const now = new Date()
    let cleanedCount = 0

    for (const [token, securityToken] of this.tokenStore) {
      if (now > securityToken.expiresAt) {
        this.tokenStore.delete(token)
        cleanedCount++
      }
    }

    return cleanedCount
  }

  /**
   * 보안 메트릭 조회
   */
  getSecurityMetrics(): {
    activeTokens: number
    rateLimitedIPs: number
    securityEvents: number
  } {
    return {
      activeTokens: this.tokenStore.size,
      rateLimitedIPs: 0, // Rate limiter에서 차단된 IP 수
      securityEvents: 0  // 보안 이벤트 수 (별도 로깅 시스템 필요)
    }
  }

  /**
   * 세션별 권한 프리셋 생성
   */
  createPermissionPreset(type: ParticipantType): ParticipantPermissions {
    switch (type) {
      case 'owner':
        return {
          canComment: true,
          canReact: true,
          canEditSession: true,
          canManageVideos: true,
          canInviteOthers: true
        }

      case 'member':
        return {
          canComment: true,
          canReact: true,
          canEditSession: false,
          canManageVideos: false,
          canInviteOthers: false
        }

      case 'guest':
        return {
          canComment: true, // 세션 설정에 따라 동적 변경
          canReact: true,   // 세션 설정에 따라 동적 변경
          canEditSession: false,
          canManageVideos: false,
          canInviteOthers: false
        }
    }
  }
}

// 싱글톤 인스턴스
export const feedbackSecurity = new FeedbackSecurityManager()

// 미들웨어 함수들
export function createSecurityMiddleware(config?: Partial<SecurityConfig>) {
  const security = new FeedbackSecurityManager(config)

  return {
    validateToken: (token: string) => security.validateToken(token),
    checkPermission: (participant: FeedbackParticipant, session: FeedbackSessionMetadata, action: string) =>
      security.checkPermission(participant, session, action as any),
    checkRateLimit: (identifier: string, action: string) => security.checkRateLimit(identifier, action),
    sanitizeInput: (input: string) => security.sanitizeInput(input)
  }
}