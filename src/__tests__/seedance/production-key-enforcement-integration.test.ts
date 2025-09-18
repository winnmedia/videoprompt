/**
 * Production Key Enforcer API 통합 테스트
 * TDD로 구현된 강력한 키 검증 시스템 테스트
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createRoute, GET as statusRoute } from '@/app/api/seedance/create/route';
import { GET as statusCheckRoute } from '@/app/api/seedance/status/[jobId]/route';
import { enforceProductionKeyValidation } from '@/lib/providers/production-key-enforcer';

// Mock 모듈들
vi.mock('@/lib/providers/seedance-service', () => ({
  seedanceService: {
    createVideo: vi.fn(),
    getStatus: vi.fn(),
    runHealthCheck: vi.fn(),
  }
}));

vi.mock('@/lib/providers/production-key-enforcer');
const mockEnforceProductionKeyValidation = vi.mocked(enforceProductionKeyValidation);

describe('Production Key Enforcer API 통합', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Seedance Create API (/api/seedance/create)', () => {
    const createValidRequest = () => new NextRequest('http://localhost/api/seedance/create', {
      method: 'POST',
      body: JSON.stringify({
        prompt: '바다에서 서핑하는 사람',
        aspect_ratio: '16:9',
        duration_seconds: 8
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    test('❌ 프로덕션에서 API 키 없으면 503 에러와 설정 가이드 반환', async () => {
      // Given: 프로덕션 환경, API 키 없음
      process.env.NODE_ENV = 'production';
      delete process.env.SEEDANCE_API_KEY;
      delete process.env.MODELARK_API_KEY;

      mockEnforceProductionKeyValidation.mockReturnValue({
        isValid: false,
        environment: 'production',
        keySource: 'none',
        enforced: false,
        errors: ['❌ 프로덕션 환경에서 API 키가 설정되지 않았습니다'],
        warnings: [],
        recommendations: ['SEEDANCE_API_KEY 또는 MODELARK_API_KEY 환경변수를 설정하세요']
      });

      const request = createValidRequest();

      // When: API 호출
      const response = await createRoute(request, { user: { id: null }, authContext: {} });

      // Then: 503 에러와 설정 가이드 반환
      expect(response.status).toBe(503);
      const responseBody = await response.json();

      expect(responseBody).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'SERVICE_UNAVAILABLE',
          message: expect.stringContaining('API 키가 설정되지 않았습니다')
        }),
        setup_guide: expect.objectContaining({
          requiredEnvVars: expect.arrayContaining(['SEEDANCE_API_KEY']),
          instructions: expect.any(Array)
        })
      });
    });

    test('❌ 프로덕션에서 무효한 키 형식이면 503 에러 반환', async () => {
      // Given: 프로덕션 환경, 무효한 키
      process.env.NODE_ENV = 'production';
      process.env.SEEDANCE_API_KEY = 'invalid-key';

      mockEnforceProductionKeyValidation.mockReturnValue({
        isValid: false,
        environment: 'production',
        keySource: 'SEEDANCE_API_KEY',
        enforced: false,
        errors: ['❌ 프로덕션 환경에서 API 키 형식이 올바르지 않습니다'],
        warnings: [],
        recommendations: ['BytePlus ModelArk에서 유효한 API 키를 발급받아 설정하세요']
      });

      const request = createValidRequest();

      // When: API 호출
      const response = await createRoute(request, { user: { id: null }, authContext: {} });

      // Then: 503 에러 반환
      expect(response.status).toBe(503);
      const responseBody = await response.json();

      expect(responseBody.error.code).toBe('INVALID_API_KEY');
      expect(responseBody.error.message).toContain('키 형식이 올바르지 않습니다');
    });

    test('❌ 프로덕션에서 테스트 키 패턴이면 503 에러 반환', async () => {
      // Given: 프로덕션 환경, 차단된 테스트 키
      process.env.NODE_ENV = 'production';
      process.env.SEEDANCE_API_KEY = '007f7ffe-84c3-4cdc-b0af-4e00dafdc81c';

      mockEnforceProductionKeyValidation.mockReturnValue({
        isValid: false,
        environment: 'production',
        keySource: 'SEEDANCE_API_KEY',
        enforced: false,
        errors: ['❌ 프로덕션 환경에서 요구되는 키 패턴(ark_)과 일치하지 않습니다'],
        warnings: [],
        recommendations: ['BytePlus 공식 API 키(ark_ 접두사)를 사용하세요']
      });

      const request = createValidRequest();

      // When: API 호출
      const response = await createRoute(request, { user: { id: null }, authContext: {} });

      // Then: 503 에러 반환
      expect(response.status).toBe(503);
      const responseBody = await response.json();

      expect(responseBody.error.code).toBe('BLOCKED_TEST_KEY');
      expect(responseBody.error.message).toContain('테스트 키');
    });

    test('✅ 프로덕션에서 유효한 키면 정상 처리', async () => {
      // Given: 프로덕션 환경, 유효한 키
      process.env.NODE_ENV = 'production';
      process.env.SEEDANCE_API_KEY = 'ark_valid_production_key_' + 'a'.repeat(30);

      mockEnforceProductionKeyValidation.mockReturnValue({
        isValid: true,
        environment: 'production',
        keySource: 'SEEDANCE_API_KEY',
        enforced: false,
        errors: [],
        warnings: [],
        recommendations: ['프로덕션 환경에서 실제 API 키 사용 중']
      });

      const request = createValidRequest();

      // When: API 호출
      const response = await createRoute(request, { user: { id: null }, authContext: {} });

      // Then: 키 검증이 호출됨
      expect(mockEnforceProductionKeyValidation).toHaveBeenCalledWith({
        strictMode: true,
        logLevel: 'error'
      });

      // 정상 처리되어야 함 (실제 seedance 로직 실행)
      expect(response.status).not.toBe(503);
    });

    test('✅ 개발환경에서는 Mock 모드 허용', async () => {
      // Given: 개발 환경
      process.env.NODE_ENV = 'development';
      delete process.env.SEEDANCE_API_KEY;

      mockEnforceProductionKeyValidation.mockReturnValue({
        isValid: true,
        environment: 'development',
        keySource: 'none',
        enforced: false,
        errors: [],
        warnings: ['development 환경에서는 Mock API 사용이 허용됩니다'],
        recommendations: []
      });

      const request = createValidRequest();

      // When: API 호출
      const response = await createRoute(request, { user: { id: null }, authContext: {} });

      // Then: 정상 처리 (Mock 모드)
      expect(response.status).not.toBe(503);
    });
  });

  describe('Seedance Status API (/api/seedance/status/[jobId])', () => {
    test('❌ 프로덕션에서 API 키 없으면 503 에러', async () => {
      // Given: 프로덕션 환경, API 키 없음
      process.env.NODE_ENV = 'production';
      delete process.env.SEEDANCE_API_KEY;

      mockEnforceProductionKeyValidation.mockReturnValue({
        isValid: false,
        environment: 'production',
        keySource: 'none',
        enforced: false,
        errors: ['❌ 프로덕션 환경에서 API 키가 설정되지 않았습니다'],
        warnings: [],
        recommendations: ['SEEDANCE_API_KEY 환경변수를 설정하세요']
      });

      // When: Status API 호출
      const response = await statusCheckRoute(
        new NextRequest('http://localhost/api/seedance/status/test-job'),
        { params: { jobId: 'test-job' }, user: { id: null }, authContext: {} }
      );

      // Then: 503 에러 반환
      expect(response.status).toBe(503);
      const responseBody = await response.json();
      expect(responseBody.error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('키 검증 흐름 테스트', () => {
    test('키 검증 실패 시 적절한 에러 컨텍스트 생성', async () => {
      // Given: 다양한 키 검증 실패 시나리오
      const scenarios = [
        {
          name: '키 없음',
          env: { NODE_ENV: 'production' },
          expected: { code: 'SERVICE_UNAVAILABLE', status: 503 }
        },
        {
          name: '무효한 형식',
          env: { NODE_ENV: 'production', SEEDANCE_API_KEY: 'invalid' },
          expected: { code: 'INVALID_API_KEY', status: 503 }
        },
        {
          name: '테스트 키',
          env: { NODE_ENV: 'production', SEEDANCE_API_KEY: 'test-key-123' },
          expected: { code: 'BLOCKED_TEST_KEY', status: 503 }
        }
      ];

      for (const scenario of scenarios) {
        // When: 각 시나리오 테스트
        process.env = { ...originalEnv, ...scenario.env };

        mockEnforceProductionKeyValidation.mockReturnValue({
          isValid: false,
          environment: 'production',
          keySource: 'SEEDANCE_API_KEY',
          enforced: false,
          errors: [`테스트 에러: ${scenario.name}`],
          warnings: [],
          recommendations: []
        });

        const request = new NextRequest('http://localhost/api/seedance/create', {
          method: 'POST',
          body: JSON.stringify({ prompt: 'test' })
        });

        const response = await createRoute(request, { user: { id: null }, authContext: {} });

        // Then: 예상된 에러 반환
        expect(response.status).toBe(scenario.expected.status);
        const body = await response.json();
        expect(body.error.code).toBe(scenario.expected.code);
      }
    });

    test('키 회전(rotation) 시나리오 테스트', async () => {
      // Given: 키 회전 상황 시뮬레이션
      const oldKey = 'ark_old_key_' + 'a'.repeat(30);
      const newKey = 'ark_new_key_' + 'b'.repeat(30);

      // 기존 키로 요청
      process.env.SEEDANCE_API_KEY = oldKey;
      mockEnforceProductionKeyValidation.mockReturnValue({
        isValid: true,
        environment: 'production',
        keySource: 'SEEDANCE_API_KEY',
        enforced: false,
        errors: [],
        warnings: [],
        recommendations: []
      });

      let request = new NextRequest('http://localhost/api/seedance/create', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test with old key' })
      });

      let response = await createRoute(request, { user: { id: null }, authContext: {} });
      expect(response.status).not.toBe(503);

      // 새 키로 요청
      process.env.SEEDANCE_API_KEY = newKey;
      request = new NextRequest('http://localhost/api/seedance/create', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test with new key' })
      });

      response = await createRoute(request, { user: { id: null }, authContext: {} });
      expect(response.status).not.toBe(503);

      // 키 검증이 각각 호출되었는지 확인
      expect(mockEnforceProductionKeyValidation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Provider Status 엔드포인트', () => {
    test('✅ /api/seedance/create GET 요청으로 Provider 상태 확인', async () => {
      // Given: 유효한 키가 설정된 상태
      process.env.SEEDANCE_API_KEY = 'ark_status_test_' + 'c'.repeat(30);

      mockEnforceProductionKeyValidation.mockReturnValue({
        isValid: true,
        environment: 'production',
        keySource: 'SEEDANCE_API_KEY',
        enforced: false,
        errors: [],
        warnings: [],
        recommendations: []
      });

      // When: GET 요청으로 상태 확인
      const response = await statusRoute();

      // Then: 서비스 상태 정보 반환
      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body).toMatchObject({
        service: 'SeeDance Video Generation',
        status: 'operational',
        configuration: {
          hasApiKey: true,
          hasModel: expect.any(Boolean),
          hasApiBase: expect.any(Boolean)
        },
        capabilities: expect.objectContaining({
          textToVideo: true,
          imageToVideo: true,
          customDuration: true
        })
      });
    });

    test('❌ API 키 없으면 configuration_error 상태', async () => {
      // Given: API 키 없음
      delete process.env.SEEDANCE_API_KEY;
      delete process.env.MODELARK_API_KEY;

      // When: GET 요청으로 상태 확인
      const response = await statusRoute();

      // Then: configuration_error 상태 반환
      const body = await response.json();
      expect(body.status).toBe('configuration_error');
      expect(body.configuration.hasApiKey).toBe(false);
    });
  });
});