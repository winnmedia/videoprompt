/**
 * Feedback API Utilities - Phase 3.9
 *
 * 영상 피드백 확장 기능을 위한 공통 유틸리티
 * CLAUDE.md 준수: 비용 안전 규칙, JWT 검증, 타입 안전성, $300 사건 방지
 */

import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import jwt from 'jsonwebtoken'
import { createHash } from 'crypto'

import { CostSafetyMiddleware } from '@/shared/lib/cost-safety-middleware'
import logger from '@/shared/lib/structured-logger'
import type { User } from './dto-transformers'

// ===========================================
// 상수 정의
// ===========================================

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// 비용 안전 설정 (Phase 3.9 확장 기능용 더 엄격한 제한)
const FEEDBACK_COST_SAFETY_CONFIG = {
  minuteLimit: 20, // 분당 20회 (업로드 작업이 무거우므로 더 제한적)
  hourlyLimit: 200,
  uploadLimitPerHour: 5, // 시간당 5개 파일 업로드
  commentLimitPerHour: 50, // 시간당 50개 댓글
  screenshotLimitPerHour: 20, // 시간당 20개 스크린샷
  costThreshold: 30, // $30 임계값 (더 보수적)
  infiniteLoopWindow: 3000,
  infiniteLoopThreshold: 8,
}

// 파일 업로드 제한
export const FILE_UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 300 * 1024 * 1024, // 300MB
  SUPPORTED_VIDEO_FORMATS: ['mp4', 'webm', 'mov', 'avi'],
  SUPPORTED_VIDEO_CODECS: ['H.264', 'H.265', 'VP9', 'AV1'],
  SUPPORTED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'webp'],
  MAX_VERSIONS_PER_SLOT: 10,
  MAX_SCREENSHOTS_PER_SESSION: 100,
} as const

// 댓글 제한
export const COMMENT_LIMITS = {
  MAX_DEPTH: 3,
  MAX_CONTENT_LENGTH: 2000,
  MAX_MENTIONS: 10,
  MAX_ATTACHMENTS: 5,
  EDIT_TIME_LIMIT_HOURS: 24,
} as const

// 공유 제한
export const SHARE_LIMITS = {
  TOKEN_LENGTH: 32,
  SHORT_URL_LENGTH: 8,
  DEFAULT_EXPIRY_DAYS: 30,
  MAX_ACTIVE_LINKS_PER_SESSION: 10,
  QR_CODE_SIZE: 200,
} as const

// ===========================================
// 글로벌 비용 안전 미들웨어
// ===========================================

const feedbackCostSafety = new CostSafetyMiddleware({
  logger: {
    error: (data) => logger.error('피드백 API 비용 안전 오류', undefined, data),
    warn: (data) => logger.warn('피드백 API 비용 안전 경고', data),
    info: (data) => logger.info('피드백 API 비용 안전 정보', data),
  },
  onEmergencyShutdown: (params) => {
    logger.error('피드백 API 비상 셧다운 실행', undefined, {
      component: 'FeedbackCostSafety',
      metadata: params,
    })
  },
  ...FEEDBACK_COST_SAFETY_CONFIG,
})

// ===========================================
// 에러 타입 정의
// ===========================================

export class FeedbackApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'FeedbackApiError'
  }
}

// ===========================================
// 공통 스키마
// ===========================================

export const TimecodeSchema = z.object({
  minutes: z.number().min(0).max(59),
  seconds: z.number().min(0).max(59),
  frames: z.number().min(0).max(999),
})

export const VideoSlotSchema = z.enum(['a', 'b'])

export const EmotionTypeSchema = z.enum([
  'like', 'love', 'laugh', 'wow', 'sad', 'angry',
  'confused', 'idea', 'approve', 'reject'
])

export const AccessLevelSchema = z.enum([
  'view', 'comment', 'react', 'edit', 'admin'
])

export const ParticipantTypeSchema = z.enum([
  'project_owner', 'collaborator', 'client', 'guest'
])

// ===========================================
// 버전 관리 스키마
// ===========================================

export const VersionUploadSchema = z.object({
  sessionId: z.string().uuid('유효한 세션 ID가 필요합니다'),
  videoSlot: VideoSlotSchema,
  originalFilename: z.string()
    .min(1, '파일명은 필수입니다')
    .max(255, '파일명이 너무 깁니다'),
  fileSize: z.number()
    .positive('파일 크기는 양수여야 합니다')
    .max(FILE_UPLOAD_LIMITS.MAX_FILE_SIZE, '파일 크기가 300MB를 초과합니다'),
  replaceReason: z.string().max(500, '교체 사유는 500자를 초과할 수 없습니다').optional(),
})

