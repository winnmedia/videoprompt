/**
 * MSW 핸들러 통합 인덱스
 * 모든 API 핸들러를 하나의 배열로 통합
 */

import { authHandlers } from './auth';
import { scenarioHandlers } from './scenario';
import { storyboardHandlers } from './storyboard';
import { videoHandlers } from './video';
import { costSafetyHandlers } from './cost-safety';
import { bytedanceHandlers } from './bytedance';
import { reduxHandlers } from '../redux-handlers';

// 모든 핸들러를 하나의 배열로 통합
export const handlers = [
  ...reduxHandlers,
  ...authHandlers,
  ...scenarioHandlers,
  ...storyboardHandlers,
  ...videoHandlers,
  ...costSafetyHandlers,
  ...bytedanceHandlers, // ByteDance API 모킹 추가
];