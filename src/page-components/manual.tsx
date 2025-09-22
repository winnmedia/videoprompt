/**
 * Workflow Manual Page Component - FSD Pages Layer
 *
 * FRD.md 워크플로우 매뉴얼 페이지 명세 구현:
 * - 8개 핵심 섹션 (앵커 네비게이션 포함)
 * - 좌측 고정 사이드바 + 우측 메인 콘텐츠 레이아웃
 * - 상단 브레드크럼 + 페이지 내 검색
 * - 딥링크 버튼 및 키보드 네비게이션
 * - 접근성 WCAG 2.1 AA 준수
 * - data-testid 네이밍 규약
 */

'use client';

import type { Metadata } from 'next'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'

// Shared UI 컴포넌트 (FSD Public API 준수)
import { Button, Card, Input } from '../shared/ui'

export const metadata: Metadata = {
  title: '워크플로우 매뉴얼 | VLANET',
  description: 'VLANET 워크플로우 매뉴얼 - AI 영상 기획부터 피드백까지 전체 프로세스 단계별 가이드',
}

// 매뉴얼 섹션 타입 정의
interface ManualSection {
  id: string
  title: string
  description: string
  content: string[]
  deepLinks?: Array<{
    label: string
    href: string
    description: string
  }>
  screenshots?: Array<{
    alt: string
    caption: string
  }>
}

// 사이드바 네비게이션 아이템 타입
interface NavItem {
  id: string
  title: string
  anchor: string
  level: number // 0: 메인 섹션, 1: 서브 섹션
}

/**
 * 워크플로우 매뉴얼 페이지 컴포넌트
 *
 * FRD.md 명세에 따른 8개 핵심 섹션과 기능:
 * 1. 시작하기 - 계정/프로젝트 생성, 전역 테마, 네비 구조
 * 2. AI 시나리오 개발 - 스토리 입력 → 4단계 구성 → 12숏 분해, PDF 내보내기
 * 3. 프롬프트 생성기 - 4단계 구성 데이터 로드, 키워드/타임라인 정제, JSON 출력
 * 4. 영상 생성 - 최신 프롬프트 로드, 제공자 선택, 상태 조회
 * 5. 영상 피드백 - 플레이어 툴바, 버전 스위처, 코멘트 범위
 * 6. 콘텐츠 관리 - 탭별 기본 컬럼, 필터 예시
 * 7. 단축키 & 접근성 - T(타임코드), 폼 id/htmlFor, data-testid 활용
 * 8. 트러블슈팅 - 업로드 실패 사유, 빌드/테스트 체크리스트
 */
