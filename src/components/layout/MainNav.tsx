"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSoftPrefetch } from '@/shared/lib/prefetch';
import { useAuthStore } from '@/shared/store/useAuthStore';

const items = [
  { href: '/', label: '홈' },
  { href: '/scenario', label: 'AI 영상 기획' },
  { href: '/prompt-generator', label: '프롬프트 생성기' },
  // { href: '/workflow', label: 'AI 영상 생성' }, // 일시 비활성화 - VEO3 비용 절감
  { href: '/feedback', label: '영상 피드백' },
  { href: '/planning', label: '콘텐츠 관리' },
];

export function MainNav() {
  const pathname = usePathname() || '';
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();

  // 🔥 401 오류 해결: 중복 인증 체크 제거
  // Header.tsx에서 이미 checkAuth()를 호출하므로 중복 호출 방지

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

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
      
      {/* 사용자 메뉴 */}
      <div className="ml-4 flex items-center gap-2">
        {isLoading ? (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"></div>
        ) : isAuthenticated && user ? (
          <div className="flex items-center gap-3">
            {/* 사용자 정보 */}
            <div className="flex items-center gap-2">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="h-6 w-6 rounded-full"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-brand-100 flex items-center justify-center">
                  <span className="text-brand-600 font-medium text-xs">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-gray-700 font-medium">{user.username}</span>
              {user.role === 'admin' && (
                <span className="bg-danger-100 text-danger-600 px-2 py-1 rounded-full text-xs font-medium">
                  관리자
                </span>
              )}
            </div>

            {/* 관리자 메뉴 */}
            {user.role === 'admin' && (
              <Link href="/admin" className="rounded border px-3 py-1 text-gray-800 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
                관리자
              </Link>
            )}

            {/* 큐 관리 */}
            <Link href="/queue" className="rounded border px-3 py-1 text-gray-800 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
              큐 관리
            </Link>

            {/* 로그아웃 */}
            <button
              onClick={handleLogout}
              className="rounded border px-3 py-1 text-gray-800 hover:text-danger-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-400"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <>
            <Link href="/register" prefetch={false} className="rounded border px-3 py-1 text-gray-800 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">회원가입</Link>
            <Link href="/login" prefetch={false} className="rounded border px-3 py-1 text-gray-800 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">로그인</Link>
          </>
        )}
      </div>
    </nav>
  );
}


