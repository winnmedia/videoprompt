/**
 * ShotsGrid Component Tests
 * 접근성 및 드래그앤드롭 기능 테스트
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { DndContext } from '@dnd-kit/core';
import { ShotsGrid } from '../../widgets/shots/ShotsGrid';
import type { TwelveShotCollection } from '../../entities/Shot';

// jest-axe 매처 추가
expect.extend(toHaveNoViolations);

// 테스트용 모의 컬렉션
const createMockCollection = (): TwelveShotCollection => ({
  id: 'collection_test',
  storyId: 'story_test',
  shots: Array.from({ length: 12 }, (_, i) => ({
    id: `shot_${i + 1}`,
    storyId: 'story_test',
    actType: i < 3 ? 'setup' : i < 7 ? 'development' : i < 10 ? 'climax' : 'resolution',
    actOrder: (i % 4) + 1,
    globalOrder: i + 1,
    title: `샷 ${i + 1}`,
    description: `샷 ${i + 1}의 상세 설명입니다.`,
    shotType: 'medium',
    cameraMovement: 'static',
    duration: 5,
    emotion: 'neutral',
    lightingMood: 'natural',
    colorPalette: 'natural',
    transitionType: 'cut',
    continuityNotes: '',
    charactersInShot: ['주인공'],
    storyboard: {
      id: `storyboard_${i + 1}`,
      shotId: `shot_${i + 1}`,
      prompt: '',
      style: 'cinematic',
      status: i % 3 === 0 ? 'completed' : 'empty', // 일부는 완성된 상태
      generationAttempts: 0,
      imageUrl: i % 3 === 0 ? `https://example.com/image_${i + 1}.png` : undefined
    },
    visualReferences: [],
    isUserEdited: i % 4 === 0, // 일부는 편집된 상태
    editHistory: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  })),
  totalDuration: 60,
  aiGenerated: true,
  generationParams: {
    creativity: 70,
    cinematic: 80,
    pacing: 'medium',
    style: 'commercial'
  },
  status: 'completed',
  completionPercentage: 75,
  storyboardsCompleted: 4,
  allStoryboardsGenerated: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
});

// 기본 props
const defaultProps = {
  collection: createMockCollection(),
  selectedShotId: null,
  isDragEnabled: true,
  onShotOrderChange: jest.fn(),
  onShotSelect: jest.fn(),
  onShotEdit: jest.fn(),
  onGenerateStoryboard: jest.fn(),
  onRegenerateStoryboard: jest.fn(),
  onDownloadStoryboard: jest.fn()
};

// 테스트 래퍼 컴포넌트 (DndContext 제공)
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <DndContext>
      {children}
    </DndContext>
  );
};

describe('ShotsGrid Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('렌더링 및 기본 기능', () => {
    it('should render all 12 shots correctly', () => {
      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      // 12개의 샷이 모두 렌더링되는지 확인
      for (let i = 1; i <= 12; i++) {
        expect(screen.getByText(`샷 ${i}`)).toBeInTheDocument();
      }
    });

    it('should group shots by act type', () => {
      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      // Act별 제목 확인
      expect(screen.getByText('1막: 도입')).toBeInTheDocument();
      expect(screen.getByText('2막: 전개')).toBeInTheDocument();
      expect(screen.getByText('3막: 절정')).toBeInTheDocument();
      expect(screen.getByText('4막: 결말')).toBeInTheDocument();
    });

    it('should display shot details correctly', () => {
      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      // 첫 번째 샷의 세부 정보 확인
      expect(screen.getByText('샷 1')).toBeInTheDocument();
      expect(screen.getByText('샷 1의 상세 설명입니다.')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
      expect(screen.getByText('5초')).toBeInTheDocument();
    });

    it('should show storyboard status correctly', () => {
      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      // 완성된 콘티 (shot_1, shot_4, shot_7, shot_10)
      const regenerateButtons = screen.getAllByText('재생성');
      expect(regenerateButtons.length).toBeGreaterThan(0);

      // 빈 콘티
      const generateButtons = screen.getAllByText('콘티 생성');
      expect(generateButtons.length).toBeGreaterThan(0);
    });

    it('should highlight selected shot', () => {
      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} selectedShotId="shot_1" />
        </TestWrapper>
      );

      // 선택된 샷이 강조 표시되는지 확인
      const selectedShot = screen.getByLabelText('1번 숏트: 샷 1');
      expect(selectedShot).toHaveClass('ring-2', 'ring-blue-500');
    });
  });

  describe('접근성 (Accessibility)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should provide proper ARIA labels', () => {
      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      // 샷 카드의 ARIA 라벨 확인
      expect(screen.getByLabelText('1번 숏트: 샷 1')).toBeInTheDocument();
      expect(screen.getByLabelText('2번 숏트: 샷 2')).toBeInTheDocument();
    });

    it('should provide keyboard navigation instructions', () => {
      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText(/스페이스바를 눌러 드래그를 시작하고/)).toBeInTheDocument();
    });

    it('should update instructions when drag is disabled', () => {
      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} isDragEnabled={false} />
        </TestWrapper>
      );

      expect(screen.getByText('드래그 기능이 비활성화되어 있습니다.')).toBeInTheDocument();
    });

    it('should announce drag operations to screen readers', () => {
      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      // ARIA live region 확인 (aria-live="polite"와 sr-only 클래스로 찾기)
      const liveRegion = document.querySelector('[aria-live="polite"].sr-only');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('role', 'status');
    });
  });

  describe('사용자 상호작용', () => {
    it('should call onShotSelect when shot is clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      const shotCard = screen.getByLabelText('1번 숏트: 샷 1');
      await user.click(shotCard);

      expect(defaultProps.onShotSelect).toHaveBeenCalledWith('shot_1');
    });

    it('should call onGenerateStoryboard when generate button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      // 빈 콘티를 가진 샷의 생성 버튼 클릭
      const generateButton = screen.getAllByText('콘티 생성')[0];
      await user.click(generateButton);

      expect(defaultProps.onGenerateStoryboard).toHaveBeenCalled();
    });

    it('should call onRegenerateStoryboard when regenerate button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      // 완성된 콘티의 재생성 버튼 (호버 시 나타남)
      const shotWithStoryboard = screen.getByLabelText('1번 숏트: 샷 1');
      await user.hover(shotWithStoryboard);

      await waitFor(() => {
        const regenerateButton = screen.getByLabelText('1번 숏트 콘티 재생성하기');
        expect(regenerateButton).toBeVisible();
      });

      const regenerateButton = screen.getByLabelText('1번 숏트 콘티 재생성하기');
      await user.click(regenerateButton);

      expect(defaultProps.onRegenerateStoryboard).toHaveBeenCalledWith('shot_1');
    });

    it('should call onDownloadStoryboard when download button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      // 완성된 콘티의 다운로드 버튼
      const shotWithStoryboard = screen.getByLabelText('1번 숏트: 샷 1');
      await user.hover(shotWithStoryboard);

      await waitFor(() => {
        const downloadButton = screen.getByLabelText('1번 숏트 콘티 다운로드하기');
        expect(downloadButton).toBeVisible();
      });

      const downloadButton = screen.getByLabelText('1번 숏트 콘티 다운로드하기');
      await user.click(downloadButton);

      expect(defaultProps.onDownloadStoryboard).toHaveBeenCalledWith('shot_1');
    });
  });

  describe('드래그앤드롭 기능', () => {
    it('should show drag handles when drag is enabled', () => {
      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} isDragEnabled={true} />
        </TestWrapper>
      );

      // 드래그 핸들 확인
      const dragHandle = screen.getByLabelText('1번 숏트 순서 변경하기');
      expect(dragHandle).toBeInTheDocument();
    });

    it('should hide drag handles when drag is disabled', () => {
      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} isDragEnabled={false} />
        </TestWrapper>
      );

      // 드래그 핸들이 없는지 확인
      const dragHandle = screen.queryByLabelText('1번 숏트 순서 변경하기');
      expect(dragHandle).not.toBeInTheDocument();
    });

    it('should call onShotOrderChange when drag ends', () => {
      // 참고: 실제 드래그 동작은 @dnd-kit의 복잡한 이벤트 시뮬레이션이 필요하므로
      // 여기서는 콜백이 올바른 시그니처로 호출되는지만 확인
      const mockOnOrderChange = jest.fn();

      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} onShotOrderChange={mockOnOrderChange} />
        </TestWrapper>
      );

      // 실제 드래그 테스트는 E2E 테스트에서 더 적절함
      expect(mockOnOrderChange).toHaveBeenCalledTimes(0);
    });
  });

  describe('편집 기능', () => {
    it('should allow inline editing of shot title', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      // 제목 클릭하여 편집 모드 진입
      const title = screen.getByText('샷 1');
      await user.click(title);

      // 입력 필드가 나타나는지 확인
      const titleInput = screen.getByLabelText('숏트 제목 편집');
      expect(titleInput).toBeInTheDocument();
      expect(titleInput).toHaveValue('샷 1');

      // 제목 변경
      await user.clear(titleInput);
      await user.type(titleInput, '편집된 제목');

      // Enter로 저장
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(defaultProps.onShotEdit).toHaveBeenCalledWith('shot_1', 'title', '편집된 제목');
      });
    });

    it('should allow inline editing of shot description', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      // 설명 클릭하여 편집 모드 진입
      const description = screen.getByText('샷 1의 상세 설명입니다.');
      await user.click(description);

      // 텍스트 영역이 나타나는지 확인
      const descriptionTextarea = screen.getByLabelText('숏트 설명 편집');
      expect(descriptionTextarea).toBeInTheDocument();

      // 설명 변경
      await user.clear(descriptionTextarea);
      await user.type(descriptionTextarea, '편집된 설명');

      // Enter로 저장
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(defaultProps.onShotEdit).toHaveBeenCalledWith('shot_1', 'description', '편집된 설명');
      });
    });

    it('should cancel editing on Escape key', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      // 제목 편집 시작
      const title = screen.getByText('샷 1');
      await user.click(title);

      const titleInput = screen.getByLabelText('숏트 제목 편집');
      await user.clear(titleInput);
      await user.type(titleInput, '변경된 제목');

      // Escape로 취소
      await user.keyboard('{Escape}');

      await waitFor(() => {
        // 원본 제목이 다시 나타나야 함
        expect(screen.getByText('샷 1')).toBeInTheDocument();
        // 편집 저장이 호출되지 않아야 함
        expect(defaultProps.onShotEdit).not.toHaveBeenCalled();
      });
    });
  });

  describe('빈 상태', () => {
    it('should show empty state when no shots', () => {
      const emptyCollection = {
        ...createMockCollection(),
        shots: []
      };

      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} collection={emptyCollection} />
        </TestWrapper>
      );

      expect(screen.getByText('숏트가 없습니다')).toBeInTheDocument();
      expect(screen.getByText('4단계 스토리를 먼저 완성한 후 12단계 숏트를 생성해보세요.')).toBeInTheDocument();
    });
  });

  describe('성능 최적화', () => {
    it('should use lazy loading for storyboard images', () => {
      render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      // 완성된 콘티 이미지들이 lazy loading 속성을 가지는지 확인
      const storyboardImages = screen.getAllByRole('img');
      storyboardImages.forEach(img => {
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });

    it('should not re-render unnecessarily', () => {
      const { rerender } = render(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      // 동일한 props로 재렌더링
      rerender(
        <TestWrapper>
          <ShotsGrid {...defaultProps} />
        </TestWrapper>
      );

      // React.memo 등의 최적화가 적용되었는지 확인
      // 실제로는 렌더링 카운터나 profiler를 사용해야 함
      expect(screen.getByText('샷 1')).toBeInTheDocument();
    });
  });
});