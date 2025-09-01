'use client';

import Link from 'next/link';

export default function ManualPage() {
  const sections = [
    { id: 'getting-started', title: '시작하기' },
    { id: 'scenario', title: 'AI 시나리오 개발' },
    { id: 'prompt', title: '프롬프트 생성기' },
    { id: 'video', title: '영상 생성' },
    { id: 'feedback', title: '영상 피드백' },
    { id: 'planning', title: '콘텐츠 관리' },
    { id: 'a11y', title: '단축키 & 접근성' },
    { id: 'troubleshooting', title: '트러블슈팅' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <nav className="sticky top-6 space-y-2" aria-label="문서 목차">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block text-sm text-gray-600 hover:text-primary-600"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        <main className="space-y-12 lg:col-span-3">
          <section id="getting-started">
            <h1 className="mb-3 text-3xl font-bold text-gray-900">워크플로우 매뉴얼</h1>
            <p className="mb-6 text-gray-600">
              VLANET의 전체 기능을 빠르게 이해하고 활용할 수 있도록 단계별 가이드를 제공합니다.
            </p>
            <div className="space-x-3">
              <Link href="/scenario" className="text-primary-600 hover:underline">
                AI 영상 기획으로 이동
              </Link>
              <Link href="/prompt-generator" className="text-primary-600 hover:underline">
                프롬프트 생성기로 이동
              </Link>
              <Link href="/feedback" className="text-primary-600 hover:underline">
                영상 피드백으로 이동
              </Link>
            </div>
          </section>

          <section id="scenario">
            <h2 className="mb-2 text-2xl font-semibold text-gray-900">AI 시나리오 개발</h2>
            <p className="text-gray-700">
              스토리 입력 → 4단계 구성 → 12숏 분해를 거쳐 PDF로 내보낼 수 있습니다. 생성된 데이터는
              프롬프트 생성기에서 이어서 불러옵니다.
            </p>
          </section>

          <section id="prompt">
            <h2 className="mb-2 text-2xl font-semibold text-gray-900">프롬프트 생성기</h2>
            <p className="text-gray-700">
              4단계 구성 데이터를 불러와 키워드/네거티브/타임라인을 정제합니다. 결과는 구조화된
              JSON으로 복사/다운로드 가능합니다.
            </p>
          </section>

          <section id="video">
            <h2 className="mb-2 text-2xl font-semibold text-gray-900">영상 생성</h2>
            <p className="text-gray-700">
              최근 프롬프트를 로드하고 제공자(Seedance/Veo3)를 선택해 생성합니다. 생성 상태를
              확인하고 결과를 콘텐츠 관리에서 열람합니다.
            </p>
          </section>

          <section id="feedback">
            <h2 className="mb-2 text-2xl font-semibold text-gray-900">영상 피드백</h2>
            <ul className="list-disc space-y-1 pl-6 text-gray-700">
              <li>플레이어 툴바: 교체, 공유, 스크린샷, 현재 시점 피드백</li>
              <li>버전 스위처: v1/v2/v3 등 선택, 메타데이터 확인</li>
              <li>코멘트: 타임코드 자동 삽입(T 키 또는 버튼)</li>
            </ul>
          </section>

          <section id="planning">
            <h2 className="mb-2 text-2xl font-semibold text-gray-900">콘텐츠 관리</h2>
            <p className="text-gray-700">
              탭 구성: AI 시나리오, 프롬프트, 이미지, 영상. 각 탭에서 기본 컬럼 기준으로 정렬/검색을
              활용하세요.
            </p>
          </section>

          <section id="a11y">
            <h2 className="mb-2 text-2xl font-semibold text-gray-900">단축키 & 접근성</h2>
            <ul className="list-disc space-y-1 pl-6 text-gray-700">
              <li>T: 현재 타임코드 코멘트에 삽입</li>
              <li>폼 요소: id/htmlFor 지정, 테스트용 data-testid 사용</li>
            </ul>
          </section>

          <section id="troubleshooting">
            <h2 className="mb-2 text-2xl font-semibold text-gray-900">트러블슈팅</h2>
            <ul className="list-disc space-y-1 pl-6 text-gray-700">
              <li>업로드 실패: 파일 용량/코덱/형식 확인 후 재시도</li>
              <li>빌드/테스트: E2E 스모크, 셀렉터 안정화(id/htmlFor, data-testid)</li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
