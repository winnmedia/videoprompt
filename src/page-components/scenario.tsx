/**
 * Scenario Page Component - FSD Pages Layer
 *
 * CLAUDE.md 준수사항:
 * - FSD pages 레이어 컴포넌트
 * - 시나리오 기획 및 생성 UI/UX 구현
 * - 접근성 WCAG 2.1 AA 준수
 * - TDD 테스트 가능한 구조
 * - data-testid 네이밍 규약
 * - 반응형 디자인 (모바일 우선)
 * - widgets/scenario 컴포넌트 활용
 */

'use client';

import type { Metadata } from 'next'
import { useState, useCallback } from 'react'
import Link from 'next/link'

// FSD Public API를 통한 import (CLAUDE.md 준수)
import { StoryInputForm, ScenesGrid } from '../widgets/scenario'
import { Button, Card, Tabs, TabsContent, TabsList, TabsTrigger } from '../shared/ui'
import { useScenario } from '../features/scenario'
import type { Scene } from '../entities/scenario'

export const metadata: Metadata = {
  title: '시나리오 기획',
  description: 'AI 기반 영상 시나리오 기획 및 생성 도구 - VideoPlanet',
}

/**
 * 시나리오 기획 페이지 컴포넌트
 *
 * AI를 활용한 시나리오 기획 및 씬 편집을 제공하는 페이지입니다:
 * - AI 스토리 생성
 * - 드래그앤드롭 씬 편집
 * - 반응형 레이아웃
 * - 접근성 준수
 * - 실시간 미리보기
 */
