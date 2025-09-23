import { configureStore } from '@reduxjs/toolkit';
import { userReducer } from '@/entities/user';
import { storyReducer } from '@/entities/story';
import { shotSlice } from '@/entities/shot';
import { scenarioReducer } from '@/entities/scenario';
// storyGenerator는 entities/story에서 관리됨
import { storyboardReducer } from '@/entities/storyboard';

export const store = configureStore({
  reducer: {
    user: userReducer,
    story: storyReducer,
    shot: shotSlice.reducer,
    scenario: scenarioReducer,
    storyboard: storyboardReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Supabase 객체 등 비직렬화 데이터 무시
        ignoredActions: ['user/setCurrentUser'],
        ignoredPaths: ['user.currentUser.metadata'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;