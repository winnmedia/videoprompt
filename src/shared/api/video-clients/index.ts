/**
 * 비디오 클라이언트 팩토리 및 Public API
 * 멀티 AI 모델 통합 관리
 */

import type { AIVideoModel } from '../../../entities/prompt';
import type { VideoGenerationRequest, VideoGenerationResponse } from './base-video-client';
import { BaseVideoClient, VideoClientError } from './base-video-client';
import RunwayClient from './runway-client';
import StableVideoClient from './stable-video-client';
import PikaClient from './pika-client';
import ZeroscopeClient from './zeroscope-client';
import AnimateDiffClient from './animatediff-client';
import ByteDanceClient from './bytedance-client';

// ===== 클라이언트 팩토리 =====

export class VideoClientFactory {
  private clients: Map<AIVideoModel, BaseVideoClient> = new Map();

  /**
   * 클라이언트 초기화
   */
  initialize(): void {
    // 환경변수에서 API 키 로드
    const apiKeys = {
      runway: process.env.RUNWAY_API_KEY,
      stability: process.env.STABILITY_API_KEY,
      pika: process.env.PIKA_API_KEY,
      zeroscope: process.env.ZEROSCOPE_API_KEY,
      animatediff: process.env.ANIMATEDIFF_API_KEY,
      bytedance: process.env.SEEDREAM_API_KEY,
    };

    // 사용 가능한 클라이언트만 초기화
    try {
      if (apiKeys.runway) {
        this.clients.set('runway-gen3', new RunwayClient(apiKeys.runway));
      }
    } catch (error) {
      console.warn('Runway client initialization failed:', error);
    }

    try {
      if (apiKeys.stability) {
        this.clients.set('stable-video', new StableVideoClient(apiKeys.stability));
      }
    } catch (error) {
      console.warn('Stable Video client initialization failed:', error);
    }

    try {
      if (apiKeys.pika) {
        this.clients.set('pika-labs', new PikaClient(apiKeys.pika));
      }
    } catch (error) {
      console.warn('Pika client initialization failed:', error);
    }

    try {
      if (apiKeys.zeroscope) {
        this.clients.set('zeroscope', new ZeroscopeClient(apiKeys.zeroscope));
      }
    } catch (error) {
      console.warn('Zeroscope client initialization failed:', error);
    }

    try {
      if (apiKeys.animatediff) {
        this.clients.set('animatediff', new AnimateDiffClient(apiKeys.animatediff));
      }
    } catch (error) {
      console.warn('AnimateDiff client initialization failed:', error);
    }

    try {
      if (apiKeys.bytedance) {
        this.clients.set('bytedance-seedream', new ByteDanceClient(apiKeys.bytedance));
      }
    } catch (error) {
      console.warn('ByteDance client initialization failed:', error);
    }

    if (this.clients.size === 0) {
      console.warn('No video clients initialized. Please check your API keys.');
    }
  }

  /**
   * 클라이언트 가져오기
   */
  getClient(model: AIVideoModel): BaseVideoClient {
    const client = this.clients.get(model);
    if (!client) {
      throw new VideoClientError(
        `${model} 클라이언트가 초기화되지 않았습니다. API 키를 확인해주세요.`,
        'CLIENT_NOT_INITIALIZED',
        503,
        false
      );
    }
    return client;
  }

  /**
   * 사용 가능한 모델 목록
   */
  getAvailableModels(): AIVideoModel[] {
    return Array.from(this.clients.keys());
  }

  /**
   * 모든 클라이언트 상태 조회
   */
  getAllClientStatus(): Record<AIVideoModel, any> {
    const status: Record<string, any> = {};

    this.clients.forEach((client, model) => {
      status[model] = client.getStatus();
    });

    return status as Record<AIVideoModel, any>;
  }

  /**
   * 최적 모델 추천
   */
  recommendModel(
    request: VideoGenerationRequest,
    criteria: 'cost' | 'quality' | 'speed' | 'style' = 'quality'
  ): AIVideoModel | null {
    const availableModels = this.getAvailableModels();
    if (availableModels.length === 0) return null;

    const modelScores: Array<{ model: AIVideoModel; score: number }> = [];

    availableModels.forEach(model => {
      const client = this.clients.get(model)!;
      const capabilities = client.getCapabilities();
      const status = client.getStatus();

      // 사용 불가능한 모델 제외
      if (!status.isAvailable) return;

      // 요구사항에 맞지 않는 모델 제외
      if (request.settings.duration > capabilities.maxDuration) return;
      if (!capabilities.supportedFormats.includes(request.settings.format)) return;
      if (!capabilities.supportedQualities.includes(request.settings.quality)) return;
      if (!capabilities.supportedAspectRatios.includes(request.settings.aspectRatio)) return;

      let score = 0;

      switch (criteria) {
        case 'cost':
          score = 100 / capabilities.costPerSecond; // 낮은 비용일수록 높은 점수
          break;
        case 'quality':
          score = this.getQualityScore(model);
          break;
        case 'speed':
          score = this.getSpeedScore(model);
          break;
        case 'style':
          score = this.getStyleScore(model, request.prompt);
          break;
      }

      modelScores.push({ model, score });
    });

    if (modelScores.length === 0) return null;

    // 점수 기준 정렬
    modelScores.sort((a, b) => b.score - a.score);
    return modelScores[0].model;
  }

