/**
 * 템플릿 카드 컴포넌트
 *
 * CLAUDE.md 준수사항:
 * - FSD widgets 레이어 (UI 컴포넌트)
 * - Tailwind CSS v4 사용
 * - 접근성 (WCAG 2.1 AA) 준수
 * - 성능 최적화 (React.memo, 이미지 최적화)
 */

'use client'

import React, { memo, useState, useCallback } from 'react'
import Image from 'next/image'
import type { ProjectTemplate } from '../../entities/templates'
import { TemplateFeatureUtils } from '../../features/templates'

// ===========================================
// 타입 정의
// ===========================================

export interface TemplateCardProps {
  /**
   * 템플릿 데이터
   */
  readonly template: ProjectTemplate

  /**
   * 표시 모드 (그리드 또는 리스트)
   */
  readonly view?: 'grid' | 'list'

  /**
   * 컴팩트 모드 (작은 크기)
   */
  readonly compact?: boolean

  /**
   * 배지 표시 ('recommended', 'popular', 'new', 'featured')
   */
  readonly showBadge?: 'recommended' | 'popular' | 'new' | 'featured' | null

  /**
   * 사용자 정의 CSS 클래스
   */
  readonly className?: string

  /**
   * 카드 클릭 시 콜백
   */
  readonly onClick?: () => void

  /**
   * 프로젝트 생성 콜백
   */
  readonly onCreateProject?: (projectName: string) => void

  /**
   * 미리보기 버튼 표시 여부
   */
  readonly showPreview?: boolean

  /**
   * 즐겨찾기 버튼 표시 여부
   */
  readonly showFavorite?: boolean
}

export interface Badge {
  readonly label: string
  readonly color: string
  readonly bgColor: string
  readonly icon?: string
}

// ===========================================
// 상수 정의
// ===========================================

const BADGE_CONFIG: Record<string, Badge> = {
  recommended: {
    label: '추천',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: '⭐'
  },
  popular: {
    label: '인기',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: '🔥'
  },
  new: {
    label: '신규',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: '✨'
  },
  featured: {
    label: '추천',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    icon: '👑'
  }
}

// ===========================================
// 서브 컴포넌트들
// ===========================================

const TemplateBadge = memo(function TemplateBadge({
  type
}: {
  type: 'recommended' | 'popular' | 'new' | 'featured'
}) {
  const badge = BADGE_CONFIG[type]

  return (
    <span
      className={`
        absolute top-2 left-2 z-10
        inline-flex items-center px-2 py-1
        text-xs font-medium rounded-full
        ${badge.color} ${badge.bgColor}
        backdrop-blur-sm
      `}
      aria-label={`${badge.label} 템플릿`}
    >
      {badge.icon && <span className="mr-1" aria-hidden="true">{badge.icon}</span>}
      {badge.label}
    </span>
  )
})

const TemplateImage = memo(function TemplateImage({
  template,
  compact = false
}: {
  template: ProjectTemplate
  compact?: boolean
}) {
  const [imageError, setImageError] = useState(false)

  const handleImageError = useCallback(() => {
    setImageError(true)
  }, [])

  if (imageError) {
    return (
      <div className={`
        ${compact ? 'h-32' : 'h-48'}
        bg-gradient-to-br from-gray-100 to-gray-200
        dark:from-gray-700 dark:to-gray-800
        flex items-center justify-center
        text-gray-500 dark:text-gray-400
      `}>
        <div className="text-center">
          <div className="text-2xl mb-2">📹</div>
          <div className="text-sm font-medium">미리보기 없음</div>
        </div>
      </div>
    )
  }

  return (
    <Image
      src={template.thumbnailUrl}
      alt={`${template.name} 템플릿 미리보기`}
      width={400}
      height={compact ? 128 : 192}
      className={`
        ${compact ? 'h-32' : 'h-48'}
        w-full object-cover
        transition-transform duration-300
        group-hover:scale-105
      `}
      onError={handleImageError}
      loading="lazy"
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  )
})

