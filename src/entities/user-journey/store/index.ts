/**
 * UserJourney Store Public API
 */

export { default as userJourneyReducer } from './user-journey-slice';
export {
  setCurrentStep,
  updateStepProgress,
  setStepData,
  completeStep,
  goToNextStep,
  goToPreviousStep,
  jumpToStep,
  resetJourney,
  restoreSession,
  setLoading,
  setError,
  clearError,
  selectUserJourney,
  selectCurrentStep,
  selectCompletedSteps,
  selectStepProgress,
  selectStepData,
  selectTotalProgress,
  selectIsStepCompleted,
  selectJourneyStats,
  selectRecommendedNextStep,
} from './user-journey-slice';
export type { UserJourneyState, UserJourneyStep } from './user-journey-slice';