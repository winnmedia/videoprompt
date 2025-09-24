/**
 * MSW Handlers for Redux Store Integration
 * Redux 상태 관리와 연동되는 MSW 핸들러
 */

import { http, HttpResponse } from 'msw';
// TODO: @/ path alias not working, using temporary types for build stability
// import type { User } from '@/entities/User';
// import type { Project } from '@/entities/Project';
// import type { Story } from '@/entities/Story';
// import type { Scene } from '@/entities/Scene';
// import type { Shot } from '@/entities/Shot';
// import type { Storyboard } from '@/entities/Storyboard';

type User = any;
type Project = any;
type Story = any;
type Scene = any;
type Shot = any;
type Storyboard = any;

// 초기 데이터 - 결정론적 테스트를 위한 고정값
const mockUser: User = {
  id: 'test-user-1',
  email: 'test@example.com',
  name: '테스트 사용자',
  isGuest: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  preferences: {
    theme: 'auto',
    language: 'ko',
    autoSave: true,
    videoQuality: 'medium',
  },
};

const mockProject: Project = {
  id: 'test-project-1',
  title: '테스트 프로젝트',
  description: '이것은 테스트용 프로젝트입니다.',
  userId: 'test-user-1',
  status: 'planning',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockStory: Story = {
  id: 'test-story-1',
  title: '테스트 스토리',
  synopsis: '이것은 테스트용 스토리입니다.',
  genre: 'drama',
  status: 'draft',
  userId: 'test-user-1',
  scenes: ['test-scene-1', 'test-scene-2'],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockScene: Scene = {
  id: 'test-scene-1',
  storyId: 'test-story-1',
  title: '테스트 씬 1',
  description: '첫 번째 테스트 씬입니다.',
  order: 1,
  duration: 30,
  shots: ['test-shot-1'],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockShot: Shot = {
  id: 'test-shot-1',
  sceneId: 'test-scene-1',
  shotType: 'medium',
  cameraMovement: 'static',
  duration: 5,
  description: '테스트 샷 설명',
  order: 1,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockStoryboard: Storyboard = {
  id: 'test-storyboard-1',
  projectId: 'test-project-1',
  sceneId: 'test-scene-1',
  shotId: 'test-shot-1',
  prompt: '테스트 프롬프트',
  style: 'realistic',
  status: 'completed',
  imageUrl: 'https://example.com/test-image.jpg',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// MSW 핸들러들
export const reduxHandlers = [
  // Auth API
  http.get('/api/auth/me', () => {
    return HttpResponse.json(mockUser, { status: 200 });
  }),

  http.post('/api/auth/login', () => {
    return HttpResponse.json(
      { user: mockUser, token: 'mock-jwt-token' },
      { status: 200 }
    );
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ message: '로그아웃 성공' }, { status: 200 });
  }),

  // User API
  http.get('/api/users/:id', ({ params }) => {
    if (params.id === mockUser.id) {
      return HttpResponse.json(mockUser, { status: 200 });
    }
    return HttpResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 });
  }),

  http.put('/api/users/:id', () => {
    return HttpResponse.json(mockUser, { status: 200 });
  }),

  // Project API
  http.get('/api/projects', () => {
    return HttpResponse.json([mockProject], { status: 200 });
  }),

  http.get('/api/projects/:id', ({ params }) => {
    if (params.id === mockProject.id) {
      return HttpResponse.json(mockProject, { status: 200 });
    }
    return HttpResponse.json({ error: '프로젝트를 찾을 수 없습니다' }, { status: 404 });
  }),

  http.post('/api/projects', () => {
    return HttpResponse.json(mockProject, { status: 201 });
  }),

  http.put('/api/projects/:id', () => {
    return HttpResponse.json(mockProject, { status: 200 });
  }),

  http.delete('/api/projects/:id', () => {
    return HttpResponse.json({ message: '프로젝트가 삭제되었습니다' }, { status: 200 });
  }),

  // Story API
  http.get('/api/stories', () => {
    return HttpResponse.json([mockStory], { status: 200 });
  }),

  http.get('/api/stories/:id', ({ params }) => {
    if (params.id === mockStory.id) {
      return HttpResponse.json(mockStory, { status: 200 });
    }
    return HttpResponse.json({ error: '스토리를 찾을 수 없습니다' }, { status: 404 });
  }),

  http.post('/api/stories', () => {
    return HttpResponse.json(mockStory, { status: 201 });
  }),

  // Scene API
  http.get('/api/scenes', () => {
    return HttpResponse.json([mockScene], { status: 200 });
  }),

  http.post('/api/scenes', () => {
    return HttpResponse.json(mockScene, { status: 201 });
  }),

  // Shot API
  http.get('/api/shots', () => {
    return HttpResponse.json([mockShot], { status: 200 });
  }),

  http.post('/api/shots', () => {
    return HttpResponse.json(mockShot, { status: 201 });
  }),

  // Scenario API - 기존 슬라이스와 호환
  http.post('/api/scenario/generate', async ({ request }) => {
    const body = await request.json() as any;

    // 비용 안전 체크 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 지연

    const mockScenario = {
      id: 'generated-scenario-1',
      title: body.idea || '생성된 시나리오',
      description: `${body.genre || '드라마'} 장르의 시나리오입니다.`,
      scenes: [
        { id: 'scene-1', title: '도입부', type: '기' },
        { id: 'scene-2', title: '전개부', type: '승' },
        { id: 'scene-3', title: '절정부', type: '전' },
        { id: 'scene-4', title: '결말부', type: '결' },
      ],
      createdAt: new Date().toISOString(),
    };

    return HttpResponse.json({ scenario: mockScenario }, { status: 200 });
  }),

  // Storyboard API - 기존 슬라이스와 호환
  http.post('/api/storyboard/generate', async ({ request }) => {
    const body = await request.json() as any;

    // 비용 안전 체크 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 지연

    return HttpResponse.json({ storyboard: mockStoryboard }, { status: 200 });
  }),

  http.post('/api/storyboard/generateImage', async ({ request }) => {
    const body = await request.json() as any;

    // 이미지 생성 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3초 지연

    return HttpResponse.json(
      {
        imageUrl: `https://example.com/generated-image-${Date.now()}.jpg`,
        prompt: body.prompt,
      },
      { status: 200 }
    );
  }),

  // Cost Safety - 비용 추적 API
  http.get('/api/cost/stats', () => {
    return HttpResponse.json({
      callsLastMinute: 5,
      costLastHour: 0.25,
      costLastDay: 2.50,
      totalCalls: 42,
    }, { status: 200 });
  }),
];