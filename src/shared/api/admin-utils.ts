/**
 * Admin API Utilities
 *
 * 관리자 API를 위한 전용 유틸리티
 * CLAUDE.md 준수: IP 화이트리스트, JWT+API키 이중 인증, 감사 로그
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import crypto from 'crypto';
import { CostSafetyMiddleware } from '../lib/cost-safety-middleware';
import logger from '../lib/structured-logger';
import type { JwtPayload } from './planning-utils';
import { verifyJwtToken, extractJwtToken } from './planning-utils';
import type {
  AdminApiResponse,
  PaginationInfo,
  AuditLog,
  AdminActionType
} from '@/entities/admin';

// ===========================================
// 관리자 전용 상수
// ===========================================

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const ADMIN_IP_WHITELIST = process.env.ADMIN_IP_WHITELIST?.split(',') || [];
const COST_SAFETY_CONFIG = {
  minuteLimit: 100, // 관리자는 더 높은 제한
  hourlyLimit: 1000,
  costThreshold: 100,
  infiniteLoopWindow: 3000,
  infiniteLoopThreshold: 5,
};

// ===========================================
// 관리자 전용 비용 안전 미들웨어
// ===========================================

const adminCostSafety = new CostSafetyMiddleware({
  logger: {
    error: (data) => logger.error('관리자 비용 안전 오류', undefined, data),
    warn: (data) => logger.warn('관리자 비용 안전 경고', data),
    info: (data) => logger.info('관리자 비용 안전 정보', data),
  },
  onEmergencyShutdown: (params) => {
    logger.error('관리자 비상 셧다운 실행', undefined, {
      component: 'AdminCostSafety',
      metadata: params,
    });
  },
  ...COST_SAFETY_CONFIG,
});

// ===========================================
// 에러 타입 정의
// ===========================================

export class AdminApiError extends Error {
  constructor(
    public message: string,
    public code: string = 'ADMIN_API_ERROR',
    public status: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export class AdminAuthError extends AdminApiError {
  constructor(message: string = '관리자 권한이 필요합니다.') {
    super(message, 'ADMIN_AUTH_ERROR', 403);
    this.name = 'AdminAuthError';
  }
}

export class IpWhitelistError extends AdminApiError {
  constructor(message: string = '허용되지 않은 IP 주소입니다.') {
    super(message, 'IP_WHITELIST_ERROR', 403);
    this.name = 'IpWhitelistError';
  }
}

// ===========================================
// IP 화이트리스트 검증
// ===========================================

function getClientIp(request: NextRequest): string {
  // Cloudflare, Vercel 등에서 사용하는 헤더 순서대로 확인
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  if (cfConnectingIp) return cfConnectingIp;
  if (realIp) return realIp;
  if (forwardedFor) {
    // x-forwarded-for는 여러 IP가 콤마로 구분될 수 있음
    return forwardedFor.split(',')[0].trim();
  }

  // 개발 환경에서는 localhost 허용
  if (process.env.NODE_ENV === 'development') {
    return '127.0.0.1';
  }

  return 'unknown';
}

function isIpWhitelisted(ip: string): boolean {
  // 개발 환경에서는 모든 IP 허용
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // 화이트리스트가 비어있으면 거부
  if (ADMIN_IP_WHITELIST.length === 0) {
    logger.warn('관리자 IP 화이트리스트가 설정되지 않음', {
      component: 'AdminSecurity',
      metadata: { ip },
    });
    return false;
  }

  return ADMIN_IP_WHITELIST.includes(ip);
}

// ===========================================
// 관리자 권한 검증 (JWT + API 키 이중 인증)
// ===========================================

export interface AdminJwtPayload extends JwtPayload {
  role: 'admin' | 'super_admin';
  permissions: string[];
}

export function verifyAdminAuth(request: NextRequest): AdminJwtPayload {
  // 1. IP 화이트리스트 검증
  const clientIp = getClientIp(request);
  if (!isIpWhitelisted(clientIp)) {
    logger.warn('차단된 IP에서 관리자 접근 시도', {
      component: 'AdminSecurity',
      metadata: {
        ip: crypto.createHash('sha256').update(clientIp).digest('hex'), // IP 해싱
        timestamp: new Date().toISOString(),
      },
    });
    throw new IpWhitelistError();
  }

  // 2. API 키 검증
  const apiKey = request.headers.get('x-admin-api-key');
  if (!apiKey || apiKey !== ADMIN_API_KEY) {
    logger.warn('잘못된 관리자 API 키', {
      component: 'AdminSecurity',
      metadata: {
        hasApiKey: !!apiKey,
        ip: crypto.createHash('sha256').update(clientIp).digest('hex'),
      },
    });
    throw new AdminAuthError('유효하지 않은 API 키입니다.');
  }

  // 3. JWT 토큰 검증
  const token = extractJwtToken(request);
  if (!token) {
    throw new AdminAuthError('인증 토큰이 필요합니다.');
  }

  const payload = verifyJwtToken(token);

  // 4. 관리자 권한 검증
  if (!payload.role || !['admin', 'super_admin'].includes(payload.role)) {
    logger.warn('비관리자 사용자의 관리자 API 접근 시도', {
      component: 'AdminSecurity',
      metadata: {
        userId: payload.userId,
        role: payload.role,
        ip: crypto.createHash('sha256').update(clientIp).digest('hex'),
      },
    });
    throw new AdminAuthError('관리자 권한이 필요합니다.');
  }

  return payload as AdminJwtPayload;
}

// ===========================================
// 감사 로그 기록
// ===========================================

export async function createAuditLog(
  admin: AdminJwtPayload,
  eventType: AuditLog['eventType'],
  action: string,
  resource?: { type: string; id: string },
  metadata: Record<string, unknown> = {},
  request?: NextRequest
): Promise<void> {
  const auditLog: Omit<AuditLog, 'id'> = {
    eventType,
    actor: {
      id: admin.userId,
      role: admin.role,
      ipAddress: request ? crypto.createHash('sha256').update(getClientIp(request)).digest('hex') : undefined,
    },
    resource,
    action,
    metadata: {
      ...metadata,
      userAgent: request?.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
    },
    timestamp: new Date(),
    sessionId: request?.headers.get('x-session-id') || undefined,
  };

  // TODO: Supabase에 감사 로그 저장
  logger.info('관리자 감사 로그', {
    component: 'AdminAudit',
    metadata: auditLog,
  });
}

// ===========================================
// 관리자 응답 헬퍼
// ===========================================

export function createAdminSuccessResponse<T>(
  data: T,
  metadata?: Partial<AdminApiResponse<T>['metadata']>
): NextResponse<AdminApiResponse<T>> {
  const response: AdminApiResponse<T> = {
    data,
    success: true,
    timestamp: new Date(),
    ...metadata,
  };

  return NextResponse.json(response, { status: 200 });
}

export function createAdminErrorResponse(
  error: AdminApiError,
  metadata?: any
): NextResponse {
  const response = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
    timestamp: new Date(),
    ...metadata,
  };

  return NextResponse.json(response, { status: error.status });
}

export function createAdminPaginatedResponse<T>(
  data: T[],
  pagination: PaginationInfo,
  metadata?: any
): NextResponse {
  const response: AdminApiResponse<T[]> = {
    data,
    success: true,
    pagination,
    timestamp: new Date(),
    ...metadata,
  };

  return NextResponse.json(response, { status: 200 });
}

// ===========================================
// 관리자 API 핸들러 래퍼
// ===========================================

export interface AdminApiHandlerOptions {
  endpoint: string;
  requireSuperAdmin?: boolean;
  skipAuditLog?: boolean;
  permissions?: string[];
}

export function withAdminHandler(
  handler: (
    request: NextRequest,
    context: {
      params?: any;
      admin: AdminJwtPayload;
      createAuditLog: (
        eventType: AuditLog['eventType'],
        action: string,
        resource?: { type: string; id: string },
        metadata?: Record<string, unknown>
      ) => Promise<void>;
    }
  ) => Promise<NextResponse>,
  options: AdminApiHandlerOptions
) {
  return async (request: NextRequest, context: { params?: any } = {}) => {
    const startTime = Date.now();
    let admin: AdminJwtPayload | undefined;

    try {
      // 1. 관리자 인증 검증
      admin = verifyAdminAuth(request);

      // 2. 권한 검증
      if (options.requireSuperAdmin && admin.role !== 'super_admin') {
        throw new AdminAuthError('슈퍼 관리자 권한이 필요합니다.');
      }

      if (options.permissions && options.permissions.length > 0) {
        const hasPermission = options.permissions.some(permission =>
          admin!.permissions.includes(permission)
        );
        if (!hasPermission) {
          throw new AdminAuthError(`필요한 권한: ${options.permissions.join(', ')}`);
        }
      }

      // 3. 비용 안전 미들웨어 적용
      const result = await adminCostSafety.checkApiCallLimit(options.endpoint);
      if (!result.allowed) {
        throw new AdminApiError('API 호출 제한을 초과했습니다.', 'RATE_LIMIT_ERROR', 429);
      }

      // 4. 감사 로그 헬퍼 생성
      const auditLogHelper = async (
        eventType: AuditLog['eventType'],
        action: string,
        resource?: { type: string; id: string },
        metadata?: Record<string, unknown>
      ) => {
        if (!options.skipAuditLog) {
          await createAuditLog(admin!, eventType, action, resource, metadata, request);
        }
      };

      // 5. 실제 핸들러 실행
      const response = await handler(request, {
        ...context,
        admin,
        createAuditLog: auditLogHelper,
      });

      // 6. 성공 로깅
      const processingTime = Date.now() - startTime;
      logger.logApiRequest(
        request.method,
        new URL(request.url).pathname,
        response.status,
        processingTime,
        {
          userId: admin.userId,
          metadata: {
            success: true,
            processingTime,
            role: admin.role,
            endpoint: options.endpoint,
          },
        }
      );

      return response;

    } catch (error) {
      const processingTime = Date.now() - startTime;

      // 에러 처리
      if (error instanceof AdminApiError) {
        logger.logApiRequest(
          request.method,
          new URL(request.url).pathname,
          error.status,
          processingTime,
          {
            userId: admin?.userId,
            metadata: {
              success: false,
              errorCode: error.code,
              processingTime,
              role: admin?.role,
              endpoint: options.endpoint,
            },
          }
        );

        return createAdminErrorResponse(error);
      }

      // 예상치 못한 에러
      logger.error('관리자 API 예상치 못한 에러', error instanceof Error ? error : new Error(String(error)), {
        userId: admin?.userId,
        component: 'AdminAPI',
        metadata: {
          method: request.method,
          url: request.url,
          processingTime,
          endpoint: options.endpoint,
        },
      });

      return createAdminErrorResponse(
        new AdminApiError('내부 서버 오류가 발생했습니다.', 'INTERNAL_ERROR', 500)
      );
    }
  };
}

// ===========================================
// 유틸리티 함수
// ===========================================

export function hashSensitiveData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export function maskPii(data: any): any {
  if (typeof data === 'string') {
    // 이메일 마스킹
    if (data.includes('@')) {
      return maskEmail(data);
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(maskPii);
  }

  if (data && typeof data === 'object') {
    const masked = { ...data };

    // 민감한 필드들 마스킹
    const sensitiveFields = ['email', 'phone', 'ip', 'ipAddress'];
    sensitiveFields.forEach(field => {
      if (masked[field] && typeof masked[field] === 'string') {
        if (field === 'email') {
          masked[field] = maskEmail(masked[field]);
        } else if (field === 'ip' || field === 'ipAddress') {
          masked[field] = hashSensitiveData(masked[field]);
        }
      }
    });

    return masked;
  }

  return data;
}