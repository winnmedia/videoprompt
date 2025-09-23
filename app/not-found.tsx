import Link from 'next/link';

/**
 * 404 페이지
 * 존재하지 않는 경로 접근 시 표시
 *
 * CLAUDE.md 원칙:
 * - 서버 컴포넌트로 구현
 * - 친화적인 404 메시지
 * - 명확한 네비게이션 제공
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center">
        {/* 404 타이틀 */}
        <h1 className="text-9xl font-bold text-gradient mb-4">404</h1>

        {/* 메시지 */}
        <h2 className="text-3xl font-bold text-white mb-4">
          페이지를 찾을 수 없습니다
        </h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
          URL을 다시 확인해주세요.
        </p>

        {/* 액션 버튼들 */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="btn-neon px-8 py-3 rounded-lg font-medium inline-block"
          >
            홈으로 돌아가기
          </Link>
          <Link
            href="/contents"
            className="px-8 py-3 rounded-lg font-medium border border-gray-700 hover:bg-gray-900 transition-colors inline-block"
          >
            내 콘텐츠 보기
          </Link>
        </div>

        {/* 추가 도움말 */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <p className="text-sm text-gray-500">
            계속 문제가 발생한다면{' '}
            <a
              href="mailto:support@vlanet.io"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              지원팀에 문의
            </a>
            해주세요.
          </p>
        </div>
      </div>
    </div>
  );
}