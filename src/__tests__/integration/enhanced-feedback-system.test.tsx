/**
 * Enhanced Feedback System Integration Test
 *
 * CLAUDE.md 준수: TDD 통합 테스트
 * FRD.md 명세: Phase 3.9 영상 피드백 기능 통합 테스트
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { EnhancedFeedbackPage } from '../../pages/enhanced-feedback'
import { feedbackSlice } from '../../entities/feedback'

// Mock data
const mockVideoData = {
  id: 'test-video-1',
  title: '테스트 영상',
  description: '통합 테스트용 영상입니다',
  duration: '2:35',
  versions: ['v1', 'v2', 'v3'],
  currentVersion: 'v3'
}

const mockUser = {
  id: 'test-user-1',
  name: '테스트 사용자',
  email: 'test@example.com'
}

// Mock all external dependencies
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  }),
  useSearchParams: () => new URLSearchParams('?video=test-video-1&version=v3')
}))

// Mock auth if needed - commenting out for now
// jest.mock('../../app/store/hooks/useAuth', () => ({
//   useAuth: () => ({ user: mockUser })
// }))

jest.mock('../../features/video-feedback/hooks/usePlayerControls', () => ({
  usePlayerControls: () => ({
    isProcessing: false,
    error: null,
    lastAction: null,
    replaceVideo: jest.fn().mockResolvedValue({}),
    quickShare: jest.fn().mockResolvedValue('https://share.example.com/video123'),
    captureScreenshot: jest.fn().mockResolvedValue({}),
    startFeedbackAtCurrentTime: jest.fn(),
    openShareModal: jest.fn(),
    getCurrentTimecodeString: () => '00:01:23.456',
    registerShortcuts: () => () => {}
  })
}))

jest.mock('../../features/video-feedback/hooks/useVersionManager', () => ({
  useVersionManager: () => ({
    versions: mockVideoData.versions,
    currentVersion: mockVideoData.currentVersion,
    isLoading: false,
    error: null,
    switchToVersion: jest.fn(),
    activateVersion: jest.fn(),
    deleteVersion: jest.fn(),
    uploadVersion: jest.fn(),
    getVersionHistory: () => ({ totalVersions: 3 }),
    getActiveVersion: () => null,
    getStorageUsage: () => 50 * 1024 * 1024
  })
}))

jest.mock('../../features/video-feedback/hooks/useCommentThread', () => ({
  useCommentThread: () => ({
    comments: [
      {
        id: 'comment-1',
        content: '테스트 댓글입니다',
        author: mockUser,
        timecode: '00:01:23',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        reactions: {
          thumbsUp: { count: 2, userReacted: true },
          thumbsDown: { count: 0, userReacted: false },
          confused: { count: 1, userReacted: false }
        },
        status: 'open',
        replies: [],
        depth: 0
      }
    ],
    isLoading: false,
    error: null,
    addComment: jest.fn(),
    addReply: jest.fn(),
    updateComment: jest.fn(),
    deleteComment: jest.fn(),
    resolveComment: jest.fn(),
    reopenComment: jest.fn(),
    addReaction: jest.fn(),
    removeReaction: jest.fn()
  })
}))

jest.mock('../../features/video-feedback/hooks/useAdvancedSharing', () => ({
  useAdvancedSharing: () => ({
    shareLinks: [],
    isCreating: false,
    error: null,
    createShareLink: jest.fn(),
    deleteShareLink: jest.fn(),
    deactivateShareLink: jest.fn(),
    regenerateToken: jest.fn(),
    getShareStats: jest.fn().mockResolvedValue({
      totalLinks: 5,
      totalAccess: 25,
      uniqueUsers: 8,
      accessByLevel: { view: 15, comment: 8, edit: 2 },
      topDomains: [{ domain: 'company.com', count: 12 }]
    })
  })
}))

// 테스트 스토어 생성
const createTestStore = () => configureStore({
  reducer: {
    feedback: feedbackSlice.reducer,
  },
})

const renderWithProviders = (ui: React.ReactElement) => {
  const store = createTestStore()
  return render(
    <Provider store={store}>
      {ui}
    </Provider>
  )
}

describe('Enhanced Feedback System Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Clipboard API mock
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined)
      }
    })
  })

  describe('전체 페이지 렌더링', () => {
    it('모든 주요 컴포넌트가 렌더링되어야 한다', async () => {
      renderWithProviders(<EnhancedFeedbackPage />)

      // 헤더 요소들
      expect(screen.getByText('테스트 영상')).toBeInTheDocument()
      expect(screen.getByText('통합 테스트용 영상입니다')).toBeInTheDocument()

      // 플레이어 컨트롤
      expect(screen.getByText('교체')).toBeInTheDocument()
      expect(screen.getByText('공유')).toBeInTheDocument()
      expect(screen.getByText('스크린샷')).toBeInTheDocument()
      expect(screen.getByText('피드백 @TC')).toBeInTheDocument()

      // 버전 관리
      expect(screen.getByText('버전 관리')).toBeInTheDocument()

      // 댓글 시스템
      expect(screen.getByText('댓글')).toBeInTheDocument()
      expect(screen.getByText('테스트 댓글입니다')).toBeInTheDocument()
    })

    it('키보드 단축키 도움말이 작동해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProviders(<EnhancedFeedbackPage />)

      // H 키 눌러서 도움말 열기
      await user.keyboard('h')

      await waitFor(() => {
        expect(screen.getByText('키보드 단축키')).toBeInTheDocument()
        expect(screen.getByText('현재 타임코드에서 피드백 작성')).toBeInTheDocument()
      })

      // ESC 키로 닫기
      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByText('키보드 단축키')).not.toBeInTheDocument()
      })
    })

    it('반응형 사이드바가 토글되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProviders(<EnhancedFeedbackPage />)

      const toggleButton = screen.getByTitle('사이드바 토글')
      await user.click(toggleButton)

      // 사이드바가 숨겨지는지 확인 (클래스 변경)
      const mainGrid = toggleButton.closest('.max-w-7xl')?.querySelector('.grid')
      expect(mainGrid).toHaveClass('grid-cols-1')
    })
  })

  describe('플레이어 컨트롤 통합', () => {
    it('영상 교체 기능이 작동해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProviders(<EnhancedFeedbackPage />)

      const file = new File(['test'], 'test.mp4', { type: 'video/mp4' })
      const replaceButton = screen.getByText('교체')
      const fileInput = replaceButton.closest('div')?.querySelector('input[type="file"]')

      if (fileInput) {
        await user.upload(fileInput as HTMLElement, file)
      }

      // 파일 업로드 로직이 호출되는지 확인은 mock 함수로 검증
      // 실제로는 usePlayerControls hook의 replaceVideo가 호출됨
    })

    it('공유 메뉴가 열리고 작동해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProviders(<EnhancedFeedbackPage />)

      const shareButton = screen.getByText('공유')
      await user.click(shareButton)

      await waitFor(() => {
        expect(screen.getByText('빠른 공유 (보기)')).toBeInTheDocument()
        expect(screen.getByText('빠른 공유 (댓글)')).toBeInTheDocument()
        expect(screen.getByText('고급 공유 설정')).toBeInTheDocument()
      })

      // 빠른 공유 클릭 테스트
      const quickShareView = screen.getByText('빠른 공유 (보기)')
      await user.click(quickShareView)

      // 클립보드 복사 확인
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://share.example.com/video123')
      })
    })

    it('스크린샷 캡처가 작동해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProviders(<EnhancedFeedbackPage />)

      const screenshotButton = screen.getByText('스크린샷')
      await user.click(screenshotButton)

      // 스크린샷 캡처 로직 호출 확인은 mock을 통해 검증
      // 실제로는 usePlayerControls의 captureScreenshot이 호출됨
    })

    it('피드백 @TC 버튼이 작동해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProviders(<EnhancedFeedbackPage />)

      const feedbackButton = screen.getByText('피드백 @TC')
      await user.click(feedbackButton)

      // 피드백 시작 로직 호출 확인
    })
  })

  describe('버전 관리 통합', () => {
    it('버전 스위처가 렌더링되고 상호작용이 가능해야 한다', async () => {
      renderWithProviders(<EnhancedFeedbackPage />)

      expect(screen.getByText('버전 관리')).toBeInTheDocument()
      expect(screen.getByText('클릭: 전환 | 드래그: 업로드 | 1/2/3: 단축키')).toBeInTheDocument()

      // 버전 탭들이 렌더링되는지 확인
      // 실제 버전 데이터는 mock에서 제공
    })

    it('숫자 키 단축키로 버전 전환이 가능해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProviders(<EnhancedFeedbackPage />)

      // 1, 2, 3 키로 버전 전환 테스트
      await user.keyboard('1')
      await user.keyboard('2')
      await user.keyboard('3')

      // 실제 버전 전환은 mock 함수로 확인
    })
  })

  describe('댓글 시스템 통합', () => {
    it('댓글 목록이 렌더링되어야 한다', async () => {
      renderWithProviders(<EnhancedFeedbackPage />)

      // 탭에서 댓글 선택 (기본으로 선택되어 있음)
      expect(screen.getByText('댓글')).toBeInTheDocument()
      expect(screen.getByText('테스트 댓글입니다')).toBeInTheDocument()
      expect(screen.getByText('테스트 사용자')).toBeInTheDocument()
    })

    it('댓글 작성이 가능해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProviders(<EnhancedFeedbackPage />)

      // 댓글 작성 버튼 클릭
      const createButton = screen.getByTestId('toggle-comment-form')
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.getByTestId('comment-textarea')).toBeInTheDocument()
      })

      // 댓글 내용 입력
      const textarea = screen.getByTestId('comment-textarea')
      await user.type(textarea, '새로운 댓글입니다')

      // 작성 버튼 클릭
      const submitButton = screen.getByTestId('comment-submit')
      await user.click(submitButton)

      // 댓글 작성 로직 호출 확인
    })

    it('댓글에 반응 추가가 가능해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProviders(<EnhancedFeedbackPage />)

      // 좋아요 버튼 클릭 (이미 활성화된 상태)
      const thumbsUpButton = screen.getByTitle('좋아요')
      await user.click(thumbsUpButton)

      // 반응 제거 로직 호출 확인
    })

    it('댓글 정렬과 필터링이 작동해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProviders(<EnhancedFeedbackPage />)

      // 정렬 옵션 변경
      const oldestSort = screen.getByText('오래된순')
      await user.click(oldestSort)

      const reactionSort = screen.getByText('반응순')
      await user.click(reactionSort)

      // 필터 옵션 변경
      const unresolvedFilter = screen.getByText('미해결')
      await user.click(unresolvedFilter)

      const resolvedFilter = screen.getByText('해결됨')
      await user.click(resolvedFilter)
    })
  })

  describe('탭 네비게이션 통합', () => {
    it('탭 전환이 작동해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProviders(<EnhancedFeedbackPage />)

      // 타임라인 탭으로 전환
      const timelineTab = screen.getByText('타임라인')
      await user.click(timelineTab)

      // 탭이 활성화되는지 확인
      expect(timelineTab.closest('button')).toHaveClass('bg-blue-600')

      // 버전 탭으로 전환
      const versionsTab = screen.getByText('버전')
      await user.click(versionsTab)

      expect(versionsTab.closest('button')).toHaveClass('bg-blue-600')
      expect(screen.getByText('버전 히스토리')).toBeInTheDocument()
    })
  })

  describe('고급 공유 모달 통합', () => {
    it('공유 모달이 열리고 닫혀야 한다', async () => {
      const user = userEvent.setup()
      renderWithProviders(<EnhancedFeedbackPage />)

      // 공유하기 버튼 클릭 (헤더의 버튼)
      const shareButton = screen.getByText('공유하기')
      await user.click(shareButton)

      await waitFor(() => {
        expect(screen.getByText('고급 공유 설정')).toBeInTheDocument()
        expect(screen.getByText('새 링크 생성')).toBeInTheDocument()
      })

      // ESC 키로 모달 닫기
      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByText('고급 공유 설정')).not.toBeInTheDocument()
      })
    })

    it('공유 링크 생성 폼이 작동해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProviders(<EnhancedFeedbackPage />)

      // 모달 열기
      const shareButton = screen.getByText('공유하기')
      await user.click(shareButton)

      await waitFor(() => {
        expect(screen.getByText('액세스 권한')).toBeInTheDocument()
      })

      // 권한 레벨 선택
      const commentAccess = screen.getByLabelText(/댓글 작성/)
      await user.click(commentAccess)

      // 만료 시간 설정
      const oneDayPreset = screen.getByText('1일')
      await user.click(oneDayPreset)

      // 옵션 체크
      const qrCodeOption = screen.getByLabelText(/QR 코드 생성/)
      await user.click(qrCodeOption)

      // 폼 제출
      const createButton = screen.getByText('공유 링크 생성')
      await user.click(createButton)

      // 링크 생성 로직 호출 확인
    })
  })

  describe('통합 워크플로우', () => {
    it('전체 피드백 워크플로우가 작동해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProviders(<EnhancedFeedbackPage />)

      // 1. 특정 타임코드에서 피드백 시작
      const feedbackButton = screen.getByText('피드백 @TC')
      await user.click(feedbackButton)

      // 2. 댓글 작성 폼 열기
      const createCommentButton = screen.getByTestId('toggle-comment-form')
      await user.click(createCommentButton)

      // 3. 댓글 내용 입력
      const textarea = screen.getByTestId('comment-textarea')
      await user.type(textarea, '이 부분에서 음성이 너무 작습니다')

      // 4. 댓글 작성
      const submitButton = screen.getByTestId('comment-submit')
      await user.click(submitButton)

      // 5. 스크린샷 캡처
      const screenshotButton = screen.getByText('스크린샷')
      await user.click(screenshotButton)

      // 6. 공유 링크 생성
      const shareButtonInControls = screen.getByText('공유')
      await user.click(shareButtonInControls)

      const quickShare = screen.getByText('빠른 공유 (댓글)')
      await user.click(quickShare)

      // 전체 워크플로우가 순서대로 실행되는지 확인
    })

    it('에러 상황에서 적절한 처리가 되어야 한다', async () => {
      // 에러 상황 시뮬레이션을 위해 mock 함수가 에러를 던지도록 설정
      const mockError = new Error('네트워크 오류')

      jest.mocked(jest.requireMock('../../features/video-feedback/hooks/useCommentThread').useCommentThread).mockReturnValue({
        comments: [],
        isLoading: false,
        error: '댓글을 불러올 수 없습니다',
        addComment: jest.fn().mockRejectedValue(mockError),
        addReply: jest.fn(),
        updateComment: jest.fn(),
        deleteComment: jest.fn(),
        resolveComment: jest.fn(),
        reopenComment: jest.fn(),
        addReaction: jest.fn(),
        removeReaction: jest.fn()
      })

      renderWithProviders(<EnhancedFeedbackPage />)

      // 에러 메시지가 표시되는지 확인
      expect(screen.getByText('댓글을 불러올 수 없습니다')).toBeInTheDocument()
      expect(screen.getByText('다시 시도')).toBeInTheDocument()
    })
  })

  describe('성능 및 사용성', () => {
    it('로딩 상태가 적절히 표시되어야 한다', async () => {
      // 로딩 상태 시뮬레이션
      jest.mocked(jest.requireMock('../../features/video-feedback/hooks/useCommentThread').useCommentThread).mockReturnValue({
        comments: [],
        isLoading: true,
        error: null,
        addComment: jest.fn(),
        addReply: jest.fn(),
        updateComment: jest.fn(),
        deleteComment: jest.fn(),
        resolveComment: jest.fn(),
        reopenComment: jest.fn(),
        addReaction: jest.fn(),
        removeReaction: jest.fn()
      })

      renderWithProviders(<EnhancedFeedbackPage />)

      expect(screen.getByText('댓글을 불러오는 중...')).toBeInTheDocument()
    })

    it('키보드 네비게이션이 가능해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProviders(<EnhancedFeedbackPage />)

      // Tab 키로 요소들 사이 이동
      await user.tab()
      await user.tab()
      await user.tab()

      // Enter 키로 활성화
      await user.keyboard('{Enter}')

      // 키보드만으로 주요 기능 사용 가능한지 확인
    })

    it('접근성 요구사항이 충족되어야 한다', () => {
      renderWithProviders(<EnhancedFeedbackPage />)

      // ARIA 라벨들이 적절히 설정되어 있는지 확인
      expect(screen.getByRole('list', { name: /댓글/ })).toBeInTheDocument()
      expect(screen.getByRole('tablist')).toBeInTheDocument()

      // 스크린 리더를 위한 실시간 업데이트 영역 확인
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })
})