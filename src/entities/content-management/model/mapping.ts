/**
 * Content Management Mapping Service
 *
 * CLAUDE.md 준수: entities 레이어 매핑 어댑터
 * 기존 엔티티(scenario, video, prompt)를 ContentItem으로 변환
 * FSD 원칙: 크로스 레퍼런스 방지, 인터페이스 기반 매핑
 */

import {
  type ContentItem,
  type ScenarioContentItem,
  type PromptContentItem,
  type ImageContentItem,
  type VideoContentItem,
  type ScenarioContent,
  type PromptContent,
  type ImageContent,
  type VideoContent,
  type AnyContentItem,
  ContentManagementError,
} from '../types'
import { ContentManagementDomain } from './domain'

// === 외부 엔티티 인터페이스 정의 ===
// FSD 원칙: 직접 import 대신 인터페이스로 계약 정의

/**
 * 기존 Scenario 엔티티 인터페이스 (최소 계약)
 */
interface ExternalScenario {
  readonly id?: string
  readonly title: string
  readonly description?: string
  readonly story: string
  readonly scenes?: readonly Array<{
    readonly id: string
    readonly description: string
    readonly duration?: number
    readonly characters?: readonly string[]
  }>
  readonly tone?: string
  readonly genre?: string
  readonly duration?: number
  readonly characterCount?: number
  readonly projectId?: string
  readonly userId: string
  readonly createdAt?: Date
  readonly updatedAt?: Date
  readonly tags?: readonly string[]
}

/**
 * 기존 Video 엔티티 인터페이스 (최소 계약)
 */
interface ExternalVideo {
  readonly id?: string
  readonly title?: string
  readonly description?: string
  readonly url: string
  readonly thumbnailUrl?: string
  readonly prompt?: string
  readonly duration?: number
  readonly resolution?: { width: number; height: number }
  readonly fileSize?: number
  readonly format?: string
  readonly provider?: string
  readonly projectId?: string
  readonly userId: string
  readonly createdAt?: Date
  readonly updatedAt?: Date
  readonly status?: string
  readonly tags?: readonly string[]
}

/**
 * 기존 Prompt 엔티티 인터페이스 (최소 계약)
 */
interface ExternalPrompt {
  readonly id?: string
  readonly title: string
  readonly description?: string
  readonly template: string
  readonly variables?: Record<string, string>
  readonly category?: string
  readonly instructions?: string
  readonly examples?: readonly string[]
  readonly projectId?: string
  readonly userId: string
  readonly createdAt?: Date
  readonly updatedAt?: Date
  readonly tags?: readonly string[]
}

/**
 * 콘텐츠 매핑 서비스
 * 기존 엔티티들을 ContentItem으로 양방향 변환
 */
export class ContentMappingService {
  /**
   * Scenario 엔티티를 ScenarioContentItem으로 변환
   */
  static fromScenario(scenario: ExternalScenario): ScenarioContentItem {
    try {
      const metadata = ContentManagementDomain.createMetadata({
        type: 'scenario',
        title: scenario.title,
        description: scenario.description,
        tags: scenario.tags,
        projectId: scenario.projectId,
        userId: scenario.userId,
        usage: 'instance',
      })

      // ID가 있으면 기존 메타데이터 덮어쓰기
      if (scenario.id) {
        (metadata as any).id = scenario.id
      }
      if (scenario.createdAt) {
        (metadata as any).createdAt = scenario.createdAt
      }
      if (scenario.updatedAt) {
        (metadata as any).updatedAt = scenario.updatedAt
      }

      const content: ScenarioContent = {
        story: scenario.story,
        scenes: scenario.scenes || [],
        tone: scenario.tone,
        genre: scenario.genre,
        duration: scenario.duration,
        characterCount: scenario.characterCount,
      }

      return {
        metadata,
        content,
        version: 1,
        checksum: ContentManagementDomain.generateChecksum(content),
      }
    } catch (error) {
      throw new ContentManagementError(
        'SCENARIO_MAPPING_ERROR',
        `시나리오 매핑 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { scenario }
      )
    }
  }

  /**
   * Video 엔티티를 VideoContentItem으로 변환
   */
  static fromVideo(video: ExternalVideo): VideoContentItem {
    try {
      const metadata = ContentManagementDomain.createMetadata({
        type: 'video',
        title: video.title || '제목 없음',
        description: video.description,
        tags: video.tags,
        projectId: video.projectId,
        userId: video.userId,
        usage: 'instance',
      })

      // ID와 날짜 정보 복원
      if (video.id) {
        (metadata as any).id = video.id
      }
      if (video.createdAt) {
        (metadata as any).createdAt = video.createdAt
      }
      if (video.updatedAt) {
        (metadata as any).updatedAt = video.updatedAt
      }

      // 상태 매핑
      if (video.status) {
        (metadata as any).status = this.mapVideoStatusToContentStatus(video.status)
      }

      const content: VideoContent = {
        url: video.url,
        thumbnailUrl: video.thumbnailUrl,
        prompt: video.prompt || '',
        duration: video.duration || 0,
        resolution: video.resolution || { width: 1920, height: 1080 },
        fileSize: video.fileSize || 0,
        format: (video.format as any) || 'mp4',
        provider: (video.provider as any) || 'custom',
      }

      return {
        metadata,
        content,
        version: 1,
        checksum: ContentManagementDomain.generateChecksum(content),
      }
    } catch (error) {
      throw new ContentManagementError(
        'VIDEO_MAPPING_ERROR',
        `비디오 매핑 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { video }
      )
    }
  }

