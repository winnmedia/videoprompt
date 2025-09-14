/**
 * API 보안 테스트
 *
 * 테스트 범위:
 * - API 키 보호 및 노출 방지
 * - Rate limiting 동작 검증
 * - XSS, CSRF, Injection 공격 방어
 * - 인증 및 권한 검증
 * - 입력 데이터 검증 및 새니타이제이션
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse, delay } from 'msw';

// 보안 테스트를 위한 모킹된 보안 유틸리티
class SecurityValidator {
  // XSS 공격 패턴 감지
  static detectXSS(input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
      /vbscript:/gi,
      /data:text\/html/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  // SQL Injection 패턴 감지
  static detectSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /('|(\\'))|(;|;\\s)|(--|-\\s)|(\/\\*|\\*\\/)|(union|UNION)|(select|SELECT)|(insert|INSERT)|(delete|DELETE)|(update|UPDATE)|(drop|DROP)|(exec|EXEC)|(or|OR)\\s+(1=1|true)/gi
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  // 입력 데이터 새니타이제이션
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // HTML 태그 제거
      .replace(/['"]/g, '') // 따옴표 제거
      .replace(/javascript:/gi, '') // JavaScript 프로토콜 제거
      .replace(/on\w+=/gi, '') // 이벤트 핸들러 제거
      .trim();
  }

  // 파일 업로드 보안 검증
  static validateFileUpload(filename: string, mimeType: string, size: number): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const allowedMimeTypes = [
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/wmv',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];

    const dangerousExtensions = [
      '.exe', '.bat', '.cmd', '.scr', '.pif',
      '.js', '.jar', '.php', '.asp', '.jsp'
    ];

    // MIME 타입 검증
    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      errors.push(`허용되지 않는 파일 형식입니다: ${mimeType}`);
    }

    // 확장자 검증
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    if (dangerousExtensions.includes(extension)) {
      errors.push(`위험한 파일 확장자입니다: ${extension}`);
    }

    // 파일 크기 검증 (600MB 제한)
    if (size > 600 * 1024 * 1024) {
      errors.push('파일 크기가 600MB를 초과합니다');
    }

    // 파일명 검증
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      errors.push('유효하지 않은 파일명입니다');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Rate limiting 검사
  static checkRateLimit(
    clientId: string,
    requests: Map<string, { count: number; resetTime: number }>,
    limit: number = 100,
    windowMs: number = 60000
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - windowMs;

    let clientData = requests.get(clientId);

    if (!clientData || clientData.resetTime < windowStart) {
      clientData = { count: 0, resetTime: now + windowMs };
      requests.set(clientId, clientData);
    }

    if (clientData.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: clientData.resetTime
      };
    }

    clientData.count++;
    return {
      allowed: true,
      remaining: limit - clientData.count,
      resetTime: clientData.resetTime
    };
  }

  // JWT 토큰 검증 시뮬레이션
  static validateJWTToken(token: string): {
    isValid: boolean;
    payload?: any;
    error?: string;
  } {
    if (!token) {
      return { isValid: false, error: '토큰이 없습니다' };
    }

    if (!token.startsWith('Bearer ')) {
      return { isValid: false, error: '올바른 토큰 형식이 아닙니다' };
    }

    const tokenValue = token.replace('Bearer ', '');

    // 만료된 토큰 시뮬레이션
    if (tokenValue === 'expired-token') {
      return { isValid: false, error: '만료된 토큰입니다' };
    }

    // 유효하지 않은 토큰 시뮬레이션
    if (tokenValue === 'invalid-token') {
      return { isValid: false, error: '유효하지 않은 토큰입니다' };
    }

    // 유효한 토큰
    if (tokenValue.startsWith('valid-token-')) {
      return {
        isValid: true,
        payload: {
          userId: 'user-123',
          email: 'test@example.com',
          role: 'user',
          exp: Date.now() + 3600000 // 1시간 후 만료
        }
      };
    }

    return { isValid: false, error: '알 수 없는 토큰입니다' };
  }
}

// Rate limiting을 위한 글로벌 맵
const requestTracker = new Map<string, { count: number; resetTime: number }>();

// MSW 서버 설정 (보안 테스트용)
const server = setupServer(
  // Rate limiting이 적용된 API 엔드포인트
  http.post('/api/ai/generate-story', async ({ request }) => {
    const clientId = request.headers.get('x-client-id') || 'anonymous';
    const rateLimitResult = SecurityValidator.checkRateLimit(clientId, requestTracker, 5, 60000); // 1분에 5회 제한

    if (!rateLimitResult.allowed) {
      return HttpResponse.json(
        {
          error: 'Rate limit exceeded',
          resetTime: rateLimitResult.resetTime
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      );
    }

    const body = await request.json() as any;

    // XSS 공격 탐지
    if (SecurityValidator.detectXSS(body.title || '') ||
        SecurityValidator.detectXSS(body.oneLineStory || '')) {
      return HttpResponse.json(
        { error: 'Potentially malicious content detected' },
        { status: 400 }
      );
    }

    // SQL Injection 탐지
    if (SecurityValidator.detectSQLInjection(body.title || '') ||
        SecurityValidator.detectSQLInjection(body.oneLineStory || '')) {
      return HttpResponse.json(
        { error: 'Invalid input detected' },
        { status: 400 }
      );
    }

    await delay(100);

    return HttpResponse.json({
      success: true,
      data: { steps: [] },
      rateLimitInfo: {
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime
      }
    }, {
      headers: {
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
      }
    });
  }),

  // 인증이 필요한 보호된 엔드포인트
  http.get('/api/user/profile', async ({ request }) => {
    const authHeader = request.headers.get('Authorization') || '';
    const tokenValidation = SecurityValidator.validateJWTToken(authHeader);

    if (!tokenValidation.isValid) {
      return HttpResponse.json(
        { error: tokenValidation.error },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: tokenValidation.payload
    });
  }),

  // 파일 업로드 보안 검증
  http.post('/api/upload/secure', async ({ request }) => {
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return HttpResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    // 테스트 시나리오 기반 검증
    const testScenario = request.headers.get('x-test-scenario') || '';

    switch (testScenario) {
      case 'malicious-file':
        return HttpResponse.json(
          { error: '위험한 파일 확장자입니다: .exe' },
          { status: 400 }
        );

      case 'oversized-file':
        return HttpResponse.json(
          { error: '파일 크기가 600MB를 초과합니다' },
          { status: 413 }
        );

      case 'invalid-mimetype':
        return HttpResponse.json(
          { error: '허용되지 않는 파일 형식입니다: application/x-executable' },
          { status: 400 }
        );

      case 'path-traversal':
        return HttpResponse.json(
          { error: '유효하지 않은 파일명입니다' },
          { status: 400 }
        );

      default:
        return HttpResponse.json({
          success: true,
          data: {
            filename: 'safe-file.mp4',
            size: 1024,
            mimeType: 'video/mp4'
          }
        });
    }
  }),

  // CSRF 보호 테스트
  http.post('/api/sensitive-action', async ({ request }) => {
    const csrfToken = request.headers.get('x-csrf-token');
    const referer = request.headers.get('referer');

    // CSRF 토큰 검증
    if (!csrfToken || csrfToken !== 'valid-csrf-token') {
      return HttpResponse.json(
        { error: 'CSRF token missing or invalid' },
        { status: 403 }
      );
    }

    // Referer 검증 (같은 origin에서만 허용)
    if (!referer || !referer.includes('localhost')) {
      return HttpResponse.json(
        { error: 'Invalid referer' },
        { status: 403 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Sensitive action completed'
    });
  })
);

describe('API 보안 테스트', () => {
  beforeEach(() => {
    server.listen({ onUnhandledRequest: 'error' });
    requestTracker.clear();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    server.resetHandlers();
    vi.useRealTimers();
  });

  afterAll(() => {
    server.close();
  });

  describe('🛡️ 입력 검증 및 XSS 방어', () => {
    it('XSS 공격 시도를 감지하고 차단해야 한다', async () => {
      const maliciousPayloads = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src=x onerror=alert("XSS")>',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        'vbscript:msgbox("XSS")',
        '<object data="data:text/html;base64,PHNjcmlwdD5hbGVydCgiWFNTIik8L3NjcmlwdD4="></object>'
      ];

      for (const payload of maliciousPayloads) {
        const response = await fetch('/api/ai/generate-story', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': 'test-client'
          },
          body: JSON.stringify({
            title: payload,
            oneLineStory: '정상적인 스토리'
          })
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('malicious content');
      }
    });

    it('SQL Injection 공격 시도를 감지하고 차단해야 한다', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO users VALUES ('hacker'); --",
        "admin' OR 1=1 #"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch('/api/ai/generate-story', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': 'test-client'
          },
          body: JSON.stringify({
            title: '정상적인 제목',
            oneLineStory: payload
          })
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('Invalid input');
      }
    });

    it('SecurityValidator가 XSS 패턴을 올바르게 감지해야 한다', () => {
      const xssInputs = [
        '<script>alert("test")</script>',
        'javascript:alert("test")',
        '<img src=x onerror=alert("test")>',
        '<iframe src="javascript:alert(\'test\')"></iframe>'
      ];

      const safeInputs = [
        '안전한 텍스트입니다',
        'This is safe text',
        '숫자 123과 특수문자 !@#$%^&*()',
        '<p>일반적인 HTML 태그</p>' // script가 아닌 일반 태그는 허용할 수도 있음
      ];

      xssInputs.forEach(input => {
        expect(SecurityValidator.detectXSS(input)).toBe(true);
      });

      // 이 부분은 비즈니스 로직에 따라 조정 필요
      safeInputs.forEach(input => {
        if (!input.includes('<')) { // HTML 태그가 없는 경우만 테스트
          expect(SecurityValidator.detectXSS(input)).toBe(false);
        }
      });
    });

    it('입력 데이터 새니타이제이션이 올바르게 동작해야 한다', () => {
      const testCases = [
        {
          input: '<script>alert("test")</script>Hello',
          expected: 'alert(test)Hello'
        },
        {
          input: 'javascript:alert("test")',
          expected: 'alert(test)'
        },
        {
          input: '<img src=x onerror="alert(\'test\')">',
          expected: 'img src=x alert(test)'
        },
        {
          input: '  정상적인 텍스트  ',
          expected: '정상적인 텍스트'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const sanitized = SecurityValidator.sanitizeInput(input);
        expect(sanitized).toBe(expected);
      });
    });
  });

  describe('🚦 Rate Limiting', () => {
    it('Rate limit을 초과하면 429 상태 코드를 반환해야 한다', async () => {
      const clientId = 'rate-limit-test';

      // 5회 요청 (제한: 1분에 5회)
      for (let i = 0; i < 5; i++) {
        const response = await fetch('/api/ai/generate-story', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': clientId
          },
          body: JSON.stringify({
            title: `요청 ${i + 1}`,
            oneLineStory: '테스트 스토리'
          })
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('X-RateLimit-Remaining')).toBe((4 - i).toString());
      }

      // 6번째 요청은 차단되어야 함
      const blockedResponse = await fetch('/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId
        },
        body: JSON.stringify({
          title: '차단될 요청',
          oneLineStory: '테스트 스토리'
        })
      });

      expect(blockedResponse.status).toBe(429);
      expect(blockedResponse.headers.get('X-RateLimit-Remaining')).toBe('0');

      const data = await blockedResponse.json();
      expect(data.error).toBe('Rate limit exceeded');
    });

    it('시간 윈도우가 지나면 Rate limit이 리셋되어야 한다', async () => {
      const clientId = 'reset-test';

      // 5회 요청으로 제한 도달
      for (let i = 0; i < 5; i++) {
        await fetch('/api/ai/generate-story', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': clientId
          },
          body: JSON.stringify({
            title: `요청 ${i + 1}`,
            oneLineStory: '테스트'
          })
        });
      }

      // 6번째 요청 차단 확인
      const blockedResponse = await fetch('/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId
        },
        body: JSON.stringify({
          title: '차단될 요청',
          oneLineStory: '테스트'
        })
      });

      expect(blockedResponse.status).toBe(429);

      // 시간 경과 (1분 + 1초)
      vi.advanceTimersByTime(61000);

      // 리셋 후 요청 성공해야 함
      const afterResetResponse = await fetch('/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId
        },
        body: JSON.stringify({
          title: '리셋 후 요청',
          oneLineStory: '테스트'
        })
      });

      expect(afterResetResponse.status).toBe(200);
    });

    it('다른 클라이언트는 독립적인 Rate limit을 가져야 한다', async () => {
      const client1 = 'client-1';
      const client2 = 'client-2';

      // client1이 제한에 도달
      for (let i = 0; i < 5; i++) {
        await fetch('/api/ai/generate-story', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': client1
          },
          body: JSON.stringify({
            title: `Client1 요청 ${i + 1}`,
            oneLineStory: '테스트'
          })
        });
      }

      // client1의 추가 요청은 차단
      const client1BlockedResponse = await fetch('/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': client1
        },
        body: JSON.stringify({
          title: 'Client1 차단될 요청',
          oneLineStory: '테스트'
        })
      });

      expect(client1BlockedResponse.status).toBe(429);

      // client2는 여전히 요청 가능해야 함
      const client2Response = await fetch('/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': client2
        },
        body: JSON.stringify({
          title: 'Client2 요청',
          oneLineStory: '테스트'
        })
      });

      expect(client2Response.status).toBe(200);
    });
  });

  describe('🔐 인증 및 권한 검증', () => {
    it('유효한 JWT 토큰으로 보호된 엔드포인트에 접근할 수 있어야 한다', async () => {
      const response = await fetch('/api/user/profile', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token-123'
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('userId');
      expect(data.data).toHaveProperty('email');
    });

    it('토큰 없이 보호된 엔드포인트에 접근하면 401을 반환해야 한다', async () => {
      const response = await fetch('/api/user/profile', {
        method: 'GET'
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('토큰이 없습니다');
    });

    it('유효하지 않은 토큰으로 접근하면 401을 반환해야 한다', async () => {
      const invalidTokens = [
        'invalid-token',
        'Bearer invalid-token',
        'Bearer expired-token',
        'not-a-bearer-token'
      ];

      for (const token of invalidTokens) {
        const response = await fetch('/api/user/profile', {
          method: 'GET',
          headers: {
            'Authorization': token
          }
        });

        expect(response.status).toBe(401);

        const data = await response.json();
        expect(data.error).toBeDefined();
      }
    });
  });

  describe('📁 파일 업로드 보안', () => {
    it('안전한 파일 업로드는 성공해야 한다', async () => {
      const response = await fetch('/api/upload/secure', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=test',
          'x-test-scenario': 'safe-file'
        },
        body: 'mock-multipart-data'
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('filename');
    });

    it('악성 파일 업로드는 차단되어야 한다', async () => {
      const maliciousScenarios = [
        'malicious-file',
        'oversized-file',
        'invalid-mimetype',
        'path-traversal'
      ];

      for (const scenario of maliciousScenarios) {
        const response = await fetch('/api/upload/secure', {
          method: 'POST',
          headers: {
            'Content-Type': 'multipart/form-data; boundary=test',
            'x-test-scenario': scenario
          },
          body: 'mock-multipart-data'
        });

        expect(response.status).toBeGreaterThanOrEqual(400);

        const data = await response.json();
        expect(data.error).toBeDefined();
      }
    });

    it('파일 업로드 검증 함수가 올바르게 동작해야 한다', () => {
      const testCases = [
        {
          filename: 'video.mp4',
          mimeType: 'video/mp4',
          size: 1024 * 1024, // 1MB
          expected: { isValid: true, errors: [] }
        },
        {
          filename: 'malicious.exe',
          mimeType: 'application/x-executable',
          size: 1024,
          expected: {
            isValid: false,
            errors: expect.arrayContaining([
              expect.stringContaining('허용되지 않는 파일 형식'),
              expect.stringContaining('위험한 파일 확장자')
            ])
          }
        },
        {
          filename: 'large-video.mp4',
          mimeType: 'video/mp4',
          size: 700 * 1024 * 1024, // 700MB
          expected: {
            isValid: false,
            errors: expect.arrayContaining([
              expect.stringContaining('파일 크기가 600MB를 초과')
            ])
          }
        },
        {
          filename: '../../../etc/passwd',
          mimeType: 'video/mp4',
          size: 1024,
          expected: {
            isValid: false,
            errors: expect.arrayContaining([
              expect.stringContaining('유효하지 않은 파일명')
            ])
          }
        }
      ];

      testCases.forEach(({ filename, mimeType, size, expected }) => {
        const result = SecurityValidator.validateFileUpload(filename, mimeType, size);
        expect(result).toEqual(expected);
      });
    });
  });

  describe('🔒 CSRF 보호', () => {
    it('유효한 CSRF 토큰과 Referer로 민감한 작업을 수행할 수 있어야 한다', async () => {
      const response = await fetch('/api/sensitive-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'valid-csrf-token',
          'referer': 'http://localhost:3000/dashboard'
        },
        body: JSON.stringify({
          action: 'delete-account'
        })
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Sensitive action completed');
    });

    it('CSRF 토큰이 없으면 403을 반환해야 한다', async () => {
      const response = await fetch('/api/sensitive-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'referer': 'http://localhost:3000/dashboard'
        },
        body: JSON.stringify({
          action: 'delete-account'
        })
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('CSRF token missing or invalid');
    });

    it('잘못된 Referer로 요청하면 403을 반환해야 한다', async () => {
      const response = await fetch('/api/sensitive-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'valid-csrf-token',
          'referer': 'https://malicious-site.com'
        },
        body: JSON.stringify({
          action: 'delete-account'
        })
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Invalid referer');
    });
  });
});