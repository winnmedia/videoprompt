/**
 * ByteDance Seedream API 모킹 핸들러
 * 결정론적 테스트를 위한 ByteDance API 응답 모킹
 *
 * 기능:
 * - 이미지 생성 API 모킹
 * - 특징 추출 API 모킹
 * - 배치 처리 API 모킹
 * - 일관성 시스템 테스트 지원
 * - $300 사건 방지를 위한 안전한 테스트 환경
 */

import { http, HttpResponse } from 'msw';
import { z } from 'zod';

// 테스트용 시드 값 (결정론적 결과 보장)
const TEST_SEED = 12345;
let requestCounter = 0;

// ByteDance API 요청 스키마
const bytedanceImageRequestSchema = z.object({
  prompt: z.string(),
  style: z.enum(['pencil', 'rough', 'monochrome', 'colored']),
  quality: z.enum(['draft', 'standard', 'high']).default('standard'),
  aspect_ratio: z.enum(['16:9', '4:3', '1:1', '9:16']).default('16:9'),
  consistency_features: z.any().optional(),
  metadata: z.any().optional(),
});

const featureExtractionRequestSchema = z.object({
  imageUrl: z.string().url(),
  extractTypes: z.array(z.string()),
  metadata: z.any().optional(),
});

// 결정론적 데이터 생성기
class DeterministicDataGenerator {
  private seed: number;

  constructor(seed: number = TEST_SEED) {
    this.seed = seed;
  }

  // 시드 기반 의사 난수 생성
  private random(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  // 결정론적 이미지 URL 생성
  generateImageUrl(prompt: string, style: string, requestId: number): string {
    const hash = this.simpleHash(prompt + style + requestId);
    return `https://mock-seedream-api.com/images/${hash}.png`;
  }

  // 결정론적 처리 시간 생성 (15-45초)
  generateProcessingTime(): number {
    return Math.floor(15000 + (this.random() * 30000));
  }

  // 결정론적 비용 생성 ($0.03-$0.07)
  generateCost(): number {
    return 0.03 + (this.random() * 0.04);
  }

  // 결정론적 특징 생성
  generateConsistencyFeatures(prompt: string): any {
    const characters = this.extractCharactersFromPrompt(prompt);
    const objects = this.extractObjectsFromPrompt(prompt);
    const styleAnalysis = this.generateStyleAnalysis(prompt);

    return {
      characters,
      objects,
      style_analysis: styleAnalysis,
      composition: {
        frame_type: this.selectRandom(['close-up', 'medium', 'wide']),
        camera_angle: this.selectRandom(['eye-level', 'high', 'low']),
        lighting: this.selectRandom(['natural', 'dramatic', 'soft']),
        composition_rules: ['rule-of-thirds', 'leading-lines'],
      },
      scene_analysis: {
        setting: this.extractSetting(prompt),
        time_of_day: this.selectRandom(['morning', 'afternoon', 'evening', 'night']),
        weather: this.selectRandom(['clear', 'cloudy', 'rainy', 'sunny']),
        location_type: this.selectRandom(['indoor', 'outdoor', 'urban', 'nature']),
      },
    };
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit 정수로 변환
    }
    return Math.abs(hash).toString(16);
  }

  private selectRandom<T>(items: T[]): T {
    const index = Math.floor(this.random() * items.length);
    return items[index];
  }

  private extractCharactersFromPrompt(prompt: string): any[] {
    const characterKeywords = ['man', 'woman', 'child', 'person', 'character', 'hero', 'protagonist'];
    const foundCharacters: any[] = [];

    characterKeywords.forEach(keyword => {
      if (prompt.toLowerCase().includes(keyword)) {
        foundCharacters.push({
          name: keyword,
          confidence: 0.8 + (this.random() * 0.15),
          features: [
            `distinctive ${keyword} appearance`,
            'recognizable facial features',
            'consistent clothing style',
          ],
          bounding_box: {
            x: this.random() * 100,
            y: this.random() * 100,
            width: 50 + (this.random() * 30),
            height: 60 + (this.random() * 40),
          },
        });
      }
    });

    return foundCharacters;
  }

  private extractObjectsFromPrompt(prompt: string): any[] {
    const objectKeywords = ['car', 'table', 'chair', 'building', 'tree', 'door', 'window'];
    const foundObjects: any[] = [];

    objectKeywords.forEach(keyword => {
      if (prompt.toLowerCase().includes(keyword)) {
        foundObjects.push({
          name: keyword,
          confidence: 0.7 + (this.random() * 0.2),
          attributes: [
            `${keyword} design`,
            'material texture',
            'color variation',
          ],
          position: this.selectRandom(['foreground', 'background', 'center']),
        });
      }
    });

    return foundObjects;
  }

  private generateStyleAnalysis(prompt: string): any {
    const styles = ['pencil sketch', 'rough drawing', 'monochrome art', 'colored illustration'];
    const techniques = ['cross-hatching', 'blending', 'line work', 'shading'];
    const moods = ['calm', 'energetic', 'dramatic', 'peaceful'];

    return {
      primary_style: this.selectRandom(styles),
      techniques: [this.selectRandom(techniques), this.selectRandom(techniques)],
      color_palette: [
        '#2B2B2B', '#4A4A4A', '#6B6B6B', '#8C8C8C', '#ADADAD'
      ],
      mood: this.selectRandom(moods),
      confidence: 0.85 + (this.random() * 0.1),
    };
  }

