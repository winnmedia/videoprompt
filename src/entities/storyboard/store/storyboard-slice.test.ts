/**
 * Storyboard Slice Tests
 * TDD 원칙에 따른 스토리보드 상태 관리 테스트
 */

import {
  storyboardSlice,
  StoryboardState,
  generateStoryboard,
  setCurrentStoryboard,
  clearCurrentStoryboard,
  generateImage,
} from './storyboard-slice';
import { Storyboard } from '../model/Storyboard';

describe('storyboardSlice', () => {
  const initialState: StoryboardState = {
    storyboards: [],
    currentStoryboard: null,
    isLoading: false,
    isGenerating: false,
    isGeneratingImage: false,
    error: null,
  };

  const mockStoryboard: Storyboard = {
    id: 'storyboard-1',
    scenarioId: 'scenario-1',
    title: '제주도 여행 스토리보드',
    description: 'AI가 생성한 제주도 여행 스토리보드',
    panels: [
      {
        id: 'panel-1',
        sceneId: 'scene-1',
        imagePrompt: '제주도 공항에서 여행객이 도착하는 모습',
        duration: 30,
        order: 1,
        visualDescription: '밝은 공항 로비, 여행 가방을 든 주인공',
        cameraAngle: '미디엄 샷',
        lighting: '자연광',
      },
    ],
    totalDuration: 30,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    status: 'draft',
  };

  it('should return the initial state', () => {
    expect(storyboardSlice.reducer(undefined, { type: 'unknown' })).toEqual(
      initialState
    );
  });

  it('should handle setCurrentStoryboard', () => {
    const actual = storyboardSlice.reducer(
      initialState,
      setCurrentStoryboard(mockStoryboard)
    );

    expect(actual.currentStoryboard).toEqual(mockStoryboard);
    expect(actual.error).toBe(null);
  });

  it('should handle clearCurrentStoryboard', () => {
    const stateWithStoryboard: StoryboardState = {
      ...initialState,
      currentStoryboard: mockStoryboard,
    };

    const actual = storyboardSlice.reducer(
      stateWithStoryboard,
      clearCurrentStoryboard()
    );

    expect(actual.currentStoryboard).toBe(null);
  });

  it('should handle generateStoryboard.pending', () => {
    const actual = storyboardSlice.reducer(
      initialState,
      generateStoryboard.pending('', {
        scenarioId: 'scenario-1',
        title: '제주도 여행',
        description: '제주도 여행 스토리보드',
        scenes: [
          {
            id: 'scene-1',
            title: '오프닝',
            description: '제주도 공항 도착',
            type: '기',
            content: '공항에 도착하여 설레는 마음을 표현',
          },
        ],
      })
    );

    expect(actual.isGenerating).toBe(true);
    expect(actual.error).toBe(null);
  });

  it('should handle generateStoryboard.fulfilled', () => {
    const generatedResponse = {
      storyboard: mockStoryboard,
    };

    const actual = storyboardSlice.reducer(
      { ...initialState, isGenerating: true },
      generateStoryboard.fulfilled(generatedResponse, '', {
        scenarioId: 'scenario-1',
        title: '제주도 여행',
        description: '제주도 여행 스토리보드',
        scenes: [
          {
            id: 'scene-1',
            title: '오프닝',
            description: '제주도 공항 도착',
            type: '기',
            content: '공항에 도착하여 설레는 마음을 표현',
          },
        ],
      })
    );

    expect(actual.currentStoryboard).toEqual(mockStoryboard);
    expect(actual.storyboards).toContain(mockStoryboard);
    expect(actual.isGenerating).toBe(false);
    expect(actual.error).toBe(null);
  });

  it('should handle generateStoryboard.rejected', () => {
    const error = '스토리보드 생성 실패';

    const actual = storyboardSlice.reducer(
      { ...initialState, isGenerating: true },
      generateStoryboard.rejected(new Error(error), '', {
        scenarioId: 'scenario-1',
        title: '제주도 여행',
        description: '제주도 여행 스토리보드',
        scenes: [
          {
            id: 'scene-1',
            title: '오프닝',
            description: '제주도 공항 도착',
            type: '기',
            content: '공항에 도착하여 설레는 마음을 표현',
          },
        ],
      })
    );

    expect(actual.currentStoryboard).toBe(null);
    expect(actual.isGenerating).toBe(false);
    expect(actual.error).toBe(error);
  });

  it('should handle generateImage.pending', () => {
    const actual = storyboardSlice.reducer(
      initialState,
      generateImage.pending('', {
        prompt: '제주도 공항에서 여행객이 도착하는 모습',
        style: 'cinematic',
        aspectRatio: '16:9',
      })
    );

    expect(actual.isGeneratingImage).toBe(true);
    expect(actual.error).toBe(null);
  });

  it('should handle generateImage.fulfilled', () => {
    const imageResponse = {
      imageUrl: 'https://example.com/generated-image.jpg',
      prompt: '제주도 공항에서 여행객이 도착하는 모습',
    };

    const actual = storyboardSlice.reducer(
      { ...initialState, isGeneratingImage: true },
      generateImage.fulfilled(imageResponse, '', {
        prompt: '제주도 공항에서 여행객이 도착하는 모습',
        style: 'cinematic',
        aspectRatio: '16:9',
      })
    );

    expect(actual.isGeneratingImage).toBe(false);
    expect(actual.error).toBe(null);
  });

  it('should handle generateImage.rejected', () => {
    const error = '이미지 생성 실패';

    const actual = storyboardSlice.reducer(
      { ...initialState, isGeneratingImage: true },
      generateImage.rejected(new Error(error), '', {
        prompt: '제주도 공항에서 여행객이 도착하는 모습',
        style: 'cinematic',
        aspectRatio: '16:9',
      })
    );

    expect(actual.isGeneratingImage).toBe(false);
    expect(actual.error).toBe(error);
  });
});
