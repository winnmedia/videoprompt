/**
 * Grace QA Lead: API 계약 불일치 회귀 방지 테스트
 *
 * 무관용 정책: API 계약 변경은 즉시 감지하고 차단
 * 백엔드-프론트엔드 간 계약 일치성 보장
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { z } from 'zod';

// API 계약 스키마 정의 (Zod를 사용한 런타임 검증)
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  avatar_url: z.string().url().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  role: z.enum(['user', 'admin', 'moderator']),
  is_active: z.boolean(),
  metadata: z.record(z.any()).optional()
});

const AuthResponseSchema = z.object({
  user: UserSchema,
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
  token_type: z.literal('Bearer')
});

const PlanningSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  scenarios: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    duration: z.number().positive(),
    style: z.enum(['cinematic', 'documentary', 'animation', 'realistic']),
    theme: z.string().min(1)
  })),
  status: z.enum(['draft', 'planning', 'ready', 'completed']),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

const StoryGenerationRequestSchema = z.object({
  planning_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  style_preferences: z.object({
    tone: z.enum(['professional', 'casual', 'dramatic', 'humorous']),
    length: z.enum(['short', 'medium', 'long']),
    focus: z.enum(['narrative', 'informational', 'promotional'])
  }),
  additional_context: z.string().optional()
});

const StoryGenerationResponseSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1),
  metadata: z.object({
    word_count: z.number().nonnegative(),
    estimated_duration: z.number().positive(),
    style_applied: z.string(),
    ai_model_used: z.string()
  }),
  status: z.enum(['generated', 'processing', 'failed']),
  created_at: z.string().datetime()
});

// API 계약 검증기
class APIContractValidator {
  private readonly endpoints: Map<string, z.ZodSchema> = new Map();
  private readonly violations: Array<{
    endpoint: string;
    method: string;
    type: 'REQUEST' | 'RESPONSE';
    errors: string[];
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  }> = [];

  constructor() {
    this.registerContracts();
  }

  private registerContracts(): void {
    // Response contracts
    this.endpoints.set('GET /api/auth/me', UserSchema);
    this.endpoints.set('POST /api/auth/login', AuthResponseSchema);
    this.endpoints.set('POST /api/auth/refresh', AuthResponseSchema);
    this.endpoints.set('GET /api/planning/list', z.array(PlanningSchema));
    this.endpoints.set('GET /api/planning/:id', PlanningSchema);
    this.endpoints.set('POST /api/ai/generate-story', StoryGenerationResponseSchema);

    // Request contracts
    this.endpoints.set('POST /api/auth/login:request', z.object({
      email: z.string().email(),
      password: z.string().min(1)
    }));
    this.endpoints.set('POST /api/ai/generate-story:request', StoryGenerationRequestSchema);
    this.endpoints.set('POST /api/planning/create:request', z.object({
      title: z.string().min(1),
      description: z.string(),
      scenarios: z.array(z.object({
        name: z.string().min(1),
        duration: z.number().positive(),
        style: z.enum(['cinematic', 'documentary', 'animation', 'realistic']),
        theme: z.string().min(1)
      }))
    }));
  }

  validateResponse(endpoint: string, method: string, data: unknown): {
    valid: boolean;
    errors: string[];
    schema?: z.ZodSchema;
  } {
    const key = `${method} ${endpoint}`;
    const schema = this.endpoints.get(key);

    if (!schema) {
      return {
        valid: false,
        errors: [`No contract defined for ${key}`]
      };
    }

    try {
      schema.parse(data);
      return {
        valid: true,
        errors: [],
        schema
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err =>
          `${err.path.join('.')}: ${err.message}`
        );

        this.violations.push({
          endpoint,
          method,
          type: 'RESPONSE',
          errors,
          severity: this.determineSeverity(endpoint, errors)
        });

        return {
          valid: false,
          errors,
          schema
        };
      }

      return {
        valid: false,
        errors: ['Unknown validation error'],
        schema
      };
    }
  }

  validateRequest(endpoint: string, method: string, data: unknown): {
    valid: boolean;
    errors: string[];
  } {
    const key = `${method} ${endpoint}:request`;
    const schema = this.endpoints.get(key);

    if (!schema) {
      return { valid: true, errors: [] }; // No request validation defined
    }

    try {
      schema.parse(data);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err =>
          `${err.path.join('.')}: ${err.message}`
        );

        this.violations.push({
          endpoint,
          method,
          type: 'REQUEST',
          errors,
          severity: this.determineSeverity(endpoint, errors)
        });

        return { valid: false, errors };
      }

      return { valid: false, errors: ['Unknown validation error'] };
    }
  }

  private determineSeverity(endpoint: string, errors: string[]): 'CRITICAL' | 'HIGH' | 'MEDIUM' {
    // 인증 관련 엔드포인트는 CRITICAL
    if (endpoint.includes('/auth/')) {
      return 'CRITICAL';
    }

    // 필수 필드 누락은 CRITICAL
    if (errors.some(err => err.includes('Required'))) {
      return 'CRITICAL';
    }

    // 타입 불일치는 HIGH
    if (errors.some(err => err.includes('Expected'))) {
      return 'HIGH';
    }

    return 'MEDIUM';
  }

  getViolations(): typeof this.violations {
    return [...this.violations];
  }

  clearViolations(): void {
    this.violations.length = 0;
  }

  hasViolations(): boolean {
    return this.violations.length > 0;
  }

  hasCriticalViolations(): boolean {
    return this.violations.some(v => v.severity === 'CRITICAL');
  }

  generateComplianceReport(): {
    passed: boolean;
    totalEndpoints: number;
    violatingEndpoints: number;
    complianceScore: number;
    violations: typeof this.violations;
    recommendations: string[];
  } {
    const totalEndpoints = this.endpoints.size;
    const violatingEndpoints = new Set(
      this.violations.map(v => `${v.method} ${v.endpoint}`)
    ).size;

    const complianceScore = totalEndpoints > 0
      ? ((totalEndpoints - violatingEndpoints) / totalEndpoints) * 100
      : 100;

    const recommendations: string[] = [];

    if (this.hasCriticalViolations()) {
      recommendations.push('즉시 배포 차단 - 크리티컬 API 계약 위반');
      recommendations.push('백엔드 API 응답 스키마 수정 필요');
    }

    if (complianceScore < 95) {
      recommendations.push('API 계약 컴플라이언스 95% 미만 - 긴급 수정');
    }

    recommendations.push('OpenAPI 3.0 스펙 업데이트');
    recommendations.push('Zod 스키마 검증 강화');
    recommendations.push('API 버저닝 전략 수립');

    return {
      passed: complianceScore >= 95 && !this.hasCriticalViolations(),
      totalEndpoints,
      violatingEndpoints,
      complianceScore,
      violations: this.getViolations(),
      recommendations
    };
  }
}

// Mock 서버 설정
const server = setupServer(
  // 올바른 API 응답
  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'user@example.com',
      name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      role: 'user',
      is_active: true,
      metadata: { plan: 'pro' }
    });
  }),

  // 잘못된 API 응답 (테스트용)
  http.get('/api/auth/me-invalid', () => {
    return HttpResponse.json({
      id: 'invalid-uuid', // UUID 형식 아님
      email: 'invalid-email', // 이메일 형식 아님
      name: '', // 빈 문자열
      role: 'invalid-role', // 허용되지 않은 역할
      is_active: 'yes', // boolean이 아님
      // created_at, updated_at 누락
    });
  }),

  http.post('/api/ai/generate-story', async ({ request }) => {
    const body = await request.json();

    // 요청 검증을 위한 잘못된 응답
    if ((body as any).invalid_request) {
      return HttpResponse.json({
        id: 'invalid-uuid',
        content: '',
        metadata: {
          word_count: -1, // 음수
          estimated_duration: 0, // 양수가 아님
          style_applied: null, // string이 아님
          ai_model_used: null
        },
        status: 'invalid-status', // 허용되지 않은 상태
        created_at: 'invalid-date'
      }, { status: 200 });
    }

    return HttpResponse.json({
      id: '456e7890-e89b-12d3-a456-426614174001',
      content: '생성된 스토리 내용입니다.',
      metadata: {
        word_count: 150,
        estimated_duration: 30,
        style_applied: 'cinematic',
        ai_model_used: 'gpt-4'
      },
      status: 'generated',
      created_at: '2024-01-01T00:00:00Z'
    });
  })
);

describe('Grace QA: API 계약 불일치 회귀 방지 시스템', () => {
  let validator: APIContractValidator;

  beforeEach(() => {
    validator = new APIContractValidator();
    validator.clearViolations();
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('응답 스키마 검증', () => {
    it('should validate correct API responses', async () => {
      const response = await fetch('/api/auth/me');
      const data = await response.json();

      const validation = validator.validateResponse('/api/auth/me', 'GET', data);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validator.hasViolations()).toBe(false);
    });

    it('should detect API contract violations', async () => {
      const response = await fetch('/api/auth/me-invalid');
      const data = await response.json();

      const validation = validator.validateResponse('/api/auth/me', 'GET', data);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validator.hasViolations()).toBe(true);
      expect(validator.hasCriticalViolations()).toBe(true);

      const violations = validator.getViolations();
      expect(violations[0].severity).toBe('CRITICAL');
      expect(violations[0].type).toBe('RESPONSE');
    });

    it('should validate complex nested schemas', async () => {
      const validStoryResponse = {
        id: '789e1234-e89b-12d3-a456-426614174002',
        content: '복잡한 스토리 내용',
        metadata: {
          word_count: 250,
          estimated_duration: 45,
          style_applied: 'documentary',
          ai_model_used: 'claude-3'
        },
        status: 'generated',
        created_at: '2024-01-01T00:00:00Z'
      };

      const validation = validator.validateResponse(
        '/api/ai/generate-story',
        'POST',
        validStoryResponse
      );

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect nested field violations', async () => {
      const invalidStoryResponse = {
        id: '789e1234-e89b-12d3-a456-426614174002',
        content: '스토리 내용',
        metadata: {
          word_count: -10, // 음수 (위반)
          estimated_duration: 0, // 0 (위반)
          style_applied: null, // null (위반)
          ai_model_used: 123 // 숫자 (위반)
        },
        status: 'invalid', // 잘못된 enum (위반)
        created_at: 'not-a-date' // 잘못된 날짜 (위반)
      };

      const validation = validator.validateResponse(
        '/api/ai/generate-story',
        'POST',
        invalidStoryResponse
      );

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(5);

      // 특정 필드 에러 확인
      expect(validation.errors.some(err => err.includes('word_count'))).toBe(true);
      expect(validation.errors.some(err => err.includes('estimated_duration'))).toBe(true);
      expect(validation.errors.some(err => err.includes('status'))).toBe(true);
    });
  });

  describe('요청 스키마 검증', () => {
    it('should validate request payloads', () => {
      const validRequest = {
        planning_id: '123e4567-e89b-12d3-a456-426614174000',
        scenario_id: '456e7890-e89b-12d3-a456-426614174001',
        style_preferences: {
          tone: 'professional',
          length: 'medium',
          focus: 'narrative'
        },
        additional_context: '추가 컨텍스트'
      };

      const validation = validator.validateRequest(
        '/api/ai/generate-story',
        'POST',
        validRequest
      );

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid request payloads', () => {
      const invalidRequest = {
        planning_id: 'invalid-uuid',
        scenario_id: '', // 빈 문자열
        style_preferences: {
          tone: 'invalid-tone',
          length: 'invalid-length',
          focus: 'invalid-focus'
        }
        // additional_context는 선택사항이므로 생략 가능
      };

      const validation = validator.validateRequest(
        '/api/ai/generate-story',
        'POST',
        invalidRequest
      );

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);

      const violations = validator.getViolations();
      expect(violations.some(v => v.type === 'REQUEST')).toBe(true);
    });
  });

  describe('회귀 방지 시스템', () => {
    it('should prevent deployment with contract violations', async () => {
      // 여러 엔드포인트에서 위반 발생 시뮬레이션
      const invalidUserData = {
        id: 'not-uuid',
        email: 'invalid-email',
        name: '',
        role: 'invalid-role'
      };

      const invalidStoryData = {
        id: 'not-uuid',
        content: '',
        status: 'invalid-status'
      };

      validator.validateResponse('/api/auth/me', 'GET', invalidUserData);
      validator.validateResponse('/api/ai/generate-story', 'POST', invalidStoryData);

      const report = validator.generateComplianceReport();

      expect(report.passed).toBe(false);
      expect(report.complianceScore).toBeLessThan(95);
      expect(report.violations.length).toBeGreaterThan(0);
      expect(report.recommendations).toContain('즉시 배포 차단 - 크리티컬 API 계약 위반');
    });

    it('should allow deployment with full compliance', () => {
      // 모든 엔드포인트가 올바른 응답을 반환
      const validUserData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        name: 'Test User',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        role: 'user',
        is_active: true
      };

      validator.validateResponse('/api/auth/me', 'GET', validUserData);

      const report = validator.generateComplianceReport();

      expect(report.passed).toBe(true);
      expect(report.complianceScore).toBe(100);
      expect(report.violations).toHaveLength(0);
    });

    it('should track violations across multiple endpoints', () => {
      // 다양한 엔드포인트에서 위반 시뮬레이션
      const endpoints = [
        { path: '/api/auth/me', method: 'GET', data: { id: 'invalid' } },
        { path: '/api/auth/login', method: 'POST', data: { user: null } },
        { path: '/api/planning/list', method: 'GET', data: 'not-array' }
      ];

      endpoints.forEach(({ path, method, data }) => {
        validator.validateResponse(path, method, data);
      });

      const violations = validator.getViolations();
      expect(violations).toHaveLength(3);

      // 서로 다른 엔드포인트의 위반이 기록되어야 함
      const uniqueEndpoints = new Set(violations.map(v => v.endpoint));
      expect(uniqueEndpoints.size).toBe(3);
    });
  });

  describe('Grace 무관용 정책 강제', () => {
    it('should have zero tolerance for authentication API violations', () => {
      const authViolation = {
        id: 'invalid-id',
        email: 'not-email',
        name: '',
        role: 'hacker', // 허용되지 않은 역할
        is_active: 'maybe' // boolean이 아님
      };

      validator.validateResponse('/api/auth/me', 'GET', authViolation);

      const violations = validator.getViolations();
      expect(violations[0].severity).toBe('CRITICAL');
      expect(violations[0].endpoint).toBe('/api/auth/me');
      expect(validator.hasCriticalViolations()).toBe(true);
    });

    it('should provide detailed error context for debugging', () => {
      const malformedData = {
        id: 123, // 숫자가 아닌 문자열
        email: null, // null
        name: ['array'], // 배열
        role: { invalid: 'object' }, // 객체
        is_active: undefined, // undefined
        extra_field: 'should-not-be-here'
      };

      validator.validateResponse('/api/auth/me', 'GET', malformedData);

      const violations = validator.getViolations();
      const errors = violations[0].errors;

      expect(errors.some(err => err.includes('id'))).toBe(true);
      expect(errors.some(err => err.includes('email'))).toBe(true);
      expect(errors.some(err => err.includes('name'))).toBe(true);
      expect(errors.some(err => err.includes('role'))).toBe(true);
      expect(errors.some(err => err.includes('is_active'))).toBe(true);
    });

    it('should maintain performance with large API responses', () => {
      // 대규모 API 응답 시뮬레이션
      const largeResponse = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        name: 'Test User',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        role: 'user',
        is_active: true,
        metadata: Object.fromEntries(
          Array.from({ length: 1000 }, (_, i) => [`key${i}`, `value${i}`])
        )
      };

      const startTime = Date.now();
      validator.validateResponse('/api/auth/me', 'GET', largeResponse);
      const endTime = Date.now();

      // Grace 기준: 1초 이내 검증 완료
      expect(endTime - startTime).toBeLessThan(1000);
      expect(validator.hasViolations()).toBe(false);
    });

    it('should generate actionable compliance reports', () => {
      // 다양한 심각도의 위반 발생
      validator.validateResponse('/api/auth/me', 'GET', { id: 'invalid' }); // CRITICAL
      validator.validateResponse('/api/planning/list', 'GET', [{ title: null }]); // HIGH

      const report = validator.generateComplianceReport();

      expect(report.recommendations).toContain('즉시 배포 차단 - 크리티컬 API 계약 위반');
      expect(report.recommendations).toContain('백엔드 API 응답 스키마 수정 필요');
      expect(report.recommendations).toContain('OpenAPI 3.0 스펙 업데이트');
      expect(report.recommendations).toContain('Zod 스키마 검증 강화');
    });
  });

  describe('실제 API 통합 테스트', () => {
    it('should work with real MSW server responses', async () => {
      // 올바른 응답
      const validResponse = await fetch('/api/auth/me');
      const validData = await validResponse.json();

      const validValidation = validator.validateResponse('/api/auth/me', 'GET', validData);
      expect(validValidation.valid).toBe(true);

      // 잘못된 응답
      const invalidResponse = await fetch('/api/auth/me-invalid');
      const invalidData = await invalidResponse.json();

      const invalidValidation = validator.validateResponse('/api/auth/me', 'GET', invalidData);
      expect(invalidValidation.valid).toBe(false);
    });

    it('should validate story generation API end-to-end', async () => {
      // 유효한 요청
      const validRequest = {
        planning_id: '123e4567-e89b-12d3-a456-426614174000',
        scenario_id: '456e7890-e89b-12d3-a456-426614174001',
        style_preferences: {
          tone: 'professional',
          length: 'medium',
          focus: 'narrative'
        }
      };

      const requestValidation = validator.validateRequest(
        '/api/ai/generate-story',
        'POST',
        validRequest
      );
      expect(requestValidation.valid).toBe(true);

      // API 호출
      const response = await fetch('/api/ai/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      const responseData = await response.json();

      const responseValidation = validator.validateResponse(
        '/api/ai/generate-story',
        'POST',
        responseData
      );
      expect(responseValidation.valid).toBe(true);
    });
  });
});