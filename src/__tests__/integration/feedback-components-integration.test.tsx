/**
 * Feedback Components Integration Test
 *
 * 피드백 시스템 컴포넌트들의 기본 통합 테스트
 * CLAUDE.md 준수: TDD 통합 테스트 (단순화 버전)
 */

import { render, screen } from '@testing-library/react'
import { EnhancedVersionSwitcher } from '../../widgets/feedback/EnhancedVersionSwitcher'
import { ImprovedCommentThread } from '../../widgets/feedback/ImprovedCommentThread'

// Mock data
const mockVersions = ['v1', 'v2', 'v3']
const mockComments = [
  {
    id: 'comment-1',
    content: '테스트 댓글입니다',
    author: {
      id: 'user-1',
      name: '테스트 사용자',
      email: 'test@example.com'
    },
    timecode: '00:01:23',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    reactions: {
      thumbsUp: { count: 2, userReacted: true },
      thumbsDown: { count: 0, userReacted: false },
      confused: { count: 1, userReacted: false }
    },
    status: 'open' as const,
    replies: [],
    depth: 0
  }
]

// Mock functions for components
const mockVersionHandlers = {
  onVersionSwitch: jest.fn(),
  onVersionDelete: jest.fn(),
  onVersionUpload: jest.fn()
}

const mockCommentHandlers = {
  onAddComment: jest.fn(),
  onUpdateComment: jest.fn(),
  onDeleteComment: jest.fn(),
  onToggleReaction: jest.fn(),
  onToggleResolved: jest.fn()
}

describe('Feedback Components Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('EnhancedVersionSwitcher', () => {
    it('컴포넌트가 정상적으로 렌더링되어야 함', () => {
      render(
        <EnhancedVersionSwitcher
          versions={mockVersions}
          currentVersion="v3"
          onVersionSwitch={mockVersionHandlers.onVersionSwitch}
          onVersionDelete={mockVersionHandlers.onVersionDelete}
          onVersionUpload={mockVersionHandlers.onVersionUpload}
        />
      )

      // 버전 스위처가 렌더링되었는지 확인
      expect(screen.getByText('v3')).toBeInTheDocument()
    })

    it('모든 버전들이 표시되어야 함', () => {
      render(
        <EnhancedVersionSwitcher
          versions={mockVersions}
          currentVersion="v2"
          onVersionSwitch={mockVersionHandlers.onVersionSwitch}
          onVersionDelete={mockVersionHandlers.onVersionDelete}
          onVersionUpload={mockVersionHandlers.onVersionUpload}
        />
      )

      // 각 버전이 표시되는지 확인
      mockVersions.forEach(version => {
        expect(screen.getByText(version)).toBeInTheDocument()
      })
    })
  })

  describe('ImprovedCommentThread', () => {
    it('컴포넌트가 정상적으로 렌더링되어야 함', () => {
      render(
        <ImprovedCommentThread
          comments={mockComments}
          onAddComment={mockCommentHandlers.onAddComment}
          onUpdateComment={mockCommentHandlers.onUpdateComment}
          onDeleteComment={mockCommentHandlers.onDeleteComment}
          onToggleReaction={mockCommentHandlers.onToggleReaction}
          onToggleResolved={mockCommentHandlers.onToggleResolved}
        />
      )

      // 댓글 시스템이 렌더링되었는지 확인
      expect(screen.getByText('테스트 댓글입니다')).toBeInTheDocument()
    })

    it('댓글 작성자 정보가 표시되어야 함', () => {
      render(
        <ImprovedCommentThread
          comments={mockComments}
          onAddComment={mockCommentHandlers.onAddComment}
          onUpdateComment={mockCommentHandlers.onUpdateComment}
          onDeleteComment={mockCommentHandlers.onDeleteComment}
          onToggleReaction={mockCommentHandlers.onToggleReaction}
          onToggleResolved={mockCommentHandlers.onToggleResolved}
        />
      )

      // 작성자 이름이 표시되는지 확인
      expect(screen.getByText('테스트 사용자')).toBeInTheDocument()
    })

    it('반응 버튼들이 표시되어야 함', () => {
      render(
        <ImprovedCommentThread
          comments={mockComments}
          onAddComment={mockCommentHandlers.onAddComment}
          onUpdateComment={mockCommentHandlers.onUpdateComment}
          onDeleteComment={mockCommentHandlers.onDeleteComment}
          onToggleReaction={mockCommentHandlers.onToggleReaction}
          onToggleResolved={mockCommentHandlers.onToggleResolved}
        />
      )

      // 반응 카운트가 표시되는지 확인
      expect(screen.getByText('2')).toBeInTheDocument() // thumbsUp count
      expect(screen.getByText('1')).toBeInTheDocument() // confused count
    })
  })

  describe('Components Integration', () => {
    it('모든 컴포넌트가 함께 렌더링되어야 함', () => {
      const { container } = render(
        <div>
          <EnhancedVersionSwitcher
            versions={mockVersions}
            currentVersion="v3"
            onVersionSwitch={mockVersionHandlers.onVersionSwitch}
            onVersionDelete={mockVersionHandlers.onVersionDelete}
            onVersionUpload={mockVersionHandlers.onVersionUpload}
          />
          <ImprovedCommentThread
            comments={mockComments}
            onAddComment={mockCommentHandlers.onAddComment}
            onUpdateComment={mockCommentHandlers.onUpdateComment}
            onDeleteComment={mockCommentHandlers.onDeleteComment}
            onToggleReaction={mockCommentHandlers.onToggleReaction}
            onToggleResolved={mockCommentHandlers.onToggleResolved}
          />
        </div>
      )

      // 두 컴포넌트 모두 렌더링되었는지 확인
      expect(screen.getByText('v3')).toBeInTheDocument()
      expect(screen.getByText('테스트 댓글입니다')).toBeInTheDocument()
      expect(container).toMatchSnapshot()
    })
  })
})