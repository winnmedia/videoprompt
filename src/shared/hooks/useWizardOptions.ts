/**
 * Wizard 옵션 관리 훅
 * 테마, 스타일, 화면비, 지속시간 등의 옵션 상태를 관리
 */

import { useState, useCallback } from 'react';

export interface WizardOptions {
  // 기본 옵션
  selectedTheme: string;
  selectedStyle: string;
  selectedAspectRatio: string;
  selectedDuration: number;
  
  // 커스텀 토글/값
  useCustomTheme: boolean;
  customTheme: string;
  useCustomStyle: boolean;
  customStyle: string;
  useCustomAspect: boolean;
  customAspect: string;
  useCustomDuration: boolean;
  customDuration: string;
}

export interface WizardOptionsActions {
  setSelectedTheme: (theme: string) => void;
  setSelectedStyle: (style: string) => void;
  setSelectedAspectRatio: (ratio: string) => void;
  setSelectedDuration: (duration: number) => void;
  setUseCustomTheme: (use: boolean) => void;
  setCustomTheme: (theme: string) => void;
  setUseCustomStyle: (use: boolean) => void;
  setCustomStyle: (style: string) => void;
  setUseCustomAspect: (use: boolean) => void;
  setCustomAspect: (aspect: string) => void;
  setUseCustomDuration: (use: boolean) => void;
  setCustomDuration: (duration: string) => void;
}

const initialOptions: WizardOptions = {
  selectedTheme: '일반',
  selectedStyle: '자연스러운',
  selectedAspectRatio: '16:9',
  selectedDuration: 2,
  useCustomTheme: false,
  customTheme: '',
  useCustomStyle: false,
  customStyle: '',
  useCustomAspect: false,
  customAspect: '',
  useCustomDuration: false,
  customDuration: '',
};

export function useWizardOptions() {
  const [options, setOptions] = useState<WizardOptions>(initialOptions);

  const actions: WizardOptionsActions = {
    setSelectedTheme: useCallback((selectedTheme: string) => {
      setOptions(prev => ({ ...prev, selectedTheme }));
    }, []),

    setSelectedStyle: useCallback((selectedStyle: string) => {
      setOptions(prev => ({ ...prev, selectedStyle }));
    }, []),

    setSelectedAspectRatio: useCallback((selectedAspectRatio: string) => {
      setOptions(prev => ({ ...prev, selectedAspectRatio }));
    }, []),

    setSelectedDuration: useCallback((selectedDuration: number) => {
      setOptions(prev => ({ ...prev, selectedDuration }));
    }, []),

    setUseCustomTheme: useCallback((useCustomTheme: boolean) => {
      setOptions(prev => ({ ...prev, useCustomTheme }));
    }, []),

    setCustomTheme: useCallback((customTheme: string) => {
      setOptions(prev => ({ ...prev, customTheme }));
    }, []),

    setUseCustomStyle: useCallback((useCustomStyle: boolean) => {
      setOptions(prev => ({ ...prev, useCustomStyle }));
    }, []),

    setCustomStyle: useCallback((customStyle: string) => {
      setOptions(prev => ({ ...prev, customStyle }));
    }, []),

    setUseCustomAspect: useCallback((useCustomAspect: boolean) => {
      setOptions(prev => ({ ...prev, useCustomAspect }));
    }, []),

    setCustomAspect: useCallback((customAspect: string) => {
      setOptions(prev => ({ ...prev, customAspect }));
    }, []),

    setUseCustomDuration: useCallback((useCustomDuration: boolean) => {
      setOptions(prev => ({ ...prev, useCustomDuration }));
    }, []),

    setCustomDuration: useCallback((customDuration: string) => {
      setOptions(prev => ({ ...prev, customDuration }));
    }, []),
  };

  return { ...options, ...actions };
}