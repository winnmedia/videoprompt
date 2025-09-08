/**
 * 타입 통합 Export
 * 
 * 레거시와 CineGenius v3.1 타입을 모두 내보내며
 * Feature Flag에 따라 적절한 타입을 사용할 수 있도록 지원
 */

// Legacy Types (v2.x 호환성)
export * from './video-prompt';

// CineGenius v3.1 Types  
export * from './video-prompt-v3';

// API Types
export * from './api';

// =============================================================================
// 🔄 Type Union for Version Compatibility
// =============================================================================

import type { VideoPrompt } from './video-prompt';
import type { CineGeniusV3Prompt } from './video-prompt-v3';

/**
 * 버전별 프롬프트 Union Type
 * API에서 두 버전을 모두 처리할 수 있도록 지원
 */
export type UniversalPrompt = VideoPrompt | CineGeniusV3Prompt;

/**
 * 프롬프트 버전 타입
 */
export type PromptVersion = '2.x' | '3.1';

/**
 * 버전 감지 헬퍼
 */
export function getPromptVersion(prompt: UniversalPrompt): PromptVersion {
  return 'version' in prompt && prompt.version === '3.1' ? '3.1' : '2.x';
}

/**
 * 버전별 타입 가드
 */
export function isV3Prompt(prompt: UniversalPrompt): prompt is CineGeniusV3Prompt {
  return getPromptVersion(prompt) === '3.1';
}

export function isV2Prompt(prompt: UniversalPrompt): prompt is VideoPrompt {
  return getPromptVersion(prompt) === '2.x';
}

// =============================================================================
// 🏗️ Construction Helpers
// =============================================================================

/**
 * 기본 V2 프롬프트 생성
 */
export function createEmptyV2Prompt(): VideoPrompt {
  return {
    metadata: {
      project_name: '',
      scene_description: '',
      base_style: '',
      genre: '',
      mood: '',
      quality: '',
      weather: '',
      lighting: '',
      lens: '',
      camera_movement: '',
      aspect_ratio: '16:9',
    },
    key_elements: [],
    assembled_elements: [],
    negative_prompts: [],
    timeline: [],
    text: '',
    keywords: [],
  };
}

/**
 * 기본 V3 프롬프트 생성
 */
export function createEmptyV3Prompt(): CineGeniusV3Prompt {
  return {
    version: '3.1',
    projectId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    userInput: {
      oneLineScenario: '',
    },
    projectConfig: {
      creationMode: 'VISUAL_FIRST',
      frameworkType: 'HYBRID',
      aiAssistantPersona: 'ASSISTANT_DIRECTOR',
    },
    promptBlueprint: {
      metadata: {
        promptName: '',
        baseStyle: {
          visualStyle: '',
          genre: '',
          mood: '',
          quality: '',
          styleFusion: {
            styleA: '',
            styleB: '',
            ratio: 1.0,
          },
        },
        spatialContext: {
          placeDescription: '',
          weather: '',
          lighting: '',
        },
        cameraSetting: {
          primaryLens: '',
          dominantMovement: '',
        },
        deliverySpec: {
          durationMs: 8000,
          aspectRatio: '16:9',
        },
      },
      elements: {
        characters: [],
        coreObjects: [],
      },
      timeline: [],
    },
    generationControl: {
      directorEmphasis: [],
      shotByShot: {
        enabled: false,
      },
      seed: Math.floor(Math.random() * 2147483647),
    },
    finalOutput: {
      finalPromptText: '',
      keywords: [],
      negativePrompts: [],
    },
  };
}