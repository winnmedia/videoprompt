/**
 * EnhancedCommentThread 컴포넌트 TDD 테스트
 *
 * CLAUDE.md 준수: TDD 우선, 접근성 검증
 * FRD.md 요구사항: 스레드 댓글, 대댓글 3단계, 감정표현 3종, 해결/수정/삭제
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { EnhancedCommentThread } from '../EnhancedCommentThread'
import { feedbackSlice } from '../../../entities/feedback'

// 모킹된 댓글 데이터
const mockComments = [
  {
    id: 'comment-1',
    content: '전체적으로 좋은 영상이네요!',
    author: {
      id: 'user-1',
      name: '김영희',
      email: 'kim@example.com',
      avatar: '/avatars/kim.jpg'
    },
    timecode: '00:01:23.456',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    reactions: {
      thumbsUp: { count: 5, userReacted: true },
      thumbsDown: { count: 0, userReacted: false },
      confused: { count: 1, userReacted: false }
    },
    status: 'open' as const,
    replies: [
      {
        id: 'reply-1',
        content: '동감합니다. 편집도 깔끔하고요.',
        author: {
          id: 'user-2',
          name: '박철수',
          email: 'park@example.com',
          avatar: '/avatars/park.jpg'
        },
        parentId: 'comment-1',
        timecode: '00:01:23.456',
        createdAt: '2024-01-15T10:35:00Z',
        updatedAt: '2024-01-15T10:35:00Z',
        reactions: {
          thumbsUp: { count: 2, userReacted: false },
          thumbsDown: { count: 0, userReacted: false },
          confused: { count: 0, userReacted: false }
        },
        status: 'open' as const,
        depth: 1,
        replies: []
      }
    ],
    depth: 0
  },
  {
    id: 'comment-2',
    content: '1분 25초 부분에서 음성이 작게 들립니다.',
    author: {
      id: 'user-3',
      name: '이민수',
      email: 'lee@example.com',
      avatar: '/avatars/lee.jpg'
    },
    timecode: '00:01:25.000',
    createdAt: '2024-01-15T11:00:00Z',
    updatedAt: '2024-01-15T11:00:00Z',
    reactions: {
      thumbsUp: { count: 3, userReacted: false },
      thumbsDown: { count: 0, userReacted: false },
      confused: { count: 0, userReacted: false }
    },
    status: 'open' as const,
    replies: [],
    depth: 0
  }
]

// 모킹된 훅
const mockCommentHooks = {
  comments: mockComments,
  isLoading: false,
  error: null,
  addComment: jest.fn(),
  updateComment: jest.fn(),
  deleteComment: jest.fn(),
  addReaction: jest.fn(),
  removeReaction: jest.fn(),
  resolveComment: jest.fn(),
  reopenComment: jest.fn(),
  addReply: jest.fn(),
  sortBy: 'newest' as const,
  setSortBy: jest.fn(),
  filterBy: 'all' as const,
  setFilterBy: jest.fn(),
}

jest.mock('../../../features/video-feedback/hooks/useCommentThread', () => ({
  useCommentThread: () => mockCommentHooks,
}))

// 현재 사용자 모킹
const mockCurrentUser = {
  id: 'user-1',
  name: '김영희',
  email: 'kim@example.com',
  avatar: '/avatars/kim.jpg'
}

jest.mock('../../../shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockCurrentUser }),
}))

// 테스트 스토어 생성
const createTestStore = () => configureStore({
  reducer: {
    feedback: feedbackSlice.reducer,
  },
})

const renderWithProvider = (ui: React.ReactElement) => {
  const store = createTestStore()
  return render(
    <Provider store={store}>
      {ui}
    </Provider>
  )
}

describe('EnhancedCommentThread', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('기본 렌더링', () => {
    it('모든 댓글이 렌더링되어야 한다', () => {
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      expect(screen.getByText('전체적으로 좋은 영상이네요!')).toBeInTheDocument()
      expect(screen.getByText('1분 25초 부분에서 음성이 작게 들립니다.')).toBeInTheDocument()
    })

    it('댓글 작성자 정보가 표시되어야 한다', () => {
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      expect(screen.getByText('김영희')).toBeInTheDocument()
      expect(screen.getByText('이민수')).toBeInTheDocument()
    })

    it('타임코드가 표시되어야 한다', () => {
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      expect(screen.getByText('00:01:23')).toBeInTheDocument()
      expect(screen.getByText('00:01:25')).toBeInTheDocument()
    })

    it('대댓글이 들여쓰기되어 표시되어야 한다', () => {
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const reply = screen.getByText('동감합니다. 편집도 깔끔하고요.')
      expect(reply.closest('[data-testid^="comment-reply"]')).toHaveClass('ml-8')
    })
  })

  describe('감정표현 기능', () => {
    it('3가지 감정표현 버튼이 표시되어야 한다', () => {
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const thumbsUpButtons = screen.getAllByTitle('좋아요')
      const thumbsDownButtons = screen.getAllByTitle('싫어요')
      const confusedButtons = screen.getAllByTitle('모호해요')

      expect(thumbsUpButtons.length).toBeGreaterThan(0)
      expect(thumbsDownButtons.length).toBeGreaterThan(0)
      expect(confusedButtons.length).toBeGreaterThan(0)
    })

    it('감정표현 카운트가 표시되어야 한다', () => {
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      expect(screen.getByText('5')).toBeInTheDocument() // 좋아요 5개
      expect(screen.getByText('1')).toBeInTheDocument() // 모호해요 1개
    })

    it('사용자가 반응한 감정표현이 활성화되어 표시되어야 한다', () => {
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const firstCommentThumbsUp = screen.getAllByTitle('좋아요')[0]
      expect(firstCommentThumbsUp).toHaveClass('text-blue-600')
    })

    it('감정표현 클릭 시 적절한 함수가 호출되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const thumbsUpButton = screen.getAllByTitle('좋아요')[1] // 두 번째 댓글
      await user.click(thumbsUpButton)

      await waitFor(() => {
        expect(mockCommentHooks.addReaction).toHaveBeenCalledWith('comment-2', 'thumbsUp')
      })
    })

    it('이미 반응한 감정표현 클릭 시 제거되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const thumbsUpButton = screen.getAllByTitle('좋아요')[0] // 첫 번째 댓글 (이미 반응함)
      await user.click(thumbsUpButton)

      await waitFor(() => {
        expect(mockCommentHooks.removeReaction).toHaveBeenCalledWith('comment-1', 'thumbsUp')
      })
    })
  })

  describe('댓글 작성 기능', () => {
    it('댓글 입력창이 표시되어야 한다', () => {
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      expect(screen.getByPlaceholderText('댓글을 입력하세요...')).toBeInTheDocument()
    })

    it('댓글 작성 시 addComment가 호출되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const textarea = screen.getByPlaceholderText('댓글을 입력하세요...')
      const submitButton = screen.getByText('댓글 작성')

      await user.type(textarea, '새로운 댓글입니다.')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockCommentHooks.addComment).toHaveBeenCalledWith({
          content: '새로운 댓글입니다.',
          timecode: undefined // 타임코드가 설정되지 않은 경우
        })
      })
    })

    it('빈 댓글은 작성할 수 없어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const submitButton = screen.getByText('댓글 작성')
      expect(submitButton).toBeDisabled()

      const textarea = screen.getByPlaceholderText('댓글을 입력하세요...')
      await user.type(textarea, '   ') // 공백만 입력

      expect(submitButton).toBeDisabled()
    })
  })

  describe('대댓글 기능', () => {
    it('답글 버튼을 클릭하면 대댓글 입력창이 표시되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const replyButtons = screen.getAllByText('답글')
      await user.click(replyButtons[0])

      expect(screen.getByPlaceholderText('답글을 입력하세요...')).toBeInTheDocument()
    })

    it('대댓글 작성 시 addReply가 호출되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const replyButtons = screen.getAllByText('답글')
      await user.click(replyButtons[0])

      const replyTextarea = screen.getByPlaceholderText('답글을 입력하세요...')
      const replySubmitButton = screen.getByText('답글 작성')

      await user.type(replyTextarea, '대댓글입니다.')
      await user.click(replySubmitButton)

      await waitFor(() => {
        expect(mockCommentHooks.addReply).toHaveBeenCalledWith('comment-1', {
          content: '대댓글입니다.',
          timecode: '00:01:23.456'
        })
      })
    })

    it('3단계 깊이까지만 대댓글이 가능해야 한다', async () => {
      // 깊이 2인 댓글에 대해서는 답글 버튼이 표시되지 않아야 함
      const commentsWithMaxDepth = [
        {
          ...mockComments[0],
          replies: [
            {
              ...mockComments[0].replies[0],
              depth: 1,
              replies: [
                {
                  id: 'reply-2',
                  content: '3단계 깊이 댓글',
                  author: mockCurrentUser,
                  parentId: 'reply-1',
                  timecode: '00:01:23.456',
                  createdAt: '2024-01-15T10:40:00Z',
                  updatedAt: '2024-01-15T10:40:00Z',
                  reactions: {
                    thumbsUp: { count: 0, userReacted: false },
                    thumbsDown: { count: 0, userReacted: false },
                    confused: { count: 0, userReacted: false }
                  },
                  status: 'open' as const,
                  depth: 2,
                  replies: []
                }
              ]
            }
          ]
        }
      ]

      mockCommentHooks.comments = commentsWithMaxDepth

      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const replyButtons = screen.getAllByText('답글')
      // 깊이 2인 댓글에는 답글 버튼이 없어야 함
      expect(replyButtons).toHaveLength(2) // 원댓글 + 1단계 댓글만
    })
  })

  describe('댓글 관리 기능', () => {
    it('댓글 작성자만 수정/삭제 버튼을 볼 수 있어야 한다', () => {
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      // 첫 번째 댓글은 현재 사용자가 작성 (김영희)
      const firstCommentActions = screen.getAllByRole('button', { name: /더보기/ })[0]
      expect(firstCommentActions).toBeInTheDocument()

      // 다른 사용자 댓글에는 더보기 버튼이 없어야 함 (또는 제한된 옵션만)
      const secondCommentSection = screen.getByText('1분 25초 부분에서 음성이 작게 들립니다.').closest('[data-testid^="comment-item"]')
      expect(secondCommentSection).not.toHaveTextContent('수정')
      expect(secondCommentSection).not.toHaveTextContent('삭제')
    })

    it('댓글 해결 버튼이 표시되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const moreButton = screen.getAllByRole('button', { name: /더보기/ })[0]
      await user.click(moreButton)

      expect(screen.getByText('해결됨으로 표시')).toBeInTheDocument()
    })

    it('댓글 해결 시 resolveComment가 호출되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const moreButton = screen.getAllByRole('button', { name: /더보기/ })[0]
      await user.click(moreButton)

      const resolveButton = screen.getByText('해결됨으로 표시')
      await user.click(resolveButton)

      await waitFor(() => {
        expect(mockCommentHooks.resolveComment).toHaveBeenCalledWith('comment-1')
      })
    })

    it('댓글 삭제 시 확인 다이얼로그가 표시되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const moreButton = screen.getAllByRole('button', { name: /더보기/ })[0]
      await user.click(moreButton)

      const deleteButton = screen.getByText('삭제')
      await user.click(deleteButton)

      expect(screen.getByText('댓글 삭제 확인')).toBeInTheDocument()
    })
  })

  describe('정렬 및 필터링', () => {
    it('정렬 옵션들이 표시되어야 한다', () => {
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      expect(screen.getByText('최신순')).toBeInTheDocument()
      expect(screen.getByText('오래된순')).toBeInTheDocument()
      expect(screen.getByText('반응순')).toBeInTheDocument()
    })

    it('필터 옵션들이 표시되어야 한다', () => {
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      expect(screen.getByText('전체')).toBeInTheDocument()
      expect(screen.getByText('미해결')).toBeInTheDocument()
      expect(screen.getByText('해결됨')).toBeInTheDocument()
    })

    it('정렬 옵션 변경 시 setSortBy가 호출되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const oldestOption = screen.getByText('오래된순')
      await user.click(oldestOption)

      expect(mockCommentHooks.setSortBy).toHaveBeenCalledWith('oldest')
    })

    it('필터 옵션 변경 시 setFilterBy가 호출되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const unresolvedOption = screen.getByText('미해결')
      await user.click(unresolvedOption)

      expect(mockCommentHooks.setFilterBy).toHaveBeenCalledWith('unresolved')
    })
  })

  describe('접근성', () => {
    it('댓글 목록에 적절한 ARIA 라벨이 있어야 한다', () => {
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const commentList = screen.getByRole('list', { name: /댓글/ })
      expect(commentList).toBeInTheDocument()
    })

    it('각 댓글이 listitem 역할을 가져야 한다', () => {
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const commentItems = screen.getAllByRole('listitem')
      expect(commentItems.length).toBeGreaterThanOrEqual(2) // 최소 2개 댓글
    })

    it('감정표현 버튼이 키보드로 접근 가능해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const thumbsUpButton = screen.getAllByTitle('좋아요')[0]
      thumbsUpButton.focus()

      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockCommentHooks.removeReaction).toHaveBeenCalled()
      })
    })

    it('스크린 리더를 위한 실시간 업데이트 영역이 있어야 한다', () => {
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toBeInTheDocument()
    })
  })

  describe('로딩 및 에러 상태', () => {
    it('로딩 중 스켈레톤 UI가 표시되어야 한다', () => {
      mockCommentHooks.isLoading = true
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      expect(screen.getByText('댓글을 불러오는 중...')).toBeInTheDocument()
    })

    it('에러 발생 시 에러 메시지가 표시되어야 한다', () => {
      mockCommentHooks.error = '댓글을 불러올 수 없습니다'
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      expect(screen.getByText('댓글을 불러올 수 없습니다')).toBeInTheDocument()
      expect(screen.getByText('다시 시도')).toBeInTheDocument()
    })

    it('댓글이 없을 때 빈 상태 메시지가 표시되어야 한다', () => {
      mockCommentHooks.comments = []
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      expect(screen.getByText('아직 댓글이 없습니다')).toBeInTheDocument()
      expect(screen.getByText('첫 번째 댓글을 작성해보세요!')).toBeInTheDocument()
    })
  })

  describe('반응형 동작', () => {
    it('모바일에서 간소화된 UI가 표시되어야 한다', () => {
      // 모바일 뷰포트 시뮬레이션
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480,
      })

      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      // 모바일에서는 작성자 아바타가 작게 표시되어야 함
      const avatars = screen.getAllByRole('img', { name: /아바타/ })
      avatars.forEach(avatar => {
        expect(avatar).toHaveClass('w-8', 'h-8') // 모바일에서는 32px
      })
    })
  })

  describe('실시간 업데이트', () => {
    it('새 댓글 추가 시 실시간 알림이 표시되어야 한다', async () => {
      renderWithProvider(<EnhancedCommentThread versionId="v1" />)

      // 새 댓글 시뮬레이션
      const newComment = {
        id: 'comment-3',
        content: '새로운 댓글입니다',
        author: mockCurrentUser,
        timecode: '00:02:00.000',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reactions: {
          thumbsUp: { count: 0, userReacted: false },
          thumbsDown: { count: 0, userReacted: false },
          confused: { count: 0, userReacted: false }
        },
        status: 'open' as const,
        replies: [],
        depth: 0
      }

      // 댓글 목록 업데이트
      mockCommentHooks.comments = [...mockComments, newComment]

      // 컴포넌트 리렌더링 트리거
      const { rerender } = renderWithProvider(<EnhancedCommentThread versionId="v1" />)
      rerender(<Provider store={createTestStore()}><EnhancedCommentThread versionId="v1" /></Provider>)

      expect(screen.getByText('새로운 댓글입니다')).toBeInTheDocument()
    })
  })
})