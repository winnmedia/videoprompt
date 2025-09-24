/**
 * 결정론적 테스트 데이터 팩토리
 * 동일한 입력에 대해 항상 동일한 출력을 보장하여 $300 사건 방지
 * TDD 원칙에 따른 예측 가능한 테스트 데이터 생성
 */

import { nanoid } from 'nanoid';

// 시드 기반 ID 생성 (결정론적)
const createSeededId = (seed: string, prefix: string = ''): string => {
  // 간단한 해시 함수로 시드 기반 ID 생성
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32비트 정수로 변환
  }
  const id = Math.abs(hash).toString(16);
  return prefix ? `${prefix}-${id}` : id;
};

// 시드 기반 날짜 생성 (결정론적)
const createSeededDate = (seed: string, baseDate: string = '2024-01-01'): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  const days = Math.abs(hash) % 365; // 0-364일 범위
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

/**
 * 사용자 데이터 팩토리
 */
export const createMockUser = (seed: string = 'default-user') => ({
  id: createSeededId(seed, 'user'),
  email: `${seed}@example.com`,
  name: `테스트 사용자 ${seed}`,
  avatar: `https://example.com/avatar/${createSeededId(seed)}.jpg`,
  createdAt: createSeededDate(seed),
  updatedAt: createSeededDate(seed + '-updated'),
  preferences: {
    theme: 'light',
    language: 'ko',
    notifications: true,
  },
});

/**
 * 시나리오 데이터 팩토리
 */
export const createMockScenario = (seed: string = 'default-scenario') => ({
  id: createSeededId(seed, 'scenario'),
  title: `테스트 시나리오 ${seed}`,
  description: `${seed}에 대한 시나리오 설명`,
  genre: '여행',
  style: 'documentary',
  duration: 300,
  targetAudience: '일반',
  scenes: [
    {
      id: createSeededId(seed + '-scene-1', 'scene'),
      title: '오프닝',
      description: '시나리오 시작 부분',
      type: '기',
      content: '흥미로운 오프닝 장면',
      duration: 30,
      order: 1,
    },
    {
      id: createSeededId(seed + '-scene-2', 'scene'),
      title: '전개',
      description: '메인 스토리 전개',
      type: '승',
      content: '스토리의 핵심 내용',
      duration: 180,
      order: 2,
    },
    {
      id: createSeededId(seed + '-scene-3', 'scene'),
      title: '클라이맥스',
      description: '절정 부분',
      type: '전',
      content: '가장 긴장감 넘치는 순간',
      duration: 60,
      order: 3,
    },
    {
      id: createSeededId(seed + '-scene-4', 'scene'),
      title: '엔딩',
      description: '마무리 장면',
      type: '결',
      content: '만족스러운 결말',
      duration: 30,
      order: 4,
    },
  ],
  createdAt: createSeededDate(seed),
  updatedAt: createSeededDate(seed + '-updated'),
  status: 'draft' as const,
  userId: createSeededId(seed + '-user', 'user'),
});

/**
 * 스토리보드 데이터 팩토리
 */
export const createMockStoryboard = (seed: string = 'default-storyboard') => {
  const scenarioId = createSeededId(seed + '-scenario', 'scenario');
  return {
    id: createSeededId(seed, 'storyboard'),
    scenarioId,
    title: `테스트 스토리보드 ${seed}`,
    description: `${seed}에 대한 스토리보드`,
    panels: [
      {
        id: createSeededId(seed + '-panel-1', 'panel'),
        sceneId: createSeededId(seed + '-scene-1', 'scene'),
        imagePrompt: '테스트 이미지 프롬프트 1',
        imageUrl: `https://example.com/image/${createSeededId(seed + '-1')}.jpg`,
        duration: 30,
        order: 1,
        visualDescription: '시각적 설명 1',
        cameraAngle: '미디엄 샷',
        lighting: '자연광',
      },
      {
        id: createSeededId(seed + '-panel-2', 'panel'),
        sceneId: createSeededId(seed + '-scene-2', 'scene'),
        imagePrompt: '테스트 이미지 프롬프트 2',
        imageUrl: `https://example.com/image/${createSeededId(seed + '-2')}.jpg`,
        duration: 45,
        order: 2,
        visualDescription: '시각적 설명 2',
        cameraAngle: '클로즈업',
        lighting: '인공조명',
      },
    ],
    totalDuration: 75,
    createdAt: createSeededDate(seed),
    updatedAt: createSeededDate(seed + '-updated'),
    status: 'draft' as const,
    userId: createSeededId(seed + '-user', 'user'),
  };
};

