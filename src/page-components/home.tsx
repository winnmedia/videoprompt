/**
 * Home Page Component - FSD Pages Layer
 *
 * CLAUDE.md 준수사항:
 * - FSD pages 레이어 컴포넌트
 * - 대시보드 UI/UX 구현
 * - 접근성 WCAG 2.1 AA 준수
 * - 반응형 디자인
 * - Core Web Vitals 성능 최적화
 * - data-testid 네이밍 규약
 */

import type { Metadata } from 'next'
import Link from 'next/link'

// Shared UI 컴포넌트 (FSD Public API 준수)
import { Button, Card } from '../shared/ui'

export const metadata: Metadata = {
  title: '대시보드',
  description: 'VideoPlanet 대시보드 - 영상 프로젝트 관리 및 시작',
}

/**
 * 홈페이지/대시보드 컴포넌트
 *
 * 메인 랜딩 대시보드로 사용자가 다음을 할 수 있습니다:
 * - 새 프로젝트 시작
 * - 최근 프로젝트 확인
 * - 주요 기능 바로가기
 * - 시스템 상태 확인
 */
export function HomePage() {
  // 임시 데이터 (실제로는 API에서 가져올 것)
  const recentProjects = [
    { id: 1, name: '여행 브이로그', status: '진행중', updatedAt: '2시간 전' },
    { id: 2, name: '제품 소개 영상', status: '완료', updatedAt: '1일 전' },
    { id: 3, name: '요리 레시피', status: '초안', updatedAt: '3일 전' },
  ]

  const quickActions = [
    {
      title: '새 시나리오 작성',
      description: '새로운 영상 시나리오를 처음부터 만들어보세요',
      href: '/scenario',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 2h10a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2z" />
        </svg>
      ),
      color: 'primary'
    },
    {
      title: 'AI 프롬프트 생성',
      description: '강력한 AI 프롬프트를 자동으로 생성하세요',
      href: '/prompt-generator',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: 'secondary'
    },
    {
      title: '워크플로우 시작',
      description: '단계별 가이드로 영상을 만들어보세요',
      href: '/wizard',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'tertiary'
    },
    {
      title: '콘텐츠 관리',
      description: '업로드한 영상과 자료를 관리하세요',
      href: '/integrations',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      color: 'neutral'
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 섹션 */}
        <section className="mb-12" aria-labelledby="welcome-title">
          <div className="text-center">
            <h1
              id="welcome-title"
              className="text-4xl font-bold text-neutral-900 mb-4 sm:text-5xl lg:text-6xl"
            >
              VideoPlanet에 오신 것을 환영합니다
            </h1>
            <p className="text-xl text-neutral-600 max-w-3xl mx-auto mb-8">
              AI 기반 영상 기획부터 제작까지, 모든 과정을 한 곳에서 관리하세요.
              <br />
              전문적인 영상을 쉽고 빠르게 만들어보세요.
            </p>

            {/* CTA 버튼들 */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                size="lg"
                className="text-lg px-8 py-4"
                data-testid="home-cta-scenario"
              >
                <Link href="/scenario">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  새 프로젝트 시작
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="text-lg px-8 py-4"
                data-testid="home-cta-manual"
              >
                <Link href="/manual">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  사용법 보기
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* 주요 기능 카드 섹션 */}
        <section className="mb-12" aria-labelledby="quick-actions-title">
          <h2
            id="quick-actions-title"
            className="text-2xl font-bold text-neutral-900 mb-8 text-center"
          >
            빠른 시작
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickActions.map((action, index) => (
              <Card
                key={action.title}
                className="p-6 hover:shadow-lg transition-all duration-200 group"
                data-testid={`home-quick-action-${index}`}
              >
                <Link
                  href={action.href}
                  className="block focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-lg"
                >
                  <div className="text-primary-600 group-hover:text-primary-700 mb-4">
                    {action.icon}
                  </div>

                  <h3 className="text-lg font-semibold text-neutral-900 mb-2 group-hover:text-primary-700">
                    {action.title}
                  </h3>

                  <p className="text-neutral-600 text-sm leading-relaxed">
                    {action.description}
                  </p>

                  <div className="mt-4 text-primary-600 group-hover:text-primary-700 text-sm font-medium">
                    시작하기 →
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        </section>

        {/* 최근 프로젝트 섹션 */}
        <section className="mb-12" aria-labelledby="recent-projects-title">
          <div className="flex justify-between items-center mb-6">
            <h2
              id="recent-projects-title"
              className="text-2xl font-bold text-neutral-900"
            >
              최근 프로젝트
            </h2>

            <Button
              asChild
              variant="outline"
              size="sm"
              data-testid="home-view-all-projects"
            >
              <Link href="/projects">
                모든 프로젝트 보기
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {recentProjects.map((project) => (
              <Card
                key={project.id}
                className="p-6 hover:shadow-md transition-shadow duration-200"
                data-testid={`home-recent-project-${project.id}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-neutral-900">
                    {project.name}
                  </h3>

                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      project.status === '완료'
                        ? 'bg-green-100 text-green-800'
                        : project.status === '진행중'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {project.status}
                  </span>
                </div>

                <p className="text-neutral-500 text-sm mb-4">
                  마지막 수정: {project.updatedAt}
                </p>

                <div className="flex gap-2">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="flex-1"
                  >
                    <Link href={`/projects/${project.id}`}>
                      열기
                    </Link>
                  </Button>

                  <Button
                    asChild
                    size="sm"
                    className="flex-1"
                  >
                    <Link href={`/projects/${project.id}/edit`}>
                      편집
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {recentProjects.length === 0 && (
            <Card className="p-12 text-center">
              <div className="w-16 h-16 mx-auto text-neutral-400 mb-4">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 2h10a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2z" />
                </svg>
              </div>

              <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                프로젝트가 없습니다
              </h3>

              <p className="text-neutral-600 mb-6">
                첫 번째 영상 프로젝트를 시작해보세요!
              </p>

              <Button asChild>
                <Link href="/scenario">
                  새 프로젝트 만들기
                </Link>
              </Button>
            </Card>
          )}
        </section>

        {/* 도움말 섹션 */}
        <section className="text-center py-12 border-t border-neutral-200" aria-labelledby="help-title">
          <h2
            id="help-title"
            className="text-xl font-semibold text-neutral-900 mb-4"
          >
            도움이 필요하신가요?
          </h2>

          <p className="text-neutral-600 mb-6 max-w-2xl mx-auto">
            VideoPlanet 사용법이 궁금하시거나 문제가 있으시면 언제든 도움을 요청하세요.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild variant="outline">
              <Link href="/manual">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                사용자 매뉴얼
              </Link>
            </Button>

            <Button asChild variant="outline">
              <Link href="/feedback">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                피드백 보내기
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}