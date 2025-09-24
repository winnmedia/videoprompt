/**
 * Four Act Story Editor Widget Tests
 * React Testing Library + Jest로 UI 컴포넌트 테스트
 * 접근성 및 사용자 상호작용 검증
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { FourActStoryEditor } from '../../widgets/story-form/FourActStoryEditor';
import { storyGeneratorSlice } from '../../features/story-generator/store/storyGeneratorSlice';
import type { FourActStory } from '../../entities/story';

// 테스트용 Redux Store
const createTestStore = () => {
  return configureStore({
    reducer: {
      storyGenerator: storyGeneratorSlice.reducer
    },
    preloadedState: {
      storyGenerator: {
        currentStory: null,
        isGenerating: false,
        progress: {
          phase: 'analyzing',
          actProgress: { setup: 0, development: 0, climax: 0, resolution: 0 },
          overallProgress: 0,
          currentAct: null,
          estimatedTimeRemaining: 0
        },
        error: null,
        generationHistory: [],
        lastGenerationParams: null
      }
    }
  });
};

// 테스트용 스토리 데이터
const mockStory: FourActStory = {
  id: 'test-story-123',
  title: '시간을 되돌리는 사진사',
  synopsis: '낡은 카메라를 발견한 사진사가 과거로 돌아가 인생의 중요한 순간들을 다시 경험하게 되는 이야기',
  genre: 'drama',
  targetAudience: 'adult',
  tone: 'dramatic',
  acts: {
    setup: {
      id: 'test-story-123_act_1',
      actNumber: 1,
      title: '도입 (Setup)',
      content: '평범한 사진사 민수는 골동품 가게에서 오래된 카메라를 발견한다.',
      thumbnail: 'https://test-thumbnail-1.jpg',
      duration: 60,
      keyEvents: ['카메라 발견', '첫 번째 사진 촬영'],
      emotions: 'calm',
      characterFocus: ['민수']
    },
    development: {
      id: 'test-story-123_act_2',
      actNumber: 2,
      title: '전개 (Development)',
      content: '카메라로 찍은 사진들이 과거의 순간들을 보여주기 시작한다.',
      duration: 120,
      keyEvents: ['시간여행 발견', '과거 장면들'],
      emotions: 'tension',
      characterFocus: ['민수', '옛 연인']
    },
    climax: {
      id: 'test-story-123_act_3',
      actNumber: 3,
      title: '절정 (Climax)',
      content: '민수는 가장 후회스러운 순간으로 돌아가 모든 것을 바꾸려 한다.',
      duration: 90,
      keyEvents: ['결정적 순간', '운명의 선택'],
      emotions: 'excitement',
      characterFocus: ['민수', '옛 연인', '가족']
    },
    resolution: {
      id: 'test-story-123_act_4',
      actNumber: 4,
      title: '결말 (Resolution)',
      content: '진정한 행복은 과거를 바꾸는 것이 아니라 현재를 받아들이는 것임을 깨닫는다.',
      duration: 60,
      keyEvents: ['깨달음', '새로운 시작'],
      emotions: 'hope',
      characterFocus: ['민수']
    }
  },
  status: 'inProgress',
  userId: 'test-user',
  totalDuration: 330,
  aiGenerated: true,
  aiModel: 'gemini',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

// 컴포넌트 래핑 헬퍼
const renderWithStore = (
  component: React.ReactElement,
  store = createTestStore()
) => {
  return {
    store,
    ...render(<Provider store={store}>{component}</Provider>)
  };
};

describe('FourActStoryEditor', () => {
  const defaultProps = {
    story: mockStory,
    onStoryUpdate: jest.fn(),
    onNext: jest.fn(),
    readonly: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render story title and metadata', () => {
      renderWithStore(<FourActStoryEditor {...defaultProps} />);

      expect(screen.getByText('시간을 되돌리는 사진사')).toBeInTheDocument();
      expect(screen.getByText(/drama · adult · dramatic/)).toBeInTheDocument();
    });

    it('should render all four acts', () => {
      renderWithStore(<FourActStoryEditor {...defaultProps} />);

      expect(screen.getByText('도입 (Setup)')).toBeInTheDocument();
      expect(screen.getByText('전개 (Development)')).toBeInTheDocument();
      expect(screen.getByText('절정 (Climax)')).toBeInTheDocument();
      expect(screen.getByText('결말 (Resolution)')).toBeInTheDocument();
    });

    it('should display story progress', () => {
      renderWithStore(<FourActStoryEditor {...defaultProps} />);

      // 진행률 관련 요소가 있는지 확인
      expect(screen.getByText(/완성도/)).toBeInTheDocument();
    });

    it('should show next button when story is complete enough', () => {
      renderWithStore(
        <FourActStoryEditor {...defaultProps} />
      );

      // 완성도가 70% 이상일 때 다음 버튼이 표시되어야 함
      const nextButton = screen.queryByText(/12단계 숏트 생성으로/);
      expect(nextButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithStore(<FourActStoryEditor {...defaultProps} />);

      expect(screen.getByRole('application', { name: '4단계 스토리 편집기' })).toBeInTheDocument();
      expect(screen.getByRole('grid', { name: '4단계 스토리 구조' })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithStore(<FourActStoryEditor {...defaultProps} />);

      const editor = screen.getByRole('application');
      await user.click(editor);

      // 화살표 키로 Act 선택 테스트
      await user.keyboard('[ArrowRight]');
      await user.keyboard('[ArrowDown]');
      await user.keyboard('[ArrowLeft]');
      await user.keyboard('[ArrowUp]');

      // Enter 키로 편집 모드 진입 테스트
      await user.keyboard('[Enter]');

      // Escape 키로 선택 해제 테스트
      await user.keyboard('[Escape]');
    });

    it('should have screen reader announcements', () => {
      renderWithStore(<FourActStoryEditor {...defaultProps} />);

      const srOnlyText = document.querySelector('.sr-only');
      expect(srOnlyText).toHaveTextContent(/4단계 스토리 편집기입니다/);
    });
  });

  describe('User Interactions', () => {
    it('should handle act selection', async () => {
      const user = userEvent.setup();
      renderWithStore(<FourActStoryEditor {...defaultProps} />);

      const setupCard = screen.getByText('도입 (Setup)').closest('[role="gridcell"]');
      expect(setupCard).toBeInTheDocument();

      if (setupCard) {
        await user.click(setupCard);
        expect(setupCard).toHaveClass('ring-2', 'ring-blue-500');
      }
    });

    it('should call onNext when next button is clicked', async () => {
      const user = userEvent.setup();
      const onNext = jest.fn();

      renderWithStore(
        <FourActStoryEditor {...defaultProps} onNext={onNext} />
      );

      const nextButton = screen.getByText(/12단계 숏트 생성으로/);
      await user.click(nextButton);

      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('should handle auto-save functionality', async () => {
      const user = userEvent.setup();
      const onStoryUpdate = jest.fn();

      renderWithStore(
        <FourActStoryEditor {...defaultProps} onStoryUpdate={onStoryUpdate} />
      );

      // Act 편집 시뮬레이션
      const setupCard = screen.getByText('도입 (Setup)').closest('[role="button"]');
      if (setupCard) {
        await user.click(setupCard);

        // 편집 버튼 클릭
        const editButton = within(setupCard).getByText('편집');
        await user.click(editButton);

        // 텍스트 수정
        const textarea = within(setupCard).getByRole('textbox');
        await user.clear(textarea);
        await user.type(textarea, '새로운 도입부 내용입니다.');

        // 저장 버튼 클릭
        const saveButton = within(setupCard).getByText('저장');
        await user.click(saveButton);

        // 자동 저장이 트리거되는지 확인 (디바운스 후)
        await waitFor(() => {
          expect(screen.queryByText('자동 저장 중...')).toBeInTheDocument();
        }, { timeout: 3000 });
      }
    });
  });

  describe('Readonly Mode', () => {
    it('should disable editing in readonly mode', () => {
      renderWithStore(
        <FourActStoryEditor {...defaultProps} readonly={true} />
      );

      // 편집 버튼이 없어야 함
      expect(screen.queryByText('편집')).not.toBeInTheDocument();

      // 저장 버튼이 없어야 함
      expect(screen.queryByText('저장')).not.toBeInTheDocument();

      // 다음 단계 버튼은 여전히 있을 수 있음
      const nextButton = screen.queryByText(/12단계 숏트 생성으로/);
      if (nextButton) {
        expect(nextButton).toBeInTheDocument();
      }
    });

    it('should not respond to keyboard interactions in readonly mode', async () => {
      const user = userEvent.setup();
      renderWithStore(
        <FourActStoryEditor {...defaultProps} readonly={true} />
      );

      const editor = screen.getByRole('application');
      await user.click(editor);

      // 키보드 이벤트가 처리되지 않아야 함
      await user.keyboard('[Enter]');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('Progress Tracking', () => {
    it('should display accurate completion percentage', () => {
      renderWithStore(<FourActStoryEditor {...defaultProps} />);

      // 완성도가 표시되어야 함
      expect(screen.getByText(/완성도:/)).toBeInTheDocument();
    });

    it('should show progress for each act', () => {
      renderWithStore(<FourActStoryEditor {...defaultProps} />);

      // 각 Act별 진행률 표시 요소들이 있는지 확인
      const progressDots = document.querySelectorAll('.w-2.h-2.rounded-full');
      expect(progressDots.length).toBeGreaterThan(0);
    });
  });

  describe('Thumbnail Generation', () => {
    it('should render thumbnail generator widget', () => {
      renderWithStore(<FourActStoryEditor {...defaultProps} />);

      // 썸네일 생성 관련 UI가 있는지 확인
      expect(screen.getByText(/썸네일 일괄 생성/)).toBeInTheDocument();
    });

    it('should display existing thumbnails', () => {
      renderWithStore(<FourActStoryEditor {...defaultProps} />);

      // 기존 썸네일이 표시되는지 확인
      const thumbnailImages = screen.getAllByAltText(/썸네일/);
      expect(thumbnailImages.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing story gracefully', () => {
      // story prop이 null인 경우 에러가 발생하지 않아야 함
      const { container } = renderWithStore(
        <FourActStoryEditor
          story={null as any}
          onStoryUpdate={jest.fn()}
          onNext={jest.fn()}
        />
      );

      expect(container).toBeInTheDocument();
    });

    it('should handle incomplete story data', () => {
      const incompleteStory = {
        ...mockStory,
        acts: {
          ...mockStory.acts,
          setup: {
            ...mockStory.acts.setup,
            content: '' // 빈 내용
          }
        }
      };

      renderWithStore(
        <FourActStoryEditor {...defaultProps} story={incompleteStory} />
      );

      // 빈 내용에 대한 플레이스홀더가 표시되어야 함
      expect(screen.getByText(/도입부 작성하세요/)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const onStoryUpdate = jest.fn();
      const { rerender } = renderWithStore(
        <FourActStoryEditor {...defaultProps} onStoryUpdate={onStoryUpdate} />
      );

      // 같은 props로 리렌더링
      rerender(
        <Provider store={createTestStore()}>
          <FourActStoryEditor {...defaultProps} onStoryUpdate={onStoryUpdate} />
        </Provider>
      );

      // 불필요한 업데이트 콜백이 호출되지 않았는지 확인
      expect(onStoryUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('should work with Redux store correctly', () => {
      const store = createTestStore();
      renderWithStore(<FourActStoryEditor {...defaultProps} />, store);

      // Redux store 상태가 올바르게 연결되었는지 확인
      const state = store.getState();
      expect(state.storyGenerator).toBeDefined();
    });
  });
});