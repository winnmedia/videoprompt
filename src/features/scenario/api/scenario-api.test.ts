/**
 * Scenario API Tests
 * TDD 원칙에 따른 시나리오 API 테스트
 */

import {
  generateScenario,
  saveScenario,
  getScenario,
  getUserScenarios,
  setApiClient,
  ScenarioGenerateRequest,
  ScenarioGenerateResponse,
} from './scenario-api';
import { Scenario } from '../../../entities/scenario/model/Scenario';

// Mock API client
const mockApi = {
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
};

describe('scenario-api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setApiClient(mockApi as never);
  });

  describe('generateScenario', () => {
    const mockRequest: ScenarioGenerateRequest = {
      idea: '제주도 여행 브이로그',
      genre: '여행',
      targetAudience: '20-30대',
      duration: 180,
    };

    const mockResponse: ScenarioGenerateResponse = {
      scenario: {
        id: 'scenario-1',
        title: '제주도 여행 브이로그',
        description: 'AI가 생성한 제주도 여행 시나리오',
        scenes: [
          {
            id: 'scene-1',
            title: '오프닝',
            description: '제주도 공항 도착',
            type: '기',
            duration: 45,
            content: '공항에 도착하여 설레는 마음을 표현',
            order: 1,
          },
          {
            id: 'scene-2',
            title: '여행 준비',
            description: '숙소 체크인',
            type: '승',
            duration: 30,
            content: '숙소에 짐을 풀고 여행 계획 설명',
            order: 2,
          },
        ],
        totalDuration: 75,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        status: 'draft',
        genre: '여행',
        targetAudience: '20-30대',
      },
    };

    it('아이디어를 입력받아 시나리오를 생성한다', async () => {
      mockApi.post.mockResolvedValue({ data: mockResponse });

      const result = await generateScenario(mockRequest);

      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/scenario/generate',
        mockRequest
      );
      expect(result).toEqual(mockResponse);
      expect(result.scenario.scenes).toHaveLength(2);
      expect(result.scenario.scenes[0].type).toBe('기');
    });

    it('필수 입력값이 없으면 오류를 던진다', async () => {
      const invalidRequest = { ...mockRequest, idea: '' };

      await expect(generateScenario(invalidRequest)).rejects.toThrow(
        '아이디어를 입력해주세요'
      );
    });

    it('API 호출 실패 시 오류를 던진다', async () => {
      mockApi.post.mockRejectedValue(new Error('서버 오류'));

      await expect(generateScenario(mockRequest)).rejects.toThrow('서버 오류');
    });
  });

  describe('saveScenario', () => {
    const mockScenario: Scenario = {
      id: 'scenario-1',
      title: '제주도 여행',
      description: '여행 시나리오',
      scenes: [],
      totalDuration: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      status: 'draft',
      genre: '여행',
      targetAudience: '20-30대',
    };

    it('시나리오를 저장한다', async () => {
      mockApi.post.mockResolvedValue({ data: { success: true } });

      const result = await saveScenario(mockScenario);

      expect(mockApi.post).toHaveBeenCalledWith('/api/scenario', mockScenario);
      expect(result).toEqual({ success: true });
    });
  });

  describe('getScenario', () => {
    it('시나리오 ID로 시나리오를 조회한다', async () => {
      const mockScenario = {
        id: 'scenario-1',
        title: '제주도 여행',
      };

      mockApi.get.mockResolvedValue({ data: mockScenario });

      const result = await getScenario('scenario-1');

      expect(mockApi.get).toHaveBeenCalledWith('/api/scenario/scenario-1');
      expect(result).toEqual(mockScenario);
    });

    it('존재하지 않는 시나리오 조회 시 404 오류를 던진다', async () => {
      mockApi.get.mockRejectedValue(new Error('시나리오를 찾을 수 없습니다'));

      await expect(getScenario('nonexistent')).rejects.toThrow(
        '시나리오를 찾을 수 없습니다'
      );
    });
  });

  describe('getUserScenarios', () => {
    it('사용자의 시나리오 목록을 조회한다', async () => {
      const mockScenarios = [
        { id: 'scenario-1', title: '여행 1' },
        { id: 'scenario-2', title: '여행 2' },
      ];

      mockApi.get.mockResolvedValue({ data: mockScenarios });

      const result = await getUserScenarios('user-1');

      expect(mockApi.get).toHaveBeenCalledWith('/api/scenario/user/user-1');
      expect(result).toEqual(mockScenarios);
      expect(result).toHaveLength(2);
    });
  });
});
