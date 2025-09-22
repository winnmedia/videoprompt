/**
 * 암호화 및 보안 유틸리티
 *
 * 토큰 생성, 해시, 게스트 ID 생성 등
 * 피드백 시스템의 보안 관련 기능들을 제공
 */

import { randomBytes, createHash } from 'crypto';

// ===========================================
// 토큰 생성
// ===========================================

/**
 * 보안 토큰 생성 (공유 링크용)
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * 게스트 ID 생성 (고유하지만 추적 불가능한 ID)
 */
export function generateGuestId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString('hex');
  return `guest_${timestamp}_${random}`;
}

/**
 * 업로드 세션 ID 생성
 */
export function generateUploadSessionId(): string {
  return `upload_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

/**
 * 초대 토큰 생성
 */
export function generateInvitationToken(projectId: string, email: string): string {
  const data = `${projectId}:${email}:${Date.now()}`;
  const hash = createHash('sha256').update(data).digest('hex');
  return Buffer.from(`${data}:${hash}`).toString('base64url');
}

// ===========================================
// 토큰 검증
// ===========================================

/**
 * 초대 토큰 검증 및 파싱
 */
export function parseInvitationToken(token: string): {
  isValid: boolean;
  projectId?: string;
  email?: string;
  timestamp?: number;
} {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const parts = decoded.split(':');

    if (parts.length !== 4) {
      return { isValid: false };
    }

    const [projectId, email, timestampStr, providedHash] = parts;
    const timestamp = parseInt(timestampStr, 10);

    // 토큰 만료 확인 (7일)
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (now - timestamp > sevenDays) {
      return { isValid: false };
    }

    // 해시 검증
    const data = `${projectId}:${email}:${timestamp}`;
    const expectedHash = createHash('sha256').update(data).digest('hex');

    if (providedHash !== expectedHash) {
      return { isValid: false };
    }

    return {
      isValid: true,
      projectId,
      email,
      timestamp,
    };
  } catch {
    return { isValid: false };
  }
}

// ===========================================
// 해시 함수
// ===========================================

/**
 * 데이터 해시 생성 (SHA-256)
 */
export function hashData(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * 파일 내용 해시 생성 (중복 파일 감지용)
 */
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = createHash('sha256');
  hash.update(new Uint8Array(buffer));
  return hash.digest('hex');
}

// ===========================================
// 게스트 세션 관리
// ===========================================

export interface GuestSession {
  project_id: string;
  participant_id: string;
  guest_id: string;
  guest_name: string;
  guest_email: string;
  permissions: Record<string, boolean>;
  expires_at: number;
}

/**
 * 게스트 세션 토큰 생성
 */
export function createGuestSessionToken(session: GuestSession): string {
  const sessionData = JSON.stringify(session);
  return Buffer.from(sessionData).toString('base64url');
}

/**
 * 게스트 세션 토큰 파싱 및 검증
 */
export function parseGuestSessionToken(token: string): {
  isValid: boolean;
  session?: GuestSession;
} {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const session: GuestSession = JSON.parse(decoded);

    // 만료 시간 확인
    if (Date.now() > session.expires_at) {
      return { isValid: false };
    }

    // 필수 필드 확인
    if (!session.project_id || !session.guest_id || !session.guest_email) {
      return { isValid: false };
    }

    return {
      isValid: true,
      session,
    };
  } catch {
    return { isValid: false };
  }
}

// ===========================================
// 권한 검증
// ===========================================

/**
 * 게스트 권한 확인
 */
export function checkGuestPermission(
  session: GuestSession,
  permission: string
): boolean {
  return session.permissions[permission] === true;
}

/**
 * 사용자 역할별 권한 확인
 */
export function checkRolePermission(
  userRole: string,
  requiredPermission: string
): boolean {
  const rolePermissions: Record<string, string[]> = {
    owner: [
      'can_view', 'can_comment', 'can_react', 'can_upload',
      'can_resolve', 'can_manage_participants', 'can_delete_project'
    ],
    admin: [
      'can_view', 'can_comment', 'can_react', 'can_upload',
      'can_resolve', 'can_manage_participants'
    ],
    editor: [
      'can_view', 'can_comment', 'can_react', 'can_upload', 'can_resolve'
    ],
    viewer: [
      'can_view', 'can_comment', 'can_react'
    ],
    guest: [
      'can_view', 'can_comment', 'can_react'
    ],
  };

  const permissions = rolePermissions[userRole] || [];
  return permissions.includes(requiredPermission);
}

// ===========================================
// 이메일 검증
// ===========================================

/**
 * 이메일 주소 유효성 검증
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 도메인 허용 목록 확인
 */
export function checkAllowedDomain(
  email: string,
  allowedDomains: string[]
): boolean {
  if (!allowedDomains || allowedDomains.length === 0) {
    return true; // 제한 없음
  }

  const domain = email.split('@')[1];
  return allowedDomains.includes(domain);
}

// ===========================================
// 보안 헤더 생성
// ===========================================

/**
 * 요청 서명 생성 (API 보안용)
 */
export function generateRequestSignature(
  method: string,
  url: string,
  body: string,
  timestamp: number,
  secretKey: string
): string {
  const data = `${method}:${url}:${body}:${timestamp}`;
  const signature = createHash('sha256')
    .update(data + secretKey)
    .digest('hex');
  return signature;
}

/**
 * 요청 서명 검증
 */
export function verifyRequestSignature(
  method: string,
  url: string,
  body: string,
  timestamp: number,
  providedSignature: string,
  secretKey: string
): boolean {
  // 타임스탬프 유효성 (5분 이내)
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  if (Math.abs(now - timestamp) > fiveMinutes) {
    return false;
  }

  const expectedSignature = generateRequestSignature(
    method, url, body, timestamp, secretKey
  );

  return expectedSignature === providedSignature;
}

// ===========================================
// 파일 보안
// ===========================================

/**
 * 파일명 안전화 (보안 위험 문자 제거)
 */
export function sanitizeFileName(fileName: string): string {
  // 위험한 문자들 제거
  const dangerous = /[<>:"/\\|?*\x00-\x1f]/g;
  const sanitized = fileName.replace(dangerous, '_');

  // 길이 제한
  const maxLength = 255;
  if (sanitized.length > maxLength) {
    const extension = sanitized.split('.').pop() || '';
    const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 1);
    return `${truncatedName}.${extension}`;
  }

  return sanitized;
}

/**
 * 파일 경로 안전화 (Path Traversal 공격 방지)
 */
export function sanitizeFilePath(filePath: string): string {
  // Path traversal 패턴 제거
  const sanitized = filePath
    .replace(/\.\./g, '') // .. 제거
    .replace(/\/+/g, '/') // 연속된 슬래시 정리
    .replace(/^\//, ''); // 시작 슬래시 제거

  return sanitized;
}

// ===========================================
// 랜덤 문자열 생성
// ===========================================

/**
 * 지정된 길이의 랜덤 문자열 생성
 */
export function generateRandomString(
  length: number,
  charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
  let result = '';
  const bytes = randomBytes(length);

  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }

  return result;
}

/**
 * URL 안전한 랜덤 문자열 생성
 */
export function generateUrlSafeRandomString(length: number): string {
  return generateRandomString(length, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_');
}

// ===========================================
// 데이터 마스킹
// ===========================================

/**
 * 이메일 주소 마스킹 (프라이버시 보호)
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * IP 주소 마스킹
 */
export function maskIpAddress(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.***`;
  }
  return ip.substring(0, Math.min(ip.length, 8)) + '***';
}