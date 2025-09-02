"use client";
import { useEffect, useRef } from 'react';

export function useSoftPrefetch(href: string) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const a = ref.current;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          // next/link는 자동 prefetch가 있어도 network idle을 고려해 소극적으로 동작함
          // 여기서는 단순히 touch를 주는 용도로 사용(필요시 router.prefetch로 확장)
          io.disconnect();
        }
      });
    });
    io.observe(a);
    return () => io.disconnect();
  }, [href]);
  return ref;
}


