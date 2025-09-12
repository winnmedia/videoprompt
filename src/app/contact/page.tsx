import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '문의 | VideoPrompt',
  description: 'VideoPrompt 서비스 문의 및 지원',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            📞 문의
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            VideoPrompt 서비스에 대한 문의사항이 있으시면 언제든 연락주세요
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <div className="rounded-lg bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900">💬 문의하기</h2>
            <p className="mt-4 text-gray-600">
              서비스 사용 중 궁금한 점이나 문제가 있으시면 언제든 문의해주세요.
            </p>
            
            <div className="mt-6 space-y-4">
              <div>
                <h3 className="font-medium text-gray-900">📧 이메일</h3>
                <p className="text-gray-600">support@videoprompt.com</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">⏰ 응답 시간</h3>
                <p className="text-gray-600">평일 24시간 이내</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900">🆘 지원</h2>
            <p className="mt-4 text-gray-600">
              기술적 문제나 버그 신고는 빠른 해결을 위해 상세한 정보를 포함해주세요.
            </p>
            
            <div className="mt-6 space-y-4">
              <div>
                <h3 className="font-medium text-gray-900">🐛 버그 신고</h3>
                <p className="text-gray-600">발생한 문제와 재현 단계를 알려주세요</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">💡 기능 요청</h3>
                <p className="text-gray-600">새로운 기능이나 개선사항을 제안해주세요</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 rounded-lg bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900">❓ 자주 묻는 질문</h2>
          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                서비스 사용 중 오류가 발생했어요
              </h3>
              <p className="mt-2 text-gray-600">
                브라우저를 새로고침하거나 캐시를 삭제한 후 다시 시도해보세요. 
                문제가 지속되면 오류 메시지와 함께 문의해주세요.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                AI 생성 결과가 만족스럽지 않아요
              </h3>
              <p className="mt-2 text-gray-600">
                프롬프트를 더 구체적으로 작성하거나 다른 전개 방식을 시도해보세요. 
                여러 번 시도하면 더 나은 결과를 얻을 수 있습니다.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                계정을 삭제하고 싶어요
              </h3>
              <p className="mt-2 text-gray-600">
                계정 삭제는 관리자에게 문의해주세요. 
                개인정보는 즉시 삭제되며 복구가 불가능합니다.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 rounded-lg bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900">🔗 유용한 링크</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <a
              href="/manual"
              className="flex items-center rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
            >
              <div className="text-2xl">📚</div>
              <div className="ml-4">
                <h3 className="font-medium text-gray-900">문서</h3>
                <p className="text-sm text-gray-600">사용 가이드 및 매뉴얼</p>
              </div>
            </a>
            <a
              href="/manual"
              className="flex items-center rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
            >
              <div className="text-2xl">📖</div>
              <div className="ml-4">
                <h3 className="font-medium text-gray-900">매뉴얼</h3>
                <p className="text-sm text-gray-600">단계별 사용 방법</p>
              </div>
            </a>
            <a
              href="/api"
              className="flex items-center rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
            >
              <div className="text-2xl">🔌</div>
              <div className="ml-4">
                <h3 className="font-medium text-gray-900">API</h3>
                <p className="text-sm text-gray-600">개발자 문서</p>
              </div>
            </a>
            <a
              href="/admin"
              className="flex items-center rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
            >
              <div className="text-2xl">🛠️</div>
              <div className="ml-4">
                <h3 className="font-medium text-gray-900">관리자 도구</h3>
                <p className="text-sm text-gray-600">시스템 상태 확인</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
