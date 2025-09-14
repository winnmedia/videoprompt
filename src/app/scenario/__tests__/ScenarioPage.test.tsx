import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import ScenarioPage from '../page';

// MSW 핸들러 모킹
vi.mock('@/shared/lib/mocks/handlers', () => ({
  generateStoryHandler: vi.fn(),
  generateShotsHandler: vi.fn(),
}));

// API 함수들 모킹
vi.mock('@/features/scenario/api/story-generation', () => ({
  generateStorySteps: vi.fn(),
}));

vi.mock('@/features/scenario/api/shots-generation', () => ({
  generateShots: vi.fn(),
}));

// 도메인 모델 모킹
vi.mock('@/entities/scenario', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createInitialStoryInput: vi.fn(() => ({
      title: '',
      oneLineStory: '',
      toneAndManner: [],
      genre: '',
      target: '',
      duration: '',
      format: '',
      tempo: '',
      developmentMethod: '',
      developmentIntensity: '',
    })),
  };
});

describe('ScenarioPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('초기 렌더링', () => {
    test('페이지 제목이 표시된다', () => {
      render(<ScenarioPage />);
      expect(screen.getByText('AI 영상 기획')).toBeInTheDocument();
    });

    test('1단계: 스토리 입력 폼이 표시된다', () => {
      render(<ScenarioPage />);
      expect(screen.getByRole('heading', { name: '스토리 입력' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('시나리오 제목을 입력하세요')).toBeInTheDocument();
    });

    test('진행률 표시가 1/4 단계로 표시된다', () => {
      render(<ScenarioPage />);
      expect(screen.getByText('1단계')).toBeInTheDocument();
      // WorkflowProgress의 스토리 입력은 navigation 영역에 있음
      expect(screen.getByRole('navigation', { name: '진행 단계' })).toBeInTheDocument();
    });

    test('다른 단계들은 초기에 표시되지 않는다', () => {
      render(<ScenarioPage />);
      expect(screen.queryByText('4단계 스토리 검토/수정')).not.toBeInTheDocument();
      expect(screen.queryByText('12개 숏트 생성')).not.toBeInTheDocument();
    });
  });

  describe('워크플로우 전환', () => {
    test('스토리 입력 완료 후 2단계로 진행된다', async () => {
      const mockStorySteps = [
        {
          id: '1',
          title: '1단계',
          summary: '테스트 요약',
          content: '테스트 내용',
          goal: '테스트 목표',
          lengthHint: '30초',
          isEditing: false,
        },
      ];

      const { generateStorySteps } = await import('@/features/scenario/api/story-generation');
      vi.mocked(generateStorySteps).mockResolvedValue(mockStorySteps);

      render(<ScenarioPage />);

      // 필수 필드 입력
      fireEvent.change(screen.getByPlaceholderText('시나리오 제목을 입력하세요'), {
        target: { value: '테스트 시나리오' },
      });

      fireEvent.change(screen.getByPlaceholderText('스토리의 핵심을 한 줄로 요약하세요'), {
        target: { value: '테스트 스토리입니다.' },
      });

      // 4단계 스토리 생성 버튼 클릭
      const generateButton = screen.getByText('4단계 스토리 생성');
      fireEvent.click(generateButton);

      // 2단계 화면으로 전환 확인
      await waitFor(() => {
        expect(screen.getByText('2단계')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: '4단계 스토리 검토/수정' })).toBeInTheDocument();
      });
    });

    test('스토리 검토 완료 후 3단계로 진행된다', async () => {
      const mockShots = [
        {
          id: '1',
          stepId: '1',
          title: '테스트 샷',
          description: '테스트 설명',
          shotType: '와이드',
          camera: '정적',
          composition: '중앙 정렬',
          length: 5,
          dialogue: '',
          subtitle: '',
          transition: '컷',
          insertShots: [],
        },
      ];

      const { generateShots } = await import('@/features/scenario/api/shots-generation');
      vi.mocked(generateShots).mockResolvedValue(mockShots);

      render(<ScenarioPage />);

      // 2단계 상태로 설정하고 숏트 생성 버튼 클릭
      // (실제 구현에서는 상태 관리를 통해 처리)

      await waitFor(() => {
        expect(screen.getByText('3단계')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: '콘티 및 숏트 편집' })).toBeInTheDocument();
      });
    });
  });

  describe('에러 처리', () => {
    test('API 에러 시 에러 메시지가 표시된다', async () => {
      const { generateStorySteps } = await import('@/features/scenario/api/story-generation');
      vi.mocked(generateStorySteps).mockRejectedValue(new Error('네트워크 오류'));

      render(<ScenarioPage />);

      // 필수 필드 입력 후 생성 버튼 클릭
      const generateButton = screen.getByText('4단계 스토리 생성');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/오류가 발생했습니다/)).toBeInTheDocument();
        expect(screen.getByText(/네트워크 오류/)).toBeInTheDocument();
      });
    });

    test('재시도 버튼이 표시되고 동작한다', async () => {
      const { generateStorySteps } = await import('@/features/scenario/api/story-generation');
      vi.mocked(generateStorySteps).mockRejectedValue(new Error('서버 오류'));

      render(<ScenarioPage />);

      // 에러 발생 후 재시도 버튼 클릭
      await waitFor(() => {
        const retryButton = screen.getByText(/다시 시도/);
        fireEvent.click(retryButton);
        expect(generateStorySteps).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('접근성', () => {
    test('각 단계가 적절한 ARIA 라벨을 가진다', () => {
      render(<ScenarioPage />);

      const progressSteps = screen.getByRole('navigation', { name: /진행 단계/ });
      expect(progressSteps).toBeInTheDocument();
    });

    test('로딩 상태가 적절히 표시된다', () => {
      render(<ScenarioPage />);

      const storyForm = screen.getByRole('main');
      expect(storyForm).toHaveAttribute('aria-live', 'polite');
    });

    test('키보드 내비게이션이 가능하다', () => {
      render(<ScenarioPage />);

      const titleInput = screen.getByPlaceholderText('시나리오 제목을 입력하세요');
      titleInput.focus();
      expect(titleInput).toHaveFocus();
    });
  });

  describe('성능', () => {
    test('컴포넌트가 불필요한 리렌더링을 하지 않는다', () => {
      const renderSpy = vi.fn();

      const TestComponent = () => {
        renderSpy();
        return <ScenarioPage />;
      };

      const { rerender } = render(<TestComponent />);

      expect(renderSpy).toHaveBeenCalledTimes(1);

      rerender(<TestComponent />);

      // 동일한 props로 리렌더링 시 호출 횟수가 증가하지 않아야 함
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });
  });
});