export function ManualPage() {
  // 상태 관리
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSection, setActiveSection] = useState('getting-started')
  const [filteredSections, setFilteredSections] = useState<ManualSection[]>([])

  // Refs
  const mainContentRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 8개 핵심 섹션 데이터 (FRD.md 명세)
  const manualSections: ManualSection[] = [
    {
      id: 'getting-started',
      title: '시작하기',
      description: '계정/프로젝트 생성, 전역 테마, 네비게이션 구조',
      content: [
        '게스트 계정으로 바로 시작하기 - 별도 회원가입 없이 첫 진입 시 자동 계정 생성',
        '프로젝트 생성 및 기본 설정 - 제목, 설명, 프로젝트 타입 선택',
        '전역 네비게이션 이해하기 - 홈, AI 영상 기획, 프롬프트 생성기, 영상 생성, 영상 피드백, 콘텐츠 관리',
        '브랜딩 요소 확인 - VLANET 로고 및 일관된 디자인 시스템',
        '데이터 지속성 및 세션 관리 - 30일 자동 갱신, 브라우저별 독립 세션'
      ],
      deepLinks: [
        { label: 'AI 영상 기획 시작하기', href: '/scenario', description: '첫 시나리오 작성해보기' },
        { label: '홈 대시보드', href: '/', description: '프로젝트 현황 확인' }
      ],
      screenshots: [
        { alt: '홈 대시보드 스크린샷', caption: '메인 대시보드에서 프로젝트 현황을 한눈에 확인' },
        { alt: '네비게이션 메뉴', caption: '좌측 사이드바를 통한 주요 기능 접근' }
      ]
    },
    {
      id: 'ai-scenario',
      title: 'AI 시나리오 개발',
      description: '스토리 입력 → 4단계 구성 → 12숏 분해 → PDF 내보내기(Marp)',
      content: [
        '스토리 입력 단계 - 제목, 로그라인, 톤앤매너, 전개 방식 설정',
        '4단계 구성 자동 생성 - Google Gemini API 기반 구조화된 스토리텔링',
        '4단계 검토 및 수정 - 인라인 편집을 통한 세부 조정',
        '12개 숏트 자동 분해 - 각 단계별 촬영 계획 상세화',
        '콘티 이미지 생성 - ByteDance-Seedream-4.0 기반 시각화',
        'PDF 내보내기 - Marp 기반 A4 가로 프레젠테이션 포맷'
      ],
      deepLinks: [
        { label: 'AI 시나리오 개발 시작', href: '/scenario', description: '새로운 시나리오 프로젝트 생성' },
        { label: '시나리오 템플릿', href: '/scenario?template=basic', description: '기본 템플릿으로 빠른 시작' }
      ],
      screenshots: [
        { alt: '시나리오 입력 폼', caption: '직관적인 단계별 시나리오 입력 인터페이스' },
        { alt: '4단계 구성 편집기', caption: '생성된 4단계 구조를 실시간으로 편집' },
        { alt: '12숏 그리드 뷰', caption: '3x4 그리드로 구성된 12개 숏트 관리 화면' }
      ]
    },
    {
      id: 'prompt-generator',
      title: '프롬프트 생성기',
      description: '4단계 구성 데이터 로드 → 키워드/타임라인 정제 → JSON 출력',
      content: [
        '시나리오 데이터 로드 - 기존 4단계 구성을 프롬프트 생성기로 가져오기',
        'VLANET v1.0 스키마 적용 - 표준 프롬프트 구조 변환',
        '브랜드 정책 프로파일 - 잠금 필드, negative prompt 자동 적용',
        '키워드 및 스타일 태그 정제 - AI 기반 키워드 최적화 제안',
        '타임라인 세그먼트 구성 - 동적 타이밍 및 연출 설정',
        'JSON/텍스트 내보내기 - 완성된 프롬프트 다운로드'
      ],
      deepLinks: [
        { label: '프롬프트 생성기', href: '/prompt-generator', description: '새 프롬프트 프로젝트 시작' },
        { label: '브랜드 정책 설정', href: '/prompt-generator?tab=brand', description: '브랜드 가이드라인 적용' }
      ],
      screenshots: [
        { alt: '프롬프트 생성기 메인', caption: '체계적인 프롬프트 구성 도구' },
        { alt: '키워드 태그 편집기', caption: '드래그앤드롭으로 키워드 조합' },
        { alt: 'JSON 내보내기 모달', caption: '완성된 프롬프트를 다양한 형식으로 내보내기' }
      ]
    },
    {
      id: 'video-generation',
      title: '영상 생성',
      description: '최신 프롬프트 로드 → 제공자(Seedance/Veo3) 선택 → 상태 조회',
      content: [
        '프롬프트 데이터 로드 - 최신 완성된 프롬프트 자동 가져오기',
        '영상 제공자 선택 - Seedance, Veo3, StableVideo 중 선택',
        '생성 옵션 설정 - 해상도, 길이, 스타일 파라미터 조정',
        '큐 관리 시스템 - 순차 처리 및 우선순위 설정',
        '실시간 진행률 모니터링 - 5초 간격 상태 업데이트',
        '자동 재시도 로직 - 실패 시 최대 3회 재시도, 지수 백오프'
      ],
      deepLinks: [
        { label: '영상 생성 워크플로우', href: '/workflow', description: '새 영상 생성 프로젝트' },
        { label: '생성 상태 모니터링', href: '/workflow?tab=status', description: '진행 중인 작업 확인' }
      ],
      screenshots: [
        { alt: '영상 생성 설정', caption: '제공자별 상세 옵션 설정 인터페이스' },
        { alt: '진행률 모니터', caption: '실시간 생성 진행 상황 추적' },
        { alt: '큐 관리 대시보드', caption: '대기열 및 완료 작업 관리' }
      ]
    },
    {
      id: 'video-feedback',
      title: '영상 피드백',
      description: '플레이어 툴바(교체/공유/스크린샷/타임코드 코멘트) → 버전 스위처 → 코멘트 범위',
      content: [
        '영상 플레이어 - 0.1초 정밀도 타임코드 기반 재생',
        '플레이어 툴바 기능 - 교체, 공유, 스크린샷, 현재시점 피드백',
        '버전 관리 시스템 - v1/v2/v3 다중 영상 슬롯, 메타데이터 추적',
        '타임코드 코멘트 - T 단축키로 현재 시점 피드백 입력',
        '감정 표현 시스템 - 9가지 감정 아이콘으로 빠른 반응',
        'URL 공유 및 QR 코드 - 링크/권한/만료 설정 포함 공유',
        '실시간 협업 - Supabase Realtime 기반 동시 작업'
      ],
      deepLinks: [
        { label: '영상 피드백', href: '/feedback', description: '영상 검토 및 피드백 작성' },
        { label: '협업 프로젝트', href: '/feedback?mode=collaboration', description: '팀과 함께 작업하기' }
      ],
      screenshots: [
        { alt: '영상 피드백 인터페이스', caption: '좌측 플레이어, 우측 코멘트 패널 구성' },
        { alt: '타임코드 코멘트', caption: '정확한 시점의 피드백 입력 및 관리' },
        { alt: '버전 비교 뷰', caption: '여러 버전의 영상을 동시 비교' }
      ]
    },
    {
      id: 'content-management',
      title: '콘텐츠 관리',
      description: '탭별 기본 컬럼(AI 시나리오/프롬프트/이미지/영상) → 필터 및 검색',
      content: [
        'AI 시나리오 탭 - 제목, 버전, 작성자, 업데이트, 4단계/12숏 여부, PDF 다운로드',
        '프롬프트 탭 - 참조 시나리오, 버전, 키워드 수, 타임라인 세그먼트 수, 업데이트',
        '이미지 탭 - 타입(콘티/인서트), 태그, 해상도, 업로더, 업로드일',
        '영상 탭 - 버전, 길이, 코덱, 상태, 제공자, 참조 프롬프트, 생성시간, 피드백 바로가기',
        '고급 필터링 - 날짜 범위, 상태, 제공자, 키워드 검색',
        '일괄 작업 - 선택된 항목들의 삭제, 이동, 상태 변경',
        '내보내기 기능 - CSV, JSON 형식으로 데이터 내보내기'
      ],
      deepLinks: [
        { label: '콘텐츠 관리', href: '/planning', description: '모든 생성된 콘텐츠 통합 관리' },
        { label: '시나리오 목록', href: '/planning?tab=scenarios', description: 'AI 시나리오 프로젝트 관리' },
        { label: '영상 자산 관리', href: '/planning?tab=videos', description: '생성된 영상 파일 관리' }
      ],
      screenshots: [
        { alt: '콘텐츠 관리 대시보드', caption: '탭별로 구성된 콘텐츠 관리 인터페이스' },
        { alt: '고급 필터', caption: '다양한 조건으로 콘텐츠 필터링' },
        { alt: '일괄 작업 도구', caption: '여러 항목의 동시 관리 기능' }
      ]
    },
    {
      id: 'shortcuts-accessibility',
      title: '단축키 & 접근성',
      description: 'T(타임코드) → 폼 id/htmlFor → data-testid 활용 규칙',
      content: [
        '키보드 단축키 - T(타임코드), Space(재생/정지), ←→(탐색), Esc(모달 닫기)',
        '접근성 준수 - WCAG 2.1 AA 기준, 스크린 리더 호환성',
        '폼 접근성 - 모든 input에 적절한 id/htmlFor 연결',
        '키보드 네비게이션 - Tab 순서, 포커스 표시, Skip Links',
        '시각적 접근성 - 충분한 대비율(4.5:1), 큰 클릭 영역(44px 이상)',
        'data-testid 규칙 - 컴포넌트별 일관된 네이밍 규약',
        '대체 텍스트 - 모든 이미지, 아이콘에 적절한 alt 속성'
      ],
      deepLinks: [
        { label: '접근성 설정', href: '/?accessibility=true', description: '접근성 옵션 활성화' },
        { label: '키보드 단축키 목록', href: '/manual#shortcuts-accessibility', description: '전체 단축키 목록 확인' }
      ],
      screenshots: [
        { alt: '키보드 네비게이션', caption: '키보드로 모든 기능에 접근 가능' },
        { alt: '포커스 표시기', caption: '명확한 포커스 상태 시각화' },
        { alt: 'ARIA 라벨', caption: '스크린 리더를 위한 적절한 라벨링' }
      ]
    },
    {
      id: 'troubleshooting',
      title: '트러블슈팅',
      description: '업로드 실패 사유 → 빌드/테스트 체크리스트 → 일반적인 문제 해결',
      content: [
        '업로드 실패 원인 - 파일 크기 초과(300MB), 미지원 형식, 네트워크 오류',
        '영상 생성 실패 - API 한도 초과, 부적절한 콘텐츠, 서버 오류',
        '성능 최적화 - 브라우저 캐시 정리, 확장 프로그램 비활성화',
        '호환성 문제 - 지원 브라우저(Chrome 90+, Firefox 88+, Safari 14+)',
        '네트워크 문제 - 방화벽 설정, VPN 연결, DNS 문제',
        '데이터 복구 - 세션 복원, 임시 저장된 작업 복구',
        '계정 관련 - 데이터 초기화, 세션 만료, 권한 문제'
      ],
      deepLinks: [
        { label: '시스템 상태 확인', href: '/admin?tab=health', description: '서비스 상태 모니터링' },
        { label: '피드백 보내기', href: '/feedback?type=bug', description: '버그 신고 및 개선 제안' }
      ],
      screenshots: [
        { alt: '오류 메시지', caption: '명확한 오류 원인과 해결 방법 안내' },
        { alt: '시스템 진단', caption: '자동 시스템 상태 체크 결과' },
        { alt: '복구 도구', caption: '데이터 복구 및 세션 관리 도구' }
      ]
    }
  ]

  // 네비게이션 아이템 생성
  const navigationItems: NavItem[] = manualSections.map((section) => ({
    id: section.id,
    title: section.title,
    anchor: `#${section.id}`,
    level: 0
  }))

  // 검색 기능
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSections(manualSections)
      return
    }

    const filtered = manualSections.filter((section) =>
      section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.content.some(item =>
        item.toLowerCase().includes(searchQuery.toLowerCase())
      )
    )
    setFilteredSections(filtered)
  }, [searchQuery])

  // 스크롤 시 액티브 섹션 업데이트
  useEffect(() => {
    const handleScroll = () => {
      const sections = manualSections.map(section =>
        document.getElementById(section.id)
      ).filter(Boolean)

      let currentSection = 'getting-started'

      for (const section of sections) {
        if (section && section.getBoundingClientRect().top <= 100) {
          currentSection = section.id
        }
      }

      setActiveSection(currentSection)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Ctrl/Cmd + K: 검색 포커스
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }

      // ESC: 검색 지우기
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('')
        searchInputRef.current?.blur()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [searchQuery])

  // 앵커 링크 클릭 처리
  const handleAnchorClick = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveSection(sectionId)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50" data-testid="manual-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 브레드크럼 & 검색 헤더 */}
        <div className="mb-8">
          <nav className="mb-4" aria-label="브레드크럼" data-testid="breadcrumb-nav">
            <ol className="flex items-center space-x-2 text-sm text-neutral-600">
              <li>
                <Link
                  href="/"
                  className="hover:text-primary-600 transition-colors duration-200"
                  data-testid="breadcrumb-home"
                >
                  홈
                </Link>
              </li>
              <li><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg></li>
              <li className="text-neutral-900 font-medium" aria-current="page">워크플로우 매뉴얼</li>
            </ol>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2" data-testid="page-title">
                워크플로우 매뉴얼
              </h1>
              <p className="text-lg text-neutral-600" data-testid="page-description">
                VLANET 워크플로우를 이해하고 효율적으로 활용하는 단계별 가이드
              </p>
            </div>

            {/* 검색 입력 */}
            <div className="relative max-w-md w-full lg:w-auto">
              <Input
                ref={searchInputRef}
                type="search"
                placeholder="매뉴얼에서 검색... (Ctrl+K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
                data-testid="search-input"
                aria-label="매뉴얼 콘텐츠 검색"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* 좌측 고정 사이드바 */}
          <div className="lg:col-span-1">
            <div className="sticky top-8" data-testid="sidebar-navigation">
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4" data-testid="sidebar-title">
                  목차
                </h2>
                <nav aria-label="섹션 네비게이션">
                  <ul className="space-y-2" role="list">
                    {navigationItems.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => handleAnchorClick(item.id)}
                          className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                            activeSection === item.id
                              ? 'bg-primary-100 text-primary-700 font-medium'
                              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                          }`}
                          data-testid={`nav-${item.id}`}
                          aria-current={activeSection === item.id ? 'true' : 'false'}
                        >
                          {item.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </nav>

                {/* 빠른 액션 */}
                <div className="mt-8 pt-6 border-t border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3">빠른 시작</h3>
                  <div className="space-y-2">
                    <Button asChild variant="outline" size="sm" className="w-full justify-start text-sm">
                      <Link href="/scenario" data-testid="quick-scenario">🎬 AI 시나리오</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="w-full justify-start text-sm">
                      <Link href="/prompt-generator" data-testid="quick-prompt">🤖 프롬프트 생성</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="w-full justify-start text-sm">
                      <Link href="/workflow" data-testid="quick-workflow">⚙️ 영상 생성</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* 우측 메인 콘텐츠 */}
          <div className="lg:col-span-3" ref={mainContentRef}>
            {/* 검색 결과 표시 */}
            {searchQuery && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg" data-testid="search-results">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">"{searchQuery}"</span>에 대한 검색 결과:
                  <span className="font-semibold">{filteredSections.length}개 섹션</span>
                </p>
              </div>
            )}

            {/* 매뉴얼 섹션 */}
            <div className="space-y-12" data-testid="manual-sections">
              {filteredSections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24"
                  aria-labelledby={`${section.id}-heading`}
                  data-testid={`section-${section.id}`}
                >
                  <Card className="p-8">
                    {/* 섹션 헤더 */}
                    <div className="mb-6">
                      <h2
                        id={`${section.id}-heading`}
                        className="text-2xl font-bold text-neutral-900 mb-3"
                        data-testid={`section-title-${section.id}`}
                      >
                        {section.title}
                      </h2>
                      <p className="text-lg text-neutral-600 mb-4">
                        {section.description}
                      </p>

                      {/* 앵커 링크 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const url = new URL(window.location.href)
                            url.hash = section.id
                            navigator.clipboard.writeText(url.toString())
                          }}
                          className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
                          data-testid={`anchor-${section.id}`}
                          aria-label={`${section.title} 섹션 링크 복사`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          링크 복사
                        </button>
                      </div>
                    </div>

                    {/* 섹션 콘텐츠 */}
                    <div className="space-y-6">
                      {/* 단계별 가이드 */}
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-900 mb-3">단계별 가이드</h3>
                        <ol className="space-y-3" data-testid={`content-${section.id}`}>
                          {section.content.map((item, index) => (
                            <li key={index} className="flex items-start">
                              <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 text-sm font-medium rounded-full flex items-center justify-center mr-3 mt-0.5">
                                {index + 1}
                              </span>
                              <p className="text-neutral-700 leading-relaxed">{item}</p>
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* 딥링크 버튼 */}
                      {section.deepLinks && section.deepLinks.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-neutral-900 mb-3">관련 기능</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid={`deeplinks-${section.id}`}>
                            {section.deepLinks.map((link, index) => (
                              <Button
                                key={index}
                                asChild
                                variant="outline"
                                className="h-auto p-4 justify-start text-left"
                                data-testid={`deeplink-${section.id}-${index}`}
                              >
                                <Link href={link.href}>
                                  <div>
                                    <div className="font-medium text-neutral-900">{link.label}</div>
                                    <div className="text-sm text-neutral-600 mt-1">{link.description}</div>
                                  </div>
                                </Link>
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 스크린샷 플레이스홀더 */}
                      {section.screenshots && section.screenshots.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-neutral-900 mb-3">기능 미리보기</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid={`screenshots-${section.id}`}>
                            {section.screenshots.map((screenshot, index) => (
                              <div key={index} className="space-y-2">
                                <div className="aspect-video bg-neutral-200 rounded-lg flex items-center justify-center border-2 border-dashed border-neutral-300">
                                  <div className="text-center text-neutral-500">
                                    <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.414-1.414a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <p className="text-sm">{screenshot.alt}</p>
                                  </div>
                                </div>
                                <p className="text-sm text-neutral-600">{screenshot.caption}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </section>
              ))}
            </div>

            {/* 추가 도움말 섹션 */}
            <section className="mt-12" data-testid="additional-help">
              <Card className="p-8">
                <h2 className="text-2xl font-bold text-neutral-900 mb-6">추가 도움말</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 피드백 */}
                  <div className="p-6 bg-blue-50 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-900 mb-3">문의 및 제안</h3>
                    <p className="text-blue-700 mb-4">기능 개선 아이디어나 버그 리포트를 남겨주세요.</p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/feedback" data-testid="feedback-link">피드백 보내기</Link>
                    </Button>
                  </div>

                  {/* 시스템 상태 */}
                  <div className="p-6 bg-green-50 rounded-lg">
                    <h3 className="text-lg font-semibold text-green-900 mb-3">시스템 상태</h3>
                    <p className="text-green-700 mb-4">서비스 상태와 성능 지표를 확인하세요.</p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/admin?tab=health" data-testid="system-status-link">상태 확인</Link>
                    </Button>
                  </div>
                </div>

                {/* 단축키 요약 */}
                <div className="mt-8 p-6 bg-neutral-100 rounded-lg">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">주요 단축키</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-mono">Ctrl+K</kbd>
                      <span className="text-neutral-600">검색</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-mono">T</kbd>
                      <span className="text-neutral-600">타임코드</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-mono">Space</kbd>
                      <span className="text-neutral-600">재생/정지</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 bg-white border border-neutral-300 rounded text-xs font-mono">Esc</kbd>
                      <span className="text-neutral-600">닫기</span>
                    </div>
                  </div>
                </div>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}