export const VersionActivateSchema = z.object({
  sessionId: z.string().uuid(),
  videoSlot: VideoSlotSchema,
  versionId: z.string().uuid(),
  reason: z.string().max(200, '활성화 사유는 200자를 초과할 수 없습니다').optional(),
})

// ===========================================
// 댓글 스키마
// ===========================================

export const CommentCreateSchema = z.object({
  sessionId: z.string().uuid(),
  videoSlot: VideoSlotSchema,
  versionId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  timecode: TimecodeSchema,
  content: z.string()
    .min(1, '댓글 내용은 필수입니다')
    .max(COMMENT_LIMITS.MAX_CONTENT_LENGTH, `댓글은 ${COMMENT_LIMITS.MAX_CONTENT_LENGTH}자를 초과할 수 없습니다`),
  mentions: z.array(z.string().uuid())
    .max(COMMENT_LIMITS.MAX_MENTIONS, `멘션은 최대 ${COMMENT_LIMITS.MAX_MENTIONS}개까지 가능합니다`)
    .optional(),
})

export const EmotionToggleSchema = z.object({
  commentId: z.string().uuid(),
  emotionType: EmotionTypeSchema,
})

// ===========================================
// 공유 스키마
// ===========================================

export const ShareLinkCreateSchema = z.object({
  sessionId: z.string().uuid(),
  accessLevel: AccessLevelSchema,
  expiresAt: z.string().datetime().optional(),
  maxUses: z.number().positive().or(z.literal(-1)).optional(), // -1 = 무제한
  allowedDomains: z.array(z.string().url()).max(10).optional(),
  requiresAuth: z.boolean().default(false),
  permissions: z.object({
    canViewVideos: z.boolean().default(true),
    canAddComments: z.boolean().default(false),
    canAddReactions: z.boolean().default(false),
    canDownloadVideos: z.boolean().default(false),
    canCaptureScreenshots: z.boolean().default(false),
    canSeeOtherComments: z.boolean().default(true),
    canResolveComments: z.boolean().default(false),
    canEditOwnComments: z.boolean().default(true),
    canDeleteOwnComments: z.boolean().default(false),
    canSwitchVersions: z.boolean().default(true),
    canUploadVersions: z.boolean().default(false),
    canActivateVersions: z.boolean().default(false),
  }).optional(),
})

export const ShareSettingsUpdateSchema = z.object({
  shareId: z.string().uuid(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxUses: z.number().positive().or(z.literal(-1)).optional(),
  allowedDomains: z.array(z.string().url()).max(10).optional(),
  requiresAuth: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

// ===========================================
// 스크린샷 스키마
// ===========================================

export const ScreenshotCaptureSchema = z.object({
  sessionId: z.string().uuid(),
  videoSlot: VideoSlotSchema,
  versionId: z.string().uuid(),
  timecode: TimecodeSchema,
  format: z.enum(['jpg', 'png', 'webp']).default('jpg'),
  quality: z.number().min(1).max(100).default(85),
  includeTimestamp: z.boolean().default(true),
  includeProjectInfo: z.boolean().default(true),
})

// ===========================================
// 응답 생성 헬퍼
// ===========================================

export function createFeedbackSuccessResponse<T>(
  data: T,
  metadata?: Record<string, any>
): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  })
}

export function createFeedbackErrorResponse(
  message: string,
  code: string,
  statusCode: number = 500,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code,
        details,
      },
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  )
}

export function createPaginatedFeedbackResponse<T>(
  data: T[],
  pagination: {
    page: number
    limit: number
    total: number
  },
  metadata?: Record<string, any>
): NextResponse {
  const totalPages = Math.ceil(pagination.total / pagination.limit)

  return NextResponse.json({
    success: true,
    data,
    pagination: {
      ...pagination,
      totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPreviousPage: pagination.page > 1,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  })
}

// ===========================================
// 검증 헬퍼
// ===========================================

export async function validateFeedbackRequest<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json()
    return schema.parse(body)
  } catch (error) {
    if (error instanceof ZodError) {
      const errorDetails = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }))

      throw new FeedbackApiError(
        '요청 데이터 검증 실패',
        'VALIDATION_ERROR',
        400,
        errorDetails
      )
    }

    throw new FeedbackApiError(
      '요청 본문을 파싱할 수 없습니다',
      'INVALID_JSON',
      400
    )
  }
}

export function validateFeedbackQueryParams<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): T {
  try {
    const { searchParams } = new URL(request.url)
    const params: Record<string, any> = {}

    for (const [key, value] of searchParams.entries()) {
      // 숫자 변환 시도
      if (/^\d+$/.test(value)) {
        params[key] = parseInt(value, 10)
      } else if (/^\d+\.\d+$/.test(value)) {
        params[key] = parseFloat(value)
      } else if (value === 'true' || value === 'false') {
        params[key] = value === 'true'
      } else {
        params[key] = value
      }
    }

    return schema.parse(params)
  } catch (error) {
    if (error instanceof ZodError) {
      const errorDetails = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }))

      throw new FeedbackApiError(
        '쿼리 파라미터 검증 실패',
        'QUERY_VALIDATION_ERROR',
        400,
        errorDetails
      )
    }

    throw error
  }
}

