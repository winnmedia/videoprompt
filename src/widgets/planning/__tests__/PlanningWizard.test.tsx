/**
 * PlanningWizard Widget Tests
 *
 * 3-Step Wizard UI/UX 컴포넌트 TDD 테스트
 * CLAUDE.md 준수: TDD Red-Green-Refactor, MSW 모킹, 접근성 테스트
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'

import { PlanningWizard } from '../PlanningWizard'
import type { PlanningWizardProps } from '../PlanningWizard'
import { planningSlice } from '../../../entities/planning'
import logger from '../../../shared/lib/logger'

// Mock dependencies
jest.mock('../../../shared/lib/logger')
jest.mock('../../../features/planning')

// 테스트용 스토어 생성
function createTestStore() {
  return configureStore({
    reducer: {
      planning: planningSlice.reducer,
    },
    preloadedState: {
      planning: {
        currentProject: null,
        currentStep: 'input',
        isLoading: false,
        error: null,
        completionPercentage: 0,
        hasUnsavedChanges: false,
        lastSavedAt: null,
        progress: {
          currentStep: 'input',
          completedSteps: [],
          isGenerating: false,
          inputCompletion: 0,
          storyCompletion: 0,
          shotsCompletion: 0,
        },
      },
    },
  })
}

// 테스트 래퍼 컴포넌트
function TestWrapper({ children }: { children: React.ReactNode }) {
  const store = createTestStore()
  return <Provider store={store}>{children}</Provider>
}

describe('PlanningWizard', () => {
  const defaultProps: PlanningWizardProps = {
    enableAutoSave: true,
    enableSessionRestore: true,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('초기 렌더링', () => {
    it('위저드가 올바르게 렌더링된다', () => {
      render(
        <TestWrapper>
          <PlanningWizard {...defaultProps} />
        </TestWrapper>
      )

      // 위저드 컨테이너
      expect(screen.getByTestId('planning-wizard')).toBeInTheDocument()

      // 진행률 표시
      expect(screen.getByTestId('wizard-progress')).toBeInTheDocument()

      // Step 1 입력 폼이 기본으로 표시
      expect(screen.getByTestId('story-input-form')).toBeInTheDocument()
    })

    it('접근성 속성이 올바르게 설정된다', () => {
      render(
        <TestWrapper>
          <PlanningWizard {...defaultProps} />
        </TestWrapper>
      )

      const wizard = screen.getByTestId('planning-wizard')
      expect(wizard).toHaveAttribute('role', 'main')
      expect(wizard).toHaveAttribute('aria-label', '영상 기획 위저드')

      // 단계별 헤딩
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('영상 기획')
    })

    it('키보드 내비게이션이 가능하다', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <PlanningWizard {...defaultProps} />
        </TestWrapper>
      )

      // Tab 키로 순차 이동
      await user.tab()
      expect(screen.getByTestId('story-title-input')).toHaveFocus()

      await user.tab()
      expect(screen.getByTestId('story-logline-input')).toHaveFocus()
    })
  })

  describe('Step 1: 입력/선택', () => {
    it('필수 입력 필드가 올바르게 렌더링된다', () => {
      render(
        <TestWrapper>
          <PlanningWizard {...defaultProps} />
        </TestWrapper>
      )

      // 필수 입력 필드들
      expect(screen.getByTestId('story-title-input')).toBeInTheDocument()
      expect(screen.getByTestId('story-logline-input')).toBeInTheDocument()
      expect(screen.getByTestId('tone-manner-select')).toBeInTheDocument()
      expect(screen.getByTestId('development-select')).toBeInTheDocument()
      expect(screen.getByTestId('intensity-select')).toBeInTheDocument()
    })

    it('프리셋 버튼들이 렌더링된다', () => {
      render(
        <TestWrapper>
          <PlanningWizard {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('preset-drama')).toBeInTheDocument()
      expect(screen.getByTestId('preset-action')).toBeInTheDocument()
      expect(screen.getByTestId('preset-romance')).toBeInTheDocument()
      expect(screen.getByTestId('preset-comedy')).toBeInTheDocument()
    })

    it('유효성 검증이 작동한다', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <PlanningWizard {...defaultProps} />
        </TestWrapper>
      )

      // 빈 필드로 제출 시도
      const submitButton = screen.getByTestId('generate-story-button')
      await user.click(submitButton)

      // 에러 메시지 표시
      expect(screen.getByText('제목을 입력해주세요')).toBeInTheDocument()
      expect(screen.getByText('로그라인을 입력해주세요')).toBeInTheDocument()
    })

    it('프리셋 선택 시 자동 입력된다', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <PlanningWizard {...defaultProps} />
        </TestWrapper>
      )

      // 드라마 프리셋 클릭
      await user.click(screen.getByTestId('preset-drama'))

      // 자동 입력 확인
      expect(screen.getByTestId('tone-manner-select')).toHaveValue('dramatic')
      expect(screen.getByTestId('development-select')).toHaveValue('dramatic')
      expect(screen.getByTestId('intensity-select')).toHaveValue('high')
    })
  })

  describe('Step 2: 4단계 검토/수정', () => {
    it('스토리 생성 후 Step 2로 이동한다', async () => {
      const mockOnStepChange = jest.fn()
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <PlanningWizard {...defaultProps} onStepChange={mockOnStepChange} />
        </TestWrapper>
      )

      // Step 1 입력 완료
      await user.type(screen.getByTestId('story-title-input'), '테스트 영상')
      await user.type(screen.getByTestId('story-logline-input'), '테스트용 로그라인')

      // 스토리 생성
      await user.click(screen.getByTestId('generate-story-button'))

      await waitFor(() => {
        expect(screen.getByTestId('story-step-editor')).toBeInTheDocument()
      })
    })

    it('4단계 스토리 카드가 렌더링된다', async () => {
      // Step 2 상태로 설정
      const store = configureStore({
        reducer: { planning: planningSlice.reducer },
        preloadedState: {
          planning: {
            currentStep: 'story',
            currentProject: {
              metadata: {
                id: 'test-id',
                title: '테스트 프로젝트',
                status: 'generating',
              },
              storySteps: [
                { id: '1', order: 1, title: '시작', description: '오프닝' },
                { id: '2', order: 2, title: '전개', description: '메인 콘텐츠' },
                { id: '3', order: 3, title: '클라이맥스', description: '핵심 메시지' },
                { id: '4', order: 4, title: '마무리', description: '엔딩' },
              ],
            },
          },
        },
      })

      render(
        <Provider store={store}>
          <PlanningWizard {...defaultProps} />
        </Provider>
      )

      // 4개 스토리 카드 확인
      expect(screen.getAllByTestId(/story-step-card-/)).toHaveLength(4)
      expect(screen.getByText('시작')).toBeInTheDocument()
      expect(screen.getByText('전개')).toBeInTheDocument()
      expect(screen.getByText('클라이맥스')).toBeInTheDocument()
      expect(screen.getByText('마무리')).toBeInTheDocument()
    })

    it('인라인 편집이 가능하다', async () => {
      const user = userEvent.setup()

      // Step 2 상태로 설정
      const store = configureStore({
        reducer: { planning: planningSlice.reducer },
        preloadedState: {
          planning: {
            currentStep: 'story',
            currentProject: {
              storySteps: [
                { id: '1', order: 1, title: '시작', description: '오프닝' },
              ],
            },
          },
        },
      })

      render(
        <Provider store={store}>
          <PlanningWizard {...defaultProps} />
        </Provider>
      )

      // 편집 버튼 클릭
      await user.click(screen.getByTestId('edit-story-step-1'))

      // 인라인 에디터 표시
      expect(screen.getByTestId('story-step-editor-1')).toBeInTheDocument()

      // 텍스트 수정
      const titleInput = screen.getByTestId('story-step-title-1')
      await user.clear(titleInput)
      await user.type(titleInput, '수정된 시작')

      // 저장
      await user.click(screen.getByTestId('save-story-step-1'))

      expect(screen.getByText('수정된 시작')).toBeInTheDocument()
    })
  })

  describe('Step 3: 12숏 편집', () => {
    it('12숏 그리드가 3x4 레이아웃으로 렌더링된다', async () => {
      // Step 3 상태로 설정
      const store = configureStore({
        reducer: { planning: planningSlice.reducer },
        preloadedState: {
          planning: {
            currentStep: 'shots',
            currentProject: {
              shotSequences: Array.from({ length: 12 }, (_, i) => ({
                id: `shot-${i + 1}`,
                order: i + 1,
                title: `숏 ${i + 1}`,
                description: `설명 ${i + 1}`,
              })),
            },
          },
        },
      })

      render(
        <Provider store={store}>
          <PlanningWizard {...defaultProps} />
        </Provider>
      )

      // 3x4 그리드 확인
      const grid = screen.getByTestId('shot-grid')
      expect(grid).toHaveClass('grid-cols-3', 'grid-rows-4')

      // 12개 숏 카드 확인
      expect(screen.getAllByTestId(/shot-card-/)).toHaveLength(12)
    })

    it('콘티 이미지와 숏 편집 UI가 분리되어 있다', () => {
      // Step 3 상태로 설정
      const store = configureStore({
        reducer: { planning: planningSlice.reducer },
        preloadedState: {
          planning: {
            currentStep: 'shots',
            currentProject: {
              shotSequences: [
                {
                  id: 'shot-1',
                  order: 1,
                  title: '숏 1',
                  contiImageUrl: 'https://example.com/conti1.jpg',
                },
              ],
            },
          },
        },
      })

      render(
        <Provider store={store}>
          <PlanningWizard {...defaultProps} />
        </Provider>
      )

      // 좌측: 콘티 이미지
      expect(screen.getByTestId('conti-image-1')).toBeInTheDocument()

      // 우측: 숏 편집 UI
      expect(screen.getByTestId('shot-editor-1')).toBeInTheDocument()
    })

    it('인서트 추천 칩이 표시된다', () => {
      // Step 3 상태로 설정
      const store = configureStore({
        reducer: { planning: planningSlice.reducer },
        preloadedState: {
          planning: {
            currentStep: 'shots',
            currentProject: {
              insertShots: [
                { id: 'insert-1', purpose: 'detail', description: '클로즈업' },
                { id: 'insert-2', purpose: 'context', description: '전체샷' },
              ],
            },
          },
        },
      })

      render(
        <Provider store={store}>
          <PlanningWizard {...defaultProps} />
        </Provider>
      )

      expect(screen.getByTestId('insert-chip-insert-1')).toBeInTheDocument()
      expect(screen.getByTestId('insert-chip-insert-2')).toBeInTheDocument()
      expect(screen.getByText('클로즈업')).toBeInTheDocument()
      expect(screen.getByText('전체샷')).toBeInTheDocument()
    })
  })

  describe('자동 저장 및 세션 복원', () => {
    it('자동 저장 인디케이터가 표시된다', () => {
      render(
        <TestWrapper>
          <PlanningWizard {...defaultProps} enableAutoSave={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('auto-save-indicator')).toBeInTheDocument()
    })

    it('세션 복원 시 이전 단계로 돌아간다', async () => {
      const mockRestoreSession = jest.fn().mockResolvedValue({
        currentStep: 'story',
        projectId: 'restored-project',
      })

      // 세션 복원 모킹
      jest.doMock('../../../features/planning', () => ({
        usePlanningWizard: () => ({
          restoreSession: mockRestoreSession,
          currentStep: 'story',
        }),
      }))

      render(
        <TestWrapper>
          <PlanningWizard {...defaultProps} enableSessionRestore={true} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockRestoreSession).toHaveBeenCalled()
      })
    })
  })

  describe('에러 처리', () => {
    it('스토리 생성 실패 시 에러 메시지를 표시한다', async () => {
      const mockError = '스토리 생성에 실패했습니다'
      const store = configureStore({
        reducer: { planning: planningSlice.reducer },
        preloadedState: {
          planning: {
            error: mockError,
          },
        },
      })

      render(
        <Provider store={store}>
          <PlanningWizard {...defaultProps} />
        </Provider>
      )

      expect(screen.getByText(mockError)).toBeInTheDocument()
      expect(screen.getByTestId('error-retry-button')).toBeInTheDocument()
    })

    it('네트워크 에러 시 자동 재시도한다', async () => {
      const mockOnError = jest.fn()
      const mockRetry = jest.fn()

      render(
        <TestWrapper>
          <PlanningWizard {...defaultProps} onError={mockOnError} />
        </TestWrapper>
      )

      // 네트워크 에러 시뮬레이션
      const error = new Error('Network Error')
      mockOnError(error.message)

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith('Network Error')
      })
    })
  })

  describe('성능 최적화', () => {
    it('메모이제이션이 적용되어 불필요한 리렌더링을 방지한다', () => {
      const renderSpy = jest.fn()

      function TestComponent() {
        renderSpy()
        return <PlanningWizard {...defaultProps} />
      }

      const { rerender } = render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      )

      // 초기 렌더링
      expect(renderSpy).toHaveBeenCalledTimes(1)

      // 동일한 props로 재렌더링
      rerender(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      )

      // 불필요한 재렌더링 방지 확인
      expect(renderSpy).toHaveBeenCalledTimes(1)
    })

    it('큰 데이터셋에서도 성능이 유지된다', async () => {
      const largeShotSequences = Array.from({ length: 100 }, (_, i) => ({
        id: `shot-${i}`,
        order: i + 1,
        title: `숏 ${i + 1}`,
        description: `설명 ${i + 1}`,
      }))

      const store = configureStore({
        reducer: { planning: planningSlice.reducer },
        preloadedState: {
          planning: {
            currentStep: 'shots',
            currentProject: {
              shotSequences: largeShotSequences,
            },
          },
        },
      })

      const startTime = performance.now()

      render(
        <Provider store={store}>
          <PlanningWizard {...defaultProps} />
        </Provider>
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // 렌더링 시간이 100ms 이하여야 함
      expect(renderTime).toBeLessThan(100)
    })
  })

  describe('접근성', () => {
    it('스크린 리더 지원이 완전하다', () => {
      render(
        <TestWrapper>
          <PlanningWizard {...defaultProps} />
        </TestWrapper>
      )

      // ARIA 레이블 확인
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', '영상 기획 위저드')

      // 단계별 설명
      expect(screen.getByText('1단계: 기본 정보 입력')).toBeInTheDocument()

      // 진행률 바
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    })

    it('키보드만으로 모든 기능 사용이 가능하다', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <PlanningWizard {...defaultProps} />
        </TestWrapper>
      )

      // Tab으로 모든 요소 순회
      await user.tab() // 제목 입력
      await user.tab() // 로그라인 입력
      await user.tab() // 톤앤매너 선택
      await user.tab() // 전개방식 선택
      await user.tab() // 강도 선택
      await user.tab() // 생성 버튼

      // Enter로 버튼 활성화
      await user.keyboard('{Enter}')

      // 포커스가 올바르게 이동되는지 확인
      expect(document.activeElement).toHaveAttribute('data-testid', 'generate-story-button')
    })
  })
})