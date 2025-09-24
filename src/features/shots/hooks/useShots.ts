/**
 * useShots Hook
 * 12단계 숏트 관리 커스텀 훅
 */

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../../shared/hooks/redux';
import type {
  ShotGenerationRequest,
  ShotEditRequest,
  StoryboardGenerationRequest
} from '../types';
import type { TwelveShotCollection, ShotStoryboard } from '../../../entities/Shot';
import {
  generateShots,
  generateStoryboard,
  generateAllStoryboards,
  shotsActions,
  selectCurrentCollection,
  selectIsGenerating,
  selectGenerationProgress,
  selectGenerationError,
  selectSelectedShotId,
  selectDragEnabled,
  selectPreviewMode,
  selectStoryboardGeneration,
  selectCollectionHistory,
  selectCollectionCompletionPercentage
} from '../store/shots-slice';

export function useShots() {
  const dispatch = useAppDispatch();

  // 상태 선택자들
  const currentCollection = useAppSelector(selectCurrentCollection);
  const isGenerating = useAppSelector(selectIsGenerating);
  const progress = useAppSelector(selectGenerationProgress);
  const error = useAppSelector(selectGenerationError);
  const selectedShotId = useAppSelector(selectSelectedShotId);
  const dragEnabled = useAppSelector(selectDragEnabled);
  const previewMode = useAppSelector(selectPreviewMode);
  const storyboardGeneration = useAppSelector(selectStoryboardGeneration);
  const collections = useAppSelector(selectCollectionHistory);
  const completionPercentage = useAppSelector(selectCollectionCompletionPercentage);

  // 액션 크리에이터들
  const actions = {
    // 12단계 숏트 생성
    generateShots: useCallback((request: ShotGenerationRequest) => {
      return dispatch(generateShots(request));
    }, [dispatch]),

    // 현재 컬렉션 설정
    setCurrentCollection: useCallback((collection: TwelveShotCollection) => {
      dispatch(shotsActions.setCurrentCollection(collection));
    }, [dispatch]),

    // 숏트 순서 변경 (드래그앤드롭)
    updateShotOrder: useCallback((shotId: string, newOrder: number) => {
      dispatch(shotsActions.updateShotOrder({ shotId, newOrder }));
    }, [dispatch]),

    // 숏트 내용 편집
    editShot: useCallback((request: ShotEditRequest) => {
      dispatch(shotsActions.editShot(request));
    }, [dispatch]),

    // 숏트 선택
    selectShot: useCallback((shotId: string | null) => {
      dispatch(shotsActions.selectShot(shotId));
    }, [dispatch]),

    // 드래그 기능 토글
    toggleDrag: useCallback((enabled: boolean) => {
      dispatch(shotsActions.toggleDrag(enabled));
    }, [dispatch]),

    // 미리보기 모드 변경
    setPreviewMode: useCallback((mode: 'grid' | 'timeline' | 'storyboard') => {
      dispatch(shotsActions.setPreviewMode(mode));
    }, [dispatch]),

    // 에러 초기화
    clearError: useCallback(() => {
      dispatch(shotsActions.clearError());
    }, [dispatch]),

    // 히스토리에 추가
    addToHistory: useCallback((collection: TwelveShotCollection) => {
      dispatch(shotsActions.addToHistory(collection));
    }, [dispatch]),

    // 상태 초기화
    resetState: useCallback(() => {
      dispatch(shotsActions.resetState());
    }, [dispatch])
  };

  // 콘티 관련 액션들
  const storyboardActions = {
    // 개별 콘티 생성
    generateStoryboard: useCallback((request: StoryboardGenerationRequest) => {
      return dispatch(generateStoryboard(request));
    }, [dispatch]),

    // 모든 콘티 일괄 생성
    generateAllStoryboards: useCallback((style: ShotStoryboard['style'] = 'cinematic') => {
      return dispatch(generateAllStoryboards({ style }));
    }, [dispatch]),

    // 콘티 상태 직접 업데이트
    updateStoryboard: useCallback((shotId: string, storyboard: Partial<ShotStoryboard>) => {
      dispatch(shotsActions.updateStoryboard({ shotId, storyboard }));
    }, [dispatch])
  };

  // 유틸리티 함수들
  const utils = {
    // 특정 숏트 가져오기
    getShotById: useCallback((shotId: string) => {
      return currentCollection?.shots.find(shot => shot.id === shotId) || null;
    }, [currentCollection]),

    // Act별 숏트 가져오기
    getShotsByAct: useCallback((actType: 'setup' | 'development' | 'climax' | 'resolution') => {
      return currentCollection?.shots.filter(shot => shot.actType === actType) || [];
    }, [currentCollection]),

    // 완성된 콘티 수 계산
    getCompletedStoryboards: useCallback(() => {
      if (!currentCollection) return 0;
      return currentCollection.shots.filter(
        shot => shot.storyboard.status === 'completed'
      ).length;
    }, [currentCollection]),

    // 생성 중인 콘티 수 계산
    getGeneratingStoryboards: useCallback(() => {
      return Object.values(storyboardGeneration).filter(
        state => state.isGenerating
      ).length;
    }, [storyboardGeneration]),

    // 전체 예상 시간 계산
    getTotalDuration: useCallback(() => {
      if (!currentCollection) return 0;
      return currentCollection.totalDuration;
    }, [currentCollection]),

    // 숏트 유효성 검사
    validateCollection: useCallback(() => {
      if (!currentCollection) return { isValid: false, errors: ['컬렉션이 없습니다'] };

      const errors: string[] = [];

      if (currentCollection.shots.length !== 12) {
        errors.push(`12개의 숏트가 필요하지만 ${currentCollection.shots.length}개입니다`);
      }

      // 순서 중복 검사
      const orders = currentCollection.shots.map(shot => shot.globalOrder);
      const uniqueOrders = new Set(orders);
      if (orders.length !== uniqueOrders.size) {
        errors.push('숏트 순서에 중복이 있습니다');
      }

      // 순서 연속성 검사
      const sortedOrders = [...orders].sort((a, b) => a - b);
      for (let i = 0; i < sortedOrders.length; i++) {
        if (sortedOrders[i] !== i + 1) {
          errors.push('숏트 순서가 연속적이지 않습니다');
          break;
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    }, [currentCollection]),

    // 콘티 다운로드 URL 생성
    getStoryboardDownloadUrl: useCallback((shotId: string) => {
      const shot = currentCollection?.shots.find(s => s.id === shotId);
      return shot?.storyboard.downloadUrl || null;
    }, [currentCollection])
  };

  return {
    // 상태
    currentCollection,
    isGenerating,
    progress,
    error,
    selectedShotId,
    dragEnabled,
    previewMode,
    storyboardGeneration,
    collections,
    completionPercentage,

    // 액션들
    ...actions,
    storyboard: storyboardActions,

    // 유틸리티
    ...utils
  };
}