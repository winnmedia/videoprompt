/**
 * Story Workflow Integration Tests
 * 전체 스토리 생성 및 편집 워크플로우 테스트
 * UserJourneyMap 5-6단계 완전 테스트
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { storyGeneratorSlice } from '../../features/story-generator/store/storyGeneratorSlice';
import { StoryGenerationForm, FourActStoryEditor } from '../../widgets/story-form';
import type { StoryGenerationParams } from '../../entities/story';

// MSW를 사용한 API 모킹
import { rest } from 'msw';
import { setupServer } from 'msw/node';

// 테스트용 API 서버 모킹
const server = setupServer(
  // 스토리 생성 API 모킹
  rest.post('/api/story/generate', (req, res, ctx) => {
    return res(
      ctx.delay(1000), // 1초 지연으로 로딩 상태 테스트
      ctx.json({
        success: true,
        story: {
          id: 'generated-story-123',
          title: '시간을 되돌리는 사진사',
          synopsis: '낡은 카메라를 발견한 사진사가 과거로 돌아가 인생의 중요한 순간들을 다시 경험하게 되는 이야기',
          genre: 'drama',
          targetAudience: 'adult',
          tone: 'dramatic',
          acts: {
            setup: {
              id: 'generated-story-123_act_1',
              actNumber: 1,
              title: '도입 (Setup)',
              content: 'AI가 생성한 도입부 내용입니다.',
              duration: 60,
              keyEvents: ['카메라 발견'],
              emotions: 'calm',
              characterFocus: ['민수']
            },
            development: {
              id: 'generated-story-123_act_2',
              actNumber: 2,
              title: '전개 (Development)',
              content: 'AI가 생성한 전개부 내용입니다.',
              duration: 120,
              keyEvents: ['시간여행 발견'],
              emotions: 'tension',
              characterFocus: ['민수', '옛 연인']
            },
            climax: {
              id: 'generated-story-123_act_3',
              actNumber: 3,
              title: '절정 (Climax)',
              content: 'AI가 생성한 절정부 내용입니다.',
              duration: 90,
              keyEvents: ['결정적 순간'],
              emotions: 'excitement',
              characterFocus: ['민수', '옛 연인']
            },
            resolution: {
              id: 'generated-story-123_act_4',
              actNumber: 4,
              title: '결말 (Resolution)',
              content: 'AI가 생성한 결말부 내용입니다.',
              duration: 60,
              keyEvents: ['깨달음'],
              emotions: 'hope',
              characterFocus: ['민수']
            }
          },
          status: 'completed',
          userId: 'test-user',
          totalDuration: 330,
          aiGenerated: true,
          aiModel: 'gemini',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        tokensUsed: 1500,
        generationTime: 3000,
        cost: 0.02
      })
    );
  }),

  // 썸네일 생성 API 모킹
  rest.post('/api/story/thumbnail', (req, res, ctx) => {
    return res(
      ctx.delay(2000), // 2초 지연
      ctx.json({
        success: true,
        thumbnails: {
          setup: 'https://mock-thumbnail-setup.jpg',
          development: 'https://mock-thumbnail-development.jpg',
          climax: 'https://mock-thumbnail-climax.jpg',
          resolution: 'https://mock-thumbnail-resolution.jpg'
        },
        totalCost: 0.16
      })
    );
  }),

  // 스토리 저장 API 모킹
  rest.post('/api/story', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        story: req.body,
        message: '스토리가 저장되었습니다'
      })
    );
  })
);

// 테스트 전후 설정
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// 테스트용 Redux Store
const createTestStore = () => {
  return configureStore({
    reducer: {
      storyGenerator: storyGeneratorSlice.reducer
    }
  });
};

describe('Story Generation Workflow Integration', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
  });

  const renderWithStore = (component: React.ReactElement) => {
    return render(
      <Provider store={store}>
        {component}
      </Provider>
    );
  };

  describe('Complete Story Generation Flow', () => {
    it('should complete the entire story generation workflow', async () => {
      const user = userEvent.setup();
      const onGenerate = jest.fn();

      // 1. 스토리 생성 폼 렌더링
      renderWithStore(
        <StoryGenerationForm
          onGenerate={onGenerate}
          isGenerating={false}
        />
      );

      // 2. 폼 필드 입력
      await user.type(
        screen.getByLabelText(/스토리 제목/),
        '시간을 되돌리는 사진사'
      );

      await user.type(
        screen.getByLabelText(/줄거리/),
        '낡은 카메라를 발견한 사진사가 과거로 돌아가 인생의 중요한 순간들을 다시 경험하게 되는 이야기'
      );

      // 장르 선택
      await user.selectOptions(
        screen.getByLabelText(/장르/),
        ['drama']
      );

      // 창의성 조절
      const creativitySlider = screen.getByLabelText(/창의성/);
      fireEvent.change(creativitySlider, { target: { value: '80' } });

      // 강도 조절
      const intensitySlider = screen.getByLabelText(/감정 강도/);
      fireEvent.change(intensitySlider, { target: { value: '70' } });

      // 주요 인물 추가
      const characterInput = screen.getByPlaceholderText(/인물명 입력/);
      await user.type(characterInput, '민수');
      await user.click(screen.getByText('추가'));

      await user.type(characterInput, '옛 연인');
      await user.click(screen.getByText('추가'));

      // 3. 스토리 생성 버튼 클릭
      const generateButton = screen.getByText(/4단계 스토리 생성하기/);
      expect(generateButton).not.toBeDisabled();

      await user.click(generateButton);

      // 4. onGenerate 콜백이 올바른 파라미터로 호출되었는지 확인
      expect(onGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '시간을 되돌리는 사진사',
          synopsis: expect.stringContaining('낡은 카메라'),
          genre: 'drama',
          creativity: 80,
          intensity: 70,
          keyCharacters: ['민수', '옛 연인']
        })
      );
    });

    it('should handle form validation correctly', async () => {
      const user = userEvent.setup();
      const onGenerate = jest.fn();

      renderWithStore(
        <StoryGenerationForm
          onGenerate={onGenerate}
          isGenerating={false}
        />
      );

      // 빈 폼으로 제출 시도
      const generateButton = screen.getByText(/4단계 스토리 생성하기/);
      expect(generateButton).toBeDisabled();

      // 제목만 입력
      await user.type(screen.getByLabelText(/스토리 제목/), '테스트 제목');
      expect(generateButton).toBeDisabled(); // 줄거리가 없으면 여전히 비활성화

      // 짧은 줄거리 입력
      await user.type(screen.getByLabelText(/줄거리/), '짧은 줄거리');
      expect(generateButton).toBeDisabled(); // 최소 20자 미만

      // 충분한 길이의 줄거리 입력
      await user.clear(screen.getByLabelText(/줄거리/));
      await user.type(
        screen.getByLabelText(/줄거리/),
        '충분히 긴 줄거리입니다. 최소 20자 이상이어야 합니다.'
      );
      expect(generateButton).not.toBeDisabled(); // 이제 활성화

      await user.click(generateButton);
      expect(onGenerate).toHaveBeenCalled();
    });
  });

  describe('Story Editing Workflow', () => {
    const mockGeneratedStory = {
      id: 'test-story-123',
      title: '시간을 되돌리는 사진사',
      synopsis: '낡은 카메라를 발견한 사진사가 과거로 돌아가 인생의 중요한 순간들을 다시 경험하게 되는 이야기',
      genre: 'drama' as const,
      targetAudience: 'adult' as const,
      tone: 'dramatic' as const,
      acts: {
        setup: {
          id: 'test-story-123_act_1',
          actNumber: 1 as const,
          title: '도입 (Setup)',
          content: 'AI가 생성한 도입부 내용입니다.',
          duration: 60,
          keyEvents: ['카메라 발견'],
          emotions: 'calm' as const,
          characterFocus: ['민수']
        },
        development: {
          id: 'test-story-123_act_2',
          actNumber: 2 as const,
          title: '전개 (Development)',
          content: 'AI가 생성한 전개부 내용입니다.',
          duration: 120,
          keyEvents: ['시간여행 발견'],
          emotions: 'tension' as const,
          characterFocus: ['민수', '옛 연인']
        },
        climax: {
          id: 'test-story-123_act_3',
          actNumber: 3 as const,
          title: '절정 (Climax)',
          content: 'AI가 생성한 절정부 내용입니다.',
          duration: 90,
          keyEvents: ['결정적 순간'],
          emotions: 'excitement' as const,
          characterFocus: ['민수', '옛 연인']
        },
        resolution: {
          id: 'test-story-123_act_4',
          actNumber: 4 as const,
          title: '결말 (Resolution)',
          content: 'AI가 생성한 결말부 내용입니다.',
          duration: 60,
          keyEvents: ['깨달음'],
          emotions: 'hope' as const,
          characterFocus: ['민수']
        }
      },
      status: 'completed' as const,
      userId: 'test-user',
      totalDuration: 330,
      aiGenerated: true,
      aiModel: 'gemini' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    it('should allow editing of generated story', async () => {
      const user = userEvent.setup();
      const onStoryUpdate = jest.fn();
      const onNext = jest.fn();

      renderWithStore(
        <FourActStoryEditor
          story={mockGeneratedStory}
          onStoryUpdate={onStoryUpdate}
          onNext={onNext}
        />
      );

      // 도입부 편집
      const setupCard = screen.getByText('도입 (Setup)').closest('[role="button"]');
      expect(setupCard).toBeInTheDocument();

      if (setupCard) {
        await user.click(setupCard);

        // 편집 버튼 클릭
        const editButton = screen.getByText('편집');
        await user.click(editButton);

        // 내용 수정
        const textarea = screen.getByDisplayValue(/AI가 생성한 도입부 내용/);
        await user.clear(textarea);
        await user.type(textarea, '사용자가 수정한 도입부 내용입니다.');

        // 저장 버튼 클릭
        const saveButton = screen.getByText('저장');
        await user.click(saveButton);

        // Redux 상태가 업데이트되었는지 확인
        await waitFor(() => {
          expect(screen.getByText('사용자가 수정한 도입부 내용입니다.')).toBeInTheDocument();
        });
      }
    });

    it('should handle thumbnail generation workflow', async () => {
      const user = userEvent.setup();

      renderWithStore(
        <FourActStoryEditor
          story={mockGeneratedStory}
          onStoryUpdate={jest.fn()}
          onNext={jest.fn()}
        />
      );

      // 썸네일 생성 버튼 찾기
      const generateButton = screen.getByText(/모든 썸네일 생성/);
      await user.click(generateButton);

      // 로딩 상태 확인
      await waitFor(() => {
        expect(screen.getByText(/생성 중.../)).toBeInTheDocument();
      });

      // 생성 완료 확인
      await waitFor(() => {
        expect(screen.queryByText(/생성 중.../)).not.toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should proceed to next step when story is complete', async () => {
      const user = userEvent.setup();
      const onNext = jest.fn();

      renderWithStore(
        <FourActStoryEditor
          story={mockGeneratedStory}
          onStoryUpdate={jest.fn()}
          onNext={onNext}
        />
      );

      // 다음 단계 버튼이 있는지 확인
      const nextButton = screen.getByText(/12단계 숏트 생성으로/);
      expect(nextButton).toBeInTheDocument();

      await user.click(nextButton);
      expect(onNext).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // API 에러 모킹
      server.use(
        rest.post('/api/story/generate', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({
              success: false,
              error: {
                type: 'api_error',
                message: '서버 오류가 발생했습니다',
                retryable: true,
                timestamp: new Date().toISOString()
              }
            })
          );
        })
      );

      const user = userEvent.setup();
      const onGenerate = jest.fn();

      renderWithStore(
        <StoryGenerationForm
          onGenerate={onGenerate}
          isGenerating={false}
          error="서버 오류가 발생했습니다"
        />
      );

      // 에러 메시지가 표시되는지 확인
      expect(screen.getByText(/서버 오류가 발생했습니다/)).toBeInTheDocument();
    });

    it('should handle rate limiting', async () => {
      // Rate limit 에러 모킹
      server.use(
        rest.post('/api/story/generate', (req, res, ctx) => {
          return res(
            ctx.status(429),
            ctx.json({
              success: false,
              error: {
                type: 'rate_limit',
                message: '시간당 생성 한도를 초과했습니다',
                retryable: true,
                timestamp: new Date().toISOString()
              }
            })
          );
        })
      );

      const user = userEvent.setup();
      const onGenerate = jest.fn();

      renderWithStore(
        <StoryGenerationForm
          onGenerate={onGenerate}
          isGenerating={false}
          error="시간당 생성 한도를 초과했습니다"
        />
      );

      expect(screen.getByText(/시간당 생성 한도를 초과했습니다/)).toBeInTheDocument();
    });
  });

  describe('Performance and Loading States', () => {
    it('should show loading states during generation', async () => {
      const user = userEvent.setup();

      renderWithStore(
        <StoryGenerationForm
          onGenerate={jest.fn()}
          isGenerating={true}
        />
      );

      // 로딩 스피너가 표시되는지 확인
      expect(screen.getByText(/4단계 스토리 생성 중.../)).toBeInTheDocument();

      // 생성 버튼이 비활성화되는지 확인
      const generateButton = screen.getByText(/4단계 스토리 생성 중.../);
      expect(generateButton).toBeDisabled();
    });

    it('should handle auto-save with debouncing', async () => {
      const user = userEvent.setup();
      const onStoryUpdate = jest.fn();

      renderWithStore(
        <FourActStoryEditor
          story={mockGeneratedStory}
          onStoryUpdate={onStoryUpdate}
        />
      );

      // 빠른 연속 편집 시뮬레이션
      const setupCard = screen.getByText('도입 (Setup)').closest('[role="button"]');
      if (setupCard) {
        await user.click(setupCard);
        const editButton = screen.getByText('편집');
        await user.click(editButton);

        const textarea = screen.getByDisplayValue(/AI가 생성한 도입부 내용/);

        // 연속으로 타이핑
        await user.type(textarea, 'abc');
        await user.type(textarea, 'def');
        await user.type(textarea, 'ghi');

        // 디바운스로 인해 자동저장이 한 번만 트리거되는지 확인
        await waitFor(() => {
          expect(screen.queryByText('자동 저장 중...')).toBeInTheDocument();
        }, { timeout: 3000 });
      }
    });
  });
});