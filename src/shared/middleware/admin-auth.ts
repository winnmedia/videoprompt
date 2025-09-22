/**
 * Admin Authentication Middleware
 *
 * 관리자 전용 API 엔드포인트의 인증 및 권한 검증을 담당하는 미들웨어입니다.
 * IP/토큰 기반 접근 제어와 감사 로그를 포함합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * 관리자 사용자 정보
 */
interface AdminUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
}

/**
 * 인증 결과
 */
interface AuthResult {
  success: boolean;
  user?: AdminUser;
  error?: string;
  auditData?: {
    ipHash: string;
    userAgent: string;
    timestamp: Date;
  };
}

/**
 * IP 주소 해싱
 */
function hashIpAddress(ip: string): string {
  return crypto
    .createHash('sha256')
    .update(ip + process.env.IP_HASH_SECRET!)
    .digest('hex')
    .substring(0, 16);
}

/**
 * IP 주소 추출
 */
function getClientIp(request: NextRequest): string {
  // Vercel의 경우 X-Forwarded-For 헤더 사용
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // 직접 연결의 경우
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // 로컬 개발환경 fallback
  return '127.0.0.1';
}

/**
 * 허용된 IP 범위 확인
 */
function isAllowedIp(ip: string): boolean {
  const allowedIps = process.env.ADMIN_ALLOWED_IPS?.split(',') || [];

  // 로컬 개발환경은 항상 허용
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // IP 화이트리스트 검증
  return allowedIps.some(allowedIp => {
    // CIDR 표기법 지원 (예: 192.168.1.0/24)
    if (allowedIp.includes('/')) {
      // 실제 구현에서는 CIDR 검증 라이브러리 사용
      return ip.startsWith(allowedIp.split('/')[0].substring(0, 10));
    }

    // 정확한 IP 매치
    return ip === allowedIp;
  });
}

/**
 * JWT 토큰 검증
 */
