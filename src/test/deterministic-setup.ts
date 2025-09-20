/**
 * 결정론적 테스트 환경 설정
 * - 시간 고정
 * - 랜덤 시드 고정
 * - 네트워크 요청 차단
 * - MSW 안정화
 */

import { beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { logger } from '@/shared/lib/logger';


// 전역 시간 고정 (2024-01-01 00:00:00 UTC)
const FIXED_DATE = new Date('2024-01-01T00:00:00.000Z');

beforeAll(() => {
  // 1. 시간 고정
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_DATE);

  // 2. 랜덤 시드 고정 (Math.random 대체)
  let seed = 12345;
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  vi.stubGlobal('Math', {
    ...Math,
    random: seededRandom,
  });

  // 3. console 출력 제어 (테스트 결과 일관성)
  if (process.env.CI) {
    vi.stubGlobal('console', {
      ...console,
      log: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
    });
  }

  // 4. 글로벌 fetch 차단 (MSW로만 허용)
  const originalFetch = global.fetch;
  vi.stubGlobal('fetch', vi.fn((url, options) => {
    if (process.env.NODE_ENV === 'test' && !url.includes('localhost')) {
      throw new Error(
        `테스트에서 실제 네트워크 요청이 감지되었습니다: ${url}\n` +
        'MSW를 사용하여 모킹하거나 localhost 요청만 허용됩니다.'
      );
    }
    return originalFetch(url, options);
  }));

  // 5. 환경 변수 고정
  process.env.TZ = 'UTC';
  process.env.NODE_ENV = 'test';
  process.env.VITEST_DETERMINISTIC = 'true';

  // 6. DOM 이벤트 시뮬레이션 안정화
  if (typeof window !== 'undefined') {
    // 스크롤 이벤트 모킹 (테스트 안정성)
    Object.defineProperty(window, 'scrollTo', {
      value: vi.fn(),
      writable: true,
    });

    // 로컬 스토리지 초기화
    window.localStorage.clear();
    window.sessionStorage.clear();

    // 뷰포트 크기 고정
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  }
});

beforeEach(() => {
  // 각 테스트 전 시간 리셋
  vi.setSystemTime(FIXED_DATE);

  // 스토리지 초기화
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }

  // 모든 모킹 함수 리셋
  vi.clearAllMocks();
});

afterEach(() => {
  // 테스트 후 정리
  vi.clearAllTimers();

  // 메모리 누수 방지를 위한 정리
  if (typeof window !== 'undefined') {
    // 이벤트 리스너 정리
    const events = ['scroll', 'resize', 'click', 'keydown', 'keyup'];
    events.forEach(event => {
      window.removeEventListener(event, () => {});
    });
  }
});

afterAll(() => {
  // 실제 시간으로 복원
  vi.useRealTimers();

  // 글로벌 상태 복원
  vi.unstubAllGlobals();

  // MSW 서버 정리 (setup.ts에서 시작된 경우)
  if (global.__MSW_SERVER__) {
    global.__MSW_SERVER__.close();
  }
});

// 테스트 유틸리티 함수들
export const testUtils = {
  /**
   * 지정된 시간만큼 시간을 앞당김
   */
  advanceTime: (ms: number) => {
    vi.advanceTimersByTime(ms);
  },

  /**
   * 특정 날짜로 시간 설정
   */
  setTime: (date: Date | string) => {
    vi.setSystemTime(new Date(date));
  },

  /**
   * Promise가 resolve될 때까지 대기
   */
  waitForPromises: () => {
    return new Promise(resolve => setTimeout(resolve, 0));
  },

  /**
   * 다음 틱까지 대기
   */
  nextTick: () => {
    return new Promise(resolve => process.nextTick(resolve));
  },

  /**
   * 메모리 사용량 체크 (성능 테스트용)
   */
  getMemoryUsage: () => {
    return process.memoryUsage();
  },

  /**
   * 결정론적 랜덤 문자열 생성
   */
  generateTestId: (prefix = 'test') => {
    const timestamp = FIXED_DATE.getTime();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}-${timestamp}-${random}`;
  },
};

// 글로벌 테스트 환경 정보 출력
if (process.env.VITEST_DETERMINISTIC) {
  logger.info('🔧 결정론적 테스트 환경이 활성화되었습니다.');
  logger.info(`⏰ 고정 시간: ${FIXED_DATE.toISOString()}`);
  logger.info(`🌍 시간대: ${process.env.TZ}`);
  logger.info(`🎲 랜덤 시드: 고정됨`);
}