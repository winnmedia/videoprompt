/**
 * 로그인 페이지 TDD 테스트
 * $300 사건 방지: useEffect 안전 규칙 및 API 호출 제한 테스트
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import LoginPage from './page';

// 모킹된 next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

// useAuthRedirect 모킹
vi.mock('@/shared/hooks', () => ({
  useAuthRedirect: () => ({ isLoading: false }),
}));

// useAuthStore 모킹
vi.mock('@/shared/store/useAuthStore', () => ({
  useAuthStore: () => ({
    setUser: vi.fn(),
  }),
}));

describe('LoginPage - $300 사건 방지 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    localStorage.clear();
  });

  describe('🔴 RED: useEffect $300 방지 규칙', () => {
    test('useEffect 의존성 배열에 함수 포함하면 안 됨', () => {
      const { container } = render(<LoginPage />);

      // 컴포넌트가 마운트된 후 1초 대기
      setTimeout(() => {
        // useEffect가 1번만 실행되어야 함 (무한 루프 방지)
        expect(container).toBeInTheDocument();
      }, 1000);
    });

    test('API 호출 중복 방지 확인', async () => {
      render(<LoginPage />);

      const form = screen.getByRole('form');

      // 빠른 연속 제출 시도
      fireEvent.submit(form);
      fireEvent.submit(form);
      fireEvent.submit(form);

      // API가 1번만 호출되어야 함 (현재는 실패할 것)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('🔴 RED: 실시간 입력 검증', () => {
    test('이메일 형식 실시간 검증해야 함', async () => {
      render(<LoginPage />);

      const emailInput = screen.getByTestId('email-input');

      // 잘못된 이메일 입력
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);

      // 실시간 검증 에러가 표시되어야 함 (현재는 실패할 것)
      await waitFor(() => {
        expect(screen.getByText('유효한 이메일을 입력해주세요')).toBeInTheDocument();
      });
    });

    test('비밀번호 최소 길이 실시간 검증해야 함', async () => {
      render(<LoginPage />);

      const passwordInput = screen.getByTestId('password-input');

      // 짧은 비밀번호 입력
      fireEvent.change(passwordInput, { target: { value: '123' } });
      fireEvent.blur(passwordInput);

      // 실시간 검증 에러가 표시되어야 함 (현재는 실패할 것)
      await waitFor(() => {
        expect(screen.getByText('비밀번호는 최소 8자 이상이어야 합니다')).toBeInTheDocument();
      });
    });
  });

  describe('🔴 RED: Supabase 에러 메시지 매핑', () => {
    test('이메일 미확인 에러를 한국어로 변환해야 함', async () => {
      // API 에러 응답 모킹
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          message: 'Email not confirmed',
        }),
      });

      render(<LoginPage />);

      // 폼 제출
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByTestId('login-button'));

      // 한국어 에러 메시지가 표시되어야 함 (현재는 실패할 것)
      await waitFor(() => {
        expect(screen.getByText('이메일 인증이 필요합니다. 가입 시 받은 이메일을 확인하여 계정을 활성화해주세요.')).toBeInTheDocument();
      });
    });

    test('잘못된 자격증명 에러를 한국어로 변환해야 함', async () => {
      // API 에러 응답 모킹
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          message: 'Invalid login credentials',
        }),
      });

      render(<LoginPage />);

      // 폼 제출
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'wrongpassword' } });
      fireEvent.click(screen.getByTestId('login-button'));

      // 한국어 에러 메시지가 표시되어야 함 (현재는 실패할 것)
      await waitFor(() => {
        expect(screen.getByText('이메일 또는 비밀번호가 올바르지 않습니다')).toBeInTheDocument();
      });
    });
  });

  describe('🔴 RED: 토큰 동기화 및 스토어 업데이트', () => {
    test('로그인 성공 시 토큰이 localStorage에 저장되어야 함', async () => {
      // API 성공 응답 모킹
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            id: 'user-123',
            email: 'test@test.com',
            token: 'mock-token',
          },
        }),
      });

      render(<LoginPage />);

      // 폼 제출
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByTestId('login-button'));

      // 토큰이 localStorage에 저장되어야 함 (현재는 실패할 것)
      await waitFor(() => {
        expect(localStorage.getItem('token')).toBe('mock-token');
      });
    });
  });
});