const TemplateInfo = memo(function TemplateInfo({
  template,
  compact = false,
  view = 'grid'
}: {
  template: ProjectTemplate
  compact?: boolean
  view?: 'grid' | 'list'
}) {
  const categoryDisplay = TemplateFeatureUtils.getCategoryDisplayName(template.category)
  const difficultyDisplay = TemplateFeatureUtils.getDifficultyDisplayName(template.difficulty)
  const timeDisplay = TemplateFeatureUtils.formatEstimatedTime(template.estimatedCompletionTime)
  const downloadDisplay = TemplateFeatureUtils.formatUsageCount(template.metadata.usage.downloadCount)

  if (view === 'list' && !compact) {
    return (
      <div className="flex-1 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
              {template.name}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
              {template.description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              {categoryDisplay}
            </span>
            <span>난이도: {difficultyDisplay}</span>
            <span>예상 시간: {timeDisplay}</span>
            <span>다운로드: {downloadDisplay}</span>
          </div>

          <div className="flex items-center space-x-2">
            {template.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={compact ? 'p-3' : 'p-4'}>
      <div className="flex items-start justify-between mb-2">
        <h3 className={`
          font-semibold text-gray-900 dark:text-white line-clamp-2
          ${compact ? 'text-sm' : 'text-lg'}
        `}>
          {template.name}
        </h3>
      </div>

      <p className={`
        text-gray-600 dark:text-gray-300 mb-3 line-clamp-2
        ${compact ? 'text-xs' : 'text-sm'}
      `}>
        {template.shortDescription || template.description}
      </p>

      <div className={`
        flex items-center justify-between text-xs text-gray-500 dark:text-gray-400
        ${compact ? 'mb-2' : 'mb-3'}
      `}>
        <span className="flex items-center">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></span>
          {categoryDisplay}
        </span>
        <span>{difficultyDisplay}</span>
      </div>

      {!compact && (
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>⏱️ {timeDisplay}</span>
          <span>📥 {downloadDisplay}</span>
        </div>
      )}

      {/* 태그 */}
      {!compact && template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {template.tags.slice(0, 2).map((tag) => (
            <span
              key={tag.id}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
            >
              {tag.name}
            </span>
          ))}
          {template.tags.length > 2 && (
            <span className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
              +{template.tags.length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  )
})

const TemplateActions = memo(function TemplateActions({
  template,
  onCreateProject,
  showPreview = true,
  showFavorite = true,
  compact = false
}: {
  template: ProjectTemplate
  onCreateProject?: (projectName: string) => void
  showPreview?: boolean
  showFavorite?: boolean
  compact?: boolean
}) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowCreateModal(true)
    setProjectName(`${template.name} 프로젝트`)
  }, [template.name])

  const handleCreateSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName.trim() || !onCreateProject) return

    setIsCreating(true)
    try {
      await onCreateProject(projectName.trim())
      setShowCreateModal(false)
      setProjectName('')
    } catch (error) {
      console.error('프로젝트 생성 실패:', error)
    } finally {
      setIsCreating(false)
    }
  }, [projectName, onCreateProject])

  const handleModalClose = useCallback(() => {
    setShowCreateModal(false)
    setProjectName('')
  }, [])

  if (compact) {
    return (
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
        <button
          onClick={handleCreateClick}
          className="
            px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md
            hover:bg-blue-700 focus:ring-2 focus:ring-blue-500
            transform scale-90 group-hover:scale-100
            transition-all duration-200
          "
          aria-label={`${template.name} 템플릿으로 프로젝트 생성`}
        >
          사용하기
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="px-4 pb-4">
        <div className="flex gap-2">
          <button
            onClick={handleCreateClick}
            className="
              flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md
              hover:bg-blue-700 focus:ring-2 focus:ring-blue-500
              transition-colors duration-200
            "
            aria-label={`${template.name} 템플릿으로 프로젝트 생성`}
          >
            사용하기
          </button>

          {showPreview && (
            <button
              className="
                px-3 py-2 border border-gray-300 dark:border-gray-600
                text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md
                hover:bg-gray-50 dark:hover:bg-gray-700
                focus:ring-2 focus:ring-blue-500
                transition-colors duration-200
              "
              aria-label={`${template.name} 템플릿 미리보기`}
            >
              미리보기
            </button>
          )}

          {showFavorite && (
            <button
              className="
                px-3 py-2 border border-gray-300 dark:border-gray-600
                text-gray-700 dark:text-gray-300 rounded-md
                hover:bg-gray-50 dark:hover:bg-gray-700
                focus:ring-2 focus:ring-blue-500
                transition-colors duration-200
              "
              aria-label={`${template.name} 템플릿 즐겨찾기`}
            >
              ♡
            </button>
          )}
        </div>
      </div>

      {/* 프로젝트 생성 모달 */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={handleModalClose}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              프로젝트 생성
            </h3>

            <form onSubmit={handleCreateSubmit}>
              <div className="mb-4">
                <label
                  htmlFor="project-name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  프로젝트 이름
                </label>
                <input
                  id="project-name"
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="
                    w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    transition-colors duration-200
                  "
                  placeholder="프로젝트 이름을 입력하세요"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="
                    px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
                    border border-gray-300 dark:border-gray-600 rounded-md
                    hover:bg-gray-50 dark:hover:bg-gray-700
                    focus:ring-2 focus:ring-blue-500
                    transition-colors duration-200
                  "
                  disabled={isCreating}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !projectName.trim()}
                  className="
                    px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md
                    hover:bg-blue-700 focus:ring-2 focus:ring-blue-500
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors duration-200
                  "
                >
                  {isCreating ? '생성 중...' : '프로젝트 생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
})

// ===========================================
// 메인 컴포넌트
// ===========================================

export const TemplateCard = memo(function TemplateCard({
  template,
  view = 'grid',
  compact = false,
  showBadge = null,
  className = '',
  onClick,
  onCreateProject,
  showPreview = true,
  showFavorite = true
}: TemplateCardProps) {
  const handleCardClick = useCallback(() => {
    onClick?.()
  }, [onClick])

  const cardClasses = `
    group relative cursor-pointer
    bg-white dark:bg-gray-800
    border border-gray-200 dark:border-gray-700
    rounded-lg overflow-hidden
    shadow-sm hover:shadow-lg
    transition-all duration-300
    transform hover:-translate-y-1
    ${view === 'list' ? 'flex' : 'flex flex-col'}
    ${compact ? 'max-w-xs' : ''}
    ${className}
  `

  return (
    <article
      className={cardClasses}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-label={`${template.name} 템플릿 선택`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCardClick()
        }
      }}
    >
      {/* 배지 */}
      {showBadge && <TemplateBadge type={showBadge} />}

      {/* 이미지 섹션 */}
      <div className={`
        relative overflow-hidden
        ${view === 'list' ? 'w-48 flex-shrink-0' : 'w-full'}
      `}>
        <TemplateImage template={template} compact={compact} />
      </div>

      {/* 정보 섹션 */}
      <div className="flex-1 flex flex-col">
        <TemplateInfo template={template} compact={compact} view={view} />

        {/* 액션 버튼들 (그리드 뷰에서만) */}
        {view === 'grid' && !compact && (
          <div className="mt-auto">
            <TemplateActions
              template={template}
              onCreateProject={onCreateProject}
              showPreview={showPreview}
              showFavorite={showFavorite}
              compact={compact}
            />
          </div>
        )}

        {/* 컴팩트 모드 액션 오버레이 */}
        {compact && (
          <TemplateActions
            template={template}
            onCreateProject={onCreateProject}
            showPreview={false}
            showFavorite={false}
            compact={true}
          />
        )}
      </div>
    </article>
  )
})

// 기본 내보내기
export default TemplateCard