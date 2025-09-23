/**
 * Shared Mocks - 통합 버전
 * MSW 핸들러 및 테스트 모의 데이터
 */

import { http, HttpResponse } from 'msw';

// Mock Handlers
export const mockHandlers = [
  // Auth endpoints
  http.post('/api/auth/login', () => {
    return HttpResponse.json({
      user: { id: '1', name: 'Test User', email: 'test@example.com', isGuest: false },
      token: 'mock-token'
    });
  }),

  http.post('/api/auth/register', () => {
    return HttpResponse.json({
      user: { id: '2', name: 'New User', email: 'new@example.com', isGuest: false },
      message: 'User registered successfully'
    });
  }),

  // Story endpoints
  http.post('/api/story/generate', () => {
    return HttpResponse.json({
      story: {
        id: 'story-1',
        title: 'Test Story',
        summary: 'A test story',
        genre: 'drama',
        chapters: {
          setup: { title: 'Setup', content: 'Beginning', duration: 30 },
          confrontation: { title: 'Conflict', content: 'Middle', duration: 60 },
          resolution: { title: 'Resolution', content: 'End', duration: 30 }
        },
        totalDuration: 120,
        metadata: { generatedAt: new Date().toISOString() }
      }
    });
  }),

  // Storyboard endpoints
  http.post('/api/storyboard/generate', () => {
    return HttpResponse.json({
      storyboard: {
        id: 'storyboard-1',
        title: 'Test Storyboard',
        frames: [],
        totalDuration: 120
      }
    });
  }),

  // Health check
  http.get('/api/health', () => {
    return HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  })
];

// Mock Data
export const mockStory = {
  id: 'story-1',
  title: 'Sample Story',
  summary: 'A sample story for testing',
  genre: 'drama',
  status: 'draft',
  totalDuration: 120,
  chapters: {
    exposition: {
      title: 'Beginning',
      content: 'Story starts here',
      duration: 30
    },
    rising_action: {
      title: 'Development',
      content: 'Conflict develops',
      duration: 40
    },
    climax: {
      title: 'Climax',
      content: 'Peak of the story',
      duration: 30
    },
    resolution: {
      title: 'End',
      content: 'Story concludes',
      duration: 20
    }
  },
  userId: 'user-1',
  metadata: {
    generatedAt: '2024-01-01T00:00:00Z',
    tone: 'neutral',
    keywords: ['drama', 'test']
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

export const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  isGuest: false,
  preferences: {
    theme: 'light',
    language: 'ko'
  },
  metadata: {},
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};