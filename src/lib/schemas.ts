/**
 * 통합 스키마 Export
 * 
 * 레거시 스키마와 CineGenius v3.1 스키마를 모두 내보내며
 * 버전별 검증 로직 제공
 */

// Legacy Schemas (v2.x)
export * from './schema';

// CineGenius v3.1 Schemas
export * from './schema-v3';

import { z } from 'zod';
import { ScenePromptSchema } from './schema';
import { validateV3Prompt, UniversalPromptSchema, CineGeniusV3PromptSchema } from './schema-v3';
import { logger } from '@/shared/lib/logger';


// Re-export for convenience
export { 
  UniversalPromptSchema, 
  CineGeniusV3PromptSchema,
  validatePrompt,
  validateV3Prompt,
  validatePartialV3Prompt 
} from './schema-v3';

// =============================================================================
// 🔄 Version Detection & Routing
// =============================================================================

/**
 * 프롬프트 데이터에서 버전 자동 감지
 */
export function detectPromptVersion(data: unknown): '2.x' | '3.1' | 'unknown' {
  if (typeof data !== 'object' || data === null) {
    return 'unknown';
  }
  
  const obj = data as Record<string, unknown>;
  
  // v3.1 명시적 버전 체크
  if (obj.version === '3.1') {
    return '3.1';
  }
  
  // v3.1 구조 특징으로 판단
  if (obj.projectId && obj.promptBlueprint) {
    return '3.1';
  }
  
  // Legacy 구조 특징으로 판단
  if (obj.metadata && obj.timeline) {
    return '2.x';
  }
  
  return 'unknown';
}

/**
 * 버전별 스키마 검증 라우팅
 */
export function validateByVersion(data: unknown) {
  const version = detectPromptVersion(data);
  
  switch (version) {
    case '3.1':
      return validateV3Prompt(data);
      
    case '2.x':
      return ScenePromptSchema.parse(data);
      
    default:
      // 범용 검증 시도
      return UniversalPromptSchema.parse(data);
  }
}

// =============================================================================
// 🧪 Testing Helpers
// =============================================================================

/**
 * 테스트용 v3.1 예제 데이터 생성
 */
export function createV3Example() {
  return {
    version: '3.1' as const,
    projectId: '12345678-1234-4123-8123-123456789abc', // 유효한 UUID v4
    createdAt: '2025-09-08T12:00:00.000Z',
    userInput: {
      oneLineScenario: 'A modern office scene with professional lighting',
      targetAudience: 'Corporate training audience',
    },
    projectConfig: {
      creationMode: 'VISUAL_FIRST' as const,
      frameworkType: 'HYBRID' as const,
      aiAssistantPersona: 'ASSISTANT_DIRECTOR' as const,
    },
    promptBlueprint: {
      metadata: {
        promptName: 'Test Project',
        baseStyle: {
          visualStyle: 'Cinematic',
          genre: 'Drama',
          mood: 'Professional',
          quality: '4K',
          styleFusion: {
            styleA: 'Cinematic',
            styleB: 'Corporate',
            ratio: 0.7,
          },
        },
        spatialContext: {
          placeDescription: 'Modern corporate office with glass walls',
          weather: 'Clear',
          lighting: 'Daylight (Midday)',
        },
        cameraSetting: {
          primaryLens: '35mm (Natural)',
          dominantMovement: 'Static Shot',
          physical: {
            aperture: 'f/2.8',
            iso: 800,
          },
        },
        deliverySpec: {
          durationMs: 8000,
          aspectRatio: '16:9',
          fps: 24,
        },
        continuity: {
          noCuts: false,
        },
      },
      elements: {
        characters: [
          { id: 'char_1', description: 'Professional business person' }
        ],
        coreObjects: [
          { id: 'obj_1', description: 'Modern desk' },
          { id: 'obj_2', description: 'Computer monitor' }
        ],
      },
      timeline: [
        {
          sequence: 0,
          timestamp: '00:00:00.000',
          visualDirecting: 'Person enters office and sits at desk',
          cameraWork: {
            angle: 'Medium Shot (MS)',
            move: 'Static Shot',
          },
          pacingFX: {
            pacing: 'Real-time',
            editingStyle: 'Standard Cut',
            visualEffect: 'None',
          },
          audioLayers: {
            diegetic: 'Office ambient sounds',
            non_diegetic: '',
            voice: '',
            concept: 'Professional atmosphere',
          },
        },
      ],
    },
    generationControl: {
      directorEmphasis: [
        { term: 'lighting', weight: 2.0 },
        { term: 'composition', weight: 1.5 }
      ],
      shotByShot: {
        enabled: false,
      },
      seed: 123456789,
    },
    finalOutput: {
      finalPromptText: 'A cinematic scene in a modern office',
      keywords: ['office', 'professional', 'modern', 'business'],
      negativePrompts: ['blurry', 'low quality', 'amateur'],
    },
  };
}

/**
 * 개발용: 모든 스키마 테스트
 */
export function testAllSchemas() {
  if (process.env.NODE_ENV === 'development') {
    logger.info('🧪 Testing All Schemas...');
    
    try {
      // v2.x Legacy test
      const legacyData = {
        metadata: {
          prompt_name: 'Test',
          base_style: 'Cinematic',
          aspect_ratio: '16:9',
          room_description: 'A modern office',
          camera_setup: '35mm lens',
        },
        key_elements: ['person'],
        assembled_elements: ['desk', 'computer'],
        timeline: [
          {
            sequence: 0,
            timestamp: '00:00-00:02',
            action: 'Person sits down',
            audio: 'Ambient office sounds',
          },
        ],
        text: 'A cinematic scene in a modern office',
        keywords: ['office', 'modern', 'professional'],
      };
      
      ScenePromptSchema.parse(legacyData);
      logger.info('✅ Legacy Schema Test Passed');
      
    } catch (error) {
      logger.error('❌ Schema Test Failed:', error);
    }
  }
}

