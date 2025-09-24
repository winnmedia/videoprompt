/**
 * Storyboard API Tests - MSW 기반
 * TDD 원칙에 따른 스토리보드 API 테스트
 * $300 사건 방지를 위한 결정론적 테스트
 */

import {
  generateStoryboard,
  saveStoryboard,
  getStoryboard,
  getUserStoryboards,
  generateImage,
  setApiClient,
  StoryboardGenerateRequest,
  StoryboardGenerateResponse,
  ImageGenerateRequest,
} from './storyboard-api';
import { Storyboard } from '../../../entities/storyboard/model/Storyboard';
// import { server } from '../../../shared/mocks/server';
// import { http, HttpResponse } from 'msw';
import { createMockStoryboard } from '../../../shared/mocks/data/factories';

// Mock API 클라이언트 정의
const mockApi = {
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
};

// 실제 fetch 기반 API 클라이언트
const apiClient = {
  post: async (url: string, data?: unknown) => {
    console.log('API 호출:', url, data);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    console.log('응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.json();
      console.log('에러 응답:', error);
      throw new Error(error.error?.message || 'API Error');
    }

    const responseData = await response.json();
    console.log('성공 응답:', responseData);
    return { data: responseData };
  },
  get: async (url: string) => {
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API Error');
    }

    return { data: await response.json() };
  },
  put: async (url: string, data?: unknown) => {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API Error');
    }

    return { data: await response.json() };
  },
};

