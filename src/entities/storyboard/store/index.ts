/**
 * Storyboard Store Public API
 * entities 레이어의 Public API
 */

export {
  storyboardSlice,
  generateStoryboard,
  generateImage,
  setCurrentStoryboard,
  clearCurrentStoryboard,
} from './storyboard-slice';
export type { StoryboardState } from './storyboard-slice';
export { default as storyboardReducer } from './storyboard-slice';
