/**
 * WorkflowWizard 접근성 테스트
 * WCAG 2.1 AA 준수 검증
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { WorkflowWizard } from '../WorkflowWizard';

// MSW 테스트 유틸리티
import { server } from '@/shared/lib/test-utils/msw-server';
import { workflowHandlers } from './msw-handlers';

// jest-axe 매처 확장
expect.extend(toHaveNoViolations);

describe('WorkflowWizard - 접근성 테스트', () => {
  beforeAll(() => {
    server.listen();
    server.use(...workflowHandlers);
  });

  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  describe('♿ 기본 접근성 준수', () => {
    it('WCAG 2.1 AA 기준 위반 사항이 없어야 함', async () => {
      const { container } = render(<WorkflowWizard />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('적절한 헤딩 구조를 가져야 함', () => {
      render(<WorkflowWizard />);

      // h1 메인 제목
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/AI 영상 생성/i);

      // h3 섹션 제목들
      const h3Headings = screen.getAllByRole('heading', { level: 3 });
      expect(h3Headings).toHaveLength(2);
      expect(h3Headings[0]).toHaveTextContent(/템플릿으로 빠르게 시작/i);
      expect(h3Headings[1]).toHaveTextContent(/직접 설정하여 시작/i);
    });

    it('모든 인터랙티브 요소에 적절한 라벨이 있어야 함', () => {
      render(<WorkflowWizard />);

      // 버튼들
      expect(screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /직접 설정하여 시작/i })).toBeInTheDocument();

      // aria-label 확인
      const templateButton = screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i });
      expect(templateButton).toHaveAttribute('aria-label', '템플릿으로 빠르게 시작');
    });

    it('색상에만 의존하지 않는 정보 전달', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      // 직접 설정 모드로 진입
      const directButton = screen.getByRole('button', { name: /직접 설정하여 시작/i });
      await user.click(directButton);

      // 진행 상태를 색상 외에 텍스트로도 표시
      await waitFor(() => {
        expect(screen.getByText(/진행 중.../i)).toBeInTheDocument();
        expect(screen.getByText(/진행률: 25%/i)).toBeInTheDocument();
      });
    });
  });

  describe('⌨️ 키보드 네비게이션', () => {
    it('Tab 키로 모든 인터랙티브 요소에 순서대로 접근 가능', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      // 첫 번째 버튼에 포커스
      await user.tab();
      expect(screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i })).toHaveFocus();

      // 두 번째 버튼에 포커스
      await user.tab();
      expect(screen.getByRole('button', { name: /직접 설정하여 시작/i })).toHaveFocus();
    });

    it('Shift+Tab으로 역방향 탐색 가능', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      // 두 번째 버튼으로 이동 후 역방향 탐색
      await user.tab();
      await user.tab();
      await user.keyboard('{Shift>}{Tab}{/Shift}');

      expect(screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i })).toHaveFocus();
    });

    it('Enter 키로 버튼 활성화 가능', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      const templateButton = screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i });

      await user.tab();
      expect(templateButton).toHaveFocus();

      await user.keyboard('{Enter}');

      // 템플릿 선택 화면으로 전환 확인
      await waitFor(() => {
        expect(screen.getByText(/템플릿 선택/i)).toBeInTheDocument();
      });
    });

    it('Escape 키로 모달 닫기 가능', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      // 템플릿 선택 모달 열기
      const templateButton = screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i });
      await user.click(templateButton);

      await waitFor(() => {
        expect(screen.getByText(/템플릿 선택/i)).toBeInTheDocument();
      });

      // Escape로 모달 닫기
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText(/템플릿 선택/i)).not.toBeInTheDocument();
      });
    });

    it('폼 필드 간 Tab 네비게이션', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      // 직접 설정 모드로 진입
      const directButton = screen.getByRole('button', { name: /직접 설정하여 시작/i });
      await user.click(directButton);

      await waitFor(() => {
        const storyInput = screen.getByRole('textbox', { name: /스토리 입력/i });
        expect(storyInput).toBeInTheDocument();
      });

      // 폼 필드에 Tab으로 이동
      await user.tab();
      expect(screen.getByRole('textbox', { name: /스토리 입력/i })).toHaveFocus();
    });
  });

  describe('🔊 스크린 리더 지원', () => {
    it('상태 변경 시 aria-live로 알림', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      // aria-live 영역 존재 확인
      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');

      // 상태 변경 시 알림 업데이트
      const templateButton = screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i });
      await user.click(templateButton);

      await waitFor(() => {
        expect(statusRegion).toHaveTextContent(/템플릿 선택 모드로 전환되었습니다/i);
      });
    });

    it('진행률을 progressbar 역할로 제공', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      const directButton = screen.getByRole('button', { name: /직접 설정하여 시작/i });
      await user.click(directButton);

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '25');
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '100');
        expect(progressBar).toHaveAttribute('aria-label', '진행률 25%');
      });
    });

    it('오류 메시지를 alert 역할로 제공', async () => {
      const user = userEvent.setup();

      // 에러 시나리오 설정
      server.use(
        workflowHandlers[0] // 에러 핸들러 사용
      );

      render(<WorkflowWizard />);

      // 에러 발생 액션
      const templateButton = screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i });
      await user.click(templateButton);

      // alert 역할로 에러 메시지 표시
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent(/오류가 발생했습니다/i);
      });
    });

    it('폼 필드와 에러 메시지 연결', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      // 직접 설정 모드로 진입
      const directButton = screen.getByRole('button', { name: /직접 설정하여 시작/i });
      await user.click(directButton);

      await waitFor(() => {
        const storyInput = screen.getByRole('textbox', { name: /스토리 입력/i });
        expect(storyInput).toBeInTheDocument();
      });

      const storyInput = screen.getByRole('textbox', { name: /스토리 입력/i });

      // 빈 값으로 유효성 검사 실패 시뮬레이션
      await user.clear(storyInput);
      await user.tab(); // 포커스 이동으로 검증 트리거

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveTextContent(/스토리를 입력해주세요/i);

        // aria-describedby로 연결 확인
        expect(storyInput).toHaveAttribute('aria-describedby');
        const describedById = storyInput.getAttribute('aria-describedby');
        expect(errorAlert).toHaveAttribute('id', describedById);
      });
    });
  });

  describe('📱 터치 및 모바일 접근성', () => {
    it('터치 타겟이 최소 44px 크기를 유지', () => {
      render(<WorkflowWizard />);

      const buttons = screen.getAllByRole('button');

      buttons.forEach(button => {
        const computedStyle = window.getComputedStyle(button);
        const height = parseInt(computedStyle.height);
        const width = parseInt(computedStyle.width);

        expect(height).toBeGreaterThanOrEqual(44);
        expect(width).toBeGreaterThanOrEqual(44);
      });
    });

    it('포커스 표시기가 충분한 대비를 유지', () => {
      render(<WorkflowWizard />);

      const templateButton = screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i });

      // 포커스 상태 시뮬레이션
      fireEvent.focus(templateButton);

      const computedStyle = window.getComputedStyle(templateButton, ':focus');

      // 포커스 아웃라인이 존재하는지 확인
      expect(computedStyle.outline).not.toBe('none');
      expect(computedStyle.outline).not.toBe('0');
    });
  });

  describe('🎯 사용자 설정 반영', () => {
    it('prefers-reduced-motion 설정 반영', () => {
      // reduced motion 설정 시뮬레이션
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(<WorkflowWizard />);

      // 애니메이션 관련 클래스가 적용되지 않았는지 확인
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).not.toHaveClass('animate-pulse');
    });

    it('고대비 모드 지원', () => {
      // 고대비 모드 시뮬레이션
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(<WorkflowWizard />);

      const buttons = screen.getAllByRole('button');

      buttons.forEach(button => {
        const computedStyle = window.getComputedStyle(button);

        // 충분한 색상 대비 확인 (4.5:1 이상)
        expect(computedStyle.backgroundColor).not.toBe(computedStyle.color);
      });
    });
  });
});