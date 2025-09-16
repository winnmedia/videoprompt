'use client';

/**
 * 인증 시스템 초기화 프로바이더
 * CLAUDE.md 아키텍처 원칙에 따른 클린한 의존성 주입
 * 🚨 $300 사건 방지: useRef로 함수 참조 고정
 */

import { useEffect, useRef } from 'react';
import { initializeAuth } from '@/shared/store/auth-setup';
import { useAuthStore } from '@/shared/store/useAuthStore';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { checkAuth } = useAuthStore();

  // 🚨 $300 사건 방지: 함수 참조를 useRef로 고정하여 무한 렌더링 방지
  const checkAuthRef = useRef(checkAuth);
  checkAuthRef.current = checkAuth;

  // 초기화가 완료되었는지 추적
  const initializeRef = useRef(false);

  useEffect(() => {
    // 이미 초기화된 경우 중복 실행 방지
    if (initializeRef.current) {
      console.log('🚨 AuthProvider: Already initialized, skipping...');
      return;
    }

    console.log('🔥 AuthProvider: Initializing auth system...');

    // 🔥 401 오류 해결: 앱 시작 시 인증 시스템 초기화
    initializeAuth();

    // 초기 인증 상태 확인 (한 번만)
    checkAuthRef.current();

    // 초기화 완료 표시
    initializeRef.current = true;
  }, []); // 🚨 빈 의존성 배열로 한 번만 실행 보장

  return <>{children}</>;
}