async function verifyJwtToken(token: string): Promise<AdminUser | null> {
  try {
    const secret = process.env.JWT_SECRET!;
    const payload = jwt.verify(token, secret) as any;

    // 관리자 역할 확인
    if (payload.role !== 'admin') {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions || []
    };
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * API 키 검증 (대안 인증 방법)
 */
async function verifyApiKey(apiKey: string): Promise<AdminUser | null> {
  try {
    // 환경 변수에서 마스터 API 키 확인
    const masterApiKey = process.env.ADMIN_MASTER_API_KEY;
    if (!masterApiKey) {
      return null;
    }

    // 보안을 위한 상수 시간 비교
    const expected = Buffer.from(masterApiKey, 'utf8');
    const actual = Buffer.from(apiKey, 'utf8');

    if (expected.length !== actual.length) {
      return null;
    }

    const isValid = crypto.timingSafeEqual(expected, actual);

    if (isValid) {
      return {
        id: 'admin-master',
        email: 'admin@system',
        role: 'admin',
        permissions: ['*'] // 모든 권한
      };
    }

    return null;
  } catch (error) {
    console.error('API key verification failed:', error);
    return null;
  }
}

/**
 * 권한 검증
 */
function hasPermission(user: AdminUser, requiredPermission: string): boolean {
  // 마스터 권한 확인
  if (user.permissions.includes('*')) {
    return true;
  }

  // 특정 권한 확인
  return user.permissions.includes(requiredPermission);
}

/**
 * 감사 로그 기록
 */
async function logAuditEvent(
  user: AdminUser | null,
  request: NextRequest,
  event: {
    type: 'auth_success' | 'auth_failure' | 'access_denied' | 'ip_blocked';
    details?: Record<string, any>;
  }
): Promise<void> {
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  const auditLog = {
    timestamp: new Date().toISOString(),
    event: event.type,
    actor: {
      id: user?.id || 'anonymous',
      role: user?.role || 'unknown',
      ipHash: hashIpAddress(clientIp)
    },
    request: {
      method: request.method,
      url: request.url,
      userAgent: userAgent.substring(0, 200) // 길이 제한
    },
    details: event.details || {}
  };

  // 실제 구현에서는 데이터베이스나 로깅 서비스에 저장
  console.log('Admin Audit Log:', JSON.stringify(auditLog));

  // 예: Supabase audit_logs 테이블에 저장
  // await supabase.from('audit_logs').insert(auditLog);
}

/**
 * 관리자 인증 미들웨어
 */
export async function adminAuthMiddleware(
  request: NextRequest,
  requiredPermission: string = 'admin.read'
): Promise<AuthResult> {
  const clientIp = getClientIp(request);

  try {
    // 1. IP 주소 검증
    if (!isAllowedIp(clientIp)) {
      await logAuditEvent(null, request, {
        type: 'ip_blocked',
        details: { reason: 'IP not in whitelist' }
      });

      return {
        success: false,
        error: 'Access denied: IP address not allowed',
        auditData: {
          ipHash: hashIpAddress(clientIp),
          userAgent: request.headers.get('user-agent') || 'unknown',
          timestamp: new Date()
        }
      };
    }

    // 2. 인증 토큰 추출
    const authHeader = request.headers.get('authorization');
    const apiKey = request.headers.get('x-api-key');

    let user: AdminUser | null = null;

    // JWT 토큰 인증 시도
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      user = await verifyJwtToken(token);
    }

    // API 키 인증 시도 (JWT 실패 시)
    if (!user && apiKey) {
      user = await verifyApiKey(apiKey);
    }

    // 3. 인증 실패
    if (!user) {
      await logAuditEvent(null, request, {
        type: 'auth_failure',
        details: { reason: 'Invalid or missing credentials' }
      });

      return {
        success: false,
        error: 'Authentication failed',
        auditData: {
          ipHash: hashIpAddress(clientIp),
          userAgent: request.headers.get('user-agent') || 'unknown',
          timestamp: new Date()
        }
      };
    }

    // 4. 권한 검증
    if (!hasPermission(user, requiredPermission)) {
      await logAuditEvent(user, request, {
        type: 'access_denied',
        details: { requiredPermission, userPermissions: user.permissions }
      });

      return {
        success: false,
        error: 'Insufficient permissions',
        auditData: {
          ipHash: hashIpAddress(clientIp),
          userAgent: request.headers.get('user-agent') || 'unknown',
          timestamp: new Date()
        }
      };
    }

    // 5. 인증 성공
    await logAuditEvent(user, request, {
      type: 'auth_success',
      details: { permission: requiredPermission }
    });

    return {
      success: true,
      user,
      auditData: {
        ipHash: hashIpAddress(clientIp),
        userAgent: request.headers.get('user-agent') || 'unknown',
        timestamp: new Date()
      }
    };

  } catch (error) {
    console.error('Admin auth middleware error:', error);

    await logAuditEvent(null, request, {
      type: 'auth_failure',
      details: { error: 'Internal authentication error' }
    });

    return {
      success: false,
      error: 'Internal authentication error',
      auditData: {
        ipHash: hashIpAddress(clientIp),
        userAgent: request.headers.get('user-agent') || 'unknown',
        timestamp: new Date()
      }
    };
  }
}

/**
 * Next.js API 라우트용 래퍼
 */
export function withAdminAuth(
  handler: (request: NextRequest, user: AdminUser) => Promise<NextResponse>,
  requiredPermission: string = 'admin.read'
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = await adminAuthMiddleware(request, requiredPermission);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        {
          success: false,
          message: authResult.error || 'Authentication failed',
          timestamp: new Date().toISOString()
        },
        { status: authResult.error?.includes('denied') ? 403 : 401 }
      );
    }

    // 성공한 경우 원래 핸들러 실행
    return handler(request, authResult.user);
  };
}

// 타입 내보내기
export type { AdminUser, AuthResult };