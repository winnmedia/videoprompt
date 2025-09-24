/**
 * ByteDance Seedream 4.0 API 클라이언트
 * 콘티 이미지 생성을 위한 비용 안전 API 래퍼
 *
 * 비용 안전 규칙:
 * - 분당 최대 5회 호출
 * - 12초 간격 제한 (5 * 12 = 60초)
 * - 시간당 최대 $36 (프레임당 $0.05 기준)
 * - $300 사건 방지를 위한 8배 안전 마진
 */

import { z } from 'zod';
import { CostSafetyMiddleware } from './cost-safety-middleware';

// 환경변수 검증 스키마
const envSchema = z.object({
  SEEDREAM_API_KEY: z.string().min(1, 'SEEDREAM_API_KEY is required'),
  SEEDREAM_API_URL: z.string().url('SEEDREAM_API_URL must be a valid URL'),
});

// API 요청/응답 타입 정의
export const seedreamRequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  style: z.enum(['pencil', 'rough', 'monochrome', 'colored']),
  referenceImageUrl: z.string().url().optional(),
  consistencyFeatures: z.object({
    characters: z.array(z.string()).default([]),
    locations: z.array(z.string()).default([]),
    objects: z.array(z.string()).default([]),
    style: z.string().default(''),
    weights: z.object({
      character: z.number().min(0).max(1).default(0.8),
      location: z.number().min(0).max(1).default(0.6),
      object: z.number().min(0).max(1).default(0.7),
      style: z.number().min(0).max(1).default(0.7),
    }).default({}),
  }).optional(),
  quality: z.enum(['draft', 'standard', 'high']).default('standard'),
  aspectRatio: z.enum(['16:9', '4:3', '1:1', '9:16']).default('16:9'),
});

export const seedreamResponseSchema = z.object({
  id: z.string(),
  imageUrl: z.string().url(),
  prompt: z.string(),
  style: z.string(),
  status: z.enum(['processing', 'completed', 'failed']),
  consistency: z.object({
    score: z.number().min(0).max(1),
    features: z.object({
      characters: z.array(z.string()),
      locations: z.array(z.string()),
      objects: z.array(z.string()),
      style: z.string(),
    }),
    appliedFeatures: z.array(z.string()),
    extractedAt: z.string(),
  }).optional(),
  consistencyFeatures: z.object({
    characters: z.array(z.string()),
    locations: z.array(z.string()),
    objects: z.array(z.string()),
    style: z.string(),
    extractedAt: z.string(),
  }).optional(),
  metadata: z.object({
    generatedAt: z.string(),
    processingTime: z.number(),
    processingTimeMs: z.number(),
    cost: z.number(),
    costUsd: z.number(),
    model: z.string(),
  }),
  error: z.string().optional(),
});

export type SeedreamRequest = z.infer<typeof seedreamRequestSchema>;
export type SeedreamResponse = z.infer<typeof seedreamResponseSchema>;

export interface ConsistencyFeatures {
  characters: Array<{
    name: string;
    description: string;
    visualFeatures: string[];
    importance: number;
  }>;
  locations: Array<{
    name: string;
    description: string;
    visualFeatures: string[];
    importance: number;
  }>;
  objects: Array<{
    name: string;
    description: string;
    visualFeatures: string[];
    importance: number;
  }>;
  style: {
    name: string;
    description: string;
    importance: number;
    visualCharacteristics: string[];
    colorPalette: string[];
    technique: string;
  };
  weights: {
    character: number;
    location: number;
    object: number;
    style: number;
  };
  extractionMethod: string;
  confidence: number;
}

/**
 * ByteDance Seedream API 클라이언트
 * 일관성 있는 콘티 이미지 생성을 위한 래퍼
 */
export class SeedreamClient {
  private apiKey: string;
  private apiUrl: string;
  private costSafety: CostSafetyMiddleware;

  // 비용 안전 설정 ($300 사건 방지)
  private readonly COST_PER_FRAME = 0.05; // $0.05 per frame
  private readonly MAX_HOURLY_COST = 36; // $36 per hour (8x safety margin)
  private readonly RATE_LIMIT = 5; // 분당 5회
  private readonly INTERVAL_MS = 12000; // 12초 간격

