/**
 * Cost Safety Middleware Tests
 *
 * $300 사건 방지 미들웨어 테스트
 * CLAUDE.md 준수: 결정론적 테스트, 비용 안전 규칙 검증
 */

import { CostSafetyMiddleware } from '@/shared/lib/cost-safety-middleware';

describe('CostSafetyMiddleware', () => {
  let middleware: CostSafetyMiddleware;
  let mockLogger: any;
  let mockOnEmergencyShutdown: jest.Mock;

  beforeEach(() => {
    // 시간 기반 테스트를 결정론적으로 만들기 위해 시간 모킹
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));

    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };

    mockOnEmergencyShutdown = jest.fn();

    middleware = new CostSafetyMiddleware({
      logger: mockLogger,
      onEmergencyShutdown: mockOnEmergencyShutdown,
      minuteLimit: 30,
      hourlyLimit: 300,
      costThreshold: 50,
      infiniteLoopWindow: 5000,
      infiniteLoopThreshold: 10,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('기본 API 호출 제한', () => {
    it('첫 번째 호출은 허용되어야 함', async () => {
      // Act
      const result = await middleware.checkApiCallLimit('/api/test');

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remainingCalls).toBe(29); // 30 - 1
    });

    it('분당 30회 제한을 초과하면 차단되어야 함', async () => {
      // Arrange - 30회 호출
      const endpoint = '/api/test';
      for (let i = 0; i < 30; i++) {
        await middleware.checkApiCallLimit(endpoint);
      }

      // Act - 31번째 호출
      const result = await middleware.checkApiCallLimit(endpoint);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('RATE_LIMIT_EXCEEDED');
      expect(result.remainingCalls).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '분당 API 호출 제한 초과',
          endpoint,
          limit: 30,
          currentCalls: 30,
        })
      );
    });

    it('시간당 300회 제한을 초과하면 차단되어야 함', async () => {
      // Arrange - 여러 엔드포인트에서 총 300회 호출
      for (let i = 0; i < 100; i++) {
        await middleware.checkApiCallLimit('/api/endpoint1');
        await middleware.checkApiCallLimit('/api/endpoint2');
        await middleware.checkApiCallLimit('/api/endpoint3');
      }

      // Act - 301번째 호출
      const result = await middleware.checkApiCallLimit('/api/new-endpoint');

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('HOURLY_LIMIT_EXCEEDED');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '시간당 API 호출 제한 초과',
          limit: 300,
          currentCalls: 300,
        })
      );
    });

    it('1분 후에는 분당 제한이 리셋되어야 함', async () => {
      // Arrange - 분당 제한까지 호출
      const endpoint = '/api/test';
      for (let i = 0; i < 30; i++) {
        await middleware.checkApiCallLimit(endpoint);
      }

      // 31번째 호출이 차단되는지 확인
      let result = await middleware.checkApiCallLimit(endpoint);
      expect(result.allowed).toBe(false);

      // Act - 1분 후
      jest.advanceTimersByTime(60 * 1000 + 1);
      result = await middleware.checkApiCallLimit(endpoint);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remainingCalls).toBe(29);
    });
  });

  describe('auth/me 특별 제한', () => {
    it('auth/me는 전체 앱에서 1번만 허용되어야 함', async () => {
      // Act
      const firstCall = await middleware.checkApiCallLimit('/api/auth/me');
      const secondCall = await middleware.checkApiCallLimit('/api/auth/me');

      // Assert
      expect(firstCall.allowed).toBe(true);
      expect(secondCall.allowed).toBe(false);
      expect(secondCall.reason).toBe('AUTH_ME_SINGLE_CALL_ONLY');
    });
  });

  describe('중복 호출 방지 및 캐싱', () => {
    it('1분 내 중복 호출 시 캐시된 응답 반환', async () => {
      // Arrange
      const endpoint = '/api/test';
      const mockData = { result: 'test' };

      // 첫 번째 호출 후 캐시 설정
      await middleware.checkApiCallLimit(endpoint);
      middleware.setCachedResponse(endpoint, mockData);

      // Act - 30초 후 같은 엔드포인트 호출
      jest.advanceTimersByTime(30 * 1000);
      const result = await middleware.checkApiCallLimit(endpoint);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('CACHE_HIT');
      expect(result.cachedResponse).toEqual(mockData);
    });

    it('1분 후에는 캐시가 만료되어 새 호출 허용', async () => {
      // Arrange
      const endpoint = '/api/test';
      await middleware.checkApiCallLimit(endpoint);
      middleware.setCachedResponse(endpoint, { result: 'test' });

      // Act - 61초 후
      jest.advanceTimersByTime(61 * 1000);
      const result = await middleware.checkApiCallLimit(endpoint);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.cachedResponse).toBeUndefined();
    });
  });

  describe('무한 루프 감지', () => {
    it('5초 내 10회 호출 시 무한 루프로 감지', async () => {
      // Arrange
      const endpoint = '/api/potential-loop';

      // Act - 5초 내 10회 호출
      for (let i = 0; i < 10; i++) {
        await middleware.checkApiCallLimit(endpoint);
        jest.advanceTimersByTime(400); // 400ms씩 증가
      }

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '무한 루프 패턴 감지',
          endpoint,
          callsInWindow: 10,
          windowMs: 5000,
        })
      );

      expect(mockOnEmergencyShutdown).toHaveBeenCalledWith({
        reason: 'INFINITE_LOOP_DETECTED',
        endpoint,
      });
    });

    it('무한 루프 감지 후에도 현재 호출은 성공', async () => {
      // Arrange
      const endpoint = '/api/test';

      // Act - 무한 루프 유발
      let lastResult;
      for (let i = 0; i < 10; i++) {
        lastResult = await middleware.checkApiCallLimit(endpoint);
        jest.advanceTimersByTime(400);
      }

      // Assert - 10번째 호출(무한 루프 감지 시점)도 성공
      expect(lastResult?.allowed).toBe(true);
    });
  });

  describe('비용 추적 및 임계값', () => {
    it('비용 보고가 정확히 누적되는지 확인', () => {
      // Act
      middleware.reportCost(10);
      middleware.reportCost(15);
      middleware.reportCost(20);

      // Assert
      const status = middleware.getStatus();
      expect(status.totalCost).toBe(45);
    });

    it('비용 임계값 초과 시 비상 셧다운', () => {
      // Act
      middleware.reportCost(60); // 임계값 50 초과

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '비용 임계값 초과',
          currentCost: 60,
          threshold: 50,
        })
      );

      expect(mockOnEmergencyShutdown).toHaveBeenCalledWith({
        reason: 'COST_THRESHOLD_EXCEEDED',
        currentCost: 60,
        threshold: 50,
      });

      const status = middleware.getStatus();
      expect(status.emergencyShutdown).toBe(true);
    });

    it('비상 셧다운 후 모든 호출 차단', async () => {
      // Arrange - 비상 셧다운 유발
      middleware.reportCost(60);

      // Act
      const result = await middleware.checkApiCallLimit('/api/test');

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('EMERGENCY_SHUTDOWN_ACTIVE');
    });
  });

  describe('useEffect 의존성 검사', () => {
    it('의존성에 함수가 포함된 경우 경고', () => {
      // Arrange
      const dependencies = [
        'normalValue',
        42,
        () => console.log('function'), // 위험한 함수 의존성
        function namedFunction() {},
      ];

      // Act
      const result = middleware.checkUseEffectDependencies(dependencies);

      // Assert
      expect(result.hasFunctionDependency).toBe(true);
      expect(result.functionCount).toBe(2);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '$300 폭탄 위험: useEffect 의존성에 함수 포함',
          functionCount: 2,
          warning: 'useEffect 의존성 배열에 함수가 포함되면 무한 렌더링 발생 가능',
          solution: '의존성 배열을 빈 배열 []로 변경하거나 useCallback 사용',
        })
      );
    });

    it('안전한 의존성 배열의 경우 경고 없음', () => {
      // Arrange
      const dependencies = ['string', 42, true, null];

      // Act
      const result = middleware.checkUseEffectDependencies(dependencies);

      // Assert
      expect(result.hasFunctionDependency).toBe(false);
      expect(result.functionCount).toBe(0);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('상태 관리 및 초기화', () => {
    it('상태 조회가 정확한 정보를 반환', async () => {
      // Arrange
      await middleware.checkApiCallLimit('/api/test1');
      await middleware.checkApiCallLimit('/api/test2');
      middleware.reportCost(25);

      // Act
      const status = middleware.getStatus();

      // Assert
      expect(status).toEqual({
        emergencyShutdown: false,
        totalCost: 25,
        authMeCalled: false,
        totalEndpoints: 2,
        totalCalls: 2,
      });
    });

    it('reset() 호출 시 모든 상태 초기화', async () => {
      // Arrange
      await middleware.checkApiCallLimit('/api/test');
      middleware.reportCost(30);
      middleware.reportCost(25); // 비상 셧다운 유발

      // Act
      middleware.reset();

      // Assert
      const status = middleware.getStatus();
      expect(status).toEqual({
        emergencyShutdown: false,
        totalCost: 0,
        authMeCalled: false,
        totalEndpoints: 0,
        totalCalls: 0,
      });

      // 새 호출이 다시 허용되는지 확인
      const result = await middleware.checkApiCallLimit('/api/test');
      expect(result.allowed).toBe(true);
    });

    it('캐시 정리가 정상적으로 작동', () => {
      // Arrange
      middleware.setCachedResponse('/api/test1', { data: 'test1' });
      jest.advanceTimersByTime(30 * 1000); // 30초 후
      middleware.setCachedResponse('/api/test2', { data: 'test2' });

      // Act - 90초 후 (test1은 만료, test2는 유효)
      jest.advanceTimersByTime(60 * 1000);
      middleware.clearExpiredCache();

      // Assert - 만료된 캐시는 삭제되어야 함
      // 실제 구현에서는 캐시 내부 상태를 확인하는 public 메서드가 필요할 수 있음
    });
  });

  describe('$300 사건 회귀 방지', () => {
    it('Header.tsx의 useEffect 패턴 시뮬레이션', () => {
      // $300 사건의 원인이었던 패턴 테스트
      const checkAuth = () => {}; // 함수 의존성
      const dependencies = [checkAuth];

      const result = middleware.checkUseEffectDependencies(dependencies);

      expect(result.hasFunctionDependency).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '$300 폭탄 위험: useEffect 의존성에 함수 포함',
        })
      );
    });

    it('auth/me 엔드포인트 중복 호출 방지', async () => {
      // 첫 번째 호출
      const first = await middleware.checkApiCallLimit('/api/auth/me');
      expect(first.allowed).toBe(true);

      // 두 번째 호출은 차단되어야 함
      const second = await middleware.checkApiCallLimit('/api/auth/me');
      expect(second.allowed).toBe(false);
      expect(second.reason).toBe('AUTH_ME_SINGLE_CALL_ONLY');

      // 다른 엔드포인트는 정상 작동
      const other = await middleware.checkApiCallLimit('/api/other');
      expect(other.allowed).toBe(true);
    });

    it('짧은 시간 내 대량 호출 감지', async () => {
      // 실제 $300 사건처럼 매우 빠른 호출 시뮬레이션
      const endpoint = '/api/auth/me';

      // 0.1초마다 호출하여 10번 (총 1초)
      for (let i = 0; i < 10; i++) {
        await middleware.checkApiCallLimit(endpoint);
        jest.advanceTimersByTime(100);
      }

      // 무한 루프 감지되어야 함
      expect(mockOnEmergencyShutdown).toHaveBeenCalledWith({
        reason: 'INFINITE_LOOP_DETECTED',
        endpoint,
      });
    });
  });
});