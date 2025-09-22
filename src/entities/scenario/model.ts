/**
 * Scenario Entity Model
 *
 * 시나리오 도메인 비즈니스 로직
 * CLAUDE.md 준수: FSD entities 레이어, 도메인 순수성, 단일 책임 원칙
 */

import type {
  Scenario,
  Scene,
  ScenarioCreateInput,
  ScenarioUpdateInput,
  ValidationResult,
  ScenarioError,
  ScenarioStatus
} from './types'

/**
 * 시나리오 비즈니스 로직 모델
 */
export class ScenarioModel {
  /**
   * 새로운 시나리오 생성
   */
  static create(input: ScenarioCreateInput): Scenario {
    const now = new Date()
    
    return {
      metadata: {
        id: ScenarioModel.generateId(),
        title: input.title,
        description: input.description,
        genre: input.genre,
        targetDuration: input.targetDuration,
        createdAt: now,
        updatedAt: now,
        status: 'draft' as ScenarioStatus,
        userId: input.userId
      },
      scenes: [],
      totalDuration: 0,
      storyOutline: undefined,
      keywords: []
    }
  }

  /**
   * 시나리오 업데이트
   */
  static update(scenario: Scenario, input: ScenarioUpdateInput): Scenario {
    const updatedScenario: Scenario = {
      ...scenario,
      metadata: {
        ...scenario.metadata,
        ...Object.fromEntries(
          Object.entries(input).filter(([key]) => 
            ['title', 'description', 'genre', 'targetDuration', 'status'].includes(key)
          )
        ),
        updatedAt: new Date()
      }
    }

    // scenes 업데이트 시 totalDuration 재계산
    if (input.scenes) {
      updatedScenario.scenes = input.scenes
      updatedScenario.totalDuration = ScenarioModel.calculateTotalDuration(input.scenes)
    }

    if (input.storyOutline !== undefined) {
      updatedScenario.storyOutline = input.storyOutline
    }

    if (input.keywords !== undefined) {
      updatedScenario.keywords = input.keywords
    }

    return updatedScenario
  }

  /**
   * 씬 추가
   */
  static addScene(scenario: Scenario, scene: Omit<Scene, 'id' | 'order'>): Scenario {
    const newScene: Scene = {
      ...scene,
      id: ScenarioModel.generateId(),
      order: scenario.scenes.length + 1
    }

    const updatedScenes = [...scenario.scenes, newScene]
    
    return {
      ...scenario,
      scenes: updatedScenes,
      totalDuration: ScenarioModel.calculateTotalDuration(updatedScenes),
      metadata: {
        ...scenario.metadata,
        updatedAt: new Date()
      }
    }
  }

  /**
   * 씬 업데이트
   */
  static updateScene(scenario: Scenario, sceneId: string, updates: Partial<Scene>): Scenario {
    const updatedScenes = scenario.scenes.map(scene => 
      scene.id === sceneId 
        ? { ...scene, ...updates }
        : scene
    )

    return {
      ...scenario,
      scenes: updatedScenes,
      totalDuration: ScenarioModel.calculateTotalDuration(updatedScenes),
      metadata: {
        ...scenario.metadata,
        updatedAt: new Date()
      }
    }
  }

  /**
   * 씬 삭제
   */
  static removeScene(scenario: Scenario, sceneId: string): Scenario {
    const updatedScenes = scenario.scenes
      .filter(scene => scene.id !== sceneId)
      .map((scene, index) => ({ ...scene, order: index + 1 }))

    return {
      ...scenario,
      scenes: updatedScenes,
      totalDuration: ScenarioModel.calculateTotalDuration(updatedScenes),
      metadata: {
        ...scenario.metadata,
        updatedAt: new Date()
      }
    }
  }

  /**
   * 씬 순서 변경
   */
  static reorderScenes(scenario: Scenario, sceneIds: string[]): Scenario {
    const sceneMap = new Map(scenario.scenes.map(scene => [scene.id, scene]))
    
    const reorderedScenes = sceneIds
      .map(id => sceneMap.get(id))
      .filter((scene): scene is Scene => scene !== undefined)
      .map((scene, index) => ({ ...scene, order: index + 1 }))

    return {
      ...scenario,
      scenes: reorderedScenes,
      metadata: {
        ...scenario.metadata,
        updatedAt: new Date()
      }
    }
  }

  /**
   * 시나리오 검증
   */
  static validate(scenario: Scenario): ValidationResult {
    const errors: ScenarioError[] = []
    const warnings: string[] = []

    // 기본 검증
    if (!scenario.metadata.title.trim()) {
      errors.push({
        code: 'TITLE_REQUIRED',
        message: '시나리오 제목은 필수입니다.'
      })
    }

    if (scenario.scenes.length === 0) {
      warnings.push('시나리오에 씬이 없습니다.')
    }

    // 씬 검증
    scenario.scenes.forEach((scene, index) => {
      if (!scene.title.trim()) {
        errors.push({
          code: 'SCENE_TITLE_REQUIRED',
          message: `씬 ${index + 1}의 제목이 필요합니다.`,
          details: { sceneId: scene.id }
        })
      }

      if (!scene.description.trim()) {
        warnings.push(`씬 ${index + 1}에 설명이 없습니다.`)
      }

      if (scene.duration && scene.duration <= 0) {
        errors.push({
          code: 'INVALID_SCENE_DURATION',
          message: `씬 ${index + 1}의 지속시간이 잘못되었습니다.`,
          details: { sceneId: scene.id }
        })
      }
    })

    // 대상 지속시간 검증
    if (scenario.metadata.targetDuration && scenario.totalDuration) {
      const difference = Math.abs(scenario.totalDuration - scenario.metadata.targetDuration)
      const tolerance = scenario.metadata.targetDuration * 0.2 // 20% 허용 오차
      
      if (difference > tolerance) {
        warnings.push(
          `예상 지속시간과 대상 지속시간이 20% 이상 차이납니다. ` +
          `(예상: ${scenario.totalDuration}초, 대상: ${scenario.metadata.targetDuration}초)`
        )
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 시나리오 복제
   */
  static clone(scenario: Scenario, newTitle?: string): Scenario {
    const now = new Date()
    
    return {
      ...scenario,
      metadata: {
        ...scenario.metadata,
        id: ScenarioModel.generateId(),
        title: newTitle || `${scenario.metadata.title} (복사본)`,
        createdAt: now,
        updatedAt: now,
        status: 'draft' as ScenarioStatus
      },
      scenes: scenario.scenes.map(scene => ({
        ...scene,
        id: ScenarioModel.generateId()
      }))
    }
  }

  // === Private Helper Methods ===

  /**
   * 전체 지속시간 계산
   */
  private static calculateTotalDuration(scenes: Scene[]): number {
    return scenes.reduce((total, scene) => total + (scene.duration || 0), 0)
  }

  /**
   * 유니크 ID 생성
   */
  private static generateId(): string {
    return `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * 시나리오 도메인 상수
 */
export const SCENARIO_CONSTANTS = {
  MAX_TITLE_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_SCENE_TITLE_LENGTH: 50,
  MAX_SCENE_DESCRIPTION_LENGTH: 1000,
  MAX_SCENES_COUNT: 50,
  DEFAULT_SCENE_DURATION: 30, // 초
  MIN_SCENE_DURATION: 5,
  MAX_SCENE_DURATION: 600 // 10분
} as const
