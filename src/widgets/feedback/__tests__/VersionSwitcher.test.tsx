/**
 * VersionSwitcher 컴포넌트 TDD 테스트
 *
 * CLAUDE.md 준수: TDD 우선, 접근성 검증
 * FRD.md 요구사항: 버전 스위처, 메타데이터 표시, 되돌리기 기능
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { VersionSwitcher } from '../VersionSwitcher'
import { feedbackSlice } from '../../../entities/feedback'

// 모킹된 버전 데이터
const mockVersions = [
  {
    id: 'v1',
    version: 'v1',
    uploader: 'john@example.com',
    uploadedAt: '2024-01-15T10:30:00Z',
    fileName: 'intro_video_v1.mp4',
    fileHash: 'abc123def456',
    duration: 120.5,
    codec: 'H.264',
    resolution: '1920x1080',
    fileSize: 25600000, // 25.6MB
    isActive: false,
  },
  {
    id: 'v2',
    version: 'v2',
    uploader: 'jane@example.com',
    uploadedAt: '2024-01-16T14:20:00Z',
    fileName: 'intro_video_v2_updated.mp4',
    fileHash: 'def456ghi789',
    duration: 118.2,
    codec: 'H.264',
    resolution: '1920x1080',
    fileSize: 23800000, // 23.8MB
    isActive: false,
  },
  {
    id: 'v3',
    version: 'v3',
    uploader: 'mike@example.com',
    uploadedAt: '2024-01-17T09:15:00Z',
    fileName: 'intro_video_final.mp4',
    fileHash: 'ghi789jkl012',
    duration: 115.8,
    codec: 'H.265',
    resolution: '1920x1080',
    fileSize: 21200000, // 21.2MB
    isActive: true,
  },
]

// 모킹된 훅
const mockVersionManager = {
  versions: mockVersions,
  currentVersion: 'v3',
  isLoading: false,
  error: null,
  switchToVersion: jest.fn(),
  activateVersion: jest.fn(),
  deleteVersion: jest.fn(),
  getVersionMetadata: jest.fn(),
}

jest.mock('../../../features/video-feedback/hooks/useVersionManager', () => ({
  useVersionManager: () => mockVersionManager,
}))

// 날짜 포맷팅 모킹
jest.mock('../../../shared/lib/date-utils', () => ({
  formatDateTime: (date: string) => new Date(date).toLocaleString('ko-KR'),
  formatFileSize: (bytes: number) => (bytes / 1024 / 1024).toFixed(1) + 'MB',
  formatDuration: (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  },
}))

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

describe('VersionSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('기본 렌더링', () => {
    it('모든 버전 탭이 렌더링되어야 한다', () => {
      renderWithProvider(<VersionSwitcher />)

      expect(screen.getByText('v1')).toBeInTheDocument()
      expect(screen.getByText('v2')).toBeInTheDocument()
      expect(screen.getByText('v3')).toBeInTheDocument()
    })

    it('활성 버전이 선택된 상태로 표시되어야 한다', () => {
      renderWithProvider(<VersionSwitcher />)

      const v3Tab = screen.getByText('v3')
      expect(v3Tab.closest('button')).toHaveClass('bg-blue-600')
    })

    it('최신 버전이 기본 선택되어야 한다', () => {
      renderWithProvider(<VersionSwitcher />)

      // v3가 가장 최신이므로 활성화되어 있어야 함
      const v3Tab = screen.getByText('v3')
      expect(v3Tab.closest('button')).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('버전 메타데이터 표시', () => {
    it('업로더 정보가 표시되어야 한다', () => {
      renderWithProvider(<VersionSwitcher />)

      expect(screen.getByText('mike@example.com')).toBeInTheDocument()
      expect(screen.getByText('jane@example.com')).toBeInTheDocument()
      expect(screen.getByText('john@example.com')).toBeInTheDocument()
    })

    it('업로드 시각이 표시되어야 한다', () => {
      renderWithProvider(<VersionSwitcher />)

      // 한국어 로케일 기준 날짜 포맷 확인
      expect(screen.getByText(/2024.*1.*17/)).toBeInTheDocument()
      expect(screen.getByText(/2024.*1.*16/)).toBeInTheDocument()
      expect(screen.getByText(/2024.*1.*15/)).toBeInTheDocument()
    })

    it('파일명과 해시가 표시되어야 한다', () => {
      renderWithProvider(<VersionSwitcher />)

      expect(screen.getByText('intro_video_final.mp4')).toBeInTheDocument()
      expect(screen.getByText('ghi789jkl012')).toBeInTheDocument()
    })

    it('동영상 길이와 코덱 정보가 표시되어야 한다', () => {
      renderWithProvider(<VersionSwitcher />)

      expect(screen.getByText('1:55')).toBeInTheDocument() // 115.8초 = 1분 55초
      expect(screen.getByText('H.265')).toBeInTheDocument()
      expect(screen.getByText('21.2MB')).toBeInTheDocument()
    })
  })

  describe('버전 전환 기능', () => {
    it('다른 버전 탭 클릭 시 버전이 전환되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<VersionSwitcher />)

      const v1Tab = screen.getByText('v1')
      await user.click(v1Tab)

      await waitFor(() => {
        expect(mockVersionManager.switchToVersion).toHaveBeenCalledWith('v1')
      })
    })

    it('키보드 방향키로 버전 탐색이 가능해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<VersionSwitcher />)

      const v3Tab = screen.getByText('v3').closest('button')!
      v3Tab.focus()

      await user.keyboard('{ArrowLeft}')
      expect(screen.getByText('v2').closest('button')).toHaveFocus()

      await user.keyboard('{ArrowLeft}')
      expect(screen.getByText('v1').closest('button')).toHaveFocus()

      await user.keyboard('{ArrowRight}')
      expect(screen.getByText('v2').closest('button')).toHaveFocus()
    })

    it('Enter 키로 버전 선택이 가능해야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<VersionSwitcher />)

      const v1Tab = screen.getByText('v1').closest('button')!
      v1Tab.focus()

      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockVersionManager.switchToVersion).toHaveBeenCalledWith('v1')
      })
    })
  })

  describe('되돌리기 기능', () => {
    it('과거 버전에 되돌리기 버튼이 표시되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<VersionSwitcher />)

      // v1 탭의 더보기 메뉴 열기
      const v1MoreButton = screen.getAllByRole('button', { name: /더보기/ })[0]
      await user.click(v1MoreButton)

      expect(screen.getByText('이 버전으로 되돌리기')).toBeInTheDocument()
    })

    it('되돌리기 실행 시 확인 다이얼로그가 표시되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<VersionSwitcher />)

      const v1MoreButton = screen.getAllByRole('button', { name: /더보기/ })[0]
      await user.click(v1MoreButton)

      const revertButton = screen.getByText('이 버전으로 되돌리기')
      await user.click(revertButton)

      expect(screen.getByText('버전 되돌리기 확인')).toBeInTheDocument()
      expect(screen.getByText(/v1으로 되돌리시겠습니까/)).toBeInTheDocument()
    })

    it('되돌리기 확인 시 activateVersion이 호출되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<VersionSwitcher />)

      const v1MoreButton = screen.getAllByRole('button', { name: /더보기/ })[0]
      await user.click(v1MoreButton)

      const revertButton = screen.getByText('이 버전으로 되돌리기')
      await user.click(revertButton)

      const confirmButton = screen.getByText('되돌리기')
      await user.click(confirmButton)

      await waitFor(() => {
        expect(mockVersionManager.activateVersion).toHaveBeenCalledWith('v1')
      })
    })
  })

  describe('접근성', () => {
    it('버전 탭에 적절한 ARIA 라벨이 있어야 한다', () => {
      renderWithProvider(<VersionSwitcher />)

      const v1Tab = screen.getByText('v1').closest('button')
      expect(v1Tab).toHaveAttribute('role', 'tab')
      expect(v1Tab).toHaveAttribute('aria-label', 'v1 버전 (john@example.com, 2024-01-15)')
    })

    it('탭 패널에 적절한 ARIA 속성이 있어야 한다', () => {
      renderWithProvider(<VersionSwitcher />)

      const tabpanel = screen.getByRole('tabpanel')
      expect(tabpanel).toHaveAttribute('aria-labelledby')
    })

    it('스크린 리더를 위한 상태 안내가 있어야 한다', () => {
      renderWithProvider(<VersionSwitcher />)

      expect(screen.getByText('현재 활성 버전')).toBeInTheDocument()
    })
  })

  describe('로딩 상태', () => {
    it('버전 전환 중 로딩 인디케이터가 표시되어야 한다', () => {
      mockVersionManager.isLoading = true

      renderWithProvider(<VersionSwitcher />)

      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText('버전을 불러오는 중...')).toBeInTheDocument()
    })

    it('로딩 중에는 버튼이 비활성화되어야 한다', () => {
      mockVersionManager.isLoading = true

      renderWithProvider(<VersionSwitcher />)

      const v1Tab = screen.getByText('v1').closest('button')
      expect(v1Tab).toBeDisabled()
    })
  })

  describe('에러 처리', () => {
    it('에러 발생 시 에러 메시지가 표시되어야 한다', () => {
      mockVersionManager.error = '버전 정보를 불러올 수 없습니다'

      renderWithProvider(<VersionSwitcher />)

      expect(screen.getByText('버전 정보를 불러올 수 없습니다')).toBeInTheDocument()
      expect(screen.getByText('다시 시도')).toBeInTheDocument()
    })
  })

  describe('버전 삭제 기능', () => {
    it('활성 버전이 아닌 경우 삭제 버튼이 표시되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<VersionSwitcher />)

      const v1MoreButton = screen.getAllByRole('button', { name: /더보기/ })[0]
      await user.click(v1MoreButton)

      expect(screen.getByText('버전 삭제')).toBeInTheDocument()
    })

    it('활성 버전인 경우 삭제 버튼이 비활성화되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<VersionSwitcher />)

      const v3MoreButton = screen.getAllByRole('button', { name: /더보기/ })[2]
      await user.click(v3MoreButton)

      const deleteButton = screen.getByText('버전 삭제')
      expect(deleteButton.closest('button')).toBeDisabled()
    })

    it('삭제 확인 시 deleteVersion이 호출되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithProvider(<VersionSwitcher />)

      const v1MoreButton = screen.getAllByRole('button', { name: /더보기/ })[0]
      await user.click(v1MoreButton)

      const deleteButton = screen.getByText('버전 삭제')
      await user.click(deleteButton)

      const confirmButton = screen.getByText('삭제')
      await user.click(confirmButton)

      await waitFor(() => {
        expect(mockVersionManager.deleteVersion).toHaveBeenCalledWith('v1')
      })
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

      renderWithProvider(<VersionSwitcher />)

      // 모바일에서는 세부 메타데이터가 숨겨져야 함
      expect(screen.queryByText('intro_video_final.mp4')).not.toBeVisible()
    })
  })
})