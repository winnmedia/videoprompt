/**
 * NotFound - 404 에러 페이지
 * 사용자가 존재하지 않는 페이지에 접근할 때 표시
 */

import Link from 'next/link';
import { Button } from '@/shared/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold text-gray-900">404</h1>
        <h2 className="mb-6 text-2xl font-semibold text-gray-700">
          페이지를 찾을 수 없습니다
        </h2>
        <p className="mb-8 text-gray-600">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
        </p>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link href="/">
            <Button>홈으로 돌아가기</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">대시보드로 가기</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