// =============================================================================
// 🏗️ Migration Helpers
// =============================================================================

/**
 * v2.x에서 v3.1으로 마이그레이션
 */
export function migrateV2ToV3(v2Data: any) {
  try {
    // Legacy 스키마로 먼저 검증
    const validV2 = ScenePromptSchema.parse(v2Data);
    
    // 디버깅을 위한 로그 (테스트 환경에서만)
    if (process.env.NODE_ENV === 'test') {
      logger.info('validV2:', JSON.stringify(validV2, null, 2));
    }
    
    // v3.1 구조로 변환
    const v3Data = {
      version: '3.1' as const,
      projectId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      userInput: {
        oneLineScenario: validV2.metadata.room_description || '',
      },
      projectConfig: {
        creationMode: 'VISUAL_FIRST' as const,
        frameworkType: 'HYBRID' as const,
        aiAssistantPersona: 'ASSISTANT_DIRECTOR' as const,
      },
      promptBlueprint: {
        metadata: {
          promptName: validV2.metadata.prompt_name || 'Migrated Project',
          baseStyle: {
            visualStyle: validV2.metadata.base_style || '',
            genre: 'Drama',
            mood: 'Neutral',
            quality: '4K',
            styleFusion: {
              styleA: validV2.metadata.base_style || '',
              styleB: validV2.metadata.base_style || '',
              ratio: 1.0,
            },
          },
          spatialContext: {
            placeDescription: validV2.metadata.room_description || '',
            weather: 'Clear',
            lighting: 'Daylight (Midday)',
          },
          cameraSetting: {
            primaryLens: validV2.metadata.camera_setup || '35mm (Natural)',
            dominantMovement: 'Static Shot',
          },
          deliverySpec: {
            durationMs: Math.max((validV2.timeline || []).length * 2000, 1000), // 최소 1초, 2초씩 계산
            aspectRatio: validV2.metadata.aspect_ratio || '16:9',
          },
        },
        elements: {
          characters: (validV2.key_elements || []).map((element: string, index: number) => ({
            id: `char_${index}`,
            description: element,
          })),
          coreObjects: (validV2.assembled_elements || []).map((element: string, index: number) => ({
            id: `obj_${index}`,
            description: element,
          })),
        },
        timeline: (validV2.timeline || []).length > 0 
          ? (validV2.timeline || []).map((segment: any) => ({
          sequence: segment.sequence,
          timestamp: convertTimestamp(segment.timestamp),
          visualDirecting: segment.action,
          cameraWork: {
            angle: 'Medium Shot (MS)',
            move: 'Static Shot',
          },
          pacingFX: {
            pacing: 'Real-time',
            editingStyle: 'Standard Cut',
            visualEffect: 'None',
          },
          audioLayers: {
            diegetic: segment.audio || '',
            non_diegetic: '',
            voice: '',
            concept: '',
          },
        }))
          : [
            // 빈 타임라인인 경우 기본 세그먼트 추가
            {
              sequence: 0,
              timestamp: '00:00:00.000',
              visualDirecting: validV2.metadata.room_description || 'Empty scene',
              cameraWork: {
                angle: 'Medium Shot (MS)',
                move: 'Static Shot',
              },
              pacingFX: {
                pacing: 'Real-time',
                editingStyle: 'Standard Cut',
                visualEffect: 'None',
              },
              audioLayers: {
                diegetic: '',
                non_diegetic: '',
                voice: '',
                concept: '',
              },
            },
          ],
      },
      generationControl: {
        directorEmphasis: [],
        shotByShot: {
          enabled: false,
        },
        seed: Math.floor(Math.random() * 2147483647),
      },
      finalOutput: {
        finalPromptText: validV2.text === 'none' || !validV2.text 
          ? (validV2.metadata.room_description || 'Minimal scene')
          : validV2.text,
        keywords: validV2.keywords || [],
        negativePrompts: validV2.negative_prompts || [],
      },
    };
    
    // 디버깅을 위한 v3Data 출력
    if (process.env.NODE_ENV === 'test') {
      logger.info('Generated v3Data:', JSON.stringify(v3Data, null, 2));
    }
    
    // v3.1 스키마로 검증
    return validateV3Prompt(v3Data);
    
  } catch (error) {
    logger.error('Migration error details:', error);
    throw new Error(`Migration failed: ${error}`);
  }
}

/**
 * 타임스탬프 형식 변환 (00:00-00:02 → 00:00:00.000)
 */
function convertTimestamp(timestamp: string): string {
  try {
    const [start] = timestamp.split('-');
    const [minutes, seconds] = start.split(':');
    return `00:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}.000`;
  } catch {
    return '00:00:00.000';
  }
}

// =============================================================================
// 🚀 Startup Validation
// =============================================================================

/**
 * 애플리케이션 시작 시 스키마 검증
 */
export function validateSchemasOnStartup() {
  if (process.env.NODE_ENV === 'development') {
    logger.info('🚀 Validating Schemas on Startup...');
    testAllSchemas();
  }
}