  /**
   * Prompt 엔티티를 PromptContentItem으로 변환
   */
  static fromPrompt(prompt: ExternalPrompt): PromptContentItem {
    try {
      const metadata = ContentManagementDomain.createMetadata({
        type: 'prompt',
        title: prompt.title,
        description: prompt.description,
        tags: prompt.tags,
        projectId: prompt.projectId,
        userId: prompt.userId,
        usage: 'template', // 프롬프트는 기본적으로 템플릿
      })

      // ID와 날짜 정보 복원
      if (prompt.id) {
        (metadata as any).id = prompt.id
      }
      if (prompt.createdAt) {
        (metadata as any).createdAt = prompt.createdAt
      }
      if (prompt.updatedAt) {
        (metadata as any).updatedAt = prompt.updatedAt
      }

      const content: PromptContent = {
        template: prompt.template,
        variables: prompt.variables || {},
        category: (prompt.category as any) || 'custom',
        instructions: prompt.instructions,
        examples: prompt.examples,
      }

      return {
        metadata,
        content,
        version: 1,
        checksum: ContentManagementDomain.generateChecksum(content),
      }
    } catch (error) {
      throw new ContentManagementError(
        'PROMPT_MAPPING_ERROR',
        `프롬프트 매핑 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { prompt }
      )
    }
  }

  /**
   * ScenarioContentItem을 외부 Scenario 형식으로 변환
   */
  static toScenario(item: ScenarioContentItem): ExternalScenario {
    try {
      return {
        id: item.metadata.id,
        title: item.metadata.title,
        description: item.metadata.description,
        story: item.content.story,
        scenes: item.content.scenes,
        tone: item.content.tone,
        genre: item.content.genre,
        duration: item.content.duration,
        characterCount: item.content.characterCount,
        projectId: item.metadata.projectId,
        userId: item.metadata.userId,
        createdAt: item.metadata.createdAt,
        updatedAt: item.metadata.updatedAt,
        tags: item.metadata.tags,
      }
    } catch (error) {
      throw new ContentManagementError(
        'SCENARIO_REVERSE_MAPPING_ERROR',
        `시나리오 역매핑 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { item }
      )
    }
  }

  /**
   * VideoContentItem을 외부 Video 형식으로 변환
   */
  static toVideo(item: VideoContentItem): ExternalVideo {
    try {
      return {
        id: item.metadata.id,
        title: item.metadata.title,
        description: item.metadata.description,
        url: item.content.url,
        thumbnailUrl: item.content.thumbnailUrl,
        prompt: item.content.prompt,
        duration: item.content.duration,
        resolution: item.content.resolution,
        fileSize: item.content.fileSize,
        format: item.content.format,
        provider: item.content.provider,
        projectId: item.metadata.projectId,
        userId: item.metadata.userId,
        createdAt: item.metadata.createdAt,
        updatedAt: item.metadata.updatedAt,
        status: this.mapContentStatusToVideoStatus(item.metadata.status),
        tags: item.metadata.tags,
      }
    } catch (error) {
      throw new ContentManagementError(
        'VIDEO_REVERSE_MAPPING_ERROR',
        `비디오 역매핑 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { item }
      )
    }
  }

  /**
   * PromptContentItem을 외부 Prompt 형식으로 변환
   */
  static toPrompt(item: PromptContentItem): ExternalPrompt {
    try {
      return {
        id: item.metadata.id,
        title: item.metadata.title,
        description: item.metadata.description,
        template: item.content.template,
        variables: item.content.variables,
        category: item.content.category,
        instructions: item.content.instructions,
        examples: item.content.examples,
        projectId: item.metadata.projectId,
        userId: item.metadata.userId,
        createdAt: item.metadata.createdAt,
        updatedAt: item.metadata.updatedAt,
        tags: item.metadata.tags,
      }
    } catch (error) {
      throw new ContentManagementError(
        'PROMPT_REVERSE_MAPPING_ERROR',
        `프롬프트 역매핑 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { item }
      )
    }
  }

