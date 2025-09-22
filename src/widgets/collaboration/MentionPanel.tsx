/**
 * 멘션 패널 컴포넌트
 *
 * CLAUDE.md 준수사항:
 * - FSD widgets 레이어 (UI 컴포넌트)
 * - Tailwind CSS v4 사용
 * - 접근성 (WCAG 2.1 AA) 준수
 * - 실시간 멘션 표시 및 상호작용
 */

'use client'

import React, { memo, useState, useCallback, useMemo } from 'react'
import { XMarkIcon, BellIcon, UserIcon, UsersIcon } from '@heroicons/react/24/outline'
import { BellIcon as BellSolidIcon } from '@heroicons/react/24/solid'
import { useMentions } from '../../features/collaboration'
import type { Mention, MentionType } from '../../entities/collaboration'
import { CollaborationUtils } from '../../entities/collaboration'

// ===========================================
// 타입 정의
// ===========================================

export interface MentionPanelProps {
  /**
   * 패널 표시 여부
   */
  readonly isOpen: boolean

  /**
   * 패널 닫기 콜백
   */
  readonly onClose: () => void

  /**
   * 패널 위치
   */
  readonly position?: 'left' | 'right'

  /**
   * 사용자 정의 CSS 클래스
   */
  readonly className?: string
}

// ===========================================
// 서브 컴포넌트들
// ===========================================

const MentionTypeIcon = memo(function MentionTypeIcon({
  type,
  className = 'w-4 h-4'
}: {
  type: MentionType
  className?: string
}) {
  switch (type) {
    case 'user':
      return <UserIcon className={className} aria-hidden="true" />
    case 'everyone':
    case 'here':
      return <UsersIcon className={className} aria-hidden="true" />
    case 'role':
      return <UserIcon className={className} aria-hidden="true" />
    default:
      return <BellIcon className={className} aria-hidden="true" />
  }
})

