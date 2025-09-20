/**
 * 인증 스토어 초기화 및 API 클라이언트 연동
 * CLAUDE.md 아키텍처 원칙에 따른 의존성 주입
 */

import { initializeApiClient } from '@/shared/lib/api-client';

/**
 * 인증 시스템 초기화
 * 앱 시작 시 한 번만 호출해야 함
 */
export function initializeAuth(): void {
  // API 클라이언트에 토큰 공급자 및 토큰 설정자 설정
  initializeApiClient(
    // 토큰 공급자: localStorage에서 토큰 읽기
    () => {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem('token');
    },
    // 🔥 401 오류 해결: tokenSetter 추가 - 토큰 갱신 시 localStorage 및 store 동기화
    (newToken: string) => {
      if (typeof window === 'undefined') return;
      
      // localStorage 업데이트
      localStorage.setItem('token', newToken);
      
      // 🚨 중요: 토큰 갱신 이벤트 발생으로 store 동기화
      window.dispatchEvent(new CustomEvent('auth:token-updated', { 
        detail: { token: newToken } 
      }));
    }
  );
  
  // 토큰 무효화 이벤트 리스너 설정
  if (typeof window !== 'undefined') {
    window.addEventListener('auth:token-invalid', () => {
      // 토큰이 무효화되면 로그인 페이지로 리다이렉트
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?message=세션이 만료되었습니다. 다시 로그인해주세요.';
      }
    });
  }
  
  console.log('✅ Auth system initialized');
}

/**
 * 정리 함수 (테스트에서 사용)
 */
export function cleanupAuth(): void {
  if (typeof window !== 'undefined') {
    window.removeEventListener('auth:token-invalid', () => {});
  }
}