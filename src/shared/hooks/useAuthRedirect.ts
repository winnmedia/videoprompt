import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/shared/store/useAuthStore';

interface UseAuthRedirectOptions {
  /** 인증된 사용자가 리다이렉트될 경로 */
  redirectPath?: string;
  /** 리다이렉트 조건 (기본: 인증된 사용자만 리다이렉트) */
  shouldRedirect?: (isAuthenticated: boolean, isLoading: boolean) => boolean;
}

/**
 * 인증된 사용자가 로그인/회원가입 페이지에 접근할 때 리다이렉트하는 훅
 */
export function useAuthRedirect(options: UseAuthRedirectOptions = {}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  const {
    redirectPath = '/',
    shouldRedirect = (authenticated, loading) => authenticated && !loading
  } = options;

  useEffect(() => {
    // 인증 상태를 먼저 확인 (의존성 제거로 마운트시 1회만 실행)
    checkAuth();
  }, []); // 빈 배열: 마운트시에만 실행

  useEffect(() => {
    // 로딩 중이거나 리다이렉트 조건이 맞지 않으면 리턴
    if (!shouldRedirect(isAuthenticated, isLoading)) {
      return;
    }

    // 인증된 사용자를 지정된 경로로 리다이렉트
    router.replace(redirectPath);
  }, [isAuthenticated, isLoading, redirectPath, router, shouldRedirect]);

  return {
    isAuthenticated,
    isLoading,
    shouldRedirect: shouldRedirect(isAuthenticated, isLoading)
  };
}