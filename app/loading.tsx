/**
 * 글로벌 로딩 컴포넌트
 * 페이지 전환 시 표시되는 로딩 스피너
 *
 * CLAUDE.md 원칙:
 * - 심플한 네온 애니메이션 효과
 * - 접근성 고려 (aria-label)
 */
export default function Loading() {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="flex flex-col items-center space-y-4">
        {/* 네온 스피너 */}
        <div className="spinner" aria-label="로딩 중"></div>

        {/* 로딩 텍스트 */}
        <p className="text-gray-400 text-sm animate-pulse">
          처리 중입니다...
        </p>
      </div>
    </div>
  );
}