/**
 * Workflow 상태 관리 훅
 * FSD Architecture - Shared Layer Hook  
 */

import { useState, useCallback } from 'react';
import { useProjectStore } from '@/entities/project';

export interface WorkflowData {
  story: string;
  scenario: {
    genre: string;
    tone: string;
    target: string;
    structure: string[];
    aiGenerated?: any;
  };
  prompt: {
    visualStyle: string;
    genre: string;
    mood: string;
    quality: string;
    directorStyle: string;
    weather: string;
    lighting: string;
    primaryLens: string;
    dominantMovement: string;
    material: string;
    angle: string;
    move: string;
    pacing: string;
    audioQuality: string;
    aiGenerated?: any;
    finalPrompt?: string;
    negativePrompt?: string;
    keywords?: string[];
  };
  video: {
    duration: number;
    model: string;
  };
}

export function useWorkflowState() {
  const project = useProjectStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workflowData, setWorkflowData] = useState<WorkflowData>({
    story: '',
    scenario: {
      genre: '',
      tone: '',
      target: '',
      structure: []
    },
    prompt: {
      visualStyle: '',
      genre: '',
      mood: '',
      quality: '',
      directorStyle: '',
      weather: '',
      lighting: '',
      primaryLens: '',
      dominantMovement: '',
      material: '',
      angle: '',
      move: '',
      pacing: '',
      audioQuality: ''
    },
    video: {
      duration: 30,
      model: 'seedance'
    }
  });

  const updateWorkflowData = useCallback((updates: Partial<WorkflowData>) => {
    setWorkflowData(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, 4));
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  }, []);

  const resetWorkflow = useCallback(() => {
    setCurrentStep(1);
    setWorkflowData({
      story: '',
      scenario: {
        genre: '',
        tone: '',
        target: '',
        structure: []
      },
      prompt: {
        visualStyle: '',
        genre: '',
        mood: '',
        quality: '',
        directorStyle: '',
        weather: '',
        lighting: '',
        primaryLens: '',
        dominantMovement: '',
        material: '',
        angle: '',
        move: '',
        pacing: '',
        audioQuality: ''
      },
      video: {
        duration: 30,
        model: 'seedance'
      }
    });
    setError(null);
  }, []);

  return {
    // State
    currentStep,
    workflowData,
    isLoading,
    error,
    project,

    // Actions  
    setCurrentStep,
    updateWorkflowData,
    nextStep,
    prevStep,
    resetWorkflow,
    setIsLoading,
    setError,
  };
}