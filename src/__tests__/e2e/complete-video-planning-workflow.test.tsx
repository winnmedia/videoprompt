/**
 * 완전한 영상 기획 워크플로우 E2E 테스트
 *
 * 테스트 시나리오:
 * 1. 페이지 로드 → 스토리 입력 → 4단계 생성 → 12샷 생성 → 콘티 생성 → 저장
 * 2. 에러 복구 시나리오 (네트워크 오류, API 실패, 타임아웃)
 * 3. 성능 테스트 (응답 시간, 메모리 누수 없음)
 * 4. 접근성 테스트 (키보드 네비게이션, 스크린 리더)
 *
 * TDD Red Phase: 실패하는 테스트부터 작성
 */

import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import ScenarioPage from '@/app/scenario/page';
import { server } from '@/test/mocks/server';
import { scenarioHandlers, scenarioErrorHandlers, scenarioSuccessHandlers } from '@/shared/lib/mocks/scenario-handlers';
import { ErrorBoundary } from 'react-error-boundary';

// Axe-core 접근성 테스트를 위한 Jest matcher 추가
expect.extend(toHaveNoViolations);

// 성능 모니터링을 위한 메모리 사용량 체크
const getMemoryUsage = () => {
  if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
    return (performance as any).memory.usedJSHeapSize;
  }
  return 0;
};