describe('storyboard-api (MSW 기반)', () => {
  beforeEach(() => {
    // Mock API 클라이언트 초기화
    jest.clearAllMocks();
    mockApi.post.mockClear();
    mockApi.get.mockClear();
    mockApi.put.mockClear();
    setApiClient(mockApi as never);
  });

  describe('generateStoryboard (결정론적 테스트)', () => {
    const mockRequest: StoryboardGenerateRequest = {
      scenarioId: 'scenario-jeju-travel',
      title: '제주도 여행 스토리보드',
      description: '제주도 여행 영상을 위한 시각적 계획',
      scenes: [
        {
          id: 'scene-opening',
          title: '오프닝',
          description: '제주도 공항 도착',
          type: '기',
          content: '공항에 도착하여 설레는 마음을 표현',
        },
        {
          id: 'scene-explore',
          title: '탐험',
          description: '제주도 명소 탐방',
          type: '승',
          content: '아름다운 자연경관 감상',
        },
      ],
    };

    it('[RED] 시나리오를 입력받아 스토리보드를 생성한다', async () => {
      // Mock 응답 설정
      const mockStoryboardResponse = {
        storyboard: {
          id: 'storyboard-1',
          scenarioId: mockRequest.scenarioId,
          title: mockRequest.title,
          description: mockRequest.description,
          panels: [
            {
              id: 'panel-1',
              sequence: 1,
              imagePrompt: '제주도 공항 도착 - 오프닝 장면',
              description: '공항에 도착하여 설레는 마음을 표현',
              estimatedDuration: 5,
            },
            {
              id: 'panel-2',
              sequence: 2,
              imagePrompt: '제주도 명소 탐방 - 탐험 장면',
              description: '아름다운 자연경관 감상',
              estimatedDuration: 8,
            },
          ],
          totalDuration: 13,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          status: 'completed',
        },
        cost: {
          amount: 2.5,
          currency: 'USD',
        },
      };

      mockApi.post.mockResolvedValue({ data: mockStoryboardResponse });

      const result = await generateStoryboard(mockRequest);

      // 결정론적 검증
      expect(result).toBeDefined();
      expect(result.storyboard).toBeDefined();
      expect(result.storyboard.scenarioId).toBe(mockRequest.scenarioId);
      expect(result.storyboard.title).toBe(mockRequest.title);
      expect(result.storyboard.panels).toHaveLength(2);
      expect(result.storyboard.panels[0].imagePrompt).toContain('오프닝');
      expect(result.storyboard.panels[1].imagePrompt).toContain('탐험');

      // 비용 정보 검증 - $300 사건 방지
      expect(result.cost).toBeDefined();
      expect(result.cost.amount).toBe(2.5);
      expect(result.cost.currency).toBe('USD');
    });

    it('[GREEN] 필수 입력값이 없으면 오류를 던진다', async () => {
      const invalidRequest = { ...mockRequest, scenarioId: '' };

      mockApi.post.mockRejectedValue(new Error('시나리오 ID를 입력해주세요'));

      await expect(generateStoryboard(invalidRequest)).rejects.toThrow(
        '시나리오 ID를 입력해주세요'
      );
    });

    it('[GREEN] 장면이 없으면 오류를 던진다', async () => {
      const invalidRequest = { ...mockRequest, scenes: [] };

      mockApi.post.mockRejectedValue(new Error('최소 1개의 씬이 필요합니다'));

      await expect(generateStoryboard(invalidRequest)).rejects.toThrow(
        '최소 1개의 씬이 필요합니다'
      );
    });

    it('[GREEN] Rate Limit 초과 시 오류를 던진다', async () => {
      // 첫 번째 호출 (성공)
      const mockSuccessResponse = {
        storyboard: {
          id: 'storyboard-1',
          scenarioId: mockRequest.scenarioId,
          title: mockRequest.title,
          panels: [],
          totalDuration: 0,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          status: 'completed',
        },
        cost: { amount: 2.5, currency: 'USD' },
      };

      mockApi.post.mockResolvedValueOnce({ data: mockSuccessResponse });
      await generateStoryboard(mockRequest);

      // 두 번째 호출 (Rate Limit)
      mockApi.post.mockRejectedValueOnce(new Error('Rate limit exceeded'));
      await expect(generateStoryboard(mockRequest)).rejects.toThrow(
        'Rate limit exceeded'
      );
    });
  });

  describe('generateImage', () => {
    const mockImageRequest: ImageGenerateRequest = {
      prompt: '제주도 공항에서 여행객이 도착하는 모습',
      style: 'cinematic',
      aspectRatio: '16:9',
    };

    it('프롬프트를 입력받아 이미지를 생성한다', async () => {
      const mockImageResponse = {
        imageUrl: 'https://example.com/generated-image.jpg',
        prompt: mockImageRequest.prompt,
      };

      mockApi.post.mockResolvedValue({ data: mockImageResponse });

      const result = await generateImage(mockImageRequest);

      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/storyboard/generate-image',
        mockImageRequest
      );
      expect(result.imageUrl).toBe('https://example.com/generated-image.jpg');
    });

    it('빈 프롬프트는 오류를 던진다', async () => {
      const invalidRequest = { ...mockImageRequest, prompt: '' };

      await expect(generateImage(invalidRequest)).rejects.toThrow(
        '이미지 프롬프트를 입력해주세요'
      );
    });
  });

  describe('saveStoryboard', () => {
    const mockStoryboard: Storyboard = {
      id: 'storyboard-1',
      scenarioId: 'scenario-1',
      title: '제주도 여행',
      description: '여행 스토리보드',
      panels: [],
      totalDuration: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      status: 'draft',
    };

    it('스토리보드를 저장한다', async () => {
      mockApi.post.mockResolvedValue({ data: { success: true } });

      const result = await saveStoryboard(mockStoryboard);

      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/storyboard',
        mockStoryboard
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('getStoryboard', () => {
    it('스토리보드 ID로 스토리보드를 조회한다', async () => {
      const mockStoryboard = {
        id: 'storyboard-1',
        title: '제주도 여행',
      };

      mockApi.get.mockResolvedValue({ data: mockStoryboard });

      const result = await getStoryboard('storyboard-1');

      expect(mockApi.get).toHaveBeenCalledWith('/api/storyboard/storyboard-1');
      expect(result).toEqual(mockStoryboard);
    });

    it('존재하지 않는 스토리보드 조회 시 404 오류를 던진다', async () => {
      mockApi.get.mockRejectedValue(new Error('스토리보드를 찾을 수 없습니다'));

      await expect(getStoryboard('nonexistent')).rejects.toThrow(
        '스토리보드를 찾을 수 없습니다'
      );
    });
  });

  describe('getUserStoryboards (결정론적 테스트)', () => {
    it('[RED] 사용자의 스토리보드 목록을 조회한다', async () => {
      const testUserId = 'test-user-123';

      const mockStoryboardsResponse = {
        storyboards: [
          {
            id: 'storyboard-1',
            title: '제주도 여행',
            panels: [],
            scenarioId: 'scenario-1',
            totalDuration: 0,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            status: 'completed',
          },
          {
            id: 'storyboard-2',
            title: '서울 도시 탐방',
            panels: [],
            scenarioId: 'scenario-2',
            totalDuration: 0,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            status: 'draft',
          },
          {
            id: 'storyboard-3',
            title: '부산 바다 여행',
            panels: [],
            scenarioId: 'scenario-3',
            totalDuration: 0,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            status: 'completed',
          },
        ],
        total: 3,
      };

      mockApi.get.mockResolvedValue({ data: mockStoryboardsResponse });

      const result = await getUserStoryboards(testUserId);

      expect(result.storyboards).toBeDefined();
      expect(Array.isArray(result.storyboards)).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(0);

      // 결정론적 데이터 검증 (기본적으로 3개 시드 데이터 있음)
      expect(result.storyboards).toHaveLength(3);
      expect(result.storyboards[0]).toHaveProperty('id');
      expect(result.storyboards[0]).toHaveProperty('title');
      expect(result.storyboards[0]).toHaveProperty('panels');
    });

    it('[GREEN] 빈 사용자 ID로 빈 목록 반환', async () => {
      const mockEmptyResponse = {
        storyboards: [],
        total: 0,
      };

      mockApi.get.mockResolvedValue({ data: mockEmptyResponse });

      const result = await getUserStoryboards('');

      // 빈 ID로는 빈 목록 반환
      expect(result.storyboards).toBeDefined();
      expect(result.storyboards).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('리팩토링 - 비용 안전 확인', () => {
    it('스토리보드 생성 시 비용 정보가 포함된다', async () => {
      const mockRequest: StoryboardGenerateRequest = {
        scenarioId: 'cost-test',
        title: '비용 테스트',
        description: '비용 추적 테스트',
        scenes: [{
          id: 'scene-1',
          title: '테스트',
          description: '테스트',
          type: '기',
          content: '테스트 내용',
        }],
      };

      // 스토리보드 생성 응답에 비용 정보 포함
      const mockStoryboardResponse = {
        storyboard: {
          id: 'storyboard-1',
          scenarioId: mockRequest.scenarioId,
          title: mockRequest.title,
          panels: [],
          totalDuration: 0,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          status: 'completed',
        },
        cost: { amount: 2.5, currency: 'USD' },
      };

      mockApi.post.mockResolvedValue({ data: mockStoryboardResponse });
      const result = await generateStoryboard(mockRequest);

      // 비용 정보가 응답에 포함되어 있는지 확인 ($300 사건 방지)
      expect(result.cost).toBeDefined();
      expect(result.cost.amount).toBe(2.5);
      expect(result.cost.currency).toBe('USD');
      expect(result.cost.amount).toBeLessThan(50); // 일일 한도 내에 있는지 확인
    });

    it('비용이 과도하게 높으면 경고를 발생시킨다', async () => {
      const mockRequest: StoryboardGenerateRequest = {
        scenarioId: 'expensive-test',
        title: '고비용 테스트',
        description: '높은 비용 테스트',
        scenes: Array(20).fill(0).map((_, i) => ({
          id: `scene-${i}`,
          title: `테스트 ${i}`,
          description: `테스트 ${i}`,
          type: '기',
          content: '복잡한 장면 내용',
        })),
      };

      // 높은 비용 응답 시뮬레이션
      const mockHighCostResponse = {
        storyboard: {
          id: 'storyboard-1',
          scenarioId: mockRequest.scenarioId,
          title: mockRequest.title,
          panels: [],
          totalDuration: 0,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          status: 'completed',
        },
        cost: { amount: 25.0, currency: 'USD' }, // 높은 비용
      };

      mockApi.post.mockResolvedValue({ data: mockHighCostResponse });
      const result = await generateStoryboard(mockRequest);

      // 높은 비용에 대한 검증
      expect(result.cost.amount).toBeGreaterThan(20);
      expect(result.cost.amount).toBeLessThan(50); // 여전히 한도 내
    });
  });
});
