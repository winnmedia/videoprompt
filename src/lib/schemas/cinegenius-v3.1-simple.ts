/**
 * CineGenius v3.1 간단한 구현
 * 복잡한 Zod 검증 없이 기본적인 타입만 정의하여 빠른 프로토타입 구현
 */

import { generateId } from '@/shared/lib/utils';

// 기본 인터페이스들
export interface CineGeniusV31Simple {
  version: '3.1';
  projectId: string;
  createdAt: string;
  
  // 사용자 입력
  userInput: {
    directPrompt: string;
    creativeBrief?: string;
    targetAudience?: string;
  };
  
  // 프로젝트 설정
  projectConfig: {
    projectName: string;
    videoLength: number;
    aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
    outputFormat?: string;
  };
  
  // 프롬프트 블루프린트
  promptBlueprint: {
    coreElements: {
      visualElements: Array<{
        type: string;
        description: string;
        priority: number;
      }>;
    };
    cinematography: {
      cameraAngle?: string;
      cameraMovement?: string;
      duration?: number;
    };
    environment: {
      location?: string;
      lighting?: string;
      weather?: string;
      timeOfDay?: string;
    };
    styleDirection: {
      visualStyle?: string;
      mood?: string;
      colorPalette?: string;
    };
  };
  
  // 생성 제어
  generationControl: {
    audioLayers: Array<{
      type: 'sfx' | 'music' | 'dialogue' | 'ambient';
      description?: string;
      speaker?: string;
      content?: string;
    }>;
    veoOptimization: {
      disableTextOverlays: boolean;
      maxPromptLength: number;
    };
  };
  
  // 최종 출력
  finalOutput?: {
    compiledPrompt: string;
    keywords: string[];
    negativePrompts: string[];
  };
}

// 빈 인스턴스 생성 함수
export function createEmptyV31Instance(): CineGeniusV31Simple {
  return {
    version: '3.1',
    projectId: generateId(),
    createdAt: new Date().toISOString(),
    
    userInput: {
      directPrompt: '',
    },
    
    projectConfig: {
      projectName: '',
      videoLength: 10,
      aspectRatio: '16:9',
    },
    
    promptBlueprint: {
      coreElements: {
        visualElements: [],
      },
      cinematography: {},
      environment: {},
      styleDirection: {},
    },
    
    generationControl: {
      audioLayers: [],
      veoOptimization: {
        disableTextOverlays: true,
        maxPromptLength: 2000,
      },
    },
  };
}

// 프롬프트 컴파일 결과 타입
export interface CompilationResult {
  compiledPrompt: string;
  metadata: {
    cameraInstructions: string[];
    audioInstructions: string[];
    visualPriorities: string[];
  };
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

// 간단한 컴파일러 함수
export async function compilePromptSimple(
  data: CineGeniusV31Simple,
  options?: {
    enableVeoOptimization?: boolean;
    includeAudioLayers?: boolean;
    disableTextOverlays?: boolean;
    maxPromptLength?: number;
  }
): Promise<CompilationResult> {
  const opts = {
    enableVeoOptimization: true,
    includeAudioLayers: true,
    disableTextOverlays: true,
    maxPromptLength: 2000,
    ...options,
  };
  
  try {
    // 기본 프롬프트 시작
    const parts: string[] = [data.userInput.directPrompt];
    
    // 시각적 요소 추가
    const visualElements = data.promptBlueprint.coreElements.visualElements
      .filter(el => el.description.trim())
      .sort((a, b) => b.priority - a.priority)
      .map(el => el.description);
    
    if (visualElements.length > 0) {
      parts.push(visualElements.join(', '));
    }
    
    // 환경 설정 추가
    const envParts: string[] = [];
    if (data.promptBlueprint.environment.location) {
      envParts.push(data.promptBlueprint.environment.location);
    }
    if (data.promptBlueprint.environment.lighting) {
      envParts.push(`${data.promptBlueprint.environment.lighting} lighting`);
    }
    if (data.promptBlueprint.environment.weather) {
      envParts.push(data.promptBlueprint.environment.weather);
    }
    
    if (envParts.length > 0) {
      parts.push(envParts.join(', '));
    }
    
    // 카메라 워크 추가
    const cameraDetails: string[] = [];
    if (data.promptBlueprint.cinematography.cameraMovement) {
      cameraDetails.push(`${data.promptBlueprint.cinematography.cameraMovement} camera movement`);
    }
    if (data.promptBlueprint.cinematography.cameraAngle) {
      cameraDetails.push(`${data.promptBlueprint.cinematography.cameraAngle} angle`);
    }
    
    if (cameraDetails.length > 0) {
      parts.push(cameraDetails.join(', '));
    }
    
    // 스타일 지시사항 추가
    if (data.promptBlueprint.styleDirection.visualStyle) {
      parts.push(data.promptBlueprint.styleDirection.visualStyle);
    }
    if (data.promptBlueprint.styleDirection.mood) {
      parts.push(`${data.promptBlueprint.styleDirection.mood} mood`);
    }
    
    // 오디오 레이어 추가 (Veo 신택스)
    if (opts.includeAudioLayers) {
      data.generationControl.audioLayers.forEach(layer => {
        switch (layer.type) {
          case 'sfx':
            if (layer.description) parts.push(`[SFX: ${layer.description}]`);
            break;
          case 'music':
            if (layer.description) parts.push(`[Music: ${layer.description}]`);
            break;
          case 'dialogue':
            if (layer.speaker && layer.content) {
              parts.push(`${layer.speaker}: "${layer.content}"`);
            }
            break;
        }
      });
    }
    
    // Veo 특화 설정
    if (opts.disableTextOverlays) {
      parts.push('no text overlays');
    }
    
    // 최종 프롬프트 조립
    let compiledPrompt = parts.filter(p => p.trim()).join('. ');
    
    // 길이 제한 적용
    if (compiledPrompt.length > opts.maxPromptLength) {
      compiledPrompt = compiledPrompt.substring(0, opts.maxPromptLength - 3) + '...';
    }
    
    return {
      compiledPrompt,
      metadata: {
        cameraInstructions: cameraDetails,
        audioInstructions: data.generationControl.audioLayers
          .map(layer => `${layer.type}: ${layer.description || layer.content || ''}`)
          .filter(Boolean),
        visualPriorities: visualElements.slice(0, 5),
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: compiledPrompt.length > opts.maxPromptLength * 0.8 
          ? ['프롬프트가 길어질 수 있습니다'] 
          : [],
      },
    };
    
  } catch (error) {
    return {
      compiledPrompt: '',
      metadata: {
        cameraInstructions: [],
        audioInstructions: [],
        visualPriorities: [],
      },
      validation: {
        isValid: false,
        errors: [`컴파일 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`],
        warnings: [],
      },
    };
  }
}

export default CineGeniusV31Simple;