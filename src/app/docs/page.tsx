import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '문서 | VideoPrompt',
  description: 'VideoPrompt 서비스 사용 가이드 및 API 문서',
};

export const dynamic = 'force-static';

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            📚 문서
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            VideoPrompt 서비스 사용 가이드
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900">🚀 시작하기</h2>
            <p className="mt-4 text-gray-600">
              VideoPrompt를 처음 사용하시나요? 기본 사용법을 알아보세요.
            </p>
            <div className="mt-4">
              <a
                href="/manual"
                className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                매뉴얼 보기
              </a>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900">🎬 시나리오 작성</h2>
            <p className="mt-4 text-gray-600">
              AI를 활용한 시나리오 작성 방법을 배워보세요.
            </p>
            <div className="mt-4">
              <a
                href="/scenario"
                className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                시나리오 작성하기
              </a>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900">🎥 영상 생성</h2>
            <p className="mt-4 text-gray-600">
              AI를 활용한 영상 생성 워크플로우를 확인하세요.
            </p>
            <div className="mt-4">
              <a
                href="/workflow"
                className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                워크플로우 보기
              </a>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900">💬 피드백</h2>
            <p className="mt-4 text-gray-600">
              팀원들과 영상에 대한 피드백을 공유하세요.
            </p>
            <div className="mt-4">
              <a
                href="/feedback"
                className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                피드백 보기
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 rounded-lg bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900">❓ 자주 묻는 질문</h2>
          <div className="mt-6 space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                VideoPrompt는 어떤 서비스인가요?
              </h3>
              <p className="mt-2 text-gray-600">
                AI를 활용하여 시나리오를 작성하고 영상을 생성할 수 있는 플랫폼입니다.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                무료로 사용할 수 있나요?
              </h3>
              <p className="mt-2 text-gray-600">
                네, 기본 기능은 무료로 사용하실 수 있습니다.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                어떤 AI 모델을 사용하나요?
              </h3>
              <p className="mt-2 text-gray-600">
                GPT-4, Gemini 등 다양한 AI 모델을 활용합니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
