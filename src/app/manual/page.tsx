'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';

export default function ManualPage() {
  const [query, setQuery] = useState('');
  const sections = [
    { id: 'getting-started', title: '시작하기', keywords: ['계정', '회원가입', '프로젝트', '첫걸음', '처음'] },
    { id: 'scenario', title: 'AI 시나리오 개발', keywords: ['스토리', '4단계', '12숏', '시나리오', 'PDF'] },
    { id: 'prompt', title: '프롬프트 생성기', keywords: ['키워드', '네거티브', '타임라인', 'JSON', '추천'] },
    { id: 'video', title: '영상 생성', keywords: ['Seedance', 'Veo', '생성', '상태', '제공자'] },
    { id: 'feedback', title: '영상 피드백', keywords: ['코멘트', '공유', '스크린샷', '버전', '타임코드'] },
    { id: 'planning', title: '콘텐츠 관리', keywords: ['검색', '필터', '이미지', '영상', '시나리오'] },
    { id: 'a11y', title: '단축키 & 접근성', keywords: ['단축키', '접근성', 'a11y', '키보드', '테스트'] },
    { id: 'troubleshooting', title: '트러블슈팅', keywords: ['문제', '오류', '업로드', '빌드', '테스트'] },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) =>
      s.title.toLowerCase().includes(q) || (s.keywords || []).some((k) => k.toLowerCase().includes(q))
    );
  }, [query, sections]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <nav className="sticky top-6 space-y-2" aria-label="문서 목차">
            <label htmlFor="manual-search" className="block text-xs font-medium text-gray-700">검색</label>
            <input
              id="manual-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="예: 프롬프트, 영상, 업로드"
              className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-primary-500"
              aria-label="매뉴얼 검색"
            />
            {filtered.map((s) => (
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
          <section id="getting-started" tabIndex={-1} aria-labelledby="getting-started-heading">
            <h1 id="getting-started-heading" className="mb-3 text-3xl font-bold text-gray-900">워크플로우 매뉴얼</h1>
            <p className="mb-6 text-gray-600">
              VLANET의 전체 기능을 빠르게 이해하고 활용할 수 있도록 단계별 가이드를 제공합니다.
            </p>
            <div className="mb-6 rounded-md border border-primary-200 bg-primary-50 p-4 text-sm text-gray-800">
              <p className="mb-2 font-semibold">아주 쉬운 설명</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>오른쪽의 안내를 차례대로 읽고 버튼을 눌러 이동하세요.</li>
                <li>모르겠으면 언제든 아래의 자주 묻는 질문을 참고하세요.</li>
                <li>중요 버튼에는 파란색 강조가 있어요. 그 버튼을 눌러 다음으로 가요.</li>
              </ol>
            </div>
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

          <section id="scenario" tabIndex={-1} aria-labelledby="scenario-heading">
            <h2 id="scenario-heading" className="mb-2 text-2xl font-semibold text-gray-900">AI 시나리오 개발</h2>
            <p className="text-gray-700">
              스토리 입력 → 4단계 구성 → 12숏 분해를 거쳐 PDF로 내보낼 수 있습니다. 생성된 데이터는
              프롬프트 생성기에서 이어서 불러옵니다.
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-gray-700">
              <li>상단 메뉴에서 “AI 영상 기획”을 눌러요.</li>
              <li>이야기를 한 줄로 적고, 화면의 안내에 따라 단계를 넘겨요.</li>
              <li>완성되면 “PDF로 내보내기” 버튼을 눌러 저장해요.</li>
            </ol>
          </section>

          <section id="prompt" tabIndex={-1} aria-labelledby="prompt-heading">
            <h2 id="prompt-heading" className="mb-2 text-2xl font-semibold text-gray-900">프롬프트 생성기</h2>
            <p className="text-gray-700">
              4단계 구성 데이터를 불러와 키워드/네거티브/타임라인을 정제합니다. 결과는 구조화된
              JSON으로 복사/다운로드 가능합니다.
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-gray-700">
              <li>“프롬프트 생성기”로 이동해요.</li>
              <li>추천 키워드를 선택하거나 직접 입력해요. 모르면 기본값 그대로 두어도 돼요.</li>
              <li>완성되면 “JSON 복사” 또는 “다운로드”를 눌러 보관해요.</li>
            </ol>
          </section>

          <section id="video" tabIndex={-1} aria-labelledby="video-heading">
            <h2 id="video-heading" className="mb-2 text-2xl font-semibold text-gray-900">영상 생성</h2>
            <p className="text-gray-700">
              최근 프롬프트를 로드하고 제공자(Seedance/Veo3)를 선택해 생성합니다. 생성 상태를
              확인하고 결과를 콘텐츠 관리에서 열람합니다.
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-gray-700">
              <li>“AI 영상 생성”에서 최근 프롬프트를 불러와요.</li>
              <li>제공자(Seedance 또는 Veo3)를 고르고 “생성”을 눌러요.</li>
              <li>잠시 기다린 뒤, 생성이 끝나면 “열기”로 결과를 확인해요.</li>
            </ol>
          </section>

          <section id="feedback" tabIndex={-1} aria-labelledby="feedback-heading">
            <h2 id="feedback-heading" className="mb-2 text-2xl font-semibold text-gray-900">영상 피드백</h2>
            <ul className="list-disc space-y-1 pl-6 text-gray-700">
              <li>플레이어 툴바: 교체, 공유, 스크린샷, 현재 시점 피드백</li>
              <li>버전 스위처: v1/v2/v3 등 선택, 메타데이터 확인</li>
              <li>코멘트: 타임코드 자동 삽입(T 키 또는 버튼)</li>
            </ul>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-gray-700">
              <li>공유 버튼으로 링크를 만들고 팀에게 보내요.</li>
              <li>동영상을 보면서 생각나는 부분에 댓글을 달아요.</li>
              <li>T 키를 누르면 시간표시가 자동으로 들어가요.</li>
            </ol>
          </section>

          <section id="planning" tabIndex={-1} aria-labelledby="planning-heading">
            <h2 id="planning-heading" className="mb-2 text-2xl font-semibold text-gray-900">콘텐츠 관리</h2>
            <p className="text-gray-700">
              탭 구성: AI 시나리오, 프롬프트, 이미지, 영상. 각 탭에서 기본 컬럼 기준으로 정렬/검색을
              활용하세요.
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-gray-700">
              <li>원하는 탭(시나리오/프롬프트/이미지/영상)을 눌러요.</li>
              <li>상단의 검색창과 필터로 원하는 항목을 빨리 찾아요.</li>
              <li>필요하면 항목을 선택해 수정하거나 다운로드해요.</li>
            </ol>
          </section>

          <section id="a11y" tabIndex={-1} aria-labelledby="a11y-heading">
            <h2 id="a11y-heading" className="mb-2 text-2xl font-semibold text-gray-900">단축키 & 접근성</h2>
            <ul className="list-disc space-y-1 pl-6 text-gray-700">
              <li>T: 현재 타임코드 코멘트에 삽입</li>
              <li>폼 요소: id/htmlFor 지정, 테스트용 data-testid 사용</li>
            </ul>
          </section>

          <section id="troubleshooting" tabIndex={-1} aria-labelledby="troubleshooting-heading">
            <h2 id="troubleshooting-heading" className="mb-2 text-2xl font-semibold text-gray-900">트러블슈팅</h2>
            <ul className="list-disc space-y-1 pl-6 text-gray-700">
              <li>업로드 실패: 파일 용량/코덱/형식 확인 후 재시도</li>
              <li>빌드/테스트: E2E 스모크, 셀렉터 안정화(id/htmlFor, data-testid)</li>
            </ul>
            <details className="mt-3 rounded-md border border-gray-200 p-3">
              <summary className="cursor-pointer text-sm font-medium text-gray-800">자주 묻는 질문(펼치기)</summary>
              <div className="mt-2 space-y-2 text-sm text-gray-700">
                <p><span className="font-semibold">Q.</span> 버튼이 안 눌려요.<br />
                <span className="font-semibold">A.</span> 화면을 새로고침하고, 인터넷이 연결되어 있는지 확인하세요.</p>
                <p><span className="font-semibold">Q.</span> 영상이 안 떠요.<br />
                <span className="font-semibold">A.</span> 조금만 더 기다리거나, 콘텐츠 관리의 영상 탭에서 상태를 확인하세요.</p>
                <p><span className="font-semibold">Q.</span> 어디서 시작하나요?<br />
                <span className="font-semibold">A.</span> 상단의 “무료로 시작하기” 또는 “AI 영상 기획”을 먼저 눌러요.</p>
              </div>
            </details>
          </section>
        </main>
      </div>
    </div>
  );
}
