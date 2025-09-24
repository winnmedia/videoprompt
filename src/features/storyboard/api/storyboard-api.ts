/**
 * Storyboard API Implementation
 * 스토리보드 관련 API 호출 함수들
 */

import { Storyboard } from '../../../entities/storyboard/model/Storyboard';
import { SceneType } from '../../../entities/scenario/model/Scenario';

// API 요청 타입들
export interface StoryboardGenerateRequest {
  scenarioId: string;
  title: string;
  description: string;
  scenes: Array<{
    id: string;
    title: string;
    description: string;
    type: SceneType;
    content: string;
  }>;
}

export interface StoryboardGenerateResponse {
  storyboard: Storyboard;
}

export interface ImageGenerateRequest {
  prompt: string;
  style?: string;
  aspectRatio?: string;
}

export interface ImageGenerateResponse {
  imageUrl: string;
  prompt: string;
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
 * AI를 사용하여 스토리보드 생성
 */
export async function generateStoryboard(
  request: StoryboardGenerateRequest
): Promise<StoryboardGenerateResponse> {
  // 입력 검증
  if (!request.scenarioId.trim()) {
    throw new Error('시나리오 ID를 입력해주세요');
  }

  if (!request.title.trim()) {
    throw new Error('제목을 입력해주세요');
  }

  if (!request.scenes || request.scenes.length === 0) {
    throw new Error('최소 1개의 씬이 필요합니다');
  }

  try {
    const response = await apiClient.post('/api/storyboard/generate', request);
    return response.data as StoryboardGenerateResponse;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('스토리보드 생성에 실패했습니다');
  }
}

/**
 * AI 이미지 생성
 */
export async function generateImage(
  request: ImageGenerateRequest
): Promise<ImageGenerateResponse> {
  // 입력 검증
  if (!request.prompt.trim()) {
    throw new Error('이미지 프롬프트를 입력해주세요');
  }

  try {
    const response = await apiClient.post(
      '/api/storyboard/generate-image',
      request
    );
    return response.data as ImageGenerateResponse;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('이미지 생성에 실패했습니다');
  }
}

/**
 * 스토리보드 저장
 */
export async function saveStoryboard(
  storyboard: Storyboard
): Promise<{ success: boolean }> {
  try {
    const response = await apiClient.post('/api/storyboard', storyboard);
    return response.data as { success: boolean };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('스토리보드 저장에 실패했습니다');
  }
}

/**
 * 스토리보드 조회
 */
export async function getStoryboard(storyboardId: string): Promise<Storyboard> {
  try {
    const response = await apiClient.get(`/api/storyboard/${storyboardId}`);
    return response.data as Storyboard;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('스토리보드를 찾을 수 없습니다');
  }
}

/**
 * 사용자의 스토리보드 목록 조회
 */
export async function getUserStoryboards(
  userId: string
): Promise<Storyboard[]> {
  try {
    const response = await apiClient.get(`/api/storyboard/user/${userId}`);
    return response.data as Storyboard[];
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('스토리보드 목록을 불러오는데 실패했습니다');
  }
}

/**
 * 스토리보드 업데이트
 */
export async function updateStoryboard(
  storyboardId: string,
  updates: Partial<Storyboard>
): Promise<Storyboard> {
  try {
    const response = await apiClient.put(
      `/api/storyboard/${storyboardId}`,
      updates
    );
    return response.data as Storyboard;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('스토리보드 업데이트에 실패했습니다');
  }
}

/**
 * 스토리보드 삭제
 */
export async function deleteStoryboard(
  storyboardId: string
): Promise<{ success: boolean }> {
  try {
    const response = await apiClient.post(
      `/api/storyboard/${storyboardId}/delete`,
      {}
    );
    return response.data as { success: boolean };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('스토리보드 삭제에 실패했습니다');
  }
}
