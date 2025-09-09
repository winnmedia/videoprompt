import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StoryboardCard } from './StoryboardCard';

describe('StoryboardCard', () => {
  const mockShot = {
    id: 'shot-1',
    title: '오프닝 씬',
    description: '주인공이 도시를 바라보는 장면',
    imageUrl: 'https://example.com/image.jpg',
    prompt: '도시의 스카이라인을 바라보는 주인공의 뒷모습',
    shotType: '와이드',
    camera: '정적',
    duration: 5,
    index: 1,
  };

  const mockHandlers = {
    onRegenerate: jest.fn(),
    onDownload: jest.fn(),
    onEdit: jest.fn(),
    onViewDetails: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('렌더링', () => {
    it('샷 정보를 올바르게 표시해야 함', () => {
      render(<StoryboardCard shot={mockShot} {...mockHandlers} />);
      
      expect(screen.getByText('오프닝 씬')).toBeInTheDocument();
      expect(screen.getByText('주인공이 도시를 바라보는 장면')).toBeInTheDocument();
      expect(screen.getByText('Shot #1')).toBeInTheDocument();
      expect(screen.getByText('와이드')).toBeInTheDocument();
      expect(screen.getByText('5초')).toBeInTheDocument();
    });

    it('이미지가 있을 때 이미지를 표시해야 함', () => {
      render(<StoryboardCard shot={mockShot} {...mockHandlers} />);
      
      const image = screen.getByAltText('Shot 1: 오프닝 씬');
      expect(image).toHaveAttribute('src', mockShot.imageUrl);
    });

    it('이미지가 없을 때 플레이스홀더를 표시해야 함', () => {
      const shotWithoutImage = { ...mockShot, imageUrl: undefined };
      render(<StoryboardCard shot={shotWithoutImage} {...mockHandlers} />);
      
      expect(screen.getByText('이미지 생성 대기 중')).toBeInTheDocument();
    });

    it('로딩 상태일 때 스켈레톤을 표시해야 함', () => {
      render(<StoryboardCard shot={mockShot} isLoading={true} {...mockHandlers} />);
      
      expect(screen.getByTestId('storyboard-card-skeleton')).toBeInTheDocument();
    });
  });

  describe('상호작용', () => {
    it('재생성 버튼 클릭 시 핸들러가 호출되어야 함', async () => {
      render(<StoryboardCard shot={mockShot} {...mockHandlers} />);
      
      const regenerateButton = screen.getByLabelText('이미지 재생성');
      fireEvent.click(regenerateButton);
      
      await waitFor(() => {
        expect(mockHandlers.onRegenerate).toHaveBeenCalledWith(mockShot.id);
      });
    });

    it('다운로드 버튼 클릭 시 핸들러가 호출되어야 함', async () => {
      render(<StoryboardCard shot={mockShot} {...mockHandlers} />);
      
      const downloadButton = screen.getByLabelText('이미지 다운로드');
      fireEvent.click(downloadButton);
      
      await waitFor(() => {
        expect(mockHandlers.onDownload).toHaveBeenCalledWith(mockShot.id, mockShot.imageUrl);
      });
    });

    it('편집 버튼 클릭 시 핸들러가 호출되어야 함', async () => {
      render(<StoryboardCard shot={mockShot} {...mockHandlers} />);
      
      const editButton = screen.getByLabelText('프롬프트 편집');
      fireEvent.click(editButton);
      
      await waitFor(() => {
        expect(mockHandlers.onEdit).toHaveBeenCalledWith(mockShot.id);
      });
    });

    it('카드 클릭 시 상세보기 핸들러가 호출되어야 함', async () => {
      render(<StoryboardCard shot={mockShot} {...mockHandlers} />);
      
      const card = screen.getByTestId('storyboard-card');
      fireEvent.click(card);
      
      await waitFor(() => {
        expect(mockHandlers.onViewDetails).toHaveBeenCalledWith(mockShot);
      });
    });
  });

  describe('접근성', () => {
    it('적절한 ARIA 레이블을 가져야 함', () => {
      render(<StoryboardCard shot={mockShot} {...mockHandlers} />);
      
      expect(screen.getByRole('article')).toHaveAttribute('aria-label', 'Shot 1: 오프닝 씬');
    });

    it('키보드 네비게이션이 가능해야 함', () => {
      render(<StoryboardCard shot={mockShot} {...mockHandlers} />);
      
      const card = screen.getByTestId('storyboard-card');
      expect(card).toHaveAttribute('tabIndex', '0');
      
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(mockHandlers.onViewDetails).toHaveBeenCalled();
      
      fireEvent.keyDown(card, { key: ' ' });
      expect(mockHandlers.onViewDetails).toHaveBeenCalledTimes(2);
    });
  });

  describe('반응형 디자인', () => {
    it('컴팩트 모드에서 간소화된 뷰를 표시해야 함', () => {
      render(<StoryboardCard shot={mockShot} compact={true} {...mockHandlers} />);
      
      expect(screen.queryByText('주인공이 도시를 바라보는 장면')).not.toBeInTheDocument();
      expect(screen.getByText('오프닝 씬')).toBeInTheDocument();
    });
  });
});