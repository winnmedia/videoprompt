/**
 * Seedance Entity Public API
 * FSD Architecture - Entities Layer
 */

// Types - Public API 노출
export type {
  ProviderConfig,
  ProviderStatus,
  ApiKeyStatus,
  SeedanceProviderState
} from './store/seedance-provider-slice';

// Store Actions and Selectors - Public API 노출
export {
  setProviderConfig,
  setProviderStatus,
  updateApiKeyStatus,
  resetProviderState,
  selectProviderConfig,
  selectProviderStatus,
  selectApiKeyStatus,
  selectShouldUseMock
} from './store/seedance-provider-slice';

// Redux reducer - Public API 노출
import seedanceProviderSlice from './store/seedance-provider-slice';
export const seedanceProviderReducer = seedanceProviderSlice.reducer;

// Hooks - Public API 노출
export { useSeedanceProvider } from './hooks/use-seedance-provider';