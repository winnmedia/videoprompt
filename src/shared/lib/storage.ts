/**
 * 스토리 데이터 지속성을 위한 sessionStorage 유틸리티
 * FRD.md 게스트 세션 요구사항에 따라 구현
 */

export interface StoryData {
  id: string;
  title: string;
  oneLineStory: string;
  toneAndManner: string[];
  genre: string;
  target: string;
  duration: string;
  format: string;
  tempo: string;
  developmentMethod: string;
  developmentIntensity: string;
  storySteps: Array<{
    id: string;
    title: string;
    summary: string;
    content: string;
    goal: string;
    lengthHint: string;
    isEditing: boolean;
  }>;
  shots: Array<{
    id: string;
    stepId: string;
    title: string;
    description: string;
    shotType: string;
    camera: string;
    composition: string;
    length: number;
    dialogue: string;
    subtitle: string;
    transition: string;
    contiImage?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const STORY_STORAGE_KEY = 'videoPlanet_storyData';

/**
 * 스토리 데이터를 sessionStorage에 저장
 */
export function saveStoryData(data: StoryData): void {
  try {
    const storyWithTimestamp = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    
    sessionStorage.setItem(STORY_STORAGE_KEY, JSON.stringify(storyWithTimestamp));
    console.log('Story data saved to sessionStorage:', storyWithTimestamp.id);
  } catch (error) {
    console.warn('Failed to save story data to sessionStorage:', error);
  }
}

/**
 * sessionStorage에서 스토리 데이터 불러오기
 */
export function loadStoryData(): StoryData | null {
  try {
    const stored = sessionStorage.getItem(STORY_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    
    const data = JSON.parse(stored) as StoryData;
    console.log('Story data loaded from sessionStorage:', data.id);
    return data;
  } catch (error) {
    console.warn('Failed to load story data from sessionStorage:', error);
    return null;
  }
}

/**
 * sessionStorage에서 스토리 데이터 제거
 */
export function clearStoryData(): void {
  try {
    sessionStorage.removeItem(STORY_STORAGE_KEY);
    console.log('Story data cleared from sessionStorage');
  } catch (error) {
    console.warn('Failed to clear story data from sessionStorage:', error);
  }
}

/**
 * 스토리 데이터가 sessionStorage에 있는지 확인
 */
export function hasStoryData(): boolean {
  try {
    return sessionStorage.getItem(STORY_STORAGE_KEY) !== null;
  } catch (error) {
    return false;
  }
}

/**
 * 스토리 데이터를 프로젝트 스토어 형식으로 변환
 */
export function convertStoryDataToProjectStore(storyData: StoryData) {
  return {
    scenario: {
      title: storyData.title,
      story: storyData.oneLineStory,
      tone: storyData.toneAndManner,
      genre: storyData.genre,
      target: storyData.target,
      format: storyData.format,
      tempo: storyData.tempo,
      developmentMethod: storyData.developmentMethod,
      developmentIntensity: storyData.developmentIntensity,
      durationSec: parseInt(storyData.duration, 10) || undefined,
    },
    storySteps: storyData.storySteps,
    shots: storyData.shots,
  };
}