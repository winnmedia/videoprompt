/**
 * Prompt Builder - VLANET 프롬프트 생성 UI 컴포넌트
 *
 * CLAUDE.md 준수: FSD widgets 레이어, stateless UI 컴포넌트
 */

'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { ShotSelector } from './ShotSelector'
import { PromptPreview } from './PromptPreview'
import { usePromptGeneration } from '@/features/prompt'
import type { Scenario } from '@/entities/scenario'
import type { VLANETPrompt, ProjectConfig } from '@/entities/prompt'

interface PromptBuilderProps {
  scenario: Scenario
  className?: string
}

export function PromptBuilder({ scenario, className }: PromptBuilderProps) {
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([])
  const [customPromptName, setCustomPromptName] = useState('')
  const [projectConfig, setProjectConfig] = useState<Partial<ProjectConfig>>({
    creationMode: 'VISUAL_FIRST',
    frameworkType: 'EVENT_DRIVEN',
    aiAssistantPersona: 'ASSISTANT_DIRECTOR',
  })
  const [showPreview, setShowPreview] = useState(false)

  const {
    generatePrompt,
    isGenerating,
    generateError,
    generateSuccess,
    generatedPrompt,
    generatePreview,
    reset,
  } = usePromptGeneration({ scenario })

  const previewPrompt = showPreview ? generatePreview(selectedSceneIds) : null

  const handleGenerate = () => {
    if (selectedSceneIds.length === 0) return

    generatePrompt({
      selectedShotIds: selectedSceneIds,
      projectId: scenario.metadata.id,
      userPreferences: projectConfig,
      customPromptName: customPromptName || undefined,
    })
  }

  const handleReset = () => {
    setSelectedSceneIds([])
    setCustomPromptName('')
    setShowPreview(false)
    reset()
  }

  const canGenerate = selectedSceneIds.length > 0 && !isGenerating

  return (
    <div className={clsx('space-y-8', className)}>
      {/* 헤더 */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">VLANET 프롬프트 생성기</h2>
        <p className="text-gray-600">
          시나리오 "{scenario.metadata.title}"에서 선택한 샷들을 기반으로 VLANET 프롬프트를 생성합니다.
        </p>
      </div>

      {/* 프로젝트 설정 */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-4">프로젝트 설정</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* 생성 모드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              생성 모드
            </label>
            <select
              value={projectConfig.creationMode}
              onChange={(e) =>
                setProjectConfig((prev) => ({
                  ...prev,
                  creationMode: e.target.value as ProjectConfig['creationMode'],
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="VISUAL_FIRST">비주얼 우선</option>
              <option value="SOUND_FIRST">사운드 우선</option>
            </select>
          </div>

          {/* 프레임워크 타입 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              프레임워크 타입
            </label>
            <select
              value={projectConfig.frameworkType}
              onChange={(e) =>
                setProjectConfig((prev) => ({
                  ...prev,
                  frameworkType: e.target.value as ProjectConfig['frameworkType'],
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="EVENT_DRIVEN">이벤트 중심</option>
              <option value="DIRECTION_DRIVEN">연출 중심</option>
              <option value="HYBRID">하이브리드</option>
            </select>
          </div>

          {/* AI 어시스턴트 페르소나 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI 어시스턴트 역할
            </label>
            <select
              value={projectConfig.aiAssistantPersona}
              onChange={(e) =>
                setProjectConfig((prev) => ({
                  ...prev,
                  aiAssistantPersona: e.target.value as ProjectConfig['aiAssistantPersona'],
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ASSISTANT_DIRECTOR">조감독</option>
              <option value="CINEMATOGRAPHER">촬영감독</option>
              <option value="SCREENWRITER">시나리오 작가</option>
            </select>
          </div>
        </div>

        {/* 커스텀 프롬프트 이름 */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            프롬프트 이름 (선택사항)
          </label>
          <input
            type="text"
            value={customPromptName}
            onChange={(e) => setCustomPromptName(e.target.value)}
            placeholder={scenario.metadata.title}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 샷 선택 */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg">
        <ShotSelector
          scenes={scenario.scenes}
          selectedSceneIds={selectedSceneIds}
          onSelectionChange={setSelectedSceneIds}
          maxSelection={12}
        />
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowPreview(!showPreview)}
            disabled={selectedSceneIds.length === 0}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              {
                'bg-gray-100 text-gray-700 hover:bg-gray-200': selectedSceneIds.length > 0,
                'bg-gray-50 text-gray-400 cursor-not-allowed': selectedSceneIds.length === 0,
              }
            )}
          >
            {showPreview ? '프리뷰 숨기기' : '프리뷰 보기'}
          </button>

          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            초기화
          </button>
        </div>

        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={clsx(
            'px-6 py-2 text-sm font-medium rounded-md transition-colors',
            {
              'bg-blue-600 text-white hover:bg-blue-700': canGenerate,
              'bg-gray-300 text-gray-500 cursor-not-allowed': !canGenerate,
            }
          )}
        >
          {isGenerating ? '생성 중...' : 'VLANET 프롬프트 생성'}
        </button>
      </div>

      {/* 에러 메시지 */}
      {generateError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-medium text-red-800 mb-1">생성 오류</h4>
          <p className="text-sm text-red-700">
            {generateError instanceof Error ? generateError.message : '알 수 없는 오류가 발생했습니다.'}
          </p>
        </div>
      )}

      {/* 성공 메시지 */}
      {generateSuccess && generatedPrompt && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-green-800 mb-1">생성 완료!</h4>
          <p className="text-sm text-green-700">
            VLANET 프롬프트가 성공적으로 생성되었습니다.
            처리 시간: {generatedPrompt.processingTimeMs}ms
          </p>
          {generatedPrompt.warnings && generatedPrompt.warnings.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-green-700 font-medium">주의사항:</p>
              <ul className="list-disc list-inside text-sm text-green-600">
                {generatedPrompt.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 프리뷰 */}
      {showPreview && previewPrompt && (
        <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">프롬프트 프리뷰</h3>
          <PromptPreview prompt={previewPrompt} />
        </div>
      )}

      {/* 생성된 프롬프트 */}
      {generateSuccess && generatedPrompt && (
        <div className="p-6 bg-white border border-green-200 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">생성된 VLANET 프롬프트</h3>
          <PromptPreview prompt={generatedPrompt.prompt} />
        </div>
      )}
    </div>
  )
}