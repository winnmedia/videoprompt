/**
 * API 키 검증 및 보안 미들웨어
 * 중앙화된 API 키 검증 로직
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAIApiKeys, getServiceUrls, envUtils } from '@/shared/config/env';
import { createCorsResponse } from './cors';

/**
 * API 키 검증 결과
 */
interface ApiKeyValidation {
  isValid: boolean;
  service?: 'gemini' | 'seedance' | 'modelark';
  error?: string;
}

/**
 * 서비스별 API 키 검증
 */
export function validateApiKeys(requiredServices: ('gemini' | 'seedance' | 'modelark')[]): ApiKeyValidation {
  const apiKeys = getAIApiKeys();
  
  for (const service of requiredServices) {
    const key = apiKeys[service];
    if (!key || key.trim() === '') {
      return {
        isValid: false,
        error: `${service.toUpperCase()} API 키가 설정되지 않았습니다.`
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Webhook 서명 검증 (Seedance용)
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!secret || !signature) return false;
  
  try {
    // Seedance webhook 서명 검증 로직 (실제 구현 필요)
    // 현재는 기본적인 검증만 수행
    return signature.length > 0 && secret.length > 0;
  } catch (error) {
    console.error('Webhook 서명 검증 실패:', error);
    return false;
  }
}

/**
 * Rate limiting을 위한 간단한 메모리 기반 카운터
 */
class MemoryRateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();
  
  constructor(
    private windowMs: number = 60 * 1000, // 1분
    private maxRequests: number = 60 // 분당 60회
  ) {}
  
  check(identifier: string): { allowed: boolean; resetTime?: number } {
    const now = Date.now();
    const key = identifier;
    
    let record = this.requests.get(key);
    
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + this.windowMs };
      this.requests.set(key, record);
      return { allowed: true };
    }
    
    if (record.count >= this.maxRequests) {
      return { allowed: false, resetTime: record.resetTime };
    }
    
    record.count++;
    return { allowed: true };
  }
}

// 전역 rate limiter 인스턴스
const defaultRateLimiter = new MemoryRateLimiter();

/**
 * Rate limiting 미들웨어
 */
export function checkRateLimit(
  request: NextRequest,
  identifier?: string
): { allowed: boolean; resetTime?: number } {
  // IP 주소를 식별자로 사용 (프록시 환경 고려)
  const clientIP = identifier || 
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown';
    
  return defaultRateLimiter.check(clientIP);
}

/**
 * API 요청 크기 제한 검증
 */
export function validateRequestSize(
  contentLength: string | null,
  maxSizeMB: number = 10
): { isValid: boolean; error?: string } {
  if (!contentLength) {
    return { isValid: true }; // Content-Length가 없으면 통과
  }
  
  const sizeBytes = parseInt(contentLength, 10);
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (isNaN(sizeBytes) || sizeBytes > maxSizeBytes) {
    return {
      isValid: false,
      error: `요청 크기가 너무 큽니다. 최대 ${maxSizeMB}MB까지 허용됩니다.`
    };
  }
  
  return { isValid: true };
}

/**
 * 입력값 sanitization
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // 기본적인 XSS 방지 (HTML 태그 제거)
    return input
      .replace(/<[^>]*>/g, '')
      .trim()
      .slice(0, 10000); // 최대 10KB로 제한
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    Object.keys(input).forEach(key => {
      if (key.length <= 100) { // 키 길이 제한
        sanitized[key] = sanitizeInput(input[key]);
      }
    });
    return sanitized;
  }
  
  return input;
}

/**
 * API 보안 미들웨어 - 모든 검증을 한번에 수행
 */
export function withApiSecurity<T extends (req: NextRequest, ...args: any[]) => Promise<NextResponse>>(
  handler: T,
  options: {
    requiredServices?: ('gemini' | 'seedance' | 'modelark')[];
    requireOrigin?: boolean;
    maxRequestSizeMB?: number;
    skipRateLimit?: boolean;
  } = {}
): T {
  return (async (req: NextRequest, ...args: any[]) => {
    const origin = req.headers.get('origin');
    
    try {
      // Rate limiting 검사
      if (!options.skipRateLimit) {
        const rateCheck = checkRateLimit(req);
        if (!rateCheck.allowed) {
          return createCorsResponse(
            { 
              error: 'RATE_LIMIT_EXCEEDED', 
              message: 'API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
              resetTime: rateCheck.resetTime
            },
            origin,
            { status: 429 }
          );
        }
      }
      
      // 요청 크기 검증
      const sizeCheck = validateRequestSize(
        req.headers.get('content-length'), 
        options.maxRequestSizeMB
      );
      if (!sizeCheck.isValid) {
        return createCorsResponse(
          { error: 'REQUEST_TOO_LARGE', message: sizeCheck.error },
          origin,
          { status: 413 }
        );
      }
      
      // API 키 검증
      if (options.requiredServices && options.requiredServices.length > 0) {
        const apiKeyCheck = validateApiKeys(options.requiredServices);
        if (!apiKeyCheck.isValid) {
          return createCorsResponse(
            { error: 'API_KEY_MISSING', message: apiKeyCheck.error },
            origin,
            { status: 503 } // Service Unavailable
          );
        }
      }
      
      // 원래 핸들러 실행
      return await handler(req, ...args);
      
    } catch (error) {
      console.error('API 보안 미들웨어 오류:', error);
      return createCorsResponse(
        { error: 'INTERNAL_ERROR', message: '서버 내부 오류가 발생했습니다.' },
        origin,
        { status: 500 }
      );
    }
  }) as T;
}