// ===========================================
// 인증 및 권한 검증
// ===========================================

export function extractUserFromToken(request: NextRequest): User | null {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as any

    return {
      userId: decoded.userId || decoded.sub,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role || 'user',
    }
  } catch (error) {
    logger.warn('JWT 토큰 검증 실패', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// ===========================================
// 파일 처리 헬퍼
// ===========================================

export function generateFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export function validateVideoFormat(filename: string, mimeType: string): boolean {
  const extension = filename.split('.').pop()?.toLowerCase()

  if (!extension || !FILE_UPLOAD_LIMITS.SUPPORTED_VIDEO_FORMATS.includes(extension)) {
    return false
  }

  const validMimeTypes = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
  ]

  return validMimeTypes.includes(mimeType.toLowerCase())
}

export function validateImageFormat(filename: string, mimeType: string): boolean {
  const extension = filename.split('.').pop()?.toLowerCase()

  if (!extension || !FILE_UPLOAD_LIMITS.SUPPORTED_IMAGE_FORMATS.includes(extension)) {
    return false
  }

  const validMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ]

  return validMimeTypes.includes(mimeType.toLowerCase())
}

// ===========================================
// 토큰 생성 헬퍼
// ===========================================

export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return result
}

export function generateShortUrl(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let result = ''

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return result
}

// ===========================================
// 타임코드 헬퍼
// ===========================================

export function timecodeToMilliseconds(timecode: { minutes: number; seconds: number; frames: number }): number {
  return (timecode.minutes * 60 + timecode.seconds) * 1000 + timecode.frames
}

export function millisecondsToTimecode(ms: number): { minutes: number; seconds: number; frames: number } {
  const totalSeconds = Math.floor(ms / 1000)
  const frames = ms % 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return { minutes, seconds, frames }
}

// ===========================================
// API 핸들러 래퍼
// ===========================================

interface FeedbackApiHandlerOptions {
  requireAuth?: boolean
  costSafety?: boolean
  endpoint: string
  operationType?: 'upload' | 'comment' | 'screenshot' | 'general'
}

export function withFeedbackApiHandler(
  handler: (request: NextRequest, context: { user?: User }) => Promise<NextResponse>,
  options: FeedbackApiHandlerOptions
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now()

    try {
      // 1. 비용 안전 검사
      if (options.costSafety) {
        const operationType = options.operationType || 'general'
        const isBlocked = await feedbackCostSafety.checkRequest({
          identifier: request.ip || 'unknown',
          endpoint: options.endpoint,
          operationType,
        })

        if (isBlocked) {
          logger.warn('요청 차단됨 - 비용 안전', {
            endpoint: options.endpoint,
            operationType,
            ip: request.ip,
          })

          return createFeedbackErrorResponse(
            '요청 빈도가 너무 높습니다. 잠시 후 다시 시도해주세요.',
            'RATE_LIMIT_EXCEEDED',
            429
          )
        }
      }

      // 2. 인증 검증
      let user: User | undefined
      if (options.requireAuth) {
        user = extractUserFromToken(request)
        if (!user) {
          return createFeedbackErrorResponse(
            '인증이 필요합니다',
            'AUTHENTICATION_REQUIRED',
            401
          )
        }
      }

      // 3. 핸들러 실행
      const response = await handler(request, { user })

      // 4. 성공 로깅
      const duration = Date.now() - startTime
      logger.info('피드백 API 요청 성공', {
        endpoint: options.endpoint,
        method: request.method,
        duration,
        userId: user?.userId,
        operationType: options.operationType,
      })

      return response

    } catch (error) {
      const duration = Date.now() - startTime

      // 에러 로깅
      logger.error(
        '피드백 API 요청 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          endpoint: options.endpoint,
          method: request.method,
          duration,
          operationType: options.operationType,
        }
      )

      // FeedbackApiError 처리
      if (error instanceof FeedbackApiError) {
        return createFeedbackErrorResponse(
          error.message,
          error.code,
          error.statusCode,
          error.details
        )
      }

      // 기본 에러 처리
      return createFeedbackErrorResponse(
        '서버 내부 오류가 발생했습니다',
        'INTERNAL_SERVER_ERROR',
        500
      )
    }
  }
}

// ===========================================
// CORS 헬퍼
// ===========================================

export function handleFeedbackCorsPreflightRequest(): NextResponse {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}