export function ScenarioPage() {
  // 시나리오 상태 관리 (FSD features 레이어)
  const {
    currentScenario,
    scenes,
    selectedSceneIds,
    isLoading,
    error,
    editMode,
    createScenario,
    updateScenes,
    selectScene,
    toggleEditMode,
    deleteScene,
    reorderScenes
  } = useScenario()

  // 컴포넌트 상태
  const [activeTab, setActiveTab] = useState<'create' | 'edit'>('create')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  /**
   * 스토리 생성 완료 핸들러
   */
  const handleStoryGenerated = useCallback((scenario: any) => {
    createScenario(scenario)
    setActiveTab('edit')
  }, [createScenario])

  /**
   * 씬 순서 변경 핸들러
   */
  const handleSceneOrderChange = useCallback((newOrder: string[]) => {
    reorderScenes(newOrder)
  }, [reorderScenes])

  /**
   * 씬 편집 핸들러
   */
  const handleSceneEdit = useCallback((scene: Scene) => {
    toggleEditMode()
    selectScene(scene.id)
  }, [toggleEditMode, selectScene])

  /**
   * 에러 핸들러
   */
  const handleError = useCallback((errorMessage: string) => {
    // 에러 토스트 또는 모달 표시
    console.error('Scenario error:', errorMessage)
  }, [])

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* 브레드크럼 및 제목 */}
            <div className="flex items-center gap-4">
              <nav aria-label="브레드크럼" className="hidden sm:block">
                <ol className="flex items-center space-x-2 text-sm text-neutral-600">
                  <li>
                    <Link href="/" className="hover:text-primary-600 transition-colors">
                      홈
                    </Link>
                  </li>
                  <li>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </li>
                  <li className="text-neutral-900 font-medium">시나리오 기획</li>
                </ol>
              </nav>

              <h1 className="text-xl font-semibold text-neutral-900">
                시나리오 기획
              </h1>
            </div>

            {/* 모바일 사이드바 토글 */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="sm:hidden p-2 text-neutral-600 hover:text-neutral-900 transition-colors"
              aria-label="메뉴 열기"
              data-testid="mobile-menu-toggle"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>

            {/* 액션 버튼들 */}
            <div className="hidden sm:flex items-center gap-3">
              {scenes.length > 0 && (
                <Button
                  variant="outline"
                  onClick={toggleEditMode}
                  data-testid="toggle-edit-mode"
                >
                  {editMode === 'edit' ? '편집 완료' : '씬 편집'}
                </Button>
              )}

              <Button
                variant="outline"
                data-testid="save-scenario"
                disabled={!currentScenario}
              >
                저장
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 메인 작업 영역 */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'create' | 'edit')}>
              {/* 탭 헤더 */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <TabsList className="grid w-full sm:w-auto grid-cols-2 mb-4 sm:mb-0">
                  <TabsTrigger value="create" data-testid="tab-create">
                    스토리 생성
                  </TabsTrigger>
                  <TabsTrigger value="edit" data-testid="tab-edit" disabled={scenes.length === 0}>
                    씬 편집
                  </TabsTrigger>
                </TabsList>

                {/* 진행 상태 */}
                {currentScenario && (
                  <div className="text-sm text-neutral-600">
                    <span className="font-medium">{scenes.length}</span>개 씬 생성됨
                  </div>
                )}
              </div>

              {/* 스토리 생성 탭 */}
              <TabsContent value="create" className="space-y-6">
                <div className="max-w-4xl">
                  <StoryInputForm
                    onStoryGenerated={handleStoryGenerated}
                    onError={handleError}
                    disabled={isLoading}
                    data-testid="story-input-form"
                  />
                </div>

                {/* 생성된 시나리오 미리보기 */}
                {currentScenario && scenes.length > 0 && (
                  <div className="mt-8">
                    <Card className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-neutral-900">
                          생성된 시나리오 미리보기
                        </h3>
                        <Button
                          onClick={() => setActiveTab('edit')}
                          data-testid="goto-edit-tab"
                        >
                          편집하러 가기
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {scenes.slice(0, 6).map((scene) => (
                          <div
                            key={scene.id}
                            className="p-4 bg-neutral-50 rounded-lg border"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
                                {scene.order}
                              </span>
                              <h4 className="text-sm font-medium text-neutral-900 line-clamp-1">
                                {scene.title}
                              </h4>
                            </div>
                            <p className="text-xs text-neutral-600 line-clamp-2">
                              {scene.description}
                            </p>
                          </div>
                        ))}
                        {scenes.length > 6 && (
                          <div className="p-4 bg-neutral-100 rounded-lg border-2 border-dashed border-neutral-300 flex items-center justify-center">
                            <span className="text-sm text-neutral-600">
                              +{scenes.length - 6}개 더
                            </span>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                )}
              </TabsContent>

              {/* 씬 편집 탭 */}
              <TabsContent value="edit">
                {scenes.length > 0 ? (
                  <ScenesGrid
                    scenes={scenes}
                    selectedSceneIds={selectedSceneIds}
                    editMode={editMode}
                    onSceneSelect={selectScene}
                    onSceneEdit={handleSceneEdit}
                    onSceneDelete={deleteScene}
                    onOrderChange={handleSceneOrderChange}
                    enableDragDrop={true}
                    enableMultiSelect={true}
                    data-testid="scenes-grid"
                  />
                ) : (
                  <Card className="p-12 text-center">
                    <svg className="w-16 h-16 text-neutral-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2M7 4h10l-1 12H8L7 4zm5-2v12" />
                    </svg>
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">
                      아직 씬이 없습니다
                    </h3>
                    <p className="text-neutral-600 mb-6">
                      먼저 스토리를 생성하여 씬을 만들어보세요
                    </p>
                    <Button
                      onClick={() => setActiveTab('create')}
                      data-testid="goto-create-tab"
                    >
                      스토리 생성하기
                    </Button>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* 사이드바 */}
          <aside className={`
            lg:block lg:col-span-1
            ${sidebarOpen ? 'block' : 'hidden'}
            fixed lg:static inset-y-0 right-0 z-50 lg:z-auto
            w-80 lg:w-auto bg-white lg:bg-transparent
            border-l lg:border-0 border-neutral-200
            p-6 lg:p-0 space-y-6
          `}>
            {/* 모바일 사이드바 헤더 */}
            <div className="lg:hidden flex items-center justify-between pb-4 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900">메뉴</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 text-neutral-400 hover:text-neutral-600"
                aria-label="사이드바 닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 시나리오 정보 */}
            {currentScenario && (
              <Card className="p-4">
                <h3 className="font-medium text-neutral-900 mb-3">시나리오 정보</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">제목:</span>
                    <span className="text-neutral-900 font-medium">
                      {currentScenario.title}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">장르:</span>
                    <span className="text-neutral-900">{currentScenario.genre}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">씬 수:</span>
                    <span className="text-neutral-900">{scenes.length}개</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">예상 시간:</span>
                    <span className="text-neutral-900">
                      {Math.floor(scenes.reduce((sum, scene) => sum + (scene.duration || 0), 0) / 60)}분
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {/* 빠른 액션 */}
            <Card className="p-4">
              <h3 className="font-medium text-neutral-900 mb-3">빠른 액션</h3>
              <div className="space-y-2">
                {/* 프롬프트 생성 버튼 - 최상단 배치 */}
                <Button
                  size="sm"
                  className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid="generate-prompt"
                  disabled={scenes.length === 0}
                  asChild
                >
                  <Link href="/prompt-generator">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    프롬프트 생성
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  data-testid="quick-save"
                  disabled={!currentScenario}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  저장하기
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  data-testid="export-scenario"
                  disabled={!currentScenario}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  내보내기
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  data-testid="share-scenario"
                  disabled={!currentScenario}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                  공유하기
                </Button>
              </div>
            </Card>

            {/* 도움말 */}
            <Card className="p-4">
              <h3 className="font-medium text-neutral-900 mb-3">도움말</h3>
              <p className="text-sm text-neutral-600 mb-3">
                시나리오 기획에 도움이 필요하신가요?
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                asChild
              >
                <Link href="/manual/scenario-guide">
                  가이드 보기
                </Link>
              </Button>
            </Card>
          </aside>
        </div>

        {/* 오버레이 (모바일 사이드바) */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-25 z-40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
      </main>

      {/* 로딩 오버레이 */}
      {isLoading && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-labelledby="loading-title"
          aria-describedby="loading-description"
        >
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <div>
                <h3 id="loading-title" className="font-medium text-neutral-900">
                  처리 중...
                </h3>
                <p id="loading-description" className="text-sm text-neutral-600">
                  잠시만 기다려주세요
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 에러 모달 */}
      {error && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-labelledby="error-title"
          aria-describedby="error-description"
        >
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 id="error-title" className="font-medium text-neutral-900 mb-2">
                  오류가 발생했습니다
                </h3>
                <p id="error-description" className="text-sm text-neutral-600 mb-4">
                  {error}
                </p>
                <Button
                  size="sm"
                  onClick={() => handleError('')}
                  data-testid="dismiss-error"
                >
                  확인
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}