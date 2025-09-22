/**
 * Redux Store Configuration
 *
 * CLAUDE.md 준수: Redux Toolkit 2.0, FSD app 레이어
 * $300 사건 방지: 비용 안전 규칙 적용
 */

import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'

// Entities - 도메인 상태
import scenarioReducer from '../../entities/scenario/store'
import projectReducer from '../../entities/project/store'
import storyboardReducer from '../../entities/storyboard/store'
import authReducer from '../../entities/auth/store'
import feedbackReducer from '../../entities/feedback/store/feedback-slice'
import contentManagementReducer from '../../entities/content-management/store/content-slice'
import userJourneyReducer from '../../entities/user-journey/store/user-journey-slice'

// Features - 기능별 상태
import adminMetricsReducer from '../../features/admin/store/admin-metrics-slice'
import userManagementReducer from '../../features/admin/store/user-management-slice'
import planningReducer from '../../features/planning/store/planning-slice'

// Performance monitoring for cost safety
import logger from '../../shared/lib/logger'
import { costSafetyMiddleware } from '../../shared/lib/cost-safety-middleware'

/**
 * Redux Store 설정
 *
 * 비용 안전 규칙:
 * - 무한 호출 방지를 위한 엄격한 미들웨어 설정
 * - 개발 환경에서만 DevTools 활성화
 * - 직렬화 체크 강화
 */
export const store = configureStore({
  reducer: {
    // Entities
    auth: authReducer,
    scenario: scenarioReducer,
    project: projectReducer,
    storyboard: storyboardReducer,
    feedback: feedbackReducer,
    contentManagement: contentManagementReducer,
    userJourney: userJourneyReducer,

    // Features
    adminMetrics: adminMetricsReducer,
    userManagement: userManagementReducer,
    planning: planningReducer,
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // 비용 안전: 직렬화 체크 강화
      serializableCheck: {
        // Date 객체는 허용 (시나리오 메타데이터, 인증 토큰에서 사용)
        ignoredActionPaths: ['payload.timestamp', 'payload.tokens.expiresAt', 'payload.user.metadata'],
        ignoredStatePaths: [
          'scenario.editorState.lastSavedAt',
          'project.metadata.createdAt',
          'project.metadata.updatedAt',
          'auth.tokens.expiresAt',
          'auth.user.metadata.createdAt',
          'auth.user.metadata.updatedAt',
          'auth.user.metadata.lastLoginAt',
          'auth.lastActivity',
          'userJourney.currentJourney.startedAt',
          'userJourney.currentJourney.lastActivityAt',
          'userJourney.journeyHistory',
          'userJourney.lastSyncedAt'
        ],
      },

      // 비용 안전: 불변성 체크 활성화
      immutableCheck: {
        warnAfter: 128, // 성능 임계값
      },
    })
    // $300 사건 방지: 비용 안전 미들웨어 추가
    .concat(costSafetyMiddleware),

  // 개발 환경에서만 DevTools 활성화
  devTools: process.env.NODE_ENV !== 'production',

  // 초기 상태 미리 로드 방지 (비용 안전)
  preloadedState: undefined,
})

// RTK Query 리스너 설정 (향후 서버 상태 관리용)
setupListeners(store.dispatch)

// 타입 정의
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Store 인스턴스 로깅 (개발 환경만)
if (process.env.NODE_ENV === 'development') {
  logger.info('Redux Store 초기화 완료', {
    reducers: Object.keys(store.getState()),
    timestamp: new Date().toISOString(),
  } as any)
}

// 비용 안전: Store 구독 모니터링
if (process.env.NODE_ENV === 'development') {
  let subscriptionCount = 0

  const originalSubscribe = store.subscribe
  store.subscribe = (...args) => {
    subscriptionCount++

    // 구독 수가 비정상적으로 많으면 경고
    if (subscriptionCount > 50) {
      logger.warn('⚠️ 구독 수 급증 감지', {
        count: subscriptionCount,
        warning: '무한 구독으로 인한 비용 폭탄 위험',
      } as any)
    }

    return originalSubscribe.apply(store, args)
  }
}

export default store