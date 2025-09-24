/**
 * Scenario Store Public API
 * entities 레이어의 Public API
 */

export {
  scenarioSlice,
  generateScenario,
  setCurrentScenario,
  clearCurrentScenario,
} from './scenario-slice';
export type { ScenarioState } from './scenario-slice';
export { default as scenarioReducer } from './scenario-slice';