/**
 * 비디오 생성 요청 데이터 팩토리
 */
export const createMockVideoRequest = (seed: string = 'default-video') => ({
  id: createSeededId(seed, 'video-request'),
  storyboardId: createSeededId(seed + '-storyboard', 'storyboard'),
  panels: [
    {
      id: createSeededId(seed + '-panel-1', 'panel'),
      prompt: '테스트 비디오 프롬프트 1',
      duration: 5,
      style: 'cinematic',
    },
    {
      id: createSeededId(seed + '-panel-2', 'panel'),
      prompt: '테스트 비디오 프롬프트 2',
      duration: 5,
      style: 'realistic',
    },
  ],
  settings: {
    quality: 'high',
    fps: 30,
    resolution: '1920x1080',
  },
  createdAt: createSeededDate(seed),
  userId: createSeededId(seed + '-user', 'user'),
});

/**
 * 비디오 생성 응답 데이터 팩토리
 */
export const createMockVideoResponse = (seed: string = 'default-video') => ({
  id: createSeededId(seed, 'video'),
  requestId: createSeededId(seed, 'video-request'),
  status: 'completed' as const,
  progress: 100,
  videos: [
    {
      id: createSeededId(seed + '-video-1', 'video-file'),
      url: `https://example.com/video/${createSeededId(seed + '-1')}.mp4`,
      duration: 5,
      thumbnail: `https://example.com/thumbnail/${createSeededId(seed + '-1')}.jpg`,
    },
    {
      id: createSeededId(seed + '-video-2', 'video-file'),
      url: `https://example.com/video/${createSeededId(seed + '-2')}.mp4`,
      duration: 5,
      thumbnail: `https://example.com/thumbnail/${createSeededId(seed + '-2')}.jpg`,
    },
  ],
  createdAt: createSeededDate(seed),
  completedAt: createSeededDate(seed + '-completed'),
  cost: {
    amount: 10.5,
    currency: 'USD',
    breakdown: [
      { service: 'image-generation', amount: 5.0 },
      { service: 'video-generation', amount: 5.5 },
    ],
  },
});

/**
 * API 에러 응답 팩토리
 */
export const createMockError = (message: string, status: number = 400) => ({
  error: {
    message,
    status,
    code: `ERR_${status}`,
    timestamp: new Date().toISOString(),
  },
});

/**
 * 인증 토큰 팩토리
 */
export const createMockAuthToken = (seed: string = 'default-auth') => ({
  access_token: `mock-access-token-${createSeededId(seed)}`,
  refresh_token: `mock-refresh-token-${createSeededId(seed + '-refresh')}`,
  expires_in: 3600,
  token_type: 'Bearer',
  user: createMockUser(seed),
});

/**
 * 비용 추적 데이터 팩토리
 */
export const createMockCostTracking = (seed: string = 'default-cost') => ({
  userId: createSeededId(seed + '-user', 'user'),
  totalSpent: 25.50,
  monthlyLimit: 100.00,
  dailyUsage: [
    { date: '2024-01-01', amount: 5.25 },
    { date: '2024-01-02', amount: 8.75 },
    { date: '2024-01-03', amount: 11.50 },
  ],
  lastUpdated: createSeededDate(seed),
});