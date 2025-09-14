import { renderHook, act } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/shared/store/useAuthStore';
import { useAuthRedirect } from '../useAuthRedirect';

// Mocks
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/shared/store/useAuthStore', () => ({
  useAuthStore: jest.fn(),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({
    push: mockPush,
    replace: mockReplace,
  });
});

describe('useAuthRedirect', () => {
  it('인증된 사용자가 로그인 페이지 접근 시 홈으로 리다이렉트', () => {
    // Given: 인증된 사용자
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    // When: 로그인 페이지 접근
    renderHook(() => useAuthRedirect({ redirectPath: '/' }));

    // Then: 홈으로 리다이렉트
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('인증된 사용자가 회원가입 페이지 접근 시 홈으로 리다이렉트', () => {
    // Given: 인증된 사용자
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    // When: 회원가입 페이지 접근
    renderHook(() => useAuthRedirect({ redirectPath: '/' }));

    // Then: 홈으로 리다이렉트
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('미인증 사용자는 리다이렉트하지 않음', () => {
    // Given: 미인증 사용자
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    // When: 로그인 페이지 접근
    renderHook(() => useAuthRedirect({ redirectPath: '/' }));

    // Then: 리다이렉트하지 않음
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('로딩 중에는 리다이렉트하지 않음', () => {
    // Given: 인증 상태 확인 중
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });

    // When: 로그인 페이지 접근
    renderHook(() => useAuthRedirect({ redirectPath: '/' }));

    // Then: 리다이렉트하지 않음
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('커스텀 리다이렉트 경로로 이동', () => {
    // Given: 인증된 사용자
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    // When: 커스텀 리다이렉트 경로 설정
    renderHook(() => useAuthRedirect({ redirectPath: '/dashboard' }));

    // Then: 커스텀 경로로 리다이렉트
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });
});