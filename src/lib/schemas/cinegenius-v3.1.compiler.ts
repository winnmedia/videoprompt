/**
 * CineGenius v3.1 Veo 3 최적화 프롬프트 컴파일러
 * 
 * CineGenius v3.1 스키마 데이터를 Veo 3에 최적화된 프롬프트로 컴파일합니다.
 * 우선순위 기반 렌더링, 오디오 신택스 처리, 프롬프트 길이 최적화를 지원합니다.
 */

import type { 
  CineGeniusV31, 
  PromptCompilationResult, 
  PromptGenerationOptions,
  ValidationResult,
  VeoAudioSyntax,
  VeoCameraInstruction 
} from './cinegenius-v3.1.types';
import { CineGeniusV31Schema } from './cinegenius-v3.1.zod';

// Veo 3 제한사항 상수
const VEO_LIMITS = {
  MAX_PROMPT_LENGTH: 2000,
  MAX_AUDIO_LAYERS: 3,
  MAX_CAMERA_INSTRUCTIONS: 5,
  OPTIMAL_ELEMENT_COUNT: 10,
  MIN_PRIORITY_THRESHOLD: 3
} as const;

// 우선순위 가중치
const PRIORITY_WEIGHTS = {
  VISUAL_CORE: 10,
  CAMERA_MOVEMENT: 8,
  LIGHTING: 7,
  ENVIRONMENT: 6,
  STYLE: 5,
  AUDIO: 4,
  DETAILS: 3,
  MODIFIERS: 2,
  METADATA: 1
} as const;

export class CineGeniusV31Compiler {
  private options: Required<PromptGenerationOptions>;

  constructor(options: PromptGenerationOptions = {}) {
    this.options = {
      enableVeoOptimization: true,
      includeAudioLayers: true,
      disableTextOverlays: false,
      maxPromptLength: VEO_LIMITS.MAX_PROMPT_LENGTH,
      ...options
    };
  }

  /**
   * CineGenius v3.1 데이터를 Veo 3 최적화된 프롬프트로 컴파일
   */
  async compile(data: CineGeniusV31): Promise<PromptCompilationResult> {
    try {
      // 1. 데이터 검증
      const validation = this.validateData(data);
      if (!validation.isValid) {
        return {
          compiledPrompt: '',
          metadata: {
            cameraInstructions: [],
            audioInstructions: [],
            visualPriorities: []
          },
          validation
        };
      }

      // 2. 프롬프트 구성 요소 추출 및 우선순위 적용
      const components = this.extractPromptComponents(data);
      const prioritizedComponents = this.applyPriorityWeights(components);

      // 3. Veo 3 최적화 적용
      const optimizedComponents = this.applyVeoOptimizations(prioritizedComponents);

      // 4. 최종 프롬프트 어셈블리
      const compiledPrompt = this.assemblePrompt(optimizedComponents);

      // 5. 메타데이터 생성
      const metadata = this.generateMetadata(data, optimizedComponents);

      return {
        compiledPrompt: this.truncateToLimit(compiledPrompt),
        metadata,
        validation
      };

    } catch (error) {
      return {
        compiledPrompt: '',
        metadata: {
          cameraInstructions: [],
          audioInstructions: [],
          visualPriorities: []
        },
        validation: {
          isValid: false,
          errors: [`컴파일 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`],
          warnings: []
        }
      };
    }
  }

  /**
   * 데이터 검증
   */
  private validateData(data: CineGeniusV31): ValidationResult {
    try {
      CineGeniusV31Schema.parse(data);
      
      const warnings: string[] = [];
      
      // Veo 3 특화 검증
      if (data.generationControl.audioLayers.length > VEO_LIMITS.MAX_AUDIO_LAYERS) {
        warnings.push(`오디오 레이어 수가 ${VEO_LIMITS.MAX_AUDIO_LAYERS}개를 초과합니다.`);
      }

      if (data.promptBlueprint.coreElements.visualElements.length > VEO_LIMITS.OPTIMAL_ELEMENT_COUNT) {
        warnings.push(`시각 요소 수가 최적 개수(${VEO_LIMITS.OPTIMAL_ELEMENT_COUNT}개)를 초과합니다.`);
      }

      return {
        isValid: true,
        errors: [],
        warnings
      };
    } catch (error) {
      return {
        isValid: false,
        errors: error instanceof Error ? [error.message] : ['알 수 없는 검증 오류'],
        warnings: []
      };
    }
  }

