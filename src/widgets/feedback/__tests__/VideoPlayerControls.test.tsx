/**
 * VideoPlayerControls 컴포넌트 TDD 테스트
 *
 * CLAUDE.md 준수: TDD 우선, 접근성 검증, 키보드 네비게이션
 * FRD.md 요구사항 검증: 플레이어 하부 툴바, 키보드 단축키, 드래그앤드롭
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { VideoPlayerControls } from '../VideoPlayerControls'
import { feedbackReducer } from '../../../entities/feedback'

// 모킹된 훅들
const mockPlayerControls = {
  isProcessing: false,
  error: null,
  lastAction: null,
  replaceVideo: jest.fn(),
  quickShare: jest.fn(),
  captureScreenshot: jest.fn(),
  startFeedbackAtCurrentTime: jest.fn(),
  openShareModal: jest.fn(),
  getCurrentTimecodeString: jest.fn(() => '00:01:23.456'),
  registerShortcuts: jest.fn(() => () => {}),
}

const mockVersionManager = {
  currentVersion: 'v1',
  versions: ['v1', 'v2', 'v3'],
  switchToVersion: jest.fn(),
}

const mockSharingManager = {
  isModalOpen: false,
  openModal: jest.fn(),
  closeModal: jest.fn(),
}

// 훅 모킹
jest.mock('../../../features/video-feedback/hooks/usePlayerControls', () => ({
  usePlayerControls: () => mockPlayerControls,
}))

jest.mock('../../../features/video-feedback/hooks/useVersionManager', () => ({
  useVersionManager: () => mockVersionManager,
}))

jest.mock('../../../features/video-feedback/hooks/useAdvancedSharing', () => ({
  useAdvancedSharing: () => mockSharingManager,
}))

// 클립보드 API 모킹
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
})

// 파일 리더 모킹
global.FileReader = class {
  readAsDataURL = jest.fn()
  addEventListener = jest.fn()
  removeEventListener = jest.fn()
} as any

// 테스트 스토어 생성
const createTestStore = () => configureStore({
  reducer: {
    feedback: feedbackReducer,
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

describe('VideoPlayerControls', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('기본 렌더링', () => {
    it('모든 필수 툴바 버튼이 렌더링되어야 한다', () => {
      renderWithProvider(<VideoPlayerControls />)

      expect(screen.getByText('교체')).toBeInTheDocument()
      expect(screen.getByText('공유')).toBeInTheDocument()
      expect(screen.getByText('스크린샷')).toBeInTheDocument()
      expect(screen.getByText('피드백 @TC')).toBeInTheDocument()
    })

    it('키보드 단축키가 버튼 제목에 표시되어야 한다', () => {
      renderWithProvider(<VideoPlayerControls />)

      expect(screen.getByTitle('교체 (Ctrl+R)')).toBeInTheDocument()
      expect(screen.getByTitle('공유 (Ctrl+S)')).toBeInTheDocument()
      expect(screen.getByTitle('스크린샷 (Ctrl+Shift+S)')).toBeInTheDocument()
      expect(screen.getByTitle('피드백 @TC (T)')).toBeInTheDocument()
    })

    it('현재 타임코드가 표시되어야 한다', () => {
      renderWithProvider(<VideoPlayerControls />)

      expect(screen.getByText('00:01:23.456')).toBeInTheDocument()
    })
  })

  describe('접근성', () => {
    it('모든 버튼이 키보드로 접근 가능해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<VideoPlayerControls />)

      const replaceButton = screen.getByText('교체')
      const shareButton = screen.getByText('공유')
      const screenshotButton = screen.getByText('스크린샷')
      const feedbackButton = screen.getByText('피드백 @TC')

      await user.tab()
      expect(replaceButton).toHaveFocus()

      await user.tab()
      expect(shareButton).toHaveFocus()

      await user.tab()
      expect(screenshotButton).toHaveFocus()

      await user.tab()
      expect(feedbackButton).toHaveFocus()
    })

    it('비활성화된 버튼이 적절한 aria 상태를 가져야 한다', () => {
      // 처리 중 상태로 변경
      mockPlayerControls.isProcessing = true
      mockPlayerControls.lastAction = 'replace'

      renderWithProvider(<VideoPlayerControls />)

      const replaceButton = screen.getByText('교체')
      expect(replaceButton).toBeDisabled()
    })
  })

  describe('영상 교체 기능', () => {
    it('드래그앤드롭으로 파일 업로드가 가능해야 한다', async () => {
      renderWithProvider(<VideoPlayerControls />)

      const dropzone = screen.getByText('교체').closest('div')
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' })

      fireEvent.dragOver(dropzone!, {
        dataTransfer: {
          files: [file],
        },
      })

      fireEvent.drop(dropzone!, {
        dataTransfer: {
          files: [file],
        },
      })

      await waitFor(() => {
        expect(mockPlayerControls.replaceVideo).toHaveBeenCalledWith(file, {
          replaceReason: '사용자 업로드',
          autoActivate: true,
          notifyParticipants: true,
        })
      })
    })

    it('유효하지 않은 파일 타입은 거부되어야 한다', () => {
      renderWithProvider(<VideoPlayerControls />)

      const dropzone = screen.getByText('교체').closest('div')
      const file = new File(['text content'], 'test.txt', { type: 'text/plain' })

      fireEvent.drop(dropzone!, {
        dataTransfer: {
          files: [file],
        },
      })

      expect(mockPlayerControls.replaceVideo).not.toHaveBeenCalled()
    })

    it('교체 처리 중 로딩 상태가 표시되어야 한다', () => {
      mockPlayerControls.isProcessing = true
      mockPlayerControls.lastAction = 'replace'

      renderWithProvider(<VideoPlayerControls />)

      expect(screen.getByText('영상 교체 중...')).toBeInTheDocument()
    })
  })

  describe('공유 기능', () => {
    it('공유 버튼 클릭 시 빠른 공유 메뉴가 열려야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<VideoPlayerControls />)

      const shareButton = screen.getByText('공유')
      await user.click(shareButton)

      expect(screen.getByText('빠른 공유 (보기)')).toBeInTheDocument()
      expect(screen.getByText('빠른 공유 (댓글)')).toBeInTheDocument()
      expect(screen.getByText('고급 공유 설정')).toBeInTheDocument()
    })

    it('빠른 공유 보기 옵션이 올바르게 동작해야 한다', async () => {
      const user = userEvent.setup()
      mockPlayerControls.quickShare.mockResolvedValue('https://share.example.com/video123')

      renderWithProvider(<VideoPlayerControls />)

      const shareButton = screen.getByText('공유')
      await user.click(shareButton)

      const quickShareView = screen.getByText('빠른 공유 (보기)')
      await user.click(quickShareView)

      await waitFor(() => {
        expect(mockPlayerControls.quickShare).toHaveBeenCalledWith('view')
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://share.example.com/video123')
      })
    })

    it('빠른 공유 댓글 옵션이 올바르게 동작해야 한다', async () => {
      const user = userEvent.setup()
      mockPlayerControls.quickShare.mockResolvedValue('https://share.example.com/video123')

      renderWithProvider(<VideoPlayerControls />)

      const shareButton = screen.getByText('공유')
      await user.click(shareButton)

      const quickShareComment = screen.getByText('빠른 공유 (댓글)')
      await user.click(quickShareComment)

      await waitFor(() => {
        expect(mockPlayerControls.quickShare).toHaveBeenCalledWith('comment')
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://share.example.com/video123')
      })
    })

    it('고급 공유 설정 버튼이 모달을 열어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<VideoPlayerControls />)

      const shareButton = screen.getByText('공유')
      await user.click(shareButton)

      const advancedShare = screen.getByText('고급 공유 설정')
      await user.click(advancedShare)

      expect(mockPlayerControls.openShareModal).toHaveBeenCalled()
    })
  })

  describe('스크린샷 기능', () => {
    it('스크린샷 버튼 클릭 시 캡처가 실행되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<VideoPlayerControls />)

      const screenshotButton = screen.getByText('스크린샷')
      await user.click(screenshotButton)

      await waitFor(() => {
        expect(mockPlayerControls.captureScreenshot).toHaveBeenCalledWith({
          quality: 90,
          format: 'jpg',
          autoDownload: true,
        })
      })
    })

    it('스크린샷 처리 중 로딩 상태가 표시되어야 한다', () => {
      mockPlayerControls.isProcessing = true
      mockPlayerControls.lastAction = 'screenshot'

      renderWithProvider(<VideoPlayerControls />)

      expect(screen.getByText('스크린샷 캡처 중...')).toBeInTheDocument()
    })
  })

  describe('피드백 @TC 기능', () => {
    it('피드백 버튼 클릭 시 현재 타임코드에서 피드백이 시작되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<VideoPlayerControls />)

      const feedbackButton = screen.getByText('피드백 @TC')
      await user.click(feedbackButton)

      await waitFor(() => {
        expect(mockPlayerControls.startFeedbackAtCurrentTime).toHaveBeenCalled()
      })
    })
  })

  describe('키보드 단축키', () => {
    it('컴포넌트 마운트 시 단축키가 등록되어야 한다', () => {
      renderWithProvider(<VideoPlayerControls />)

      expect(mockPlayerControls.registerShortcuts).toHaveBeenCalled()
    })

    it('컴포넌트 언마운트 시 단축키가 해제되어야 한다', () => {
      const cleanup = jest.fn()
      mockPlayerControls.registerShortcuts.mockReturnValue(cleanup)

      const { unmount } = renderWithProvider(<VideoPlayerControls />)
      unmount()

      expect(cleanup).toHaveBeenCalled()
    })
  })

  describe('에러 처리', () => {
    it('플레이어 에러 발생 시 토스트가 표시되어야 한다', () => {
      mockPlayerControls.error = '영상 로드에 실패했습니다'

      renderWithProvider(<VideoPlayerControls />)

      expect(screen.getByText('영상 로드에 실패했습니다')).toBeInTheDocument()
    })

    it('공유 실패 시 에러 토스트가 표시되어야 한다', async () => {
      const user = userEvent.setup()
      mockPlayerControls.quickShare.mockRejectedValue(new Error('네트워크 오류'))

      renderWithProvider(<VideoPlayerControls />)

      const shareButton = screen.getByText('공유')
      await user.click(shareButton)

      const quickShareView = screen.getByText('빠른 공유 (보기)')
      await user.click(quickShareView)

      await waitFor(() => {
        expect(screen.getByText('네트워크 오류')).toBeInTheDocument()
      })
    })
  })

  describe('파일 크기 검증', () => {
    it('300MB 초과 파일 업로드 시 에러 메시지가 표시되어야 한다', async () => {
      mockPlayerControls.replaceVideo.mockRejectedValue(
        new Error('파일 크기가 300MB를 초과했습니다 (최대 허용: 300MB)')
      )

      renderWithProvider(<VideoPlayerControls />)

      const dropzone = screen.getByText('교체').closest('div')
      const largeFile = new File(['x'.repeat(300 * 1024 * 1024 + 1)], 'large.mp4', {
        type: 'video/mp4'
      })

      fireEvent.drop(dropzone!, {
        dataTransfer: {
          files: [largeFile],
        },
      })

      await waitFor(() => {
        expect(screen.getByText('파일 크기가 300MB를 초과했습니다 (최대 허용: 300MB)')).toBeInTheDocument()
      })
    })
  })

  describe('반응형 동작', () => {
    it('모바일 환경에서 축약된 UI가 표시되어야 한다', () => {
      // 모바일 뷰포트 시뮬레이션
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480,
      })

      renderWithProvider(<VideoPlayerControls />)

      // 모바일에서는 아이콘만 표시되는지 확인
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveClass('md:px-4') // 반응형 클래스 확인
      })
    })
  })
})