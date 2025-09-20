/**
 * 회원가입 페이지 TDD 테스트
 * $300 사건 방지: 실시간 입력 검증 및 API 호출 제한 테스트
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import RegisterPage from './page';

// 모킹된 useRouter
const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// useAuthRedirect 모킹
vi.mock('@/shared/hooks', () => ({
  useAuthRedirect: () => ({ isLoading: false }),
}));

// safeFetch 모킹
vi.mock('@/shared/lib/api-retry', () => ({
  safeFetch: vi.fn(),
}));

describe('RegisterPage - 실시간 입력 검증', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('🔴 RED: 실시간 이메일 검증 (실패 케이스)', () => {
    test('잘못된 이메일 형식 입력 시 즉시 에러 표시해야 함', async () => {
      render(<RegisterPage />);

      const emailInput = screen.getByTestId('email-input');

      // 잘못된 이메일 입력
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);

      // 실시간 검증 에러가 표시되어야 함 (현재는 실패할 것)
      await waitFor(() => {
        expect(screen.getByText('유효한 이메일을 입력해주세요')).toBeInTheDocument();
      });
    });

    test('중복 이메일 실시간 체크해야 함', async () => {
      // API 응답 모킹 - 중복 이메일
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ exists: true }),
      });

      render(<RegisterPage />);

      const emailInput = screen.getByTestId('email-input');

      // 이미 존재하는 이메일 입력
      fireEvent.change(emailInput, { target: { value: 'existing@test.com' } });
      fireEvent.blur(emailInput);

      // 실시간 중복 체크 결과가 표시되어야 함 (현재는 실패할 것)
      await waitFor(() => {
        expect(screen.getByText('이미 사용 중인 이메일입니다')).toBeInTheDocument();
      });
    });
  });

  describe('🔴 RED: 실시간 비밀번호 검증 (실패 케이스)', () => {
    test('비밀번호 강도 실시간 체크해야 함', async () => {
      render(<RegisterPage />);

      const passwordInput = screen.getByTestId('password-input');

      // 약한 비밀번호 입력
      fireEvent.change(passwordInput, { target: { value: '123' } });
      fireEvent.blur(passwordInput);

      // 실시간 강도 검증이 표시되어야 함 (현재는 실패할 것)
      await waitFor(() => {
        expect(screen.getByText('비밀번호는 최소 8자 이상이어야 합니다')).toBeInTheDocument();
      });
    });

    test('비밀번호 확인 실시간 체크해야 함', async () => {
      render(<RegisterPage />);

      const passwordInput = screen.getByTestId('password-input');
      const confirmPasswordInput = screen.getByTestId('confirm-password-input');

      // 비밀번호 입력
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      // 다른 비밀번호 확인 입력
      fireEvent.change(confirmPasswordInput, { target: { value: 'different123' } });
      fireEvent.blur(confirmPasswordInput);

      // 실시간 불일치 검증이 표시되어야 함 (현재는 실패할 것)
      await waitFor(() => {
        expect(screen.getByText('비밀번호가 일치하지 않습니다')).toBeInTheDocument();
      });
    });
  });

  describe('🔴 RED: API 호출 제한 및 $300 사건 방지', () => {
    test('중복 API 호출 방지해야 함', async () => {
      render(<RegisterPage />);

      const emailInput = screen.getByTestId('email-input');

      // 빠른 연속 입력
      fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
      fireEvent.change(emailInput, { target: { value: 'test2@test.com' } });
      fireEvent.change(emailInput, { target: { value: 'test3@test.com' } });

      // API 호출이 디바운스되어야 함 (현재는 실패할 것)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });

    test('1분 이내 중복 호출 캐시 사용해야 함', async () => {
      render(<RegisterPage />);

      const emailInput = screen.getByTestId('email-input');

      // 같은 이메일로 두 번 검증
      fireEvent.change(emailInput, { target: { value: 'cache@test.com' } });
      fireEvent.blur(emailInput);

      // 잠시 후 같은 이메일 다시 검증
      await waitFor(() => {});
      fireEvent.change(emailInput, { target: { value: 'other@test.com' } });
      fireEvent.change(emailInput, { target: { value: 'cache@test.com' } });
      fireEvent.blur(emailInput);

      // 캐시된 결과 사용으로 API 호출 최소화되어야 함 (현재는 실패할 것)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('🔴 RED: 사용자 친화적 에러 메시지', () => {
    test('Supabase 에러를 한국어로 변환해야 함', async () => {
      const { safeFetch } = await import('@/shared/lib/api-retry');

      // 회원가입 API 에러 응답 모킹
      (safeFetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: false,
          error: 'User already exists',
          message: 'User already registered',
        }),
      });

      render(<RegisterPage />);

      // 폼 제출
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
      fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'password123' } });

      fireEvent.click(screen.getByTestId('register-button'));

      // 한국어 에러 메시지가 표시되어야 함 (현재는 실패할 것)
      await waitFor(() => {
        expect(screen.getByText('이미 등록된 이메일입니다')).toBeInTheDocument();
      });
    });
  });
});