  /**
   * 프롬프트 구성 요소 추출
   */
  private extractPromptComponents(data: CineGeniusV31) {
    const { promptBlueprint, generationControl } = data;

    return {
      // 핵심 시각 요소 (최고 우선순위)
      visualCore: promptBlueprint.coreElements.visualElements
        .filter(element => element.priority >= VEO_LIMITS.MIN_PRIORITY_THRESHOLD)
        .sort((a, b) => b.priority - a.priority),

      // 카메라 워크
      cameraWork: {
        movement: promptBlueprint.cinematography.cameraMovement,
        angle: promptBlueprint.cinematography.cameraAngle,
        instructions: this.buildCameraInstructions(promptBlueprint.cinematography)
      },

      // 환경 설정
      environment: {
        lighting: promptBlueprint.environment.lighting,
        weather: promptBlueprint.environment.weather,
        timeOfDay: promptBlueprint.environment.timeOfDay,
        location: promptBlueprint.environment.location
      },

      // 스타일 지시사항
      style: {
        visualStyle: promptBlueprint.styleDirection.visualStyle,
        colorPalette: promptBlueprint.styleDirection.colorPalette,
        mood: promptBlueprint.styleDirection.mood
      },

      // 오디오 레이어
      audio: this.options.includeAudioLayers ? 
        this.extractAudioSyntax(generationControl.audioLayers) : null,

      // Veo 특화 설정
      veoConfig: generationControl.veoOptimization
    };
  }

  /**
   * 우선순위 가중치 적용
   */
  private applyPriorityWeights(components: any) {
    const weighted = { ...components };

    // 시각 요소 우선순위 재계산
    weighted.visualCore = weighted.visualCore.map((element: any) => ({
      ...element,
      calculatedPriority: element.priority * PRIORITY_WEIGHTS.VISUAL_CORE
    }));

    return weighted;
  }

  /**
   * Veo 3 최적화 적용
   */
  private applyVeoOptimizations(components: any) {
    if (!this.options.enableVeoOptimization) {
      return components;
    }

    const optimized = { ...components };

    // Veo 3는 간결하고 명확한 지시사항을 선호
    optimized.visualCore = optimized.visualCore
      .slice(0, VEO_LIMITS.OPTIMAL_ELEMENT_COUNT) // 요소 수 제한
      .map((element: any) => ({
        ...element,
        description: this.optimizeForVeo(element.description)
      }));

    // 카메라 명령어 최적화
    optimized.cameraWork.instructions = optimized.cameraWork.instructions
      .slice(0, VEO_LIMITS.MAX_CAMERA_INSTRUCTIONS);

    return optimized;
  }

  /**
   * Veo 3에 최적화된 텍스트 변환
   */
  private optimizeForVeo(text: string): string {
    return text
      .replace(/\s+/g, ' ') // 중복 공백 제거
      .replace(/[,]{2,}/g, ',') // 중복 쉼표 제거
      .replace(/\.\s*\./g, '.') // 중복 마침표 제거
      .trim();
  }

  /**
   * 카메라 지시사항 구축
   */
  private buildCameraInstructions(cinematography: any): VeoCameraInstruction[] {
    const instructions: VeoCameraInstruction[] = [];

    if (cinematography.cameraMovement && cinematography.cameraMovement !== 'static') {
      instructions.push({
        movement: cinematography.cameraMovement,
        angle: cinematography.cameraAngle,
        duration: cinematography.duration || 5,
        priority: PRIORITY_WEIGHTS.CAMERA_MOVEMENT
      });
    }

    return instructions;
  }

  /**
   * 오디오 신택스 추출
   */
  private extractAudioSyntax(audioLayers: any[]): VeoAudioSyntax {
    const syntax: VeoAudioSyntax = {
      sfx: [],
      music: [],
      dialogue: []
    };

    audioLayers.slice(0, VEO_LIMITS.MAX_AUDIO_LAYERS).forEach(layer => {
      switch (layer.type) {
        case 'sfx':
          if (layer.description) {
            syntax.sfx.push(`[SFX: ${layer.description}]`);
          }
          break;
        case 'music':
          if (layer.description) {
            syntax.music.push(`[Music: ${layer.description}]`);
          }
          break;
        case 'dialogue':
          if (layer.speaker && layer.content) {
            syntax.dialogue.push({
              speaker: layer.speaker,
              text: layer.content
            });
          }
          break;
      }
    });

    return syntax;
  }

