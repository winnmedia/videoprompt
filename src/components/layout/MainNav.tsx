"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSoftPrefetch } from '@/shared/lib/prefetch';

const items = [
  { href: '/', label: '홈' },
  { href: '/scenario', label: 'AI 영상 기획' },
  { href: '/prompt-generator', label: '프롬프트 생성기' },
  { href: '/workflow', label: 'AI 영상 생성' },
  { href: '/feedback', label: '영상 피드백' },
  { href: '/planning', label: '콘텐츠 관리' },
];

export function MainNav() {
  const pathname = usePathname() || '';
  return (
    <nav className="hidden items-center space-x-6 text-sm md:flex" data-testid="main-nav" aria-label="주요 내비게이션">
      {items.map(({ href, label }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(href));
        const ref = useSoftPrefetch(href);
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            ref={ref}
            aria-current={active ? 'page' : undefined}
            className={`px-2 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
              active ? 'text-brand-700 underline underline-offset-4' : 'text-gray-900 hover:text-brand-600'
            }`}
          >
            {label}
          </Link>
        );
      })}
      <Link href="/login" prefetch={false} className="ml-4 rounded border px-3 py-1 text-gray-800 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">로그인</Link>
    </nav>
  );
}


