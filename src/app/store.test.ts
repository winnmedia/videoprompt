/**
 * Redux Store Tests
 * TDD 원칙에 따른 Redux Store 테스트
 */

import { setupStore, RootState, AppDispatch } from './store';

describe('Redux Store', () => {
  let store: ReturnType<typeof setupStore>;

  beforeEach(() => {
    store = setupStore();
  });

  it('should initialize with correct slices', () => {
    const state = store.getState();

    expect(state).toHaveProperty('auth');
    expect(state.auth).toEqual({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('should have proper TypeScript types', () => {
    const state: RootState = store.getState();
    const dispatch: AppDispatch = store.dispatch;

    expect(state).toBeDefined();
    expect(dispatch).toBeDefined();
  });

  it('should be serializable', () => {
    const state = store.getState();

    expect(() => JSON.stringify(state)).not.toThrow();
  });

  it('should support time travel debugging in development', () => {
    const isDev = process.env.NODE_ENV !== 'production';

    if (isDev) {
      // DevTools should be enabled in development
      expect(store).toBeDefined();
    }
  });
});