  private getQualityScore(model: AIVideoModel): number {
    const qualityScores: Record<AIVideoModel, number> = {
      'runway-gen3': 95,
      'stable-video': 88,
      'pika-labs': 85,
      'zeroscope': 75,
      'animatediff': 80,
      'bytedance-seedream': 82,
    };
    return qualityScores[model] || 50;
  }

  private getSpeedScore(model: AIVideoModel): number {
    const speedScores: Record<AIVideoModel, number> = {
      'zeroscope': 95,
      'animatediff': 88,
      'pika-labs': 82,
      'bytedance-seedream': 78,
      'stable-video': 70,
      'runway-gen3': 65,
    };
    return speedScores[model] || 50;
  }

  private getStyleScore(model: AIVideoModel, prompt: string): number {
    const promptLower = prompt.toLowerCase();

    // 프롬프트 내용에 따른 모델별 적합도
    if (promptLower.includes('anime') || promptLower.includes('cartoon')) {
      const scores = { 'pika-labs': 95, 'animatediff': 90, 'bytedance-seedream': 80 };
      return scores[model as keyof typeof scores] || 50;
    }

    if (promptLower.includes('realistic') || promptLower.includes('cinematic')) {
      const scores = { 'runway-gen3': 95, 'stable-video': 90, 'zeroscope': 75 };
      return scores[model as keyof typeof scores] || 50;
    }

    if (promptLower.includes('storyboard') || promptLower.includes('concept')) {
      const scores = { 'bytedance-seedream': 95, 'stable-video': 80, 'pika-labs': 75 };
      return scores[model as keyof typeof scores] || 50;
    }

    // 기본 점수
    return this.getQualityScore(model);
  }
}

// ===== 통합 비디오 서비스 =====

export class VideoService {
  private factory: VideoClientFactory;

  constructor() {
    this.factory = new VideoClientFactory();
    this.factory.initialize();
  }

  /**
   * 영상 생성
   */
  async generateVideo(
    model: AIVideoModel,
    request: VideoGenerationRequest
  ): Promise<VideoGenerationResponse> {
    const client = this.factory.getClient(model);
    return await client.generateVideo(request);
  }

  /**
   * 진행률 조회
   */
  async getProgress(
    model: AIVideoModel,
    generationId: string
  ): Promise<VideoGenerationResponse> {
    const client = this.factory.getClient(model);
    return await client.getProgress(generationId);
  }

  /**
   * 생성 취소
   */
  async cancelGeneration(
    model: AIVideoModel,
    generationId: string
  ): Promise<void> {
    const client = this.factory.getClient(model);
    await client.cancelGeneration(generationId);
  }

  /**
   * 최적 모델 추천
   */
  recommendModel(
    request: VideoGenerationRequest,
    criteria: 'cost' | 'quality' | 'speed' | 'style' = 'quality'
  ): AIVideoModel | null {
    return this.factory.recommendModel(request, criteria);
  }

  /**
   * 사용 가능한 모델 목록
   */
  getAvailableModels(): AIVideoModel[] {
    return this.factory.getAvailableModels();
  }

  /**
   * 모든 클라이언트 상태
   */
  getAllStatus(): Record<AIVideoModel, any> {
    return this.factory.getAllClientStatus();
  }

  /**
   * 비용 비교
   */
  compareCosts(request: VideoGenerationRequest): Array<{
    model: AIVideoModel;
    cost: number;
    available: boolean;
  }> {
    const availableModels = this.factory.getAvailableModels();

    return availableModels.map(model => {
      const client = this.factory.getClient(model);
      const cost = client.calculateCost(request);
      const status = client.getStatus();

      return {
        model,
        cost,
        available: status.isAvailable,
      };
    }).sort((a, b) => a.cost - b.cost);
  }
}

// ===== Public Exports =====

export {
  BaseVideoClient,
  VideoClientError,
  RunwayClient,
  StableVideoClient,
  PikaClient,
  type VideoGenerationRequest,
  type VideoGenerationResponse,
  // type VideoClientCapabilities, // TODO: Define missing type
  // type RetryConfig, // TODO: Define missing type
};

// 기본 인스턴스
export const videoService = new VideoService();
export const videoClientFactory = new VideoClientFactory();

// 초기화
videoClientFactory.initialize();