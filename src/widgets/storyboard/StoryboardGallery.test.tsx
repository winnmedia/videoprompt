import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StoryboardGallery } from './StoryboardGallery';
import { Shot } from './StoryboardCard';

describe('StoryboardGallery', () => {
  const mockShots: Shot[] = [
    {
      id: 'shot-1',
      title: '오프닝 씬',
      description: '주인공이 도시를 바라보는 장면',
      imageUrl: 'https://example.com/image1.jpg',
      prompt: '도시의 스카이라인',
      shotType: '와이드',
      camera: '정적',
      duration: 5,
      index: 1,
    },
    {
      id: 'shot-2',
      title: '대화 씬',
      description: '두 인물의 대화',
      imageUrl: 'https://example.com/image2.jpg',
      prompt: '카페에서의 대화',
      shotType: '미디엄',
      camera: '팬',
      duration: 8,
      index: 2,
    },
    {
      id: 'shot-3',
      title: '액션 씬',
      description: '추격 장면',
      imageUrl: undefined,
      prompt: '도심 추격전',
      shotType: '클로즈업',
      camera: '트래킹',
      duration: 10,
      index: 3,
    },
  ];

  const mockHandlers = {
    onRegenerateShot: jest.fn(),
    onEditShot: jest.fn(),
    onDownloadShot: jest.fn(),
    onDownloadAll: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('렌더링', () => {
    it('모든 샷을 표시해야 함', () => {
      render(<StoryboardGallery shots={mockShots} {...mockHandlers} />);
      
      expect(screen.getByText('오프닝 씬')).toBeInTheDocument();
      expect(screen.getByText('대화 씬')).toBeInTheDocument();
      expect(screen.getByText('액션 씬')).toBeInTheDocument();
    });

    it('빈 상태일 때 EmptyState를 표시해야 함', () => {
      render(<StoryboardGallery shots={[]} {...mockHandlers} />);
      
      expect(screen.getByText('아직 생성된 스토리보드가 없습니다')).toBeInTheDocument();
    });

    it('로딩 상태일 때 스켈레톤을 표시해야 함', () => {
      render(<StoryboardGallery shots={mockShots} isLoading={true} {...mockHandlers} />);
      
      const skeletons = screen.getAllByTestId('storyboard-card-skeleton');
      expect(skeletons).toHaveLength(6); // 기본 6개 스켈레톤
    });
  });

  describe('뷰 모드 전환', () => {
    it('그리드 뷰와 리스트 뷰를 전환할 수 있어야 함', () => {
      render(<StoryboardGallery shots={mockShots} {...mockHandlers} />);
      
      // 기본은 그리드 뷰
      const galleryContainer = screen.getByTestId('storyboard-gallery');
      expect(galleryContainer).toHaveClass('grid');
      
      // 리스트 뷰로 전환
      const listViewButton = screen.getByLabelText('리스트 뷰');
      fireEvent.click(listViewButton);
      
      expect(galleryContainer).toHaveClass('space-y-4');
    });
  });

  describe('필터링', () => {
    it('이미지가 있는 샷만 필터링할 수 있어야 함', () => {
      render(<StoryboardGallery shots={mockShots} {...mockHandlers} />);
      
      const filterButton = screen.getByLabelText('생성된 이미지만 보기');
      fireEvent.click(filterButton);
      
      expect(screen.getByText('오프닝 씬')).toBeInTheDocument();
      expect(screen.getByText('대화 씬')).toBeInTheDocument();
      expect(screen.queryByText('액션 씬')).not.toBeInTheDocument();
    });
  });

  describe('정렬', () => {
    it('다양한 기준으로 정렬할 수 있어야 함', () => {
      render(<StoryboardGallery shots={mockShots} {...mockHandlers} />);
      
      const sortSelect = screen.getByLabelText('정렬 기준');
      
      // 지속시간으로 정렬
      fireEvent.change(sortSelect, { target: { value: 'duration' } });
      
      const cards = screen.getAllByTestId('storyboard-card');
      expect(cards[0]).toHaveTextContent('오프닝 씬'); // 5초
      expect(cards[1]).toHaveTextContent('대화 씬'); // 8초
      expect(cards[2]).toHaveTextContent('액션 씬'); // 10초
    });
  });

  describe('상호작용', () => {
    it('전체 다운로드 버튼이 작동해야 함', async () => {
      render(<StoryboardGallery shots={mockShots} {...mockHandlers} />);
      
      const downloadAllButton = screen.getByText('전체 다운로드');
      fireEvent.click(downloadAllButton);
      
      await waitFor(() => {
        expect(mockHandlers.onDownloadAll).toHaveBeenCalledWith(mockShots);
      });
    });

    it('개별 샷 상세보기 모달이 열려야 함', async () => {
      render(<StoryboardGallery shots={mockShots} {...mockHandlers} />);
      
      const firstCard = screen.getAllByTestId('storyboard-card')[0];
      fireEvent.click(firstCard);
      
      await waitFor(() => {
        expect(screen.getByTestId('storyboard-detail-modal')).toBeInTheDocument();
        expect(screen.getByText('샷 상세 정보')).toBeInTheDocument();
      });
    });
  });

  describe('접근성', () => {
    it('적절한 ARIA 속성을 가져야 함', () => {
      render(<StoryboardGallery shots={mockShots} {...mockHandlers} />);
      
      const gallery = screen.getByRole('region', { name: '스토리보드 갤러리' });
      expect(gallery).toBeInTheDocument();
    });

    it('키보드 네비게이션이 가능해야 함', () => {
      render(<StoryboardGallery shots={mockShots} {...mockHandlers} />);
      
      const cards = screen.getAllByTestId('storyboard-card');
      
      // Tab 키로 이동 가능
      cards.forEach(card => {
        expect(card).toHaveAttribute('tabIndex', '0');
      });
    });
  });

  describe('반응형 디자인', () => {
    it('컴팩트 모드를 지원해야 함', () => {
      render(<StoryboardGallery shots={mockShots} compact={true} {...mockHandlers} />);
      
      const gallery = screen.getByTestId('storyboard-gallery');
      expect(gallery).toHaveClass('grid-cols-2'); // 컴팩트 모드에서는 2열
    });
  });
});