/**
 * Shot Store Public API
 */

export { default as shotReducer } from './shot-slice';
export {
  setCurrentShot,
  clearCurrentShot,
  createShotAction,
  updateShotOrderAction,
  updateShot,
  updateShotDuration,
  deleteShot,
  setLoading,
  setError,
  clearError,
  selectShot,
  selectCurrentShot,
  selectShots,
  selectShotLoading,
  selectShotError,
  selectShotsBySceneId,
  selectTotalDuration,
  selectTotalDurationBySceneId,
} from './shot-slice';
export type { ShotState } from './shot-slice';