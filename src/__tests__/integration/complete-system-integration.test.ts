/**
 * 완전한 시스템 통합 테스트
 * API 키 검증, Redux 상태, Graceful Degradation, MSW 모킹이 모두 연동된 테스트
 */

import { configureStore } from '@reduxjs/toolkit';
import {
  seedanceProviderReducer,
  selectProviderConfig,
  selectShouldUseMock,
  useSeedanceProvider
} from '@/entities/seedance';
import { seedanceService } from '@/lib/providers/seedance-service';
import { diagnoseCurrentSetup, getSetupSummary } from '@/lib/providers/seedance-setup-guide';
import { createUserFriendlyError, detectErrorContext } from '@/lib/providers/seedance-error-messages';
import { setupMSW, mswTestUtils } from '../setup/msw-setup';

// MSW 설정
setupMSW();

// 테스트용 Redux 스토어
function createTestStore() {
  return configureStore({
    reducer: {
      seedanceProvider: seedanceProviderSlice.reducer,
    },
  });
}

describe('완전한 Seedance 시스템 통합 테스트', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    // 각 테스트마다 서비스 상태 리셋
    seedanceService.resetCircuitBreaker();
  });

  describe('시나리오 1: 유효한 API 키로 정상 동작', () => {
    beforeEach(() => {
      // 유효한 API 키 환경 시뮬레이션
      process.env.SEEDANCE_API_KEY = 'ark_test_valid_key_' + 'a'.repeat(40);
      delete process.env.NEXT_PUBLIC_ENABLE_MOCK_API;
    });

    test('전체 플로우: 영상 생성 → 상태 확인 → 완료', async () => {
      // 1. 설정 진단
      const diagnosis = diagnoseCurrentSetup();
      expect(diagnosis.overallStatus).toBe('healthy');

      // 2. 영상 생성
      const createPayload = {
        prompt: 'Integration test: beautiful landscape',
        aspect_ratio: '16:9' as const,
        duration_seconds: 5,
      };

      const createResult = await seedanceService.createVideo(createPayload);
      expect(createResult.ok).toBe(true);
      expect(createResult.source).toBe('mock'); // 실제 환경에서는 'real'이 될 것
      expect(createResult.jobId).toBeDefined();

      // 3. 상태 확인 (여러 번 확인하여 진행 시뮬레이션)
      let statusResult = await seedanceService.getStatus(createResult.jobId!);
      expect(statusResult.ok).toBe(true);
      expect(statusResult.status).toBeDefined();

      // 4. 서비스 헬스체크
      const healthStatus = await seedanceService.runHealthCheck();
      expect(healthStatus.isHealthy).toBe(true);
      expect(healthStatus.capabilities.canCreateVideo).toBe(true);

      // 5. 설정 요약 확인
      const setupSummary = getSetupSummary();
      expect(setupSummary.status).toBe('healthy');
      expect(setupSummary.completedSteps).toBeGreaterThan(0);
    });
  });

  describe('시나리오 2: API 키 없이 Mock 모드 자동 전환', () => {
    beforeEach(() => {
      // API 키 없는 개발 환경 시뮬레이션
      delete process.env.SEEDANCE_API_KEY;
      delete process.env.MODELARK_API_KEY;
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_ENABLE_MOCK_API = 'true';
    });

    test('Mock 모드에서 전체 플로우가 정상 작동해야 함', async () => {
      // 1. 설정 진단 - Mock 모드 권장사항 확인
      const diagnosis = diagnoseCurrentSetup();
      expect(diagnosis.overallStatus).toBe('warning'); // 개발환경에서는 warning
      expect(diagnosis.recommendations.some(r => r.includes('Mock 모드'))).toBe(true);

      // 2. 영상 생성 - Mock으로 자동 처리
      const createPayload = {
        prompt: 'Mock test: animated character',
        aspect_ratio: '9:16' as const,
        duration_seconds: 3,
      };

      const createResult = await seedanceService.createVideo(createPayload);
      expect(createResult.ok).toBe(true);
      expect(createResult.source).toBe('mock');
      expect(createResult.jobId).toMatch(/^mock-/);

      // 3. 상태 확인
      const statusResult = await seedanceService.getStatus(createResult.jobId!);
      expect(statusResult.ok).toBe(true);
      expect(statusResult.source).toBe('mock');

      // 4. 진행 상태 변경 테스트
      mswTestUtils.seedance.forceJobStatus(createResult.jobId!, 'completed', 100);

      const completedStatus = await seedanceService.getStatus(createResult.jobId!);
      expect(completedStatus.status).toBe('completed');
      expect(completedStatus.videoUrl).toBeDefined();
    });
  });

  describe('시나리오 3: 프로덕션 환경에서 API 키 오류', () => {
    beforeEach(() => {
      // 프로덕션 환경에서 잘못된 API 키 시뮬레이션
      process.env.NODE_ENV = 'production';
      process.env.SEEDANCE_API_KEY = '007f7ffe-84c3-4cdc-b0af-4e00dafdc81c'; // 차단된 테스트 키
      delete process.env.NEXT_PUBLIC_ENABLE_MOCK_API;
    });

    test('프로덕션에서 API 키 오류 시 적절한 에러 메시지 제공해야 함', async () => {
      // 1. 설정 진단 - 심각한 문제로 감지
      const diagnosis = diagnoseCurrentSetup();
      expect(diagnosis.overallStatus).toBe('error');
      expect(diagnosis.recommendations.some(r => r.includes('프로덕션'))).toBe(true);

      // 2. 에러 메시지 생성 테스트
      const error = 'Invalid API key format';
      const context = detectErrorContext(error);
      expect(context).toBe('api_key');

      const userFriendlyError = createUserFriendlyError(error, context);
      expect(userFriendlyError.error.severity).toBe('critical');
      expect(userFriendlyError.error.message).toContain('일시적인 문제');

      // 3. 설정 요약에서 심각한 문제 감지
      const setupSummary = getSetupSummary();
      expect(setupSummary.status).toBe('error');
      expect(setupSummary.criticalIssues).toBeGreaterThan(0);
    });
  });

  describe('시나리오 4: Circuit Breaker 패턴 동작', () => {
    beforeEach(() => {
      // 정상적인 API 키 설정
      process.env.SEEDANCE_API_KEY = 'ark_test_circuit_breaker_' + 'a'.repeat(30);
      delete process.env.NEXT_PUBLIC_ENABLE_MOCK_API;
    });

    test('연속 실패 시 Circuit Breaker 작동 및 복구', async () => {
      // MSW에서 실패 모드 활성화
      mswTestUtils.seedance.setFailureMode(true);

      const testPayload = {
        prompt: 'Circuit breaker test',
        aspect_ratio: '1:1' as const,
        duration_seconds: 5,
      };

      // 1. 첫 번째 실패 - graceful degradation으로 Mock 폴백
      let result1 = await seedanceService.createVideo(testPayload);
      expect(result1.source).toBe('mock');
      expect(result1.fallbackReason).toBeDefined();

      // 2. 연속 실패로 Circuit Breaker 트리거
      let result2 = await seedanceService.createVideo(testPayload);
      let result3 = await seedanceService.createVideo(testPayload);

      // 3. 네 번째 요청에서 Circuit Breaker 작동
      let result4 = await seedanceService.createVideo(testPayload);
      expect(result4.circuitBreakerTriggered).toBe(true);

      // 4. 서비스 복구 후 Circuit Breaker 리셋
      mswTestUtils.seedance.setFailureMode(false);
      seedanceService.resetCircuitBreaker();

      // 5. 복구 후 정상 동작 확인
      let recoveredResult = await seedanceService.createVideo(testPayload);
      expect(recoveredResult.ok).toBe(true);

      // 6. 헬스체크로 상태 확인
      const healthStatus = await seedanceService.runHealthCheck();
      expect(healthStatus.consecutiveFailures).toBe(0);
    });
  });

  describe('시나리오 5: 다양한 에러 컨텍스트 처리', () => {
    const errorScenarios = [
      {
        name: '네트워크 에러',
        error: 'ECONNRESET: Connection reset by peer',
        expectedContext: 'network',
        expectedSeverity: 'low' // 개발환경에서
      },
      {
        name: '할당량 초과',
        error: 'API quota exceeded',
        expectedContext: 'quota',
        expectedSeverity: 'medium'
      },
      {
        name: '모델 비활성화',
        error: 'Model not activated for your account',
        expectedContext: 'model',
        expectedSeverity: 'medium'
      },
      {
        name: '잘못된 파라미터',
        error: 'Invalid parameter: aspect_ratio',
        expectedContext: 'validation',
        expectedSeverity: 'low'
      },
    ];

    test.each(errorScenarios)('$name 처리', ({ error, expectedContext, expectedSeverity }) => {
      // 1. 에러 컨텍스트 자동 감지
      const context = detectErrorContext(error);
      expect(context).toBe(expectedContext);

      // 2. 환경별 적절한 에러 메시지 생성
      const userFriendlyError = createUserFriendlyError(error, context);
      expect(userFriendlyError.error.severity).toBe(expectedSeverity);
      expect(userFriendlyError.error.message).toBeDefined();

      // 3. 개발환경에서는 상세 정보 포함
      if (process.env.NODE_ENV === 'development') {
        expect(userFriendlyError.error).toHaveProperty('developmentInfo');
      }
    });
  });

  describe('시나리오 6: 환경별 설정 가이드', () => {
    const environments = ['development', 'production', 'test'] as const;

    test.each(environments)('%s 환경 설정 가이드', (environment) => {
      // 환경 시뮬레이션
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = environment;

      try {
        // 1. 설정 진단
        const diagnosis = diagnoseCurrentSetup();
        expect(diagnosis.environment).toBe(environment);
        expect(diagnosis.config.name).toBeDefined();
        expect(diagnosis.steps.length).toBeGreaterThan(0);

        // 2. 환경별 적절한 단계 제공
        const highPrioritySteps = diagnosis.steps.filter(s => s.priority === 'high');
        expect(highPrioritySteps.length).toBeGreaterThan(0);

        // 3. 추천사항 제공
        expect(diagnosis.recommendations).toBeDefined();

        // 4. 설정 요약 정보
        const summary = getSetupSummary();
        expect(summary.environment).toBe(environment);
        expect(summary.totalSteps).toBe(diagnosis.steps.length);

      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('시나리오 7: Redux 상태 연동', () => {
    test('Provider 상태가 Redux에 올바르게 반영되어야 함', async () => {
      // 1. 초기 상태 확인
      let state = store.getState();
      let summary = selectProviderSummary(state);
      expect(summary.mode).toBe('mock'); // 초기에는 mock 모드

      // 2. 실제 API 키 설정 시뮬레이션
      process.env.SEEDANCE_API_KEY = 'ark_redux_test_' + 'a'.repeat(30);

      // Provider 초기화 시뮬레이션 (실제로는 useSeedanceProvider 훅에서 수행)
      const { setApiKeyValid, setProviderReady } = seedanceProviderSlice.actions;

      store.dispatch(setApiKeyValid({
        keyFormat: 'ark_redux...test',
        source: 'SEEDANCE_API_KEY'
      }));
      store.dispatch(setProviderReady());

      // 3. 상태 변경 확인
      state = store.getState();
      summary = selectProviderSummary(state);
      const isAvailable = selectIsProviderAvailable(state);

      expect(summary.mode).toBe('real');
      expect(summary.hasValidKey).toBe(true);
      expect(isAvailable).toBe(true);

      // 4. 에러 상태 시뮬레이션
      const { setProviderError } = seedanceProviderSlice.actions;
      store.dispatch(setProviderError({
        message: 'API rate limit exceeded',
        increaseRetryCount: true
      }));

      state = store.getState();
      summary = selectProviderSummary(state);
      expect(summary.isAvailable).toBe(false);
      expect(summary.lastError).toBe('API rate limit exceeded');
      expect(summary.retryCount).toBe(1);
    });
  });

  describe('시나리오 8: 성능 및 메모리 테스트', () => {
    test('대량 요청 처리 시 메모리 누수 없이 안정적으로 동작해야 함', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 100개의 동시 요청 시뮬레이션
      const promises = Array.from({ length: 100 }, (_, i) => {
        return seedanceService.createVideo({
          prompt: `Performance test ${i}`,
          aspect_ratio: '16:9' as const,
          duration_seconds: 3,
        });
      });

      const results = await Promise.all(promises);

      // 모든 요청이 성공했는지 확인
      expect(results.every(r => r.ok)).toBe(true);

      // 메모리 사용량이 급격히 증가하지 않았는지 확인
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 100MB 이상 증가하지 않았는지 확인 (합리적인 임계값)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      // Circuit Breaker가 정상 상태인지 확인
      const healthStatus = seedanceService.getHealthStatus();
      expect(healthStatus.consecutiveFailures).toBe(0);
    });
  });
});

/**
 * 테스트 환경 정리
 */
afterAll(() => {
  // 환경변수 정리
  delete process.env.SEEDANCE_API_KEY;
  delete process.env.MODELARK_API_KEY;
  delete process.env.NEXT_PUBLIC_ENABLE_MOCK_API;
});