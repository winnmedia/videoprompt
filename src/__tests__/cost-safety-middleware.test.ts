/**
 * $300 사건 방지 미들웨어 테스트
 *
 * RED 단계: 실패하는 테스트부터 작성
 * - API 호출 제한 (분당 30회, 시간당 300회)
 * - 중복 호출 방지 (1분 내)
 * - 무한 루프 감지
 * - 비상 셧다운 기능
 */

import { CostSafetyMiddleware } from '../shared/lib/cost-safety-middleware';

describe('CostSafetyMiddleware - $300 사건 방지', () => {
  let middleware: CostSafetyMiddleware;
  let mockLogger: { error: jest.MockedFunction<any>; warn: jest.MockedFunction<any>; info: jest.MockedFunction<any> };
  let mockEmergencyShutdown: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };

    mockEmergencyShutdown = jest.fn();

    middleware = new CostSafetyMiddleware({
      logger: mockLogger,
      onEmergencyShutdown: mockEmergencyShutdown,
    });
  });

  describe('API 호출 제한', () => {
    it('분당 30회 제한을 초과하면 호출을 차단해야 한다', async () => {
      // 분당 30회 호출 (auth/me가 아닌 다른 엔드포인트 사용)
      for (let i = 0; i < 30; i++) {
        const result = await middleware.checkApiCallLimit('/api/projects');
        if (!result.allowed) {
          console.log(`호출 ${i + 1}에서 실패:`, result);
        }
        expect(result.allowed).toBe(true);
      }

      // 31번째 호출은 차단되어야 함
      const result = await middleware.checkApiCallLimit('/api/projects');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('RATE_LIMIT_EXCEEDED');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '분당 API 호출 제한 초과',
          endpoint: '/api/projects',
          limit: 30,
        })
      );
    });

    it('시간당 300회 제한을 초과하면 호출을 차단해야 한다', async () => {
      // 시간당 제한을 더 작은 수로 테스트 (실제 구현은 300개 유지)
      const testMiddleware = new CostSafetyMiddleware({
        logger: mockLogger,
        onEmergencyShutdown: mockEmergencyShutdown,
        hourlyLimit: 5, // 테스트용으로 5개로 제한
      });

      // 5회 호출
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(60 * 1000); // 1분씩 건너뛰기
        const result = await testMiddleware.checkApiCallLimit(`/api/test${i}`);
        expect(result.allowed).toBe(true);
      }

      // 6번째 호출은 차단되어야 함
      jest.advanceTimersByTime(60 * 1000);
      const result = await testMiddleware.checkApiCallLimit('/api/test-final');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('HOURLY_LIMIT_EXCEEDED');
    });

    it('auth/me 엔드포인트는 앱 전체에서 1번만 허용해야 한다', async () => {
      const firstCall = await middleware.checkApiCallLimit('/api/auth/me');
      expect(firstCall.allowed).toBe(true);

      const secondCall = await middleware.checkApiCallLimit('/api/auth/me');
      expect(secondCall.allowed).toBe(false);
      expect(secondCall.reason).toBe('AUTH_ME_SINGLE_CALL_ONLY');
    });
  });

  describe('중복 호출 방지', () => {
    it('1분 내 중복 호출은 캐시가 있을 때만 방지해야 한다', async () => {
      const firstCall = await middleware.checkApiCallLimit('/api/projects');
      expect(firstCall.allowed).toBe(true);

      // 캐시 없이 30초 후 동일 호출 - 허용되어야 함
      jest.advanceTimersByTime(30 * 1000);
      const secondCall = await middleware.checkApiCallLimit('/api/projects');
      expect(secondCall.allowed).toBe(true);

      // 1분 후에도 허용
      jest.advanceTimersByTime(30 * 1000);
      const thirdCall = await middleware.checkApiCallLimit('/api/projects');
      expect(thirdCall.allowed).toBe(true);
    });

    it('캐시된 응답을 반환해야 한다', async () => {
      const mockResponse = { data: 'cached' };

      // 첫 번째 호출로 캐시 생성
      await middleware.checkApiCallLimit('/api/projects');
      middleware.setCachedResponse('/api/projects', mockResponse);

      // 1분 내 두 번째 호출은 캐시된 응답 반환
      const result = await middleware.checkApiCallLimit('/api/projects');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('CACHE_HIT');
      expect(result.cachedResponse).toEqual(mockResponse);
    });
  });

  describe('무한 루프 감지', () => {
    it('5초 내 동일 호출 10회 시 무한 루프로 판단해야 한다', async () => {
      // 5초 내 10회 호출 (auth/me가 아닌 다른 엔드포인트 사용)
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(500); // 0.5초씩
        const result = await middleware.checkApiCallLimit('/api/video');
        expect(result.allowed).toBe(true); // 모든 호출이 성공해야 함
      }

      // 10번째 호출에서 무한 루프가 감지되어 로그가 기록됨
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '무한 루프 패턴 감지',
          endpoint: '/api/video',
          callsInWindow: 10,
        })
      );

      expect(mockEmergencyShutdown).toHaveBeenCalledWith({
        reason: 'INFINITE_LOOP_DETECTED',
        endpoint: '/api/video',
      });
    });
  });

  describe('비상 셧다운', () => {
    it('$50 임계값 초과 시 비상 셧다운을 실행해야 한다', async () => {
      middleware.reportCost(60); // $60

      expect(mockEmergencyShutdown).toHaveBeenCalledWith({
        reason: 'COST_THRESHOLD_EXCEEDED',
        currentCost: 60,
        threshold: 50,
      });
    });

    it('셧다운 후 모든 API 호출을 차단해야 한다', async () => {
      middleware.triggerEmergencyShutdown('MANUAL_SHUTDOWN');

      const result = await middleware.checkApiCallLimit('/api/projects');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('EMERGENCY_SHUTDOWN_ACTIVE');
    });
  });

  describe('useEffect 의존성 함수 감지', () => {
    it('useEffect 의존성에 함수가 포함되면 경고해야 한다', () => {
      const mockFunction = jest.fn();
      const dependencies = [mockFunction, 'someString', 123];

      const result = middleware.checkUseEffectDependencies(dependencies);

      expect(result.hasFunctionDependency).toBe(true);
      expect(result.functionCount).toBe(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '$300 폭탄 위험: useEffect 의존성에 함수 포함',
          functionCount: 1,
        })
      );
    });

    it('함수가 없는 의존성 배열은 통과해야 한다', () => {
      const dependencies = ['string', 123, true, null];

      const result = middleware.checkUseEffectDependencies(dependencies);

      expect(result.hasFunctionDependency).toBe(false);
      expect(result.functionCount).toBe(0);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});