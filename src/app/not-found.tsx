import Link from 'next/link';

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8 text-center">
      <h1 className="mb-2 text-4xl font-bold text-gray-900">페이지를 찾을 수 없습니다</h1>
      <p className="mb-6 text-gray-600">요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
      <Link href="/" className="font-medium text-primary-600 hover:text-primary-700">
        홈으로 돌아가기
      </Link>
    </div>
  );
}
