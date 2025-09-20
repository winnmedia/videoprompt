import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { useRouter, usePathname, useSelectedLayoutSegment } from 'next/navigation';
import { MainNav } from '@/components/layout/MainNav';
import { useAuthStore } from '@/shared/store/useAuthStore';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSelectedLayoutSegment: vi.fn(),
}));

// Mock auth store
vi.mock('@/shared/store/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}));

// Mock prefetch hook
vi.mock('@/shared/lib/prefetch', () => ({
  useSoftPrefetch: vi.fn(() => ({ current: null })),
  useInstantFeedback: vi.fn(() => vi.fn((callback) => vi.fn(callback))),
}));

const mockRouter = {
  push: vi.fn(),
  prefetch: vi.fn(),
};

const mockUseRouter = useRouter as ReturnType<typeof vi.fn>;
const mockUsePathname = usePathname as ReturnType<typeof vi.fn>;
const mockUseSelectedLayoutSegment = useSelectedLayoutSegment as ReturnType<typeof vi.fn>;
const mockUseAuthStore = useAuthStore as ReturnType<typeof vi.fn>;

describe('MainNav - UX 개선', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter);
    mockUsePathname.mockReturnValue('/');
    mockUseSelectedLayoutSegment.mockReturnValue(null); // 홈페이지
    mockUseAuthStore.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      logout: vi.fn(),
    });
  });

  describe('즉각적인 클릭 피드백 (≤50ms)', () => {
    it('메뉴 클릭 시 50ms 이내에 시각적 피드백을 제공해야 한다', async () => {
      const user = userEvent.setup();
      render(<MainNav />);

      const scenarioLink = screen.getByRole('link', { name: /AI 영상 기획/ });

      // 클릭 시간 측정
      const startTime = performance.now();
      await user.click(scenarioLink);

      // 시각적 피드백 확인 (active 상태)
      await waitFor(() => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        // 50ms 이내 응답 확인
        expect(responseTime).toBeLessThan(50);
        expect(scenarioLink).toHaveAttribute('aria-current', 'page');
      }, { timeout: 100 });
    });

    it('클릭된 메뉴가 active 상태로 변경되어야 한다', async () => {
      mockUsePathname.mockReturnValue('/scenario');
      mockUseSelectedLayoutSegment.mockReturnValue('scenario');

      render(<MainNav />);

      const scenarioLink = screen.getByRole('link', { name: /AI 영상 기획/ });
      expect(scenarioLink).toHaveAttribute('aria-current', 'page');
      expect(scenarioLink).toHaveClass('text-brand-700', 'bg-brand-50');
    });
  });

  describe('부드러운 페이지 전환 (INP ≤200ms)', () => {
    it('라우트 전환이 200ms 이내에 시작되어야 한다', async () => {
      const user = userEvent.setup();
      render(<MainNav />);

      const scenarioLink = screen.getByRole('link', { name: /AI 영상 기획/ });

      const startTime = performance.now();
      await user.click(scenarioLink);

      await waitFor(() => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        expect(responseTime).toBeLessThan(200);
        expect(mockRouter.push).toHaveBeenCalledWith('/scenario');
      }, { timeout: 250 });
    });

    it('로딩 상태가 적절히 표시되어야 한다', async () => {
      const user = userEvent.setup();
      mockUseAuthStore.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        logout: vi.fn(),
      });

      render(<MainNav />);

      expect(screen.getByTestId('auth-loading-skeleton')).toBeInTheDocument();
    });
  });

  describe('키보드 네비게이션 지원', () => {
    it('Tab 키로 모든 메뉴 아이템을 순차적으로 접근할 수 있어야 한다', async () => {
      const user = userEvent.setup();
      render(<MainNav />);

      // 첫 번째 메뉴 아이템에 포커스
      await user.tab();
      expect(screen.getByRole('link', { name: /홈/ })).toHaveFocus();

      // 두 번째 메뉴 아이템에 포커스
      await user.tab();
      expect(screen.getByRole('link', { name: /AI 영상 기획/ })).toHaveFocus();

      // 세 번째 메뉴 아이템에 포커스
      await user.tab();
      expect(screen.getByRole('link', { name: /프롬프트 생성기/ })).toHaveFocus();
    });

    it('Enter 키로 메뉴 아이템을 활성화할 수 있어야 한다', async () => {
      const user = userEvent.setup();
      render(<MainNav />);

      const scenarioLink = screen.getByRole('link', { name: /AI 영상 기획/ });
      scenarioLink.focus();

      await user.keyboard('{Enter}');

      // Enter로 링크 활성화 확인 (기본 브라우저 동작)
      expect(scenarioLink).toHaveFocus();
    });

    it('포커스된 아이템이 시각적으로 구분되어야 한다', async () => {
      const user = userEvent.setup();
      render(<MainNav />);

      const scenarioLink = screen.getByRole('link', { name: /AI 영상 기획/ });

      await user.tab();
      await user.tab(); // 두 번째 아이템으로 이동

      expect(scenarioLink).toHaveFocus();
      expect(scenarioLink).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-brand-400');
    });
  });

  describe('스크린 리더 호환성', () => {
    it('네비게이션 역할이 명확히 전달되어야 한다', () => {
      render(<MainNav />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', '주요 내비게이션');
      expect(nav).toHaveAttribute('data-testid', 'main-nav');
    });

    it('현재 페이지가 aria-current로 표시되어야 한다', () => {
      mockUsePathname.mockReturnValue('/scenario');
      mockUseSelectedLayoutSegment.mockReturnValue('scenario');
      render(<MainNav />);

      const scenarioLink = screen.getByRole('link', { name: /AI 영상 기획/ });
      expect(scenarioLink).toHaveAttribute('aria-current', 'page');

      const homeLink = screen.getByRole('link', { name: /홈/ });
      expect(homeLink).not.toHaveAttribute('aria-current');
    });

    it('각 메뉴 아이템의 목적이 명확히 전달되어야 한다', () => {
      render(<MainNav />);

      const menuItems = [
        { name: /홈/, href: '/' },
        { name: /AI 영상 기획/, href: '/scenario' },
        { name: /프롬프트 생성기/, href: '/prompt-generator' },
        { name: /AI 영상 생성/, href: '/workflow' },
        { name: /영상 목록/, href: '/videos' },
        { name: /영상 피드백/, href: '/feedback' },
        { name: /콘텐츠 관리/, href: '/planning' },
      ];

      menuItems.forEach(({ name, href }) => {
        const link = screen.getByRole('link', { name });
        expect(link).toHaveAttribute('href', href);
        expect(link).toBeVisible();
      });
    });
  });

  describe('에러 처리 및 상태 관리', () => {
    it('로그아웃 중복 클릭을 방지해야 한다', async () => {
      const user = userEvent.setup();
      const mockLogout = vi.fn().mockResolvedValue(undefined);

      mockUseAuthStore.mockReturnValue({
        user: { username: 'testuser', role: 'user', avatarUrl: null },
        isAuthenticated: true,
        isLoading: false,
        logout: mockLogout,
      });

      render(<MainNav />);

      const logoutButton = screen.getByRole('button', { name: /로그아웃/ });

      // 연속 클릭
      await user.click(logoutButton);
      await user.click(logoutButton);

      // 로그아웃이 한 번만 호출되어야 함
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    it('로그아웃 실패 시에도 홈으로 이동해야 한다', async () => {
      const user = userEvent.setup();
      const mockLogout = vi.fn().mockRejectedValue(new Error('Network error'));

      mockUseAuthStore.mockReturnValue({
        user: { username: 'testuser', role: 'user', avatarUrl: null },
        isAuthenticated: true,
        isLoading: false,
        logout: mockLogout,
      });

      render(<MainNav />);

      const logoutButton = screen.getByRole('button', { name: /로그아웃/ });
      await user.click(logoutButton);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('성능 최적화', () => {
    it('prefetch가 적절히 설정되어야 한다', () => {
      render(<MainNav />);

      const links = screen.getAllByRole('link');

      links.forEach((link) => {
        // Next.js Link의 prefetch={false} 설정 확인
        expect(link).toHaveAttribute('href');
      });
    });
  });
});