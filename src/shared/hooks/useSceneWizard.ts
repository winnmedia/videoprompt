/**
 * Scene Wizard 상태 관리 훅
 * 거대한 wizard/page.tsx의 상태 로직을 분리
 */

import { useState, useCallback } from 'react';

export interface ScenePrompt {
  id?: string;
  prompt?: string;
  [key: string]: unknown;
}

export interface WizardState {
  scenario: string;
  isGenerating: boolean;
  generatedPrompt: ScenePrompt | null;
  error: string | null;
  lastEnhancedPrompt: string;
  lastSuggestions: string[];
  recentPrompts: Array<{ id: string; savedAt: number; name: string; prompt: ScenePrompt }>;
  expandedRecent: Record<string, boolean>;
  veo3Preview: string;
  imagePreviews: string[];
  isImageLoading: boolean;
  negativePromptsText: string;
  enableFullSfx: boolean;
  enableMoviePack: boolean;
  statusMsg: string | null;
  statusKind: 'success' | 'error' | 'info';
  seedanceJobIds: string[];
}

export interface WizardActions {
  setScenario: (scenario: string) => void;
  setIsGenerating: (loading: boolean) => void;
  setGeneratedPrompt: (prompt: ScenePrompt | null) => void;
  setError: (error: string | null) => void;
  setLastEnhancedPrompt: (prompt: string) => void;
  setLastSuggestions: (suggestions: string[]) => void;
  setRecentPrompts: (prompts: WizardState['recentPrompts']) => void;
  setExpandedRecent: (expanded: Record<string, boolean>) => void;
  setVeo3Preview: (preview: string) => void;
  setImagePreviews: (previews: string[]) => void;
  setIsImageLoading: (loading: boolean) => void;
  setNegativePromptsText: (text: string) => void;
  setEnableFullSfx: (enabled: boolean) => void;
  setEnableMoviePack: (enabled: boolean) => void;
  setStatusMsg: (msg: string | null) => void;
  setStatusKind: (kind: 'success' | 'error' | 'info') => void;
  setSeedanceJobIds: (ids: string[]) => void;
}

const initialState: WizardState = {
  scenario: '',
  isGenerating: false,
  generatedPrompt: null,
  error: null,
  lastEnhancedPrompt: '',
  lastSuggestions: [],
  recentPrompts: [],
  expandedRecent: {},
  veo3Preview: '',
  imagePreviews: [],
  isImageLoading: false,
  negativePromptsText: '',
  enableFullSfx: false,
  enableMoviePack: false,
  statusMsg: null,
  statusKind: 'info',
  seedanceJobIds: [],
};

export function useSceneWizard() {
  const [state, setState] = useState<WizardState>(initialState);

  const actions: WizardActions = {
    setScenario: useCallback((scenario: string) => {
      setState(prev => ({ ...prev, scenario }));
    }, []),

    setIsGenerating: useCallback((isGenerating: boolean) => {
      setState(prev => ({ ...prev, isGenerating }));
    }, []),

    setGeneratedPrompt: useCallback((generatedPrompt: ScenePrompt | null) => {
      setState(prev => ({ ...prev, generatedPrompt }));
    }, []),

    setError: useCallback((error: string | null) => {
      setState(prev => ({ ...prev, error }));
    }, []),

    setLastEnhancedPrompt: useCallback((lastEnhancedPrompt: string) => {
      setState(prev => ({ ...prev, lastEnhancedPrompt }));
    }, []),

    setLastSuggestions: useCallback((lastSuggestions: string[]) => {
      setState(prev => ({ ...prev, lastSuggestions }));
    }, []),

    setRecentPrompts: useCallback((recentPrompts: WizardState['recentPrompts']) => {
      setState(prev => ({ ...prev, recentPrompts }));
    }, []),

    setExpandedRecent: useCallback((expandedRecent: Record<string, boolean>) => {
      setState(prev => ({ ...prev, expandedRecent }));
    }, []),

    setVeo3Preview: useCallback((veo3Preview: string) => {
      setState(prev => ({ ...prev, veo3Preview }));
    }, []),

    setImagePreviews: useCallback((imagePreviews: string[]) => {
      setState(prev => ({ ...prev, imagePreviews }));
    }, []),

    setIsImageLoading: useCallback((isImageLoading: boolean) => {
      setState(prev => ({ ...prev, isImageLoading }));
    }, []),

    setNegativePromptsText: useCallback((negativePromptsText: string) => {
      setState(prev => ({ ...prev, negativePromptsText }));
    }, []),

    setEnableFullSfx: useCallback((enableFullSfx: boolean) => {
      setState(prev => ({ ...prev, enableFullSfx }));
    }, []),

    setEnableMoviePack: useCallback((enableMoviePack: boolean) => {
      setState(prev => ({ ...prev, enableMoviePack }));
    }, []),

    setStatusMsg: useCallback((statusMsg: string | null) => {
      setState(prev => ({ ...prev, statusMsg }));
    }, []),

    setStatusKind: useCallback((statusKind: 'success' | 'error' | 'info') => {
      setState(prev => ({ ...prev, statusKind }));
    }, []),

    setSeedanceJobIds: useCallback((seedanceJobIds: string[]) => {
      setState(prev => ({ ...prev, seedanceJobIds }));
    }, []),
  };

  return { ...state, ...actions };
}