  /**
   * 여러 외부 엔티티를 ContentItem 목록으로 변환
   */
  static fromMixedEntities(entities: {
    scenarios?: ExternalScenario[]
    videos?: ExternalVideo[]
    prompts?: ExternalPrompt[]
  }): AnyContentItem[] {
    const contentItems: AnyContentItem[] = []

    try {
      // 시나리오 변환
      if (entities.scenarios) {
        const scenarioItems = entities.scenarios.map(scenario =>
          this.fromScenario(scenario)
        )
        contentItems.push(...scenarioItems)
      }

      // 비디오 변환
      if (entities.videos) {
        const videoItems = entities.videos.map(video =>
          this.fromVideo(video)
        )
        contentItems.push(...videoItems)
      }

      // 프롬프트 변환
      if (entities.prompts) {
        const promptItems = entities.prompts.map(prompt =>
          this.fromPrompt(prompt)
        )
        contentItems.push(...promptItems)
      }

      return contentItems
    } catch (error) {
      throw new ContentManagementError(
        'MIXED_ENTITIES_MAPPING_ERROR',
        `혼합 엔티티 매핑 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { entities }
      )
    }
  }

  /**
   * ContentItem 목록을 타입별로 분리하여 외부 엔티티로 변환
   */
  static toMixedEntities(items: AnyContentItem[]): {
    scenarios: ExternalScenario[]
    videos: ExternalVideo[]
    prompts: ExternalPrompt[]
  } {
    try {
      const scenarios: ExternalScenario[] = []
      const videos: ExternalVideo[] = []
      const prompts: ExternalPrompt[] = []

      items.forEach(item => {
        switch (item.metadata.type) {
          case 'scenario':
            scenarios.push(this.toScenario(item as ScenarioContentItem))
            break
          case 'video':
            videos.push(this.toVideo(item as VideoContentItem))
            break
          case 'prompt':
            prompts.push(this.toPrompt(item as PromptContentItem))
            break
          case 'image':
            // 이미지는 아직 외부 엔티티가 없으므로 스킵
            break
        }
      })

      return { scenarios, videos, prompts }
    } catch (error) {
      throw new ContentManagementError(
        'MIXED_ENTITIES_REVERSE_MAPPING_ERROR',
        `혼합 엔티티 역매핑 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { items }
      )
    }
  }

  // === 상태 매핑 헬퍼 메서드 ===

  /**
   * 비디오 상태를 콘텐츠 상태로 매핑
   */
  private static mapVideoStatusToContentStatus(videoStatus: string) {
    const statusMap: Record<string, any> = {
      'pending': 'processing',
      'processing': 'processing',
      'completed': 'active',
      'failed': 'failed',
      'draft': 'draft',
    }

    return statusMap[videoStatus] || 'draft'
  }

  /**
   * 콘텐츠 상태를 비디오 상태로 매핑
   */
  private static mapContentStatusToVideoStatus(contentStatus: string): string {
    const statusMap: Record<string, string> = {
      'draft': 'draft',
      'processing': 'processing',
      'active': 'completed',
      'failed': 'failed',
      'archived': 'completed',
      'deleted': 'failed',
    }

    return statusMap[contentStatus] || 'draft'
  }

  /**
   * 콘텐츠 항목 타입 안전 확인
   */
  static validateContentItem(item: unknown): item is AnyContentItem {
    if (!item || typeof item !== 'object') {
      return false
    }

    const obj = item as any

    // 필수 필드 확인
    if (!obj.metadata || !obj.content || !obj.version || !obj.checksum) {
      return false
    }

    // 메타데이터 타입 확인
    const metadata = obj.metadata
    if (!metadata.id || !metadata.type || !metadata.title || !metadata.userId) {
      return false
    }

    // 타입별 콘텐츠 구조 확인
    switch (metadata.type) {
      case 'scenario':
        return typeof obj.content.story === 'string'
      case 'prompt':
        return typeof obj.content.template === 'string'
      case 'image':
        return typeof obj.content.url === 'string'
      case 'video':
        return typeof obj.content.url === 'string'
      default:
        return false
    }
  }
}