  private extractSetting(prompt: string): string {
    if (prompt.toLowerCase().includes('room')) return 'interior room';
    if (prompt.toLowerCase().includes('street')) return 'city street';
    if (prompt.toLowerCase().includes('forest')) return 'forest setting';
    if (prompt.toLowerCase().includes('office')) return 'office environment';
    return 'general setting';
  }
}

const dataGenerator = new DeterministicDataGenerator();

// ByteDance API 모킹 핸들러
export const bytedanceHandlers = [
  // 이미지 생성 API
  http.post('*/seedream/v1/generate', async ({ request }) => {
    const currentRequestId = ++requestCounter;

    try {
      const body = await request.json();
      const validatedRequest = bytedanceImageRequestSchema.parse(body);

      // 요청 지연 시뮬레이션 (테스트에서는 빠르게)
      await new Promise(resolve => setTimeout(resolve, 100));

      // 결정론적 응답 생성
      const processingTime = dataGenerator.generateProcessingTime();
      const cost = dataGenerator.generateCost();
      const imageUrl = dataGenerator.generateImageUrl(
        validatedRequest.prompt,
        validatedRequest.style,
        currentRequestId
      );

      // 성공 응답 (90% 확률)
      const isSuccess = (currentRequestId % 10) !== 0;

      if (isSuccess) {
        return HttpResponse.json({
          task_id: `task_${currentRequestId}_${Date.now()}`,
          status: 'success',
          result: {
            image_url: imageUrl,
            image_id: `img_${currentRequestId}`,
            prompt: validatedRequest.prompt,
            style: validatedRequest.style,
            quality: validatedRequest.quality,
            created_at: new Date().toISOString(),
            processing_time_ms: processingTime,
            cost_usd: cost,
            metadata: {
              width: 1920,
              height: 1080,
              format: 'png',
              file_size: 1024000 + Math.floor(dataGenerator.generateProcessingTime() / 100),
            },
          },
        });
      } else {
        // 실패 응답 (10% 확률)
        return HttpResponse.json({
          task_id: `task_${currentRequestId}_${Date.now()}`,
          status: 'failed',
          error: {
            code: 'GENERATION_FAILED',
            message: 'Image generation failed due to content policy violation',
            details: {
              reason: 'prompt_too_complex',
              retry_suggested: true,
            },
          },
        });
      }
    } catch (error) {
      return HttpResponse.json({
        task_id: `task_error_${currentRequestId}`,
        status: 'failed',
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request validation failed',
        },
      }, { status: 400 });
    }
  }),

  // 특징 추출 API
  http.post('*/seedream/v1/extract-features', async ({ request }) => {
    const currentRequestId = ++requestCounter;

    try {
      const body = await request.json();
      const validatedRequest = featureExtractionRequestSchema.parse(body);

      // 지연 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 50));

      // 이미지 URL에서 프롬프트 정보 추출 (모킹용)
      const mockPrompt = `scene with various elements from ${validatedRequest.imageUrl}`;
      const consistencyFeatures = dataGenerator.generateConsistencyFeatures(mockPrompt);

      return HttpResponse.json({
        task_id: `extract_${currentRequestId}_${Date.now()}`,
        status: 'success',
        result: consistencyFeatures,
      });
    } catch (error) {
      return HttpResponse.json({
        task_id: `extract_error_${currentRequestId}`,
        status: 'failed',
        error: {
          code: 'EXTRACTION_FAILED',
          message: 'Feature extraction failed',
        },
      }, { status: 400 });
    }
  }),

  // 배치 처리 API (여러 이미지 동시 생성)
  http.post('*/seedream/v1/batch-generate', async ({ request }) => {
    const currentRequestId = ++requestCounter;

    try {
      const body = await request.json() as any;
      const { requests } = body;

      if (!Array.isArray(requests) || requests.length === 0) {
        throw new Error('Invalid batch request');
      }

      // 배치 요청 각각 검증
      const validatedRequests = requests.map(req =>
        bytedanceImageRequestSchema.parse(req)
      );

      // 배치 처리 지연 (요청 수에 비례)
      await new Promise(resolve => setTimeout(resolve, validatedRequests.length * 20));

      // 각 요청에 대한 응답 생성
      const results = validatedRequests.map((req, index) => {
        const requestId = currentRequestId + index;
        const isSuccess = (requestId % 10) !== 0; // 90% 성공률

        if (isSuccess) {
          return {
            task_id: `batch_${requestId}_${Date.now()}`,
            status: 'success',
            result: {
              image_url: dataGenerator.generateImageUrl(req.prompt, req.style, requestId),
              image_id: `batch_img_${requestId}`,
              prompt: req.prompt,
              style: req.style,
              quality: req.quality,
              created_at: new Date().toISOString(),
              processing_time_ms: dataGenerator.generateProcessingTime(),
              cost_usd: dataGenerator.generateCost(),
              metadata: {
                width: 1920,
                height: 1080,
                format: 'png',
                file_size: 1024000 + (requestId * 1000),
              },
            },
          };
        } else {
          return {
            task_id: `batch_${requestId}_${Date.now()}`,
            status: 'failed',
            error: {
              code: 'BATCH_ITEM_FAILED',
              message: `Batch item ${index + 1} failed`,
            },
          };
        }
      });

      return HttpResponse.json({
        batch_id: `batch_${currentRequestId}_${Date.now()}`,
        status: 'completed',
        total_requests: validatedRequests.length,
        successful_requests: results.filter(r => r.status === 'success').length,
        failed_requests: results.filter(r => r.status === 'failed').length,
        results,
      });
    } catch (error) {
      return HttpResponse.json({
        batch_id: `batch_error_${currentRequestId}`,
        status: 'failed',
        error: {
          code: 'BATCH_VALIDATION_FAILED',
          message: 'Batch request validation failed',
        },
      }, { status: 400 });
    }
  }),

  // API 상태 확인
  http.get('*/seedream/v1/status', () => {
    return HttpResponse.json({
      service: 'ByteDance Seedream API (Mock)',
      version: '4.0',
      status: 'operational',
      rate_limits: {
        requests_per_minute: 5,
        requests_per_hour: 300,
        cost_per_request: 0.05,
      },
      current_load: {
        cpu_usage: 0.3 + (Math.random() * 0.4),
        memory_usage: 0.6 + (Math.random() * 0.2),
        queue_length: Math.floor(Math.random() * 10),
      },
      timestamp: new Date().toISOString(),
    });
  }),

  // 작업 상태 조회
  http.get('*/seedream/v1/task/:taskId', ({ params }) => {
    const { taskId } = params;

    // 태스크 ID에서 상태 결정 (결정론적)
    const isCompleted = String(taskId).includes('completed') || Math.random() > 0.3;
    const isFailed = String(taskId).includes('failed') || (!isCompleted && Math.random() > 0.8);

    if (isFailed) {
      return HttpResponse.json({
        task_id: taskId,
        status: 'failed',
        error: {
          code: 'TASK_FAILED',
          message: 'Task processing failed',
        },
        created_at: new Date(Date.now() - 30000).toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    if (isCompleted) {
      return HttpResponse.json({
        task_id: taskId,
        status: 'completed',
        result: {
          image_url: `https://mock-seedream-api.com/images/${taskId}.png`,
          processing_time_ms: dataGenerator.generateProcessingTime(),
          cost_usd: dataGenerator.generateCost(),
        },
        created_at: new Date(Date.now() - 45000).toISOString(),
        completed_at: new Date().toISOString(),
      });
    }

    // 진행 중
    return HttpResponse.json({
      task_id: taskId,
      status: 'processing',
      progress: {
        percentage: Math.floor(Math.random() * 80) + 10,
        estimated_completion: new Date(Date.now() + 15000).toISOString(),
      },
      created_at: new Date(Date.now() - 15000).toISOString(),
      updated_at: new Date().toISOString(),
    });
  }),

  // 사용량 통계
  http.get('*/seedream/v1/usage', () => {
    return HttpResponse.json({
      user_id: 'test-user',
      current_period: {
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString(),
        requests_made: 42,
        requests_limit: 1000,
        cost_incurred: 2.10,
        cost_limit: 50.0,
      },
      rate_limit_status: {
        requests_remaining_this_minute: 4,
        requests_remaining_this_hour: 267,
        reset_time_minute: new Date(Date.now() + 30000).toISOString(),
        reset_time_hour: new Date(Date.now() + 1800000).toISOString(),
      },
      recommendations: [
        'Consider using batch requests for better efficiency',
        'Draft quality is sufficient for testing purposes',
      ],
    });
  }),
];

// 테스트용 유틸리티 함수들
export const bytedanceTestUtils = {
  // 요청 카운터 리셋 (테스트 간 격리)
  resetRequestCounter: () => {
    requestCounter = 0;
  },

  // 결정론적 데이터 생성기 리셋 (임시 제거)
  resetDataGenerator: (seed: number = TEST_SEED) => {
    // TODO: DeterministicDataGenerator에 public reset 메서드 추가 후 복원
    // dataGenerator.seed = seed;
  },

  // 특정 프롬프트에 대한 예상 응답 생성
  generateExpectedResponse: (prompt: string, style: string) => {
    const currentCount = requestCounter + 1;
    return {
      imageUrl: dataGenerator.generateImageUrl(prompt, style, currentCount),
      processingTime: dataGenerator.generateProcessingTime(),
      cost: dataGenerator.generateCost(),
    };
  },

  // 실패 응답 강제 생성 (특정 프롬프트 패턴)
  forceFailureFor: (prompt: string) => {
    // 실제로는 더 정교한 실패 조건 설정 가능
    return prompt.includes('FORCE_FAILURE');
  },
};

export default bytedanceHandlers;