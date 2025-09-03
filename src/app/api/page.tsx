import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API | VideoPrompt',
  description: 'VideoPrompt API 문서 및 사용 가이드',
};

export default function ApiPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            🔌 API
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            VideoPrompt API 문서 및 사용 가이드
          </p>
        </div>

        <div className="mt-12 rounded-lg bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900">📋 API 개요</h2>
          <p className="mt-4 text-gray-600">
            VideoPrompt API는 RESTful API를 제공하며, JSON 형식으로 데이터를 주고받습니다.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900">🔐 인증</h3>
            <p className="mt-2 text-gray-600">
              JWT 토큰을 사용한 인증 시스템
            </p>
            <div className="mt-4">
              <code className="rounded bg-gray-100 px-2 py-1 text-sm">
                Authorization: Bearer {'<token>'}
              </code>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900">📊 응답 형식</h3>
            <p className="mt-2 text-gray-600">
              모든 API 응답은 표준 형식을 따릅니다
            </p>
            <div className="mt-4">
              <code className="rounded bg-gray-100 px-2 py-1 text-sm">
                {`{ "success": true, "data": {...} }`}
              </code>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-lg bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900">🚀 주요 엔드포인트</h2>
          <div className="mt-6 space-y-4">
            <div className="border-l-4 border-primary-500 bg-primary-50 p-4">
              <h3 className="font-semibold text-gray-900">POST /api/auth/register</h3>
              <p className="text-sm text-gray-600">사용자 회원가입</p>
            </div>
            <div className="border-l-4 border-primary-500 bg-primary-50 p-4">
              <h3 className="font-semibold text-gray-900">POST /api/auth/login</h3>
              <p className="text-sm text-gray-600">사용자 로그인</p>
            </div>
            <div className="border-l-4 border-primary-500 bg-primary-50 p-4">
              <h3 className="font-semibold text-gray-900">POST /api/ai/generate-story</h3>
              <p className="text-sm text-gray-600">AI 스토리 생성</p>
            </div>
            <div className="border-l-4 border-primary-500 bg-primary-50 p-4">
              <h3 className="font-semibold text-gray-900">POST /api/planning/prompt</h3>
              <p className="text-sm text-gray-600">프롬프트 생성</p>
            </div>
            <div className="border-l-4 border-primary-500 bg-primary-50 p-4">
              <h3 className="font-semibold text-gray-900">POST /api/upload/video</h3>
              <p className="text-sm text-gray-600">영상 업로드</p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-lg bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900">📝 사용 예시</h2>
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900">회원가입</h3>
            <pre className="mt-2 overflow-x-auto rounded bg-gray-100 p-4 text-sm">
              <code>{`curl -X POST /api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "username": "user123",
    "password": "password123"
  }'`}</code>
            </pre>
          </div>
        </div>

        <div className="mt-8 rounded-lg bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900">🛠️ 개발자 도구</h2>
          <p className="mt-4 text-gray-600">
            API 테스트를 위한 도구들을 제공합니다.
          </p>
          <div className="mt-4">
            <a
              href="/admin"
              className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              관리자 도구
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
