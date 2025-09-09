import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GenerateStoryboardButton } from './GenerateStoryboardButton';

describe('GenerateStoryboardButton', () => {
  const mockOnGenerate = jest.fn();
  const mockOnBatchGenerate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('렌더링', () => {
    it('기본 버튼을 올바르게 표시해야 함', () => {
      render(
        <GenerateStoryboardButton
          onGenerate={mockOnGenerate}
          onBatchGenerate={mockOnBatchGenerate}
        />
      );
      
      expect(screen.getByText('스토리보드 생성')).toBeInTheDocument();
    });

    it('로딩 상태일 때 로딩 텍스트를 표시해야 함', () => {
      render(
        <GenerateStoryboardButton
          onGenerate={mockOnGenerate}
          onBatchGenerate={mockOnBatchGenerate}
          isLoading={true}
        />
      );
      
      expect(screen.getByText('생성 중...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('비활성화 상태일 때 버튼이 비활성화되어야 함', () => {
      render(
        <GenerateStoryboardButton
          onGenerate={mockOnGenerate}
          onBatchGenerate={mockOnBatchGenerate}
          disabled={true}
        />
      );
      
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('커스텀 텍스트를 표시할 수 있어야 함', () => {
      render(
        <GenerateStoryboardButton
          onGenerate={mockOnGenerate}
          onBatchGenerate={mockOnBatchGenerate}
          text="이미지 생성하기"
        />
      );
      
      expect(screen.getByText('이미지 생성하기')).toBeInTheDocument();
    });
  });

  describe('상호작용', () => {
    it('버튼 클릭 시 생성 핸들러가 호출되어야 함', async () => {
      render(
        <GenerateStoryboardButton
          onGenerate={mockOnGenerate}
          onBatchGenerate={mockOnBatchGenerate}
        />
      );
      
      const button = screen.getByText('스토리보드 생성');
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(mockOnGenerate).toHaveBeenCalledTimes(1);
      });
    });

    it('일괄 생성 모드에서 옵션 메뉴를 표시해야 함', async () => {
      render(
        <GenerateStoryboardButton
          onGenerate={mockOnGenerate}
          onBatchGenerate={mockOnBatchGenerate}
          showBatchOption={true}
        />
      );
      
      // 드롭다운 버튼 클릭
      const dropdownButton = screen.getByLabelText('생성 옵션');
      fireEvent.click(dropdownButton);
      
      // 옵션 메뉴가 표시되는지 확인
      await waitFor(() => {
        expect(screen.getByText('모든 샷 생성')).toBeInTheDocument();
        expect(screen.getByText('선택한 샷만 생성')).toBeInTheDocument();
      });
    });

    it('일괄 생성 옵션 선택 시 해당 핸들러가 호출되어야 함', async () => {
      render(
        <GenerateStoryboardButton
          onGenerate={mockOnGenerate}
          onBatchGenerate={mockOnBatchGenerate}
          showBatchOption={true}
        />
      );
      
      // 드롭다운 열기
      const dropdownButton = screen.getByLabelText('생성 옵션');
      fireEvent.click(dropdownButton);
      
      // 일괄 생성 옵션 클릭
      const batchOption = await screen.findByText('모든 샷 생성');
      fireEvent.click(batchOption);
      
      await waitFor(() => {
        expect(mockOnBatchGenerate).toHaveBeenCalledWith('all');
      });
    });
  });

  describe('진행 상태 표시', () => {
    it('진행률을 표시할 수 있어야 함', () => {
      render(
        <GenerateStoryboardButton
          onGenerate={mockOnGenerate}
          onBatchGenerate={mockOnBatchGenerate}
          progress={50}
          total={100}
        />
      );
      
      expect(screen.getByText('50 / 100')).toBeInTheDocument();
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  describe('접근성', () => {
    it('적절한 ARIA 속성을 가져야 함', () => {
      render(
        <GenerateStoryboardButton
          onGenerate={mockOnGenerate}
          onBatchGenerate={mockOnBatchGenerate}
          isLoading={true}
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('키보드 상호작용을 지원해야 함', async () => {
      render(
        <GenerateStoryboardButton
          onGenerate={mockOnGenerate}
          onBatchGenerate={mockOnBatchGenerate}
        />
      );
      
      const button = screen.getByRole('button');
      
      // Enter 키 이벤트
      fireEvent.keyDown(button, { key: 'Enter' });
      await waitFor(() => {
        expect(mockOnGenerate).toHaveBeenCalled();
      });
      
      // Space 키 이벤트
      fireEvent.keyDown(button, { key: ' ' });
      await waitFor(() => {
        expect(mockOnGenerate).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('시각적 피드백', () => {
    it('성공 상태를 표시할 수 있어야 함', () => {
      const { rerender } = render(
        <GenerateStoryboardButton
          onGenerate={mockOnGenerate}
          onBatchGenerate={mockOnBatchGenerate}
        />
      );
      
      // 성공 상태로 리렌더링
      rerender(
        <GenerateStoryboardButton
          onGenerate={mockOnGenerate}
          onBatchGenerate={mockOnBatchGenerate}
          showSuccess={true}
        />
      );
      
      expect(screen.getByText('생성 완료!')).toBeInTheDocument();
    });

    it('에러 상태를 표시할 수 있어야 함', () => {
      render(
        <GenerateStoryboardButton
          onGenerate={mockOnGenerate}
          onBatchGenerate={mockOnBatchGenerate}
          error="생성 중 오류가 발생했습니다"
        />
      );
      
      expect(screen.getByText('생성 중 오류가 발생했습니다')).toBeInTheDocument();
    });
  });
});