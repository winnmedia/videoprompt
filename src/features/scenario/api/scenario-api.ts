/**
 * Scenario API Implementation
 * 시나리오 관련 API 호출 함수들
 */

import { Scenario } from '../../../entities/scenario/model/Scenario';

// API 요청 타입들
export interface ScenarioGenerateRequest {
  idea: string;
  genre: string;
  targetAudience: string;
  duration: number; // 초 단위
}

export interface ScenarioGenerateResponse {
  scenario: Scenario;
}

// API Client interface
interface ApiClient {
  post: (url: string, data?: unknown) => Promise<{ data: unknown }>;
  get: (url: string) => Promise<{ data: unknown }>;
  put: (url: string, data?: unknown) => Promise<{ data: unknown }>;
}

// 기본 API 클라이언트 (실제로는 shared/api에서 import)
let apiClient: ApiClient = {
  post: async () => {
    throw new Error('API 구현이 필요합니다');
  },
  get: async () => {
    throw new Error('API 구현이 필요합니다');
  },
  put: async () => {
    throw new Error('API 구현이 필요합니다');
  },
};

// 테스트를 위한 API 클라이언트 설정 함수
export function setApiClient(client: ApiClient) {
  apiClient = client;
}

/**
 * AI를 사용하여 시나리오 생성
 */
export async function generateScenario(
  request: ScenarioGenerateRequest
): Promise<ScenarioGenerateResponse> {
  // 입력 검증
  if (!request.idea.trim()) {
    throw new Error('아이디어를 입력해주세요');
  }

  if (request.duration <= 0) {
    throw new Error('유효한 지속시간을 입력해주세요');
  }

  try {
    const response = await apiClient.post('/api/scenario/generate', request);
    return response.data as ScenarioGenerateResponse;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('시나리오 생성에 실패했습니다');
  }
}

/**
 * 시나리오 저장
 */
export async function saveScenario(
  scenario: Scenario
): Promise<{ success: boolean }> {
  try {
    const response = await apiClient.post('/api/scenario', scenario);
    return response.data as { success: boolean };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('시나리오 저장에 실패했습니다');
  }
}

/**
 * 시나리오 조회
 */
export async function getScenario(scenarioId: string): Promise<Scenario> {
  try {
    const response = await apiClient.get(`/api/scenario/${scenarioId}`);
    return response.data as Scenario;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('시나리오를 찾을 수 없습니다');
  }
}

/**
 * 사용자의 시나리오 목록 조회
 */
export async function getUserScenarios(userId: string): Promise<Scenario[]> {
  try {
    const response = await apiClient.get(`/api/scenario/user/${userId}`);
    return response.data as Scenario[];
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('시나리오 목록을 불러오는데 실패했습니다');
  }
}

/**
 * 시나리오 업데이트
 */
export async function updateScenario(
  scenarioId: string,
  updates: Partial<Scenario>
): Promise<Scenario> {
  try {
    const response = await apiClient.put(
      `/api/scenario/${scenarioId}`,
      updates
    );
    return response.data as Scenario;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('시나리오 업데이트에 실패했습니다');
  }
}

/**
 * 시나리오 삭제
 */
export async function deleteScenario(
  scenarioId: string
): Promise<{ success: boolean }> {
  try {
    const response = await apiClient.post(
      `/api/scenario/${scenarioId}/delete`,
      {}
    );
    return response.data as { success: boolean };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('시나리오 삭제에 실패했습니다');
  }
}
