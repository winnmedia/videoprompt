/**
 * 시나리오 생성 통합 테스트
 * UserJourneyMap 3-4단계 전체 플로우 테스트
 * MSW를 사용한 API 모킹
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

import { ScenarioForm } from '../../widgets/scenario/ScenarioForm';
import type { ScenarioGenerationRequest } from '../../entities/scenario';

// MSW 서버 설정
const server = setupServer(
  http.post('/api/scenario/generate', async ({ request }) => {
    const body = await request.json() as ScenarioGenerationRequest;

    // 유효성 검사
    if (!body.title || !body.content) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            message: '제목과 내용은 필수입니다',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      );
    }

    if (body.content.length < 50) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            message: '내용은 최소 50자 이상이어야 합니다',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      );
    }

    // 지연 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 500));

    // 성공 응답
    return HttpResponse.json({
      success: true,
      data: {
        scenario: {
          id: 'generated-scenario-id',
          title: body.title,
          content: '한국의 작은 시골 마을에 살고 있는 17세 소녀 민지는 항상 큰 꿈을 품고 있었다...',
          userId: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'completed',
          metadata: {
            genre: body.genre,
            style: body.style,
            target: body.target,
            structure: body.structure,
            intensity: body.intensity,
            estimatedDuration: 15,
            qualityScore: 85,
            tokens: 650,
            cost: 0.08,
          },
        },
        feedback: [
          '캐릭터의 내적 갈등이 잘 표현되었습니다',
          '현실적이면서도 희망적인 결말이 인상적입니다',
        ],
        suggestions: [
          '배경 설정을 더 구체적으로 묘사해보세요',
          '주인공의 성장 과정을 강조해보세요',
        ],
        alternatives: [],
        meta: {
          generationTime: Date.now(),
          userId: 'test-user',
          requestId: 'test-request-id',
        },
      },
      timestamp: new Date().toISOString(),
    });
  })
);

// 테스트 시작 전/후 설정
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('시나리오 생성 통합 테스트', () => {
  const user = userEvent.setup();

  describe('ScenarioForm 컴포넌트', () => {
    it('폼이 올바르게 렌더링되어야 한다', () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      // 필수 폼 요소들 확인
      expect(screen.getByLabelText(/시나리오 제목/)).toBeInTheDocument();
      expect(screen.getByLabelText(/시나리오 내용/)).toBeInTheDocument();
      expect(screen.getByLabelText(/장르/)).toBeInTheDocument();
      expect(screen.getByLabelText(/스타일/)).toBeInTheDocument();
      expect(screen.getByLabelText(/타겟 관객/)).toBeInTheDocument();
      expect(screen.getByLabelText(/구조 선택/)).toBeInTheDocument();
      expect(screen.getByText('시나리오 생성하기')).toBeInTheDocument();
    });

    it('초기 진행률이 0%여야 한다', () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('제목 입력 시 진행률이 업데이트되어야 한다', async () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      const titleInput = screen.getByLabelText(/시나리오 제목/);
      await user.type(titleInput, '테스트 시나리오');

      expect(screen.getByText('20%')).toBeInTheDocument();
    });

    it('제목과 내용 입력 시 진행률이 50%가 되어야 한다', async () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      const titleInput = screen.getByLabelText(/시나리오 제목/);
      const contentTextarea = screen.getByLabelText(/시나리오 내용/);

      await user.type(titleInput, '테스트 시나리오');
      await user.type(contentTextarea, '이것은 50자 이상의 유효한 시나리오 내용입니다. 충분한 길이를 확보하기 위해 더 많은 텍스트를 추가합니다.');

      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('모든 필드 입력 시 진행률이 100%가 되어야 한다', async () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      const titleInput = screen.getByLabelText(/시나리오 제목/);
      const contentTextarea = screen.getByLabelText(/시나리오 내용/);

      await user.type(titleInput, '테스트 시나리오');
      await user.type(contentTextarea, '이것은 50자 이상의 유효한 시나리오 내용입니다. 충분한 길이를 확보하기 위해 더 많은 텍스트를 추가합니다.');

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
    });

    it('진행률이 50% 미만일 때 제출 버튼이 비활성화되어야 한다', async () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByText('시나리오 생성하기');
      expect(submitButton).toBeDisabled();

      const titleInput = screen.getByLabelText(/시나리오 제목/);
      await user.type(titleInput, '테스트 시나리오');

      expect(submitButton).toBeDisabled();
    });

    it('유효한 입력으로 폼 제출 시 onSubmit이 호출되어야 한다', async () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      const titleInput = screen.getByLabelText(/시나리오 제목/);
      const contentTextarea = screen.getByLabelText(/시나리오 내용/);
      const submitButton = screen.getByText('시나리오 생성하기');

      await user.type(titleInput, '테스트 시나리오');
      await user.type(contentTextarea, '이것은 50자 이상의 유효한 시나리오 내용입니다. 충분한 길이를 확보하기 위해 더 많은 텍스트를 추가합니다.');

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      await user.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledWith({
        title: '테스트 시나리오',
        content: '이것은 50자 이상의 유효한 시나리오 내용입니다. 충분한 길이를 확보하기 위해 더 많은 텍스트를 추가합니다.',
        genre: 'drama',
        style: 'realistic',
        target: 'general',
        structure: 'traditional',
        intensity: 'medium',
      });
    });

    it('드롭다운 선택이 올바르게 작동해야 한다', async () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      const genreSelect = screen.getByLabelText(/장르/);
      await user.selectOptions(genreSelect, 'comedy');

      expect(genreSelect).toHaveValue('comedy');
    });

    it('강도 선택이 올바르게 작동해야 한다', async () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      const highIntensityRadio = screen.getByLabelText(/강함 \(강렬한\)/);
      await user.click(highIntensityRadio);

      expect(highIntensityRadio).toBeChecked();
    });

    it('로딩 상태에서 폼이 비활성화되어야 한다', () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} isLoading={true} />);

      const titleInput = screen.getByLabelText(/시나리오 제목/);
      const contentTextarea = screen.getByLabelText(/시나리오 내용/);
      const submitButton = screen.getByText(/시나리오 생성 중/);

      expect(titleInput).toBeDisabled();
      expect(contentTextarea).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });

    it('로딩 상태에서 로딩 텍스트가 표시되어야 한다', () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} isLoading={true} />);

      expect(screen.getByText(/시나리오 생성 중.../)).toBeInTheDocument();
    });
  });

  describe('유효성 검증', () => {
    it('빈 제목으로 제출 시 에러가 표시되어야 한다', async () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      const contentTextarea = screen.getByLabelText(/시나리오 내용/);
      await user.type(contentTextarea, '이것은 50자 이상의 유효한 시나리오 내용입니다. 충분한 길이를 확보하기 위해 더 많은 텍스트를 추가합니다.');

      // 제목을 비워둔 상태에서 제출 시도
      fireEvent.submit(screen.getByRole('form'));

      await waitFor(() => {
        expect(screen.getByText(/입력 오류가 있습니다/)).toBeInTheDocument();
        expect(screen.getByText(/시나리오 제목은 필수입니다/)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('짧은 내용으로 제출 시 에러가 표시되어야 한다', async () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      const titleInput = screen.getByLabelText(/시나리오 제목/);
      const contentTextarea = screen.getByLabelText(/시나리오 내용/);

      await user.type(titleInput, '테스트 시나리오');
      await user.type(contentTextarea, '짧은 내용');

      fireEvent.submit(screen.getByRole('form'));

      await waitFor(() => {
        expect(screen.getByText(/입력 오류가 있습니다/)).toBeInTheDocument();
        expect(screen.getByText(/내용은 최소 50자 이상이어야 합니다/)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('긴 제목으로 입력 시 실시간 에러가 표시되어야 한다', async () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      const titleInput = screen.getByLabelText(/시나리오 제목/);
      await user.type(titleInput, 'a'.repeat(101));

      await waitFor(() => {
        expect(screen.getByText(/입력 오류가 있습니다/)).toBeInTheDocument();
        expect(screen.getByText(/제목은 100자를 초과할 수 없습니다/)).toBeInTheDocument();
      });
    });
  });

  describe('접근성', () => {
    it('모든 폼 요소에 적절한 라벨이 있어야 한다', () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      expect(screen.getByLabelText(/시나리오 제목/)).toBeInTheDocument();
      expect(screen.getByLabelText(/시나리오 내용/)).toBeInTheDocument();
      expect(screen.getByLabelText(/장르/)).toBeInTheDocument();
      expect(screen.getByLabelText(/스타일/)).toBeInTheDocument();
      expect(screen.getByLabelText(/타겟 관객/)).toBeInTheDocument();
    });

    it('진행률 바에 적절한 ARIA 속성이 있어야 한다', () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('에러 메시지가 적절한 역할로 표시되어야 한다', async () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      fireEvent.submit(screen.getByRole('form'));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent(/입력 오류가 있습니다/);
      });
    });
  });

  describe('초기값 설정', () => {
    it('초기 데이터가 올바르게 설정되어야 한다', () => {
      const mockOnSubmit = jest.fn();
      const initialData = {
        title: '초기 제목',
        content: '초기 내용',
        genre: 'comedy' as const,
        style: 'dramatic' as const,
        target: 'teens' as const,
        structure: 'three-act' as const,
        intensity: 'high' as const,
      };

      render(<ScenarioForm onSubmit={mockOnSubmit} initialData={initialData} />);

      expect(screen.getByDisplayValue('초기 제목')).toBeInTheDocument();
      expect(screen.getByDisplayValue('초기 내용')).toBeInTheDocument();
      expect(screen.getByDisplayValue('comedy')).toBeInTheDocument();
    });
  });

  describe('사용자 경험', () => {
    it('글자 수 카운터가 표시되어야 한다', async () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      expect(screen.getByText('0/100자')).toBeInTheDocument();
      expect(screen.getByText('0/5000자 (최소 50자)')).toBeInTheDocument();

      const titleInput = screen.getByLabelText(/시나리오 제목/);
      await user.type(titleInput, '테스트');

      expect(screen.getByText('3/100자')).toBeInTheDocument();
    });

    it('구조 설명이 표시되어야 한다', () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      expect(screen.getByText(/기-승-전-결의 4단계 구조/)).toBeInTheDocument();
    });

    it('강도 설명이 표시되어야 한다', () => {
      const mockOnSubmit = jest.fn();
      render(<ScenarioForm onSubmit={mockOnSubmit} />);

      expect(screen.getByText(/적당한 긴장감과 감정적 몰입/)).toBeInTheDocument();
    });
  });
});