/**
 * Prompt Preview - VLANET 프롬프트 미리보기 컴포넌트
 *
 * CLAUDE.md 준수: FSD widgets 레이어, stateless UI 컴포넌트
 */

'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import type { VLANETPrompt } from '@/entities/prompt'

interface PromptPreviewProps {
  prompt: VLANETPrompt
  className?: string
}

type PreviewSection = 'metadata' | 'timeline' | 'elements' | 'config' | 'output'

export function PromptPreview({ prompt, className }: PromptPreviewProps) {
  const [activeSection, setActiveSection] = useState<PreviewSection>('metadata')
  const [expandedTimelineItems, setExpandedTimelineItems] = useState<Set<number>>(new Set())

  const toggleTimelineItem = (sequence: number) => {
    const newExpanded = new Set(expandedTimelineItems)
    if (newExpanded.has(sequence)) {
      newExpanded.delete(sequence)
    } else {
      newExpanded.add(sequence)
    }
    setExpandedTimelineItems(newExpanded)
  }

  const sections = [
    { id: 'metadata' as const, label: '메타데이터', count: null },
    { id: 'timeline' as const, label: '타임라인', count: prompt.promptBlueprint.timeline.length },
    { id: 'elements' as const, label: '요소', count: prompt.promptBlueprint.elements.characters.length + prompt.promptBlueprint.elements.coreObjects.length },
    { id: 'config' as const, label: '설정', count: null },
    { id: 'output' as const, label: '결과', count: null },
  ]

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // TODO: 성공 토스트 메시지 표시
    } catch (err) {
      console.error('클립보드 복사 실패:', err)
    }
  }

  const exportPrompt = () => {
    const dataStr = JSON.stringify(prompt, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vlanet-prompt-${prompt.projectId}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={clsx('border border-gray-200 rounded-lg overflow-hidden', className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
        <h4 className="font-medium text-gray-900">VLANET Prompt v{prompt.version}</h4>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => copyToClipboard(JSON.stringify(prompt, null, 2))}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            JSON 복사
          </button>
          <button
            onClick={exportPrompt}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            내보내기
          </button>
        </div>
      </div>

      {/* 섹션 탭 */}
      <div className="flex border-b border-gray-200">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={clsx(
              'flex items-center px-4 py-3 text-sm font-medium transition-colors',
              {
                'text-blue-600 border-b-2 border-blue-600 bg-blue-50': activeSection === section.id,
                'text-gray-600 hover:text-gray-900 hover:bg-gray-50': activeSection !== section.id,
              }
            )}
          >
            {section.label}
            {section.count !== null && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded-full">
                {section.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 섹션 콘텐츠 */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {activeSection === 'metadata' && (
          <div className="space-y-4">
            <div>
              <h5 className="font-medium text-gray-900 mb-2">기본 정보</h5>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-gray-600">프롬프트 이름:</dt>
                <dd className="text-gray-900">{prompt.promptBlueprint.metadata.promptName}</dd>
                <dt className="text-gray-600">프로젝트 ID:</dt>
                <dd className="text-gray-900 font-mono text-xs">{prompt.projectId}</dd>
                <dt className="text-gray-600">생성 시간:</dt>
                <dd className="text-gray-900">{new Date(prompt.createdAt).toLocaleString()}</dd>
                <dt className="text-gray-600">시나리오:</dt>
                <dd className="text-gray-900">{prompt.userInput.oneLineScenario}</dd>
              </dl>
            </div>

            <div>
              <h5 className="font-medium text-gray-900 mb-2">스타일 설정</h5>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-gray-600">비주얼 스타일:</dt>
                <dd className="text-gray-900">{prompt.promptBlueprint.metadata.baseStyle.visualStyle}</dd>
                <dt className="text-gray-600">장르:</dt>
                <dd className="text-gray-900">{prompt.promptBlueprint.metadata.baseStyle.genre}</dd>
                <dt className="text-gray-600">분위기:</dt>
                <dd className="text-gray-900">{prompt.promptBlueprint.metadata.baseStyle.mood}</dd>
                <dt className="text-gray-600">화질:</dt>
                <dd className="text-gray-900">{prompt.promptBlueprint.metadata.baseStyle.quality}</dd>
              </dl>
            </div>

            <div>
              <h5 className="font-medium text-gray-900 mb-2">촬영 설정</h5>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-gray-600">주 렌즈:</dt>
                <dd className="text-gray-900">{prompt.promptBlueprint.metadata.cameraSetting.primaryLens}</dd>
                <dt className="text-gray-600">카메라 무브먼트:</dt>
                <dd className="text-gray-900">{prompt.promptBlueprint.metadata.cameraSetting.dominantMovement}</dd>
                <dt className="text-gray-600">화면 비율:</dt>
                <dd className="text-gray-900">{prompt.promptBlueprint.metadata.deliverySpec.aspectRatio}</dd>
                <dt className="text-gray-600">길이:</dt>
                <dd className="text-gray-900">{Math.round(prompt.promptBlueprint.metadata.deliverySpec.durationMs / 1000)}초</dd>
              </dl>
            </div>
          </div>
        )}

        {activeSection === 'timeline' && (
          <div className="space-y-3">
            {prompt.promptBlueprint.timeline.map((item) => {
              const isExpanded = expandedTimelineItems.has(item.sequence)
              return (
                <div key={item.sequence} className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => toggleTimelineItem(item.sequence)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">샷 {item.sequence + 1}</span>
                        <span className="ml-2 text-sm text-gray-600">
                          {item.cameraWork.angle} - {item.cameraWork.move}
                        </span>
                      </div>
                      <svg
                        className={clsx('w-5 h-5 text-gray-400 transition-transform', {
                          'rotate-180': isExpanded,
                        })}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                      <div>
                        <h6 className="text-sm font-medium text-gray-700 mb-1">비주얼 디렉팅</h6>
                        <p className="text-sm text-gray-600">{item.visualDirecting}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h6 className="text-sm font-medium text-gray-700 mb-1">카메라 워크</h6>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>앵글: {item.cameraWork.angle}</li>
                            <li>무브먼트: {item.cameraWork.move}</li>
                            <li>포커스: {item.cameraWork.focus}</li>
                          </ul>
                        </div>

                        <div>
                          <h6 className="text-sm font-medium text-gray-700 mb-1">페이싱 & 이펙트</h6>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>속도: {item.pacingFX.pacing}</li>
                            <li>편집: {item.pacingFX.editingStyle}</li>
                            <li>이펙트: {item.pacingFX.visualEffect}</li>
                          </ul>
                        </div>
                      </div>

                      {(item.audioLayers.voice || item.audioLayers.diegetic || item.audioLayers.non_diegetic) && (
                        <div>
                          <h6 className="text-sm font-medium text-gray-700 mb-1">오디오</h6>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {item.audioLayers.voice && <li>대사: {item.audioLayers.voice}</li>}
                            {item.audioLayers.diegetic && <li>효과음: {item.audioLayers.diegetic}</li>}
                            {item.audioLayers.non_diegetic && <li>배경음악: {item.audioLayers.non_diegetic}</li>}
                          </ul>
                        </div>
                      )}

                      {(item.actionNote || item.audioNote || item.visualNote) && (
                        <div>
                          <h6 className="text-sm font-medium text-gray-700 mb-1">추가 노트</h6>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {item.actionNote && <li>액션: {item.actionNote}</li>}
                            {item.audioNote && <li>오디오: {item.audioNote}</li>}
                            {item.visualNote && <li>비주얼: {item.visualNote}</li>}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {activeSection === 'elements' && (
          <div className="space-y-4">
            <div>
              <h5 className="font-medium text-gray-900 mb-2">등장인물</h5>
              {prompt.promptBlueprint.elements.characters.length > 0 ? (
                <ul className="space-y-2">
                  {prompt.promptBlueprint.elements.characters.map((character) => (
                    <li key={character.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h6 className="font-medium text-gray-900">{character.id}</h6>
                        <p className="text-sm text-gray-600">{character.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">등장인물이 없습니다.</p>
              )}
            </div>

            <div>
              <h5 className="font-medium text-gray-900 mb-2">핵심 오브젝트</h5>
              {prompt.promptBlueprint.elements.coreObjects.length > 0 ? (
                <ul className="space-y-2">
                  {prompt.promptBlueprint.elements.coreObjects.map((object) => (
                    <li key={object.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h6 className="font-medium text-gray-900">{object.id}</h6>
                        <p className="text-sm text-gray-600">{object.description}</p>
                        {object.material && (
                          <p className="text-xs text-gray-500 mt-1">재질: {object.material}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">핵심 오브젝트가 없습니다.</p>
              )}
            </div>
          </div>
        )}

        {activeSection === 'config' && (
          <div className="space-y-4">
            <div>
              <h5 className="font-medium text-gray-900 mb-2">프로젝트 설정</h5>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-gray-600">생성 모드:</dt>
                <dd className="text-gray-900">{prompt.projectConfig.creationMode}</dd>
                <dt className="text-gray-600">프레임워크:</dt>
                <dd className="text-gray-900">{prompt.projectConfig.frameworkType}</dd>
                <dt className="text-gray-600">AI 페르소나:</dt>
                <dd className="text-gray-900">{prompt.projectConfig.aiAssistantPersona}</dd>
              </dl>
            </div>

            <div>
              <h5 className="font-medium text-gray-900 mb-2">생성 제어</h5>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-gray-600">Seed:</dt>
                <dd className="text-gray-900 font-mono">{prompt.generationControl.seed}</dd>
                <dt className="text-gray-600">샷별 생성:</dt>
                <dd className="text-gray-900">{prompt.generationControl.shotByShot.enabled ? '활성화' : '비활성화'}</dd>
              </dl>
            </div>

            {prompt.generationControl.directorEmphasis.length > 0 && (
              <div>
                <h5 className="font-medium text-gray-900 mb-2">강조 포인트</h5>
                <ul className="space-y-1">
                  {prompt.generationControl.directorEmphasis.map((emphasis, index) => (
                    <li key={index} className="flex justify-between text-sm">
                      <span className="text-gray-900">{emphasis.term}</span>
                      <span className="text-gray-600">가중치: {emphasis.weight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeSection === 'output' && prompt.finalOutputCompact && (
          <div className="space-y-4">
            <div>
              <h5 className="font-medium text-gray-900 mb-2">메타데이터</h5>
              <dl className="grid grid-cols-1 gap-y-2 text-sm">
                <dt className="text-gray-600">프롬프트 이름:</dt>
                <dd className="text-gray-900">{prompt.finalOutputCompact.metadata.prompt_name}</dd>
                <dt className="text-gray-600">기본 스타일:</dt>
                <dd className="text-gray-900">{prompt.finalOutputCompact.metadata.base_style}</dd>
                <dt className="text-gray-600">공간 설명:</dt>
                <dd className="text-gray-900">{prompt.finalOutputCompact.metadata.room_description}</dd>
                <dt className="text-gray-600">카메라 설정:</dt>
                <dd className="text-gray-900">{prompt.finalOutputCompact.metadata.camera_setup}</dd>
              </dl>
            </div>

            <div>
              <h5 className="font-medium text-gray-900 mb-2">키워드</h5>
              <div className="flex flex-wrap gap-2">
                {prompt.finalOutputCompact.keywords.map((keyword, index) => (
                  <span key={index} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h5 className="font-medium text-gray-900 mb-2">네거티브 프롬프트</h5>
              <div className="flex flex-wrap gap-2">
                {prompt.finalOutputCompact.negative_prompts.map((negative, index) => (
                  <span key={index} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                    {negative}
                  </span>
                ))}
              </div>
            </div>

            {prompt.finalOutputCompact.text && (
              <div>
                <h5 className="font-medium text-gray-900 mb-2">설명 텍스트</h5>
                <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
                  {prompt.finalOutputCompact.text}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}