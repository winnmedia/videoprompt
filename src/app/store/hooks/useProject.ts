/**
 * Redux 기반 프로젝트 훅
 * Zustand useProjectStore와 동일한 API 제공 (호환성 유지)
 */

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../index';
import {
  selectProject,
  selectProjectId,
  selectScenario,
  selectPrompt,
  selectVideo,
  selectVersions,
  init,
  setScenario,
  setPrompt,
  setVideo,
  updateVideo,
  addVersion,
  setScenarioId,
  setPromptId,
  setVideoAssetId,
  reset,
  type ScenarioData,
  type PromptData,
  type VideoData,
  type VersionMeta,
} from '../project-slice';

/**
 * 프로젝트 파이프라인 상태 관리 훅 (Redux 기반)
 * 기존 useProjectStore와 동일한 API 제공
 */
export function useProject() {
  const dispatch = useAppDispatch();
  const project = useAppSelector(selectProject);
  const scenario = useAppSelector(selectScenario);
  const prompt = useAppSelector(selectPrompt);
  const video = useAppSelector(selectVideo);
  const versions = useAppSelector(selectVersions);

  const handleInit = useCallback((id?: string) => {
    dispatch(init(id));
  }, [dispatch]);

  const handleSetScenario = useCallback((partial: Partial<ScenarioData>) => {
    dispatch(setScenario(partial));
  }, [dispatch]);

  const handleSetPrompt = useCallback((partial: Partial<PromptData>) => {
    dispatch(setPrompt(partial));
  }, [dispatch]);

  const handleSetVideo = useCallback((partial: Partial<VideoData>) => {
    dispatch(setVideo(partial));
  }, [dispatch]);

  const handleUpdateVideo = useCallback((partial: Partial<VideoData>) => {
    dispatch(updateVideo(partial));
  }, [dispatch]);

  const handleAddVersion = useCallback((version: VersionMeta) => {
    dispatch(addVersion(version));
  }, [dispatch]);

  const handleSetScenarioId = useCallback((id: string) => {
    dispatch(setScenarioId(id));
  }, [dispatch]);

  const handleSetPromptId = useCallback((id: string) => {
    dispatch(setPromptId(id));
  }, [dispatch]);

  const handleSetVideoAssetId = useCallback((id: string) => {
    dispatch(setVideoAssetId(id));
  }, [dispatch]);

  const handleReset = useCallback(() => {
    dispatch(reset());
  }, [dispatch]);

  return {
    // State (Zustand 호환)
    id: project.id,
    scenario,
    prompt,
    video,
    versions,
    scenarioId: project.scenarioId,
    promptId: project.promptId,
    videoAssetId: project.videoAssetId,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,

    // Actions (Zustand 호환 API)
    init: handleInit,
    setScenario: handleSetScenario,
    setPrompt: handleSetPrompt,
    setVideo: handleSetVideo,
    updateVideo: handleUpdateVideo,
    addVersion: handleAddVersion,
    setScenarioId: handleSetScenarioId,
    setPromptId: handleSetPromptId,
    setVideoAssetId: handleSetVideoAssetId,
    reset: handleReset,
  };
}

/**
 * 기존 useProjectStore 호환성 export
 * 점진적 마이그레이션을 위한 임시 alias
 */
export const useProjectStore = useProject;