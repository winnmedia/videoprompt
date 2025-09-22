/**
 * Shot Selector - 12개 샷 선택 UI 컴포넌트
 *
 * CLAUDE.md 준수: FSD widgets 레이어, stateless UI 컴포넌트
 */

'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import type { Scene } from '@/entities/scenario'

interface ShotSelectorProps {
  scenes: Scene[]
  selectedSceneIds: string[]
  onSelectionChange: (selectedIds: string[]) => void
  maxSelection?: number
  className?: string
}

export function ShotSelector({
  scenes,
  selectedSceneIds,
  onSelectionChange,
  maxSelection = 12,
  className,
}: ShotSelectorProps) {
  const [selectAll, setSelectAll] = useState(false)

  const handleSceneToggle = (sceneId: string) => {
    const isSelected = selectedSceneIds.includes(sceneId)

    if (isSelected) {
      // 선택 해제
      onSelectionChange(selectedSceneIds.filter((id) => id !== sceneId))
    } else {
      // 선택 추가 (최대 개수 제한)
      if (selectedSceneIds.length < maxSelection) {
        onSelectionChange([...selectedSceneIds, sceneId])
      }
    }
  }

  const handleSelectAll = () => {
    if (selectAll) {
      // 전체 해제
      onSelectionChange([])
      setSelectAll(false)
    } else {
      // 전체 선택 (최대 개수까지)
      const allSceneIds = scenes.slice(0, maxSelection).map((scene) => scene.id)
      onSelectionChange(allSceneIds)
      setSelectAll(true)
    }
  }

  const formatDuration = (duration?: number) => {
    if (!duration) return '~10초'
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    return minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}초`
  }

  const totalDuration = scenes
    .filter((scene) => selectedSceneIds.includes(scene.id))
    .reduce((sum, scene) => sum + (scene.duration || 10), 0)

  return (
    <div className={clsx('space-y-4', className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-medium text-gray-900">
            프롬프트 생성할 샷 선택
          </h3>
          <p className="text-sm text-gray-600">
            최대 {maxSelection}개 샷을 선택하여 VLANET 프롬프트를 생성할 수 있습니다.
          </p>
        </div>
        <div className="text-right text-sm text-gray-600">
          <div>선택됨: {selectedSceneIds.length}/{maxSelection}</div>
          <div>총 길이: {formatDuration(totalDuration)}</div>
        </div>
      </div>

      {/* 전체 선택/해제 */}
      <div className="flex items-center space-x-2">
        <button
          onClick={handleSelectAll}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {selectAll ? '전체 해제' : '전체 선택'}
        </button>
        {selectedSceneIds.length > 0 && (
          <button
            onClick={() => onSelectionChange([])}
            className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            선택 초기화
          </button>
        )}
      </div>

      {/* 샷 목록 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {scenes.map((scene, index) => {
          const isSelected = selectedSceneIds.includes(scene.id)
          const isDisabled = !isSelected && selectedSceneIds.length >= maxSelection

          return (
            <div
              key={scene.id}
              className={clsx(
                'relative p-4 border rounded-lg cursor-pointer transition-all',
                {
                  'border-blue-500 bg-blue-50': isSelected,
                  'border-gray-200 hover:border-gray-300': !isSelected && !isDisabled,
                  'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60': isDisabled,
                }
              )}
              onClick={() => !isDisabled && handleSceneToggle(scene.id)}
            >
              {/* 선택 인디케이터 */}
              <div className="absolute top-2 right-2">
                <div
                  className={clsx(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                    {
                      'border-blue-500 bg-blue-500': isSelected,
                      'border-gray-300': !isSelected,
                    }
                  )}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </div>

              {/* 샷 번호 */}
              <div className="mb-2">
                <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                  샷 {index + 1}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  {formatDuration(scene.duration)}
                </span>
              </div>

              {/* 샷 제목 */}
              <h4 className="font-medium text-gray-900 mb-2 line-clamp-1">
                {scene.title}
              </h4>

              {/* 샷 설명 */}
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {scene.description}
              </p>

              {/* 샷 메타데이터 */}
              <div className="space-y-1">
                {scene.type && (
                  <div className="flex items-center text-xs text-gray-500">
                    <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                    타입: {scene.type}
                  </div>
                )}
                {scene.location && (
                  <div className="flex items-center text-xs text-gray-500">
                    <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                    장소: {scene.location}
                  </div>
                )}
                {scene.characters && scene.characters.length > 0 && (
                  <div className="flex items-center text-xs text-gray-500">
                    <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                    등장인물: {scene.characters.join(', ')}
                  </div>
                )}
              </div>

              {/* 스토리보드 이미지 썸네일 */}
              {scene.storyboardImageUrl && (
                <div className="mt-3">
                  <img
                    src={scene.storyboardImageUrl}
                    alt={`${scene.title} 스토리보드`}
                    className="w-full h-20 object-cover rounded border"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 선택 상태 요약 */}
      {selectedSceneIds.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">선택된 샷 요약</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-700">선택된 샷 수:</span>
              <span className="ml-2 font-medium">{selectedSceneIds.length}개</span>
            </div>
            <div>
              <span className="text-blue-700">총 예상 길이:</span>
              <span className="ml-2 font-medium">{formatDuration(totalDuration)}</span>
            </div>
          </div>
          {selectedSceneIds.length >= maxSelection && (
            <p className="mt-2 text-sm text-blue-700">
              최대 선택 가능한 샷 수에 도달했습니다.
            </p>
          )}
        </div>
      )}
    </div>
  )
}