const MentionItem = memo(function MentionItem({
  mention,
  onSelect,
  onMarkAsRead
}: {
  mention: Mention
  onSelect: (mention: Mention) => void
  onMarkAsRead: (mentionId: string) => void
}) {
  const handleClick = useCallback(() => {
    onSelect(mention)
    if (!mention.isRead) {
      onMarkAsRead(mention.id)
    }
  }, [mention, onSelect, onMarkAsRead])

  const relativeTime = CollaborationUtils.getRelativeTime(mention.createdAt)
  const mentionText = CollaborationUtils.formatMentionText(mention)

  return (
    <div
      className={`
        p-4 border-b border-gray-200 dark:border-gray-700
        hover:bg-gray-50 dark:hover:bg-gray-800
        cursor-pointer transition-colors duration-200
        ${!mention.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
      `}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`멘션: ${mention.message}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      <div className="flex items-start space-x-3">
        {/* 아바타 */}
        <div className="flex-shrink-0">
          {mention.mentionedBy.avatar ? (
            <img
              src={mention.mentionedBy.avatar}
              alt={mention.mentionedBy.name}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </div>
          )}
        </div>

        {/* 멘션 내용 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {mention.mentionedBy.name}
              </span>
              <div className="flex items-center space-x-1">
                <MentionTypeIcon type={mention.type} className="w-3 h-3 text-gray-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {mentionText}
                </span>
              </div>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {relativeTime}
            </span>
          </div>

          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
            {mention.message}
          </p>

          {/* 컨텍스트 정보 */}
          <div className="flex items-center space-x-2 mt-2">
            <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
              {mention.context}
            </span>
            {mention.metadata.urgency !== 'normal' && (
              <span className={`
                text-xs px-2 py-1 rounded
                ${mention.metadata.urgency === 'high'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                }
              `}>
                {mention.metadata.urgency === 'high' ? '긴급' : '낮음'}
              </span>
            )}
            {!mention.isRead && (
              <div className="w-2 h-2 bg-blue-600 rounded-full" aria-label="읽지 않음" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

const MentionFilters = memo(function MentionFilters({
  activeFilter,
  onFilterChange,
  unreadCount
}: {
  activeFilter: 'all' | 'unread' | 'mentions'
  onFilterChange: (filter: 'all' | 'unread' | 'mentions') => void
  unreadCount: number
}) {
  return (
    <div className="flex space-x-1 p-2 border-b border-gray-200 dark:border-gray-700">
      <button
        onClick={() => onFilterChange('all')}
        className={`
          px-3 py-1 text-sm font-medium rounded-md transition-colors duration-200
          ${activeFilter === 'all'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }
        `}
      >
        전체
      </button>
      <button
        onClick={() => onFilterChange('unread')}
        className={`
          px-3 py-1 text-sm font-medium rounded-md transition-colors duration-200
          flex items-center space-x-1
          ${activeFilter === 'unread'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }
        `}
      >
        <span>읽지 않음</span>
        {unreadCount > 0 && (
          <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
            {unreadCount}
          </span>
        )}
      </button>
      <button
        onClick={() => onFilterChange('mentions')}
        className={`
          px-3 py-1 text-sm font-medium rounded-md transition-colors duration-200
          ${activeFilter === 'mentions'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }
        `}
      >
        내 멘션
      </button>
    </div>
  )
})

// ===========================================
// 메인 컴포넌트
// ===========================================

export const MentionPanel = memo(function MentionPanel({
  isOpen,
  onClose,
  position = 'right',
  className = ''
}: MentionPanelProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'mentions'>('all')

  const {
    mentions,
    unreadMentions,
    myMentions,
    unreadCount,
    selectMention,
    markAsRead,
    markAllAsRead,
    clearErrors
  } = useMentions()

  // ===========================================
  // 필터링된 멘션 목록
  // ===========================================

  const filteredMentions = useMemo(() => {
    switch (activeFilter) {
      case 'unread':
        return unreadMentions
      case 'mentions':
        return myMentions
      default:
        return mentions
    }
  }, [activeFilter, mentions, unreadMentions, myMentions])

  // ===========================================
  // 이벤트 핸들러들
  // ===========================================

  const handleMentionSelect = useCallback((mention: Mention) => {
    selectMention(mention.id)
    // 실제로는 해당 컨텍스트로 이동하는 로직 필요
  }, [selectMention])

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead()
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }, [markAllAsRead])

  const handleFilterChange = useCallback((filter: 'all' | 'unread' | 'mentions') => {
    setActiveFilter(filter)
  }, [])

  // 패널이 닫혀있으면 렌더링하지 않음
  if (!isOpen) return null

  // ===========================================
  // 렌더링
  // ===========================================

  return (
    <>
      {/* 배경 오버레이 (모바일에서만) */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 메인 패널 */}
      <div
        className={`
          fixed top-0 z-50 h-full w-80 bg-white dark:bg-gray-900
          border-l border-gray-200 dark:border-gray-700
          shadow-xl transform transition-transform duration-300 ease-in-out
          ${position === 'right' ? 'right-0' : 'left-0'}
          ${isOpen ? 'translate-x-0' : position === 'right' ? 'translate-x-full' : '-translate-x-full'}
          ${className}
        `}
        role="dialog"
        aria-labelledby="mention-panel-title"
        aria-modal="true"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <BellSolidIcon className="w-5 h-5 text-blue-600" aria-hidden="true" />
            <h2 id="mention-panel-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              멘션
            </h2>
            {unreadCount > 0 && (
              <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full min-w-[1.5rem] text-center">
                {unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* 모두 읽음 처리 버튼 */}
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="
                  text-sm text-blue-600 dark:text-blue-400
                  hover:text-blue-700 dark:hover:text-blue-300
                  focus:outline-none focus:ring-2 focus:ring-blue-500 rounded
                  px-2 py-1
                "
                aria-label="모든 멘션 읽음 처리"
              >
                모두 읽음
              </button>
            )}

            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="
                p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                hover:bg-gray-100 dark:hover:bg-gray-800
                rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
                transition-colors duration-200
              "
              aria-label="멘션 패널 닫기"
            >
              <XMarkIcon className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* 필터 */}
        <MentionFilters
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          unreadCount={unreadCount}
        />

        {/* 멘션 목록 */}
        <div className="flex-1 overflow-y-auto">
          {filteredMentions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400">
              <BellIcon className="w-8 h-8 mb-2" aria-hidden="true" />
              <p className="text-sm text-center">
                {activeFilter === 'unread'
                  ? '읽지 않은 멘션이 없습니다'
                  : activeFilter === 'mentions'
                  ? '내 멘션이 없습니다'
                  : '멘션이 없습니다'
                }
              </p>
            </div>
          ) : (
            <div role="list" aria-label="멘션 목록">
              {filteredMentions.map((mention) => (
                <MentionItem
                  key={mention.id}
                  mention={mention}
                  onSelect={handleMentionSelect}
                  onMarkAsRead={markAsRead}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
})

// 기본 내보내기
export default MentionPanel