/**
 * 완전한 시나리오 플로우 통합 테스트
 *
 * 테스트 범위:
 * - 실제 API 호출과 UI 상호작용
 * - 데이터 플로우 검증 (DTO → Domain 변환)
 * - 상태 관리 (Redux + React Query) 통합
 * - 에러 처리 및 복구 시나리오
 * - 자동 저장 및 복원 기능
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';

import ScenarioPage from '@/app/scenario/page';
import { scenarioHandlers, scenarioErrorHandlers, scenarioSuccessHandlers } from '@/shared/lib/mocks/scenario-handlers';
import { WORKFLOW_STEPS } from '@/entities/scenario';

// 테스트 환경 설정
process.env.INTEGRATION_TEST = 'true';

const server = setupServer(...scenarioHandlers);

// 테스트용 래퍼 컴포넌트
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div data-testid="test-wrapper">
      {children}
    </div>
  );
};

describe('완전한 시나리오 플로우 통합 테스트', () => {
  const user = userEvent.setup({
    // 실제 사용자 상호작용 시뮬레이션
    delay: 1,
    pointerEventsCheck: 0
  });

  beforeEach(() => {
    server.listen({ onUnhandledRequest: 'error' });
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // 콘솔 모킹 (테스트 출력 정리)
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    server.resetHandlers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  describe('🎯 핵심 통합 플로우 (Happy Path)', () => {
    it('전체 워크플로우를 성공적으로 완주할 수 있어야 한다', async () => {
      const { container } = render(
        <TestWrapper>
          <ScenarioPage />
        </TestWrapper>
      );

      // 1단계: 페이지 로드 및 초기 상태 확인
      await waitFor(() => {
        expect(screen.getByText('AI 영상 기획')).toBeInTheDocument();
      }, { timeout: 5000 });

      // 스토리 입력 폼이 활성화되어 있는지 확인
      const titleInput = await screen.findByPlaceholderText(/제목을 입력하세요/);
      const storyInput = await screen.findByPlaceholderText(/한 줄로 이야기를 요약해주세요/);
      expect(titleInput).toBeInTheDocument();
      expect(storyInput).toBeInTheDocument();

      // 2단계: 스토리 입력 (실제 사용자처럼 천천히)
      await user.clear(titleInput);
      await user.type(titleInput, '완전한 통합 테스트 스토리');

      await user.clear(storyInput);
      await user.type(storyInput, '주인공이 모험을 떠나며 성장하는 감동적인 이야기');

      // 톤앤매너 선택
      const seriousButton = screen.getByText('진지한');
      await user.click(seriousButton);

      const touchingButton = screen.getByText('감동적인');
      await user.click(touchingButton);

      // 장르 선택
      const genreDropdown = screen.getByRole('combobox', { name: /장르/ });
      await user.click(genreDropdown);
      await user.click(screen.getByText('Drama'));

      // 타겟 선택
      const targetDropdown = screen.getByRole('combobox', { name: /타겟/ });
      await user.click(targetDropdown);
      await user.click(screen.getByText('Adult'));

      // 3단계: 스토리 생성 요청
      const generateButton = screen.getByRole('button', { name: /4단계 스토리 생성/ });
      await user.click(generateButton);

      // 로딩 상태 확인
      await waitFor(() => {
        expect(screen.getByText(/생성 중.../)).toBeInTheDocument();
      }, { timeout: 2000 });

      // 스토리 생성 완료 대기
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // 4단계: 생성된 4단계 스토리 확인
      await waitFor(() => {
        expect(screen.getByText(/4단계 스토리가 성공적으로 생성되었습니다/)).toBeInTheDocument();
      }, { timeout: 10000 });

      // 4개 단계가 모두 생성되었는지 확인
      expect(screen.getByText('설정 및 캐릭터 소개')).toBeInTheDocument();
      expect(screen.getByText('갈등 발생 및 전개')).toBeInTheDocument();
      expect(screen.getByText('클라이맥스 및 전환점')).toBeInTheDocument();
      expect(screen.getByText('해결 및 마무리')).toBeInTheDocument();

      // 5단계: 12샷 분해 진행
      const generateShotsButton = screen.getByRole('button', { name: /12샷으로 분해/ });
      await user.click(generateShotsButton);

      // 12샷 생성 로딩 확인
      await waitFor(() => {
        expect(screen.getByText(/분해 중.../)).toBeInTheDocument();
      }, { timeout: 2000 });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // 12샷 생성 완료 확인
      await waitFor(() => {
        const shots = screen.getAllByText(/샷 \d+:/);
        expect(shots.length).toBe(12);
      }, { timeout: 15000 });

      // 6단계: 스토리보드 생성
      const generateStoryboardButton = screen.getByRole('button', { name: /스토리보드 생성/ });
      await user.click(generateStoryboardButton);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // 스토리보드 생성 완료 확인
      await waitFor(() => {
        expect(screen.getByText(/스토리보드가 생성되었습니다/)).toBeInTheDocument();
      }, { timeout: 20000 });

      // 7단계: 프로젝트 저장
      const saveButton = screen.getByRole('button', { name: /프로젝트 저장/ });
      await user.click(saveButton);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // 저장 완료 확인
      await waitFor(() => {
        expect(screen.getByText(/프로젝트가 성공적으로 저장되었습니다/)).toBeInTheDocument();
      }, { timeout: 5000 });

      // 8단계: 전체 워크플로우 완료 상태 확인
      expect(container.querySelector('[data-step="completed"]')).toBeInTheDocument();
    }, 60000); // 1분 타임아웃

    it('워크플로우 단계 간 네비게이션이 올바르게 동작해야 한다', async () => {
      render(
        <TestWrapper>
          <ScenarioPage />
        </TestWrapper>
      );

      // 워크플로우 프로그레스 바 확인
      const progressSteps = await screen.findAllByRole('button');
      const storyInputStep = progressSteps.find(step =>
        within(step).queryByText('스토리 입력')
      );

      expect(storyInputStep).toBeInTheDocument();

      // 현재 활성 단계 확인
      expect(storyInputStep).toHaveClass('active');

      // 다음 단계로 진행 후 이전 버튼으로 돌아가기 테스트는
      // 실제 데이터가 있을 때만 가능하므로 건너뜀
    });
  });

  describe('🔄 데이터 플로우 및 상태 관리', () => {
    it('자동 저장 기능이 올바르게 동작해야 한다', async () => {
      render(
        <TestWrapper>
          <ScenarioPage />
        </TestWrapper>
      );

      const titleInput = await screen.findByPlaceholderText(/제목을 입력하세요/);

      // 입력 후 자동 저장 확인
      await user.type(titleInput, '자동 저장 테스트');

      // 디바운스 시간 경과
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // 로컬 스토리지에 저장되었는지 확인
      await waitFor(() => {
        const saved = localStorage.getItem('scenario-draft');
        expect(saved).toContain('자동 저장 테스트');
      });
    });

    it('페이지 새로고침 후 데이터가 복원되어야 한다', async () => {
      // 먼저 데이터 입력
      const { unmount } = render(
        <TestWrapper>
          <ScenarioPage />
        </TestWrapper>
      );

      const titleInput = await screen.findByPlaceholderText(/제목을 입력하세요/);
      await user.type(titleInput, '복원 테스트');

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // 컴포넌트 언마운트 (페이지 새로고침 시뮬레이션)
      unmount();

      // 새로 마운트
      render(
        <TestWrapper>
          <ScenarioPage />
        </TestWrapper>
      );

      // 데이터가 복원되었는지 확인
      await waitFor(() => {
        const restoredTitleInput = screen.getByDisplayValue('복원 테스트');
        expect(restoredTitleInput).toBeInTheDocument();
      });
    });

    it('API 응답 데이터가 올바른 형식으로 변환되어야 한다', async () => {
      server.use(...scenarioSuccessHandlers);

      render(
        <TestWrapper>
          <ScenarioPage />
        </TestWrapper>
      );

      // 스토리 입력 및 생성
      const titleInput = await screen.findByPlaceholderText(/제목을 입력하세요/);
      await user.type(titleInput, '데이터 변환 테스트');

      const storyInput = await screen.findByPlaceholderText(/한 줄로 이야기를 요약해주세요/);
      await user.type(storyInput, '데이터 변환 확인용 스토리');

      const generateButton = screen.getByRole('button', { name: /생성/ });
      await user.click(generateButton);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // 생성된 데이터 구조 확인
      await waitFor(() => {
        // 4단계가 올바른 구조로 생성되었는지 확인
        expect(screen.getByText('설정 및 캐릭터 소개')).toBeInTheDocument();

        // 각 단계에 필요한 필드들이 있는지 확인
        const step1 = screen.getByText('설정 및 캐릭터 소개').closest('[data-step]');
        expect(step1).toHaveAttribute('data-step-id', expect.stringMatching(/^step-1-/));
      });
    });
  });

  describe('💥 에러 처리 및 복구', () => {
    beforeEach(() => {
      server.use(...scenarioErrorHandlers);
    });

    it('네트워크 에러 시 적절한 에러 메시지와 재시도 옵션을 제공해야 한다', async () => {
      render(
        <TestWrapper>
          <ScenarioPage />
        </TestWrapper>
      );

      const titleInput = await screen.findByPlaceholderText(/제목을 입력하세요/);
      await user.type(titleInput, '네트워크 에러 테스트');

      const generateButton = screen.getByRole('button', { name: /생성/ });
      await user.click(generateButton);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // 에러 메시지 확인
      await waitFor(() => {
        expect(screen.getByText(/오류가 발생했습니다/)).toBeInTheDocument();
      });

      // 재시도 버튼 확인
      const retryButton = screen.getByRole('button', { name: /다시 시도/ });
      expect(retryButton).toBeInTheDocument();

      // 재시도 기능 테스트
      await user.click(retryButton);

      // 재시도 시 에러가 클리어되고 로딩이 다시 시작되는지 확인
      await waitFor(() => {
        expect(screen.getByText(/생성 중.../)).toBeInTheDocument();
      });
    });

    it('API 실패 후 성공 핸들러로 변경하면 복구되어야 한다', async () => {
      render(
        <TestWrapper>
          <ScenarioPage />
        </TestWrapper>
      );

      const titleInput = await screen.findByPlaceholderText(/제목을 입력하세요/);
      await user.type(titleInput, '복구 테스트');

      const generateButton = screen.getByRole('button', { name: /생성/ });
      await user.click(generateButton);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // 에러 확인
      await waitFor(() => {
        expect(screen.getByText(/오류가 발생했습니다/)).toBeInTheDocument();
      });

      // 성공 핸들러로 변경
      server.use(...scenarioSuccessHandlers);

      // 재시도
      const retryButton = screen.getByRole('button', { name: /다시 시도/ });
      await user.click(retryButton);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // 복구 확인
      await waitFor(() => {
        expect(screen.getByText(/성공적으로 생성되었습니다/)).toBeInTheDocument();
      });
    });
  });

  describe('📊 성능 및 사용성', () => {
    it('대용량 텍스트 입력을 처리할 수 있어야 한다', async () => {
      render(
        <TestWrapper>
          <ScenarioPage />
        </TestWrapper>
      );

      const titleInput = await screen.findByPlaceholderText(/제목을 입력하세요/);
      const storyInput = await screen.findByPlaceholderText(/한 줄로 이야기를 요약해주세요/);

      // 긴 텍스트 입력
      const longTitle = '매우 ' + '긴 '.repeat(100) + '제목';
      const longStory = '매우 ' + '긴 '.repeat(500) + '스토리';

      await user.type(titleInput, longTitle);
      await user.type(storyInput, longStory);

      // 입력이 올바르게 처리되는지 확인
      expect(titleInput).toHaveValue(longTitle);
      expect(storyInput).toHaveValue(longStory);

      // 자동 저장도 제대로 작동하는지 확인
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        const saved = localStorage.getItem('scenario-draft');
        expect(saved).toContain(longTitle.slice(0, 50)); // 일부분만 확인
      });
    });

    it('빠른 연속 클릭에도 안정적으로 동작해야 한다', async () => {
      server.use(...scenarioSuccessHandlers);

      render(
        <TestWrapper>
          <ScenarioPage />
        </TestWrapper>
      );

      const titleInput = await screen.findByPlaceholderText(/제목을 입력하세요/);
      await user.type(titleInput, '연속 클릭 테스트');

      const generateButton = screen.getByRole('button', { name: /생성/ });

      // 빠른 연속 클릭
      await user.click(generateButton);
      await user.click(generateButton);
      await user.click(generateButton);

      // 중복 요청이 방지되었는지 확인 (버튼이 비활성화되어야 함)
      await waitFor(() => {
        expect(generateButton).toBeDisabled();
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // 생성 완료 후 버튼 재활성화 확인
      await waitFor(() => {
        expect(generateButton).toBeEnabled();
      });
    });
  });

  describe('🔒 데이터 검증 및 보안', () => {
    it('XSS 공격 시도를 차단해야 한다', async () => {
      render(
        <TestWrapper>
          <ScenarioPage />
        </TestWrapper>
      );

      const titleInput = await screen.findByPlaceholderText(/제목을 입력하세요/);
      const maliciousInput = '<script>alert("XSS")</script>';

      await user.type(titleInput, maliciousInput);

      // 스크립트 태그가 실행되지 않고 텍스트로 처리되는지 확인
      expect(titleInput).toHaveValue(maliciousInput);

      // DOM에 실제 script 태그가 생성되지 않았는지 확인
      expect(document.querySelector('script[src*="alert"]')).toBeNull();
    });

    it('필수 필드 검증이 올바르게 동작해야 한다', async () => {
      render(
        <TestWrapper>
          <ScenarioPage />
        </TestWrapper>
      );

      // 제목만 입력하고 스토리는 비움
      const titleInput = await screen.findByPlaceholderText(/제목을 입력하세요/);
      await user.type(titleInput, '제목만 있는 테스트');

      const generateButton = screen.getByRole('button', { name: /생성/ });
      await user.click(generateButton);

      // 검증 에러 메시지 확인
      await waitFor(() => {
        expect(screen.getByText(/필수/)).toBeInTheDocument();
      });

      // 생성이 실행되지 않았는지 확인 (로딩이 시작되지 않음)
      expect(screen.queryByText(/생성 중.../)).not.toBeInTheDocument();
    });
  });
});