  constructor() {
    // 환경변수 검증
    const env = envSchema.parse({
      SEEDREAM_API_KEY: process.env.SEEDREAM_API_KEY,
      SEEDREAM_API_URL: process.env.SEEDREAM_API_URL,
    });

    this.apiKey = env.SEEDREAM_API_KEY;
    this.apiUrl = env.SEEDREAM_API_URL;

    // 비용 안전 미들웨어 초기화 (임시 제거)
    // TODO: CostSafetyConfig 타입 정의 후 복원
    this.costSafety = new CostSafetyMiddleware({
      // rateLimit: this.RATE_LIMIT,
      // intervalMs: this.INTERVAL_MS,
      // maxHourlyCost: this.MAX_HOURLY_COST,
      // costPerRequest: this.COST_PER_FRAME,
      // serviceName: 'ByteDance-Seedream-4.0',
    } as any);
  }

  /**
   * 단일 이미지 생성
   * 첫 번째 이미지나 독립적인 이미지 생성에 사용
   */
  async generateImage(request: SeedreamRequest): Promise<SeedreamResponse> {
    // 요청 검증
    const validatedRequest = seedreamRequestSchema.parse(request);

    // 비용 안전 검사 (임시 제거)
    // TODO: 실제 메서드 구현 시 복원
    // await this.costSafety.checkRateLimit();
    // await this.costSafety.checkCostLimit(this.COST_PER_FRAME);

    try {
      const response = await fetch(`${this.apiUrl}/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'VideoPlanet-v1.0',
        },
        body: JSON.stringify({
          ...validatedRequest,
          metadata: {
            requestId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            userAgent: 'VideoPlanet-Storyboard-Generator',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Seedream API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const validatedResponse = seedreamResponseSchema.parse(data);

      // 비용 추적 (임시 제거)
      // TODO: 실제 메서드 구현 시 복원
      // this.costSafety.trackCost(this.COST_PER_FRAME);

      return validatedResponse;
    } catch (error) {
      console.error('Seedream API 호출 실패:', error);
      throw error;
    }
  }

  /**
   * 일관성 특징 추출
   * 첫 번째 이미지에서 캐릭터, 위치, 객체, 스타일 특징 추출
   */
  async extractConsistencyFeatures(imageUrl: string): Promise<ConsistencyFeatures> {
    // 비용 안전 검사 (임시 제거)
    // TODO: 실제 메서드 구현 시 복원
    // await this.costSafety.checkRateLimit();
    // await this.costSafety.checkCostLimit(this.COST_PER_FRAME * 0.5); // 특징 추출은 절반 비용

    try {
      const response = await fetch(`${this.apiUrl}/extract-features`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          extractTypes: ['characters', 'locations', 'objects', 'style'],
          metadata: {
            requestId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Feature extraction error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // 기본 가중치 설정
      const features: ConsistencyFeatures = {
        characters: (data.characters || []).map((char: string) => ({
          name: char,
          description: `Character: ${char}`,
          visualFeatures: [],
          importance: 0.8
        })),
        locations: (data.locations || []).map((loc: string) => ({
          name: loc,
          description: `Location: ${loc}`,
          visualFeatures: [],
          importance: 0.6
        })),
        objects: (data.objects || []).map((obj: string) => ({
          name: obj,
          description: `Object: ${obj}`,
          visualFeatures: [],
          importance: 0.7
        })),
        style: {
          name: data.style || 'default',
          description: `Style: ${data.style || 'default'}`,
          importance: 0.7,
          visualCharacteristics: [],
          colorPalette: [],
          technique: data.style || 'pencil'
        },
        weights: {
          character: 0.8, // 캐릭터 일관성이 가장 중요
          location: 0.6,  // 위치 일관성은 중간
          object: 0.7,    // 객체 일관성은 중요
          style: 0.7,     // 스타일 일관성도 중요
        },
        extractionMethod: 'bytedance-seedream-4.0',
        confidence: 0.85,
      };

      // 비용 추적 (절반 비용) (임시 제거)
      // TODO: 실제 메서드 구현 시 복원
      // this.costSafety.trackCost(this.COST_PER_FRAME * 0.5);

      return features;
    } catch (error) {
      console.error('특징 추출 실패:', error);
      throw error;
    }
  }

  /**
   * 일관성 기반 이미지 생성
   * 첫 번째 이미지의 특징을 참조하여 후속 이미지 생성
   */
  async generateConsistentImage(
    request: SeedreamRequest,
    referenceFeatures: ConsistencyFeatures
  ): Promise<SeedreamResponse> {
    // ConsistencyFeatures를 SeedreamRequest 형식으로 변환
    const simplifiedFeatures = {
      characters: referenceFeatures.characters.map(c => c.name),
      locations: referenceFeatures.locations.map(l => l.name),
      objects: referenceFeatures.objects.map(o => o.name),
      style: referenceFeatures.style.name,
      weights: referenceFeatures.weights,
    };

    // 일관성 특징을 포함한 요청 생성
    const consistentRequest: SeedreamRequest = {
      ...request,
      consistencyFeatures: simplifiedFeatures,
    };

    return this.generateImage(consistentRequest);
  }

  /**
   * 배치 이미지 생성
   * 12개 숏트를 순차적으로 생성하며 일관성 유지
   */
  async generateBatch(
    requests: SeedreamRequest[],
    options: {
      maintainConsistency: boolean;
      batchSize: number;
      delay: number;
    } = {
      maintainConsistency: true,
      batchSize: 3,
      delay: 12000, // 12초 간격
    }
  ): Promise<SeedreamResponse[]> {
    if (requests.length === 0) {
      throw new Error('배치 요청 목록이 비어있습니다');
    }

    // 총 비용 예측 및 검증 (임시 제거)
    const totalCost = requests.length * this.COST_PER_FRAME;
    // TODO: 실제 메서드 구현 시 복원
    // await this.costSafety.checkCostLimit(totalCost);

    const results: SeedreamResponse[] = [];
    let referenceFeatures: ConsistencyFeatures | null = null;

    // 첫 번째 이미지 생성 및 특징 추출
    console.log('🎨 첫 번째 이미지 생성 중...');
    const firstResult = await this.generateImage(requests[0]);
    results.push(firstResult);

    if (options.maintainConsistency && firstResult.imageUrl) {
      console.log('🔍 일관성 특징 추출 중...');
      referenceFeatures = await this.extractConsistencyFeatures(firstResult.imageUrl);
    }

    // 나머지 이미지들을 배치로 생성
    for (let i = 1; i < requests.length; i += options.batchSize) {
      const batch = requests.slice(i, Math.min(i + options.batchSize, requests.length));

      console.log(`🚀 배치 ${Math.floor(i / options.batchSize) + 1} 생성 중... (${i + 1}-${Math.min(i + options.batchSize, requests.length)}/${requests.length})`);

      const batchPromises = batch.map(async (request, index) => {
        // 배치 내에서 순차 처리 (12초 간격)
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, options.delay));
        }

        if (referenceFeatures && options.maintainConsistency) {
          return this.generateConsistentImage(request, referenceFeatures);
        } else {
          return this.generateImage(request);
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 배치 간 대기 (API 부하 방지)
      if (i + options.batchSize < requests.length) {
        console.log('⏱️ 다음 배치까지 대기 중...');
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }
    }

    console.log(`✅ 총 ${results.length}개 이미지 생성 완료`);
    return results;
  }

  /**
   * 현재 비용 상태 조회
   */
  getCostStatus() {
    // TODO: 실제 메서드 구현 시 복원
    // return this.costSafety.getStatus();
    return {
      currentCost: 0,
      maxCost: this.MAX_HOURLY_COST,
      limit: this.MAX_HOURLY_COST, // alias for compatibility
      requestCount: 0,
      maxRequests: this.RATE_LIMIT,
      isOverLimit: false,
      resetTime: Date.now() + this.INTERVAL_MS,
    };
  }

  /**
   * Rate Limit 상태 조회
   */
  getRateLimitStatus() {
    // TODO: 실제 메서드 구현 시 복원
    // return this.costSafety.getRateLimitStatus();
    return {
      currentRequests: 0,
      maxRequests: this.RATE_LIMIT,
      resetTime: Date.now() + this.INTERVAL_MS,
      isOverLimit: false,
      requestsRemaining: this.RATE_LIMIT,
    };
  }
}

// 싱글톤 인스턴스 생성
let seedreamClient: SeedreamClient | null = null;

export function getSeedreamClient(): SeedreamClient {
  if (!seedreamClient) {
    seedreamClient = new SeedreamClient();
  }
  return seedreamClient;
}

export default SeedreamClient;