// 테스트용 ErrorBoundary 컴포넌트
function TestErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={<div role="alert">오류가 발생했습니다</div>}
      onError={(error) => {
        console.error('ErrorBoundary caught:', error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

describe('완전한 영상 기획 워크플로우 E2E 테스트', () => {
  const user = userEvent.setup({
    // 실제 사용자의 타이핑 속도 시뮬레이션
    delay: null,
    // 포인터 이벤트 활성화
    pointerEventsCheck: 0
  });

  let initialMemory: number;

  beforeAll(() => {
    // 브라우저 API 모킹
    Object.defineProperty(window, 'scrollTo', {
      value: vi.fn(),
      writable: true
    });

    // IntersectionObserver 모킹 (이미지 lazy loading용)
    global.IntersectionObserver = vi.fn(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
    })) as any;
  });

  beforeEach(() => {
    // 메모리 사용량 기록
    initialMemory = getMemoryUsage();

    // MSW 서버 설정
    server.use(...scenarioHandlers);

    // 로컬 스토리지 초기화
    localStorage.clear();

    // 타이머 초기화
    vi.useFakeTimers();

    // 콘솔 모킹 (불필요한 로그 숨기기)
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // 타이머 정리
    vi.runOnlyPendingTimers();
    vi.useRealTimers();

    // 모킹 정리
    vi.restoreAllMocks();

    // 서버 핸들러 리셋
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  describe('🎯 핵심 워크플로우 테스트 (Happy Path)', () => {
    it('FAIL: 전체 워크플로우를 성공적으로 완주할 수 있어야 한다', async () => {
      // Red Phase: 일부러 실패하는 테스트 작성
      const { container } = render(
        <TestErrorBoundary>
          <ScenarioPage />
        </TestErrorBoundary>
      );

      // 1단계: 페이지 로드 확인
      await waitFor(() => {
        expect(screen.getByText('AI 영상 기획')).toBeInTheDocument();
      });

      // 워크플로우 진행 표시기가 있어야 함
      expect(screen.getByText('스토리 입력')).toBeInTheDocument();

      // 2단계: 스토리 입력 폼 채우기 (실제 사용자처럼 느리게)
      const titleInput = screen.getByPlaceholderText(/제목을 입력하세요/);
      const storyInput = screen.getByPlaceholderText(/한 줄로 이야기를 요약해주세요/);

      await user.clear(titleInput);
      await user.type(titleInput, '테스트 영상 프로젝트', { delay: 50 });

      await user.clear(storyInput);
      await user.type(storyInput, '흥미진진한 모험을 떠나는 주인공의 이야기', { delay: 30 });

      // 톤앤매너 선택
      await user.click(screen.getByText('진지한'));
      await user.click(screen.getByText('감동적인'));

      // 장르 선택
      const genreSelect = screen.getByRole('combobox', { name: /장르/ });
      await user.click(genreSelect);
      await user.click(screen.getByText('Drama'));

      // 3단계: 스토리 생성 요청
      const generateButton = screen.getByRole('button', { name: /4단계 스토리 생성/ });
      await user.click(generateButton);

      // 로딩 상태 확인
      expect(screen.getByText(/생성 중.../)).toBeInTheDocument();

      // 응답 대기 (실제 API 시간 시뮬레이션)
      act(() => {
        vi.advanceTimersByTime(2000); // 2초 대기
      });

      // 4단계 스토리 생성 결과 확인
      await waitFor(() => {
        expect(screen.getByText(/4단계 스토리가 성공적으로 생성되었습니다/)).toBeInTheDocument();
      }, { timeout: 5000 });

      // 4단계: 생성된 스토리 단계들이 화면에 표시되는지 확인
      expect(screen.getByText('설정 및 캐릭터 소개')).toBeInTheDocument();
      expect(screen.getByText('갈등 발생 및 전개')).toBeInTheDocument();
      expect(screen.getByText('클라이맥스 및 전환점')).toBeInTheDocument();
      expect(screen.getByText('해결 및 마무리')).toBeInTheDocument();

      // 5단계: 12샷 생성으로 진행
      const generateShotsButton = screen.getByRole('button', { name: /12샷으로 분해/ });
      await user.click(generateShotsButton);

      // 로딩 대기
      act(() => {
        vi.advanceTimersByTime(3000); // 3초 대기
      });

      // 12샷 생성 결과 확인
      await waitFor(() => {
        const shots = screen.getAllByText(/샷 \d+:/);
        expect(shots.length).toBe(12); // 정확히 12개의 샷이 생성되어야 함
      }, { timeout: 8000 });

      // 6단계: 스토리보드 이미지 생성
      const generateStoryboardButton = screen.getByRole('button', { name: /스토리보드 생성/ });
      await user.click(generateStoryboardButton);

      // 더 긴 로딩 시간 (이미지 생성)
      act(() => {
        vi.advanceTimersByTime(5000); // 5초 대기
      });

      // 스토리보드 이미지 생성 결과 확인
      await waitFor(() => {
        expect(screen.getByText(/스토리보드가 생성되었습니다/)).toBeInTheDocument();
      }, { timeout: 10000 });

      // 7단계: 프로젝트 저장
      const saveButton = screen.getByRole('button', { name: /프로젝트 저장/ });
      await user.click(saveButton);

      act(() => {
        vi.advanceTimersByTime(1000); // 1초 대기
      });

      // 저장 완료 확인
      await waitFor(() => {
        expect(screen.getByText(/프로젝트가 성공적으로 저장되었습니다/)).toBeInTheDocument();
      }, { timeout: 3000 });

      // 💥 이 테스트는 실패할 것입니다 - Red Phase
      // 아직 컴포넌트들이 완전히 구현되지 않았기 때문
      expect(true).toBe(false); // 일부러 실패시킴
    });

    it('FAIL: 워크플로우 단계 간 이동이 정확해야 한다', async () => {
      render(
        <TestErrorBoundary>
          <ScenarioPage />
        </TestErrorBoundary>
      );

      // 워크플로우 진행 표시기 확인
      const progressSteps = screen.getAllByRole('button', { name: /단계/ });
      expect(progressSteps.length).toBeGreaterThan(0);

      // 현재 활성 단계 확인
      const currentStep = screen.getByText('스토리 입력');
      expect(currentStep).toHaveClass('active'); // 아직 구현되지 않았으므로 실패

      // 💥 실패할 테스트 - Red Phase
      expect(false).toBe(true);
    });
  });

  describe('⚡ 성능 테스트', () => {
    it('FAIL: 3초 이내에 응답해야 한다', async () => {
      const startTime = Date.now();

      render(
        <TestErrorBoundary>
          <ScenarioPage />
        </TestErrorBoundary>
      );

      // 스토리 생성 시간 측정
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/제목을 입력하세요/)).toBeInTheDocument();
      });

      const loadTime = Date.now() - startTime;

      // 💥 실패할 테스트 - 3초 제한
      expect(loadTime).toBeLessThan(3000);
    });

    it('FAIL: 메모리 누수가 없어야 한다', async () => {
      const { unmount } = render(
        <TestErrorBoundary>
          <ScenarioPage />
        </TestErrorBoundary>
      );

      // 컴포넌트 언마운트
      unmount();

      // 메모리 사용량 비교
      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;

      // 💥 실패할 테스트 - 메모리 증가량 제한
      expect(memoryIncrease).toBeLessThan(1000000); // 1MB 제한
    });
  });

  describe('🛡️ 에러 시나리오 테스트', () => {
    beforeEach(() => {
      server.use(...scenarioErrorHandlers);
    });

    it('FAIL: 네트워크 오류 시 적절한 에러 메시지를 표시해야 한다', async () => {
      render(
        <TestErrorBoundary>
          <ScenarioPage />
        </TestErrorBoundary>
      );

      const titleInput = screen.getByPlaceholderText(/제목을 입력하세요/);
      await user.type(titleInput, 'NETWORK_ERROR_TEST');

      const generateButton = screen.getByRole('button', { name: /생성/ });
      await user.click(generateButton);

      // 에러 메시지 확인
      await waitFor(() => {
        expect(screen.getByText(/네트워크 오류가 발생했습니다/)).toBeInTheDocument();
      });

      // 재시도 버튼 확인
      expect(screen.getByRole('button', { name: /다시 시도/ })).toBeInTheDocument();

      // 💥 실패할 테스트 - 아직 에러 처리가 완전하지 않음
      expect(true).toBe(false);
    });

    it('FAIL: API 실패 시 재시도 기능이 작동해야 한다', async () => {
      render(
        <TestErrorBoundary>
          <ScenarioPage />
        </TestErrorBoundary>
      );

      // 서버 에러 트리거
      const titleInput = screen.getByPlaceholderText(/제목을 입력하세요/);
      await user.type(titleInput, 'SERVER_ERROR_TEST');

      const generateButton = screen.getByRole('button', { name: /생성/ });
      await user.click(generateButton);

      // 에러 후 재시도 버튼 클릭
      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /다시 시도/ });
        expect(retryButton).toBeInTheDocument();
      });

      // 💥 실패할 테스트
      expect(false).toBe(true);
    });
  });

  describe('♿ 접근성 테스트 (WCAG 2.1 AA)', () => {
    it('FAIL: 접근성 위반 사항이 없어야 한다', async () => {
      const { container } = render(
        <TestErrorBoundary>
          <ScenarioPage />
        </TestErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('AI 영상 기획')).toBeInTheDocument();
      });

      // Axe-core로 접근성 검사
      const results = await axe(container);

      // 💥 실패할 테스트 - 접근성 위반 사항 있을 것
      expect(results).toHaveNoViolations();
    });

    it('FAIL: 키보드만으로 전체 워크플로우를 완주할 수 있어야 한다', async () => {
      render(
        <TestErrorBoundary>
          <ScenarioPage />
        </TestErrorBoundary>
      );

      // Tab 키로 네비게이션
      const titleInput = screen.getByPlaceholderText(/제목을 입력하세요/);
      titleInput.focus();

      await user.keyboard('키보드 테스트 제목');

      // Tab으로 다음 필드로 이동
      await user.tab();

      const storyInput = screen.getByPlaceholderText(/한 줄로 이야기를 요약해주세요/);
      expect(storyInput).toHaveFocus();

      await user.keyboard('키보드로 입력하는 스토리');

      // Enter 키로 생성 버튼 활성화 테스트
      await user.tab(); // 생성 버튼으로 이동
      await user.keyboard('{Enter}');

      // 💥 실패할 테스트 - 키보드 네비게이션이 완전하지 않음
      expect(false).toBe(true);
    });

    it('FAIL: 스크린 리더 사용자를 위한 적절한 ARIA 속성이 있어야 한다', async () => {
      render(
        <TestErrorBoundary>
          <ScenarioPage />
        </TestErrorBoundary>
      );

      // ARIA 속성 확인
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByLabelText(/제목/)).toBeInTheDocument();

      // 로딩 상태 ARIA
      const titleInput = screen.getByPlaceholderText(/제목을 입력하세요/);
      await user.type(titleInput, '테스트');

      const generateButton = screen.getByRole('button', { name: /생성/ });
      await user.click(generateButton);

      // aria-live 영역 확인
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });

      // 💥 실패할 테스트 - ARIA 속성이 부족함
      expect(false).toBe(true);
    });
  });

  describe('🔄 데이터 플로우 테스트', () => {
    it('FAIL: 생성된 데이터가 정확한 형식이어야 한다', async () => {
      // 성공 핸들러로 변경
      server.use(...scenarioSuccessHandlers);

      render(
        <TestErrorBoundary>
          <ScenarioPage />
        </TestErrorBoundary>
      );

      // 스토리 생성 후 데이터 검증
      const titleInput = screen.getByPlaceholderText(/제목을 입력하세요/);
      await user.type(titleInput, '데이터 검증 테스트');

      const generateButton = screen.getByRole('button', { name: /생성/ });
      await user.click(generateButton);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // 생성된 데이터의 구조 확인
      await waitFor(() => {
        // 4단계가 모두 생성되었는지 확인
        expect(screen.getAllByText(/단계/).length).toBe(4);
      });

      // 💥 실패할 테스트 - 데이터 구조 검증
      expect(true).toBe(false);
    });

    it('FAIL: 로컬 스토리지에 진행 상황이 저장되어야 한다', async () => {
      render(
        <TestErrorBoundary>
          <ScenarioPage />
        </TestErrorBoundary>
      );

      const titleInput = screen.getByPlaceholderText(/제목을 입력하세요/);
      await user.type(titleInput, '자동 저장 테스트');

      // 자동 저장 확인
      await waitFor(() => {
        const savedData = localStorage.getItem('scenario-draft');
        expect(savedData).toContain('자동 저장 테스트');
      });

      // 💥 실패할 테스트 - 자동 저장 기능이 없음
      expect(false).toBe(true);
    });
  });
});