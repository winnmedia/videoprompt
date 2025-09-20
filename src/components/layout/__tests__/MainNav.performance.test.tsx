import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { useRouter, usePathname, useSelectedLayoutSegment } from 'next/navigation';
import { MainNav } from '@/components/layout/MainNav';
import { useAuthStore } from '@/shared/store/useAuthStore';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSelectedLayoutSegment: vi.fn(),
}));

vi.mock('@/shared/store/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}));

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

describe('MainNav - Core Web Vitals 성능 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter);
    mockUsePathname.mockReturnValue('/');
    mockUseSelectedLayoutSegment.mockReturnValue(null);
    mockUseAuthStore.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      logout: vi.fn(),
    });
  });

  describe('Interaction to Next Paint (INP) 테스트', () => {
    it('메뉴 클릭 시 200ms 이내에 상호작용이 완료되어야 한다', async () => {
      const user = userEvent.setup();
      render(<MainNav />);

      const scenarioLink = screen.getByRole('link', { name: /AI 영상 기획/ });

      // INP 측정: 클릭에서 시각적 업데이트까지의 시간
      const startTime = performance.now();

      await user.click(scenarioLink);

      // requestAnimationFrame을 기다려 브라우저 렌더링 사이클 완료
      await new Promise(resolve => requestAnimationFrame(resolve));

      const endTime = performance.now();
      const inp = endTime - startTime;

      // INP 목표: 200ms 이하 (Core Web Vitals)
      expect(inp).toBeLessThan(200);
    });

    it('여러 연속 클릭 시에도 성능이 일정해야 한다', async () => {
      const user = userEvent.setup();
      render(<MainNav />);

      const links = screen.getAllByRole('link').slice(0, 3); // 첫 3개 링크 테스트
      const measurements: number[] = [];

      for (const link of links) {
        const startTime = performance.now();
        await user.click(link);
        await new Promise(resolve => requestAnimationFrame(resolve));
        const endTime = performance.now();

        measurements.push(endTime - startTime);
      }

      // 모든 클릭이 200ms 이하여야 함
      measurements.forEach((measurement, index) => {
        expect(measurement).toBeLessThan(200);
      });

      // 성능 일관성 검사: 표준편차가 50ms 이하여야 함
      const avg = measurements.reduce((a, b) => a + b) / measurements.length;
      const variance = measurements.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / measurements.length;
      const stdDev = Math.sqrt(variance);

      expect(stdDev).toBeLessThan(50);
    });
  });

  describe('Cumulative Layout Shift (CLS) 테스트', () => {
    it('메뉴 상태 변경 시 레이아웃 이동이 없어야 한다', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<MainNav />);

      const nav = screen.getByRole('navigation');
      const initialRect = nav.getBoundingClientRect();

      // 다른 페이지로 상태 변경
      mockUsePathname.mockReturnValue('/scenario');
      mockUseSelectedLayoutSegment.mockReturnValue('scenario');
      rerender(<MainNav />);

      const afterRect = nav.getBoundingClientRect();

      // 레이아웃 이동이 없어야 함
      expect(initialRect.top).toBe(afterRect.top);
      expect(initialRect.left).toBe(afterRect.left);
      expect(initialRect.width).toBe(afterRect.width);
      expect(initialRect.height).toBe(afterRect.height);
    });

    it('로딩 상태에서도 레이아웃이 안정해야 한다', () => {
      const { rerender } = render(<MainNav />);

      const nav = screen.getByRole('navigation');
      const initialRect = nav.getBoundingClientRect();

      // 로딩 상태로 변경
      mockUseAuthStore.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        logout: vi.fn(),
      });
      rerender(<MainNav />);

      const loadingRect = nav.getBoundingClientRect();

      // 레이아웃 이동이 최소화되어야 함 (2px 이하)
      expect(Math.abs(initialRect.height - loadingRect.height)).toBeLessThan(2);
      expect(Math.abs(initialRect.width - loadingRect.width)).toBeLessThan(2);
    });
  });

  describe('메모리 사용량 최적화', () => {
    it('메뉴 클릭 시 메모리 누수가 없어야 한다', async () => {
      const user = userEvent.setup();
      render(<MainNav />);

      const scenarioLink = screen.getByRole('link', { name: /AI 영상 기획/ });

      // 초기 DOM 노드 수 확인
      const initialNodeCount = document.querySelectorAll('*').length;

      // 여러 번 클릭
      for (let i = 0; i < 10; i++) {
        await user.click(scenarioLink);
        await new Promise(resolve => requestAnimationFrame(resolve));
      }

      // DOM 노드 수가 크게 증가하지 않아야 함
      const finalNodeCount = document.querySelectorAll('*').length;
      const nodeIncrease = finalNodeCount - initialNodeCount;

      // 노드 증가가 5개 이하여야 함 (메모리 누수 방지)
      expect(nodeIncrease).toBeLessThan(5);
    });
  });

  describe('접근성 성능', () => {
    it('스크린 리더 속성이 성능에 영향을 주지 않아야 한다', async () => {
      const user = userEvent.setup();
      render(<MainNav />);

      const startTime = performance.now();

      // 모든 접근성 속성 확인
      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveAttribute('aria-label');
        expect(link).toHaveAttribute('title');
      });

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label');

      const endTime = performance.now();
      const accessibilityCheckTime = endTime - startTime;

      // 접근성 확인이 10ms 이하여야 함
      expect(accessibilityCheckTime).toBeLessThan(10);
    });
  });
});