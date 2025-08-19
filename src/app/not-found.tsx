import Link from 'next/link';

export default function NotFound() {
	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8 text-center">
			<h1 className="text-4xl font-bold text-gray-900 mb-2">페이지를 찾을 수 없습니다</h1>
			<p className="text-gray-600 mb-6">요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
			<Link href="/" className="text-primary-600 hover:text-primary-700 font-medium">
				홈으로 돌아가기
			</Link>
		</div>
	);
}


