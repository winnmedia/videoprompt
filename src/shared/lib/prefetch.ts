"use client";
import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 향상된 prefetch 훅 - UX 최적화
 * - Intersection Observer 기반 viewport 감지
 * - 실제 router.prefetch 호출로 성능 향상
 * - 중복 prefetch 방지
 */
export function useSoftPrefetch(href: string) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const router = useRouter();
  const hasPrefetched = useRef(false);

  const handlePrefetch = useCallback(() => {
    if (hasPrefetched.current) return;

    // 실제 prefetch 실행
    router.prefetch(href);
    hasPrefetched.current = true;
  }, [href, router]);

  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;

    // Intersection Observer 설정 (viewport 진입 시 prefetch)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            handlePrefetch();
            observer.disconnect(); // 한 번만 실행
          }
        });
      },
      {
        // 뷰포트 100px 전에 미리 로드
        rootMargin: '100px',
        threshold: 0.1
      }
    );

    observer.observe(element);

    // 호버 시에도 즉시 prefetch (데스크톱 최적화)
    const handleMouseEnter = () => {
      // 마우스 호버 시 즉시 prefetch
      handlePrefetch();
    };

    element.addEventListener('mouseenter', handleMouseEnter, { once: true });

    return () => {
      observer.disconnect();
      element.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [handlePrefetch]);

  return ref;
}

/**
 * 즉각적 클릭 피드백을 위한 훅
 * 클릭 시 50ms 이내 시각적 반응 보장
 */
export function useInstantFeedback() {
  const handleClick = useCallback((callback?: () => void) => {
    return (event: React.MouseEvent) => {
      // 비동기 경계 전에 요소 캡처 (React Synthetic Event 재사용 문제 해결)
      const target = event.currentTarget as HTMLElement;

      // null 체크로 안전성 확보
      if (!target) return;

      // requestAnimationFrame으로 즉시 시각적 피드백
      requestAnimationFrame(() => {
        // 캡처된 요소 사용 (event.currentTarget 대신)
        target.style.transform = 'scale(0.98)';
        target.style.transition = 'transform 100ms ease-out';

        // 100ms 후 원상복구
        setTimeout(() => {
          // 요소가 여전히 DOM에 존재하는지 확인
          if (target.isConnected) {
            target.style.transform = '';
          }
        }, 100);
      });

      // 콜백 실행
      callback?.();
    };
  }, []);

  return handleClick;
}


