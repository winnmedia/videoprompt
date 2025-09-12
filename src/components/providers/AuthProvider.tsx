'use client';

/**
 * 인증 시스템 초기화 프로바이더
 * CLAUDE.md 아키텍처 원칙에 따른 클린한 의존성 주입
 */

import { useEffect } from 'react';
import { initializeAuth } from '@/shared/store/auth-setup';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  useEffect(() => {
    // 🔥 401 오류 해결: 앱 시작 시 인증 시스템 초기화
    initializeAuth();
  }, []);

  return <>{children}</>;
}