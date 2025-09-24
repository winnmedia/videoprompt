/**
 * Entities Layer Public API
 * 도메인 모델 및 비즈니스 엔티티 export
 */

// User Entity
export type { User, UserPreferences } from './User';
export {
  createGuestUser,
  createRegisteredUser,
  validateUser,
  updateUserPreferences,
} from './User';

// Project Entity
export type { Project } from './Project';
export {
  createProject,
  updateProjectStatus,
  validateProject,
  attachStoryToProject,
} from './Project';

// Note: Story Entity removed - using FourActStory (story.ts) instead

// Scene Entity
export type { Scene } from './Scene';
export {
  createScene,
  updateSceneOrder,
  validateScene,
  addShotToScene,
  removeShotFromScene,
} from './Scene';

// Shot Entity (12단계 숏트 시스템)
export type {
  TwelveShot,
  TwelveShotCollection,
  ShotStoryboard,
  ShotBreakdownParams,
  ShotType,
  CameraMovement,
  ShotEmotion
} from './Shot';
export {
  createTwelveShotCollection,
  updateTwelveShotOrder,
  updateTwelveShot,
  updateShotStoryboard,
  validateTwelveShotCollection
} from './Shot';

// 기존 Shot 호환성
export type { Shot } from './Shot';
export {
  createShot,
  updateShotOrder,
  calculateTotalDuration,
  validateShot,
} from './Shot';

// Storyboard Entity
export type { Storyboard } from './Storyboard';
export {
  createStoryboard,
  updateStoryboardStatus,
  validateStoryboard,
  attachImageToStoryboard,
  setConsistencyParams,
} from './Storyboard';

// Story Entity (4단계 스토리 시스템)
export type { FourActStory, StoryAct, StoryGenerationParams } from './story';
export {
  createFourActStory,
  updateStoryAct,
  validateFourActStory,
  extractThumbnailPrompt,
  prepareForShotBreakdown,
  ACT_TEMPLATES
} from './story';

// Scenario Entity (NEW - UserJourneyMap 3-4단계)
export * from './scenario';
