'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/widgets';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

/**
 * LayoutWrapper - 클라이언트 측 레이아웃 래퍼
 * useState를 사용한 사이드바 상태 관리
 * 모바일 반응형 고려 (기본 접힌 상태)
 */
export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // 모바일 디바이스 감지 및 사이드바 초기 상태 설정
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // 모바일에서는 기본적으로 접힌 상태
      if (mobile) {
        setIsSidebarCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 사이드바 토글 핸들러
  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // 키보드 네비게이션 지원
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + B로 사이드바 토글
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        handleSidebarToggle();
      }
      // ESC로 모바일에서 사이드바 닫기
      if (event.key === 'Escape' && isMobile && !isSidebarCollapsed) {
        setIsSidebarCollapsed(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarCollapsed, isMobile]);

  return (
    <div className="flex h-full min-h-screen">
      {/* 사이드바 */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={handleSidebarToggle}
      />

      {/* 모바일 오버레이 */}
      {isMobile && !isSidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsSidebarCollapsed(true)}
          aria-hidden="true"
        />
      )}

      {/* 메인 콘텐츠 */}
      <main
        className={`
          flex-1 transition-all duration-300 min-h-screen
          ${isSidebarCollapsed ? 'ml-16' : 'ml-64'}
          ${isMobile ? '!ml-0' : ''}
        `}
        role="main"
        aria-label="메인 콘텐츠"
      >
        {children}
      </main>
    </div>
  );
}