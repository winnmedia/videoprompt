/**
 * Storyboard Generator Feature - 완전 통합 버전
 */

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/hooks';
import {
  Storyboard,
  selectStoryboards,
  selectCurrentStoryboard,
  selectGenerateStatus,
  selectIsLoading,
  selectError,
  setStoryboards,
  addStoryboard,
  setCurrentStoryboard,
  setGenerateStatus,
  setLoading,
  setError,
} from '@/entities/storyboard';

export interface StoryboardGenerateRequest {
  title: string;
  description: string;
  storyRef?: string;
  frameCount?: number;
}

export interface StoryboardGenerationResponse {
  id: string;
  title: string;
  description: string;
  frames: any[];
  totalDuration: number;
  downloadUrl?: string;
}

export class StoryboardGeneratorApi {
  static async generateStoryboard(request: StoryboardGenerateRequest): Promise<StoryboardGenerationResponse> {
    // Mock API response
    return {
      id: `storyboard_${Date.now()}`,
      title: request.title,
      description: request.description,
      frames: [],
      totalDuration: 120,
      downloadUrl: '/mock-storyboard.pdf',
    };
  }
}

export function useStoryboardGeneration() {
  const dispatch = useAppDispatch();

  const storyboards = useAppSelector(selectStoryboards);
  const currentStoryboard = useAppSelector(selectCurrentStoryboard);
  const generateStatus = useAppSelector(selectGenerateStatus);
  const isLoading = useAppSelector(selectIsLoading);
  const error = useAppSelector(selectError);

  const generateStoryboard = useCallback(async (request: StoryboardGenerateRequest) => {
    try {
      dispatch(setLoading(true));
      dispatch(setGenerateStatus('loading'));

      const response = await StoryboardGeneratorApi.generateStoryboard(request);

      const storyboard: Storyboard = {
        id: response.id,
        title: response.title,
        description: response.description,
        frames: response.frames,
        totalDuration: response.totalDuration,
        userId: 'default-user',
        metadata: {
          generatedAt: new Date().toISOString(),
          exportCount: 0,
          frameCount: response.frames.length,
          avgFrameDuration: response.frames.length > 0 ? response.totalDuration / response.frames.length : 0,
        },
        status: 'completed',
        downloadUrl: response.downloadUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      dispatch(addStoryboard(storyboard));
      dispatch(setCurrentStoryboard(storyboard));
      dispatch(setGenerateStatus('succeeded'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '스토리보드 생성 중 오류가 발생했습니다.';
      dispatch(setError(errorMessage));
      dispatch(setGenerateStatus('failed'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  return {
    storyboards,
    currentStoryboard,
    generateStatus,
    isLoading,
    error,
    generateStoryboard,
    isGenerating: generateStatus === 'loading',
  };
}