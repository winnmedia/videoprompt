// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import Link from 'next/link';

export default function Custom500() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8 text-center">
      <h1 className="mb-2 text-4xl font-bold text-gray-900">서버 오류</h1>
      <p className="mb-6 text-gray-600">서버에서 오류가 발생했습니다.</p>
      <Link
        href="/"
        className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}