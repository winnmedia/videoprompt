/**
 * Entities Public API - 통합 버전
 * 모든 도메인 엔티티를 단일 진입점으로 관리
 * 중복 export 방지를 위한 명시적 export
 */

// User Entity
export {
  type User,
  type UserPreferences,
  type UserState,
  userSlice,
  userReducer,
  defaultPreferences,
  setCurrentUser,
  clearCurrentUser,
  createGuestUser,
  setLoading as setUserLoading,
  setUserError,
  updateUserPreferences,
  restoreUserFromStorage,
  selectUserState,
  selectCurrentUser,
  selectIsAuthenticated,
  selectIsGuest,
  selectUserLoading,
  selectUserError,
  selectUserPreferences,
  selectUserInfo,
  selectAuthStatus,
} from './user';

// Story Entity
export * from './story';

// Shot Entity - alias conflicts 방지
export {
  type Shot,
  type ShotType,
  type CameraAngle,
  type ShotState,
  shotSlice,
  shotReducer,
  addShot,
  updateShot,
  removeShot,
  setError as setShotError,
  selectAllShots,
  selectShotById,
  selectIsLoading as selectShotIsLoading,
  selectError as selectShotError,
} from './shot';

// Storyboard Entity
export * from './storyboard';

// Scenario Entity
export * from './scenario';

// Prompt Entity
export * from './prompt';