  /**
   * 최종 프롬프트 어셈블리
   */
  private assemblePrompt(components: any): string {
    const sections: string[] = [];

    // 1. 핵심 시각 요소
    if (components.visualCore.length > 0) {
      const visualElements = components.visualCore
        .map((element: any) => element.description)
        .join(', ');
      sections.push(visualElements);
    }

    // 2. 카메라 워크
    const cameraSection = this.assembleCameraSection(components.cameraWork);
    if (cameraSection) {
      sections.push(cameraSection);
    }

    // 3. 환경
    const environmentSection = this.assembleEnvironmentSection(components.environment);
    if (environmentSection) {
      sections.push(environmentSection);
    }

    // 4. 스타일
    const styleSection = this.assembleStyleSection(components.style);
    if (styleSection) {
      sections.push(styleSection);
    }

    // 5. 오디오 (Veo 신택스 적용)
    if (components.audio) {
      const audioSection = this.assembleAudioSection(components.audio);
      if (audioSection) {
        sections.push(audioSection);
      }
    }

    // 6. Veo 특화 지시사항
    if (components.veoConfig.disableTextOverlays) {
      sections.push('no text overlays');
    }

    return sections.filter(Boolean).join('. ');
  }

  private assembleCameraSection(cameraWork: any): string {
    const parts: string[] = [];
    
    if (cameraWork.movement && cameraWork.movement !== 'static') {
      parts.push(`${cameraWork.movement} camera movement`);
    }
    
    if (cameraWork.angle) {
      parts.push(`${cameraWork.angle} angle`);
    }

    return parts.length > 0 ? parts.join(', ') : '';
  }

  private assembleEnvironmentSection(environment: any): string {
    const parts: string[] = [];

    if (environment.location) parts.push(environment.location);
    if (environment.timeOfDay) parts.push(environment.timeOfDay);
    if (environment.lighting) parts.push(`${environment.lighting} lighting`);
    if (environment.weather) parts.push(environment.weather);

    return parts.join(', ');
  }

  private assembleStyleSection(style: any): string {
    const parts: string[] = [];

    if (style.visualStyle) parts.push(style.visualStyle);
    if (style.mood) parts.push(`${style.mood} mood`);
    if (style.colorPalette) parts.push(`${style.colorPalette} color palette`);

    return parts.join(', ');
  }

  private assembleAudioSection(audio: VeoAudioSyntax): string {
    const parts: string[] = [];

    // SFX
    parts.push(...audio.sfx);

    // Music
    parts.push(...audio.music);

    // Dialogue (Veo 신택스)
    audio.dialogue.forEach(({ speaker, text }) => {
      parts.push(`${speaker}: "${text}"`);
    });

    return parts.join('. ');
  }

  /**
   * 프롬프트 길이 제한 적용
   */
  private truncateToLimit(prompt: string): string {
    if (prompt.length <= this.options.maxPromptLength) {
      return prompt;
    }

    // 문장 단위로 자르기
    const sentences = prompt.split('. ');
    let result = '';
    
    for (const sentence of sentences) {
      const potential = result ? `${result}. ${sentence}` : sentence;
      if (potential.length > this.options.maxPromptLength) {
        break;
      }
      result = potential;
    }

    return result || prompt.substring(0, this.options.maxPromptLength - 3) + '...';
  }

  /**
   * 메타데이터 생성
   */
  private generateMetadata(data: CineGeniusV31, components: any) {
    return {
      cameraInstructions: components.cameraWork.instructions.map((inst: VeoCameraInstruction) => 
        `${inst.movement} ${inst.angle} (${inst.duration}s)`
      ),
      audioInstructions: components.audio ? [
        ...components.audio.sfx,
        ...components.audio.music,
        ...components.audio.dialogue.map((d: any) => `${d.speaker}: "${d.text}"`)
      ] : [],
      visualPriorities: components.visualCore
        .sort((a: any, b: any) => b.calculatedPriority - a.calculatedPriority)
        .slice(0, 5)
        .map((element: any) => `${element.description} (priority: ${element.priority})`)
    };
  }
}

// 유틸리티 함수들
export function createCompiler(options?: PromptGenerationOptions): CineGeniusV31Compiler {
  return new CineGeniusV31Compiler(options);
}

export function compilePrompt(
  data: CineGeniusV31, 
  options?: PromptGenerationOptions
): Promise<PromptCompilationResult> {
  const compiler = createCompiler(options);
  return compiler.compile(data);
}

// 프리셋 컴파일러 설정들
export const COMPILER_PRESETS = {
  VEO_OPTIMIZED: {
    enableVeoOptimization: true,
    includeAudioLayers: true,
    disableTextOverlays: true,
    maxPromptLength: 1500
  },
  QUALITY_FOCUSED: {
    enableVeoOptimization: true,
    includeAudioLayers: true,
    disableTextOverlays: false,
    maxPromptLength: 2000
  },
  SIMPLE: {
    enableVeoOptimization: false,
    includeAudioLayers: false,
    disableTextOverlays: true,
    maxPromptLength: 1000
  }
} as const satisfies Record<string, PromptGenerationOptions>;

export default CineGeniusV31Compiler;