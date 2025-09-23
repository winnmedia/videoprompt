/**
 * Scenario Feature - 완전 통합 버전
 */

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/hooks';
import {
  Scenario,
  Scene,
  selectScenarios,
  selectCurrentScenario,
  selectDraftForm,
  selectIsGenerating,
  selectGenerateStatus,
  selectGenerateProgress,
  updateDraftTitle,
  updateDraftContent,
  updateDraftSettings,
  resetDraftForm,
  startGenerateScenario,
  generateScenarioSuccess,
  generateScenarioFailure,
  setGenerateProgress,
} from '@/entities/scenario';

export interface ScenarioGenerateRequest {
  title: string;
  content: string;
  settings: {
    genre: string;
    tone: string;
    targetDuration: number;
  };
}

export interface ScenarioGenerateResponse {
  title: string;
  description: string;
  genre: string;
  scenes: Scene[];
  totalDuration: number;
  metadata: {
    generatedAt: string;
    lastModified: string;
    sceneCount: number;
    characterCount: number;
  };
}

export class ScenarioApi {
  static async generateScenario(request: ScenarioGenerateRequest): Promise<ScenarioGenerateResponse> {
    // Mock API response
    return {
      title: request.title,
      description: request.content,
      genre: request.settings.genre,
      scenes: [
        {
          id: 'scene_1',
          title: '오프닝',
          description: '스토리 시작',
          duration: 30,
          location: '실내',
          characters: ['주인공'],
          dialogue: '안녕하세요.',
        },
      ],
      totalDuration: request.settings.targetDuration,
      metadata: {
        generatedAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        sceneCount: 1,
        characterCount: 1,
      },
    };
  }
}

export function useScenarioGeneration() {
  const dispatch = useAppDispatch();

  const scenarios = useAppSelector(selectScenarios);
  const currentScenario = useAppSelector(selectCurrentScenario);
  const draftForm = useAppSelector(selectDraftForm);
  const isGenerating = useAppSelector(selectIsGenerating);
  const generateStatus = useAppSelector(selectGenerateStatus);
  const progress = useAppSelector(selectGenerateProgress);

  const updateTitle = useCallback((title: string) => {
    dispatch(updateDraftTitle(title));
  }, [dispatch]);

  const updateContent = useCallback((content: string) => {
    dispatch(updateDraftContent(content));
  }, [dispatch]);

  const updateSettings = useCallback((settings: Partial<any>) => {
    dispatch(updateDraftSettings(settings));
  }, [dispatch]);

  const resetForm = useCallback(() => {
    dispatch(resetDraftForm());
  }, [dispatch]);

  const generateScenario = useCallback(async () => {
    if (isGenerating) return;

    try {
      dispatch(startGenerateScenario());

      const progressSteps = [0, 25, 50, 75, 100];
      let currentStep = 0;

      const progressInterval = setInterval(() => {
        if (currentStep < progressSteps.length - 1) {
          currentStep++;
          dispatch(setGenerateProgress(progressSteps[currentStep]));
        }
      }, 200);

      const response = await ScenarioApi.generateScenario({
        title: draftForm.title,
        content: draftForm.content,
        settings: draftForm.settings,
      });

      clearInterval(progressInterval);
      dispatch(setGenerateProgress(100));

      const completedScenario: Scenario = {
        id: `scenario_${Date.now()}`,
        title: response.title,
        description: response.description,
        genre: response.genre,
        scenes: response.scenes,
        totalDuration: response.totalDuration,
        metadata: response.metadata,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      dispatch(generateScenarioSuccess(completedScenario));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '시나리오 생성 중 오류가 발생했습니다.';
      dispatch(generateScenarioFailure(errorMessage));
    }
  }, [dispatch, draftForm, isGenerating]);

  return {
    scenarios,
    currentScenario,
    draftForm,
    isGenerating,
    generateStatus,
    progress,
    updateTitle,
    updateContent,
    updateSettings,
    resetForm,
    generateScenario,
    canGenerate: !isGenerating && draftForm.title.trim() && draftForm.content.trim(),
  };
}