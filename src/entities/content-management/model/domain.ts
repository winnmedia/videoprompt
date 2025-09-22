/**
 * Content Management Domain Logic
 *
 * CLAUDE.md 준수: entities 레이어 순수 비즈니스 로직
 * 외부 기술 의존성 없는 도메인 모델
 */

import {
  type ContentFilter,
  type ContentSort,
  type ContentValidationResult,
  type ContentValidationError,
  type ContentValidationWarning,
  type ContentCreateInput,
  type ContentUpdateInput,
  type AnyContentItem,
  type ContentMetadata,
  type ContentType,
  type ContentStatus,
  type ContentUsage,
  CONTENT_BUSINESS_RULES,
  ContentManagementError,
  isContentType,
  isContentStatus,
  isContentUsage,
} from '../types'

/**
 * 콘텐츠 관리 도메인 서비스
 * 순수 함수로 구성된 비즈니스 로직
 */
export class ContentManagementDomain {
  /**
   * 콘텐츠 메타데이터 생성
   */
  static createMetadata(input: {
    type: ContentType
    title: string
    description?: string
    tags?: readonly string[]
    projectId?: string
    userId: string
    usage?: ContentUsage
  }): ContentMetadata {
    const now = new Date()

    return {
      id: this.generateContentId(input.type),
      type: input.type,
      status: 'draft',
      usage: input.usage ?? 'instance',
      title: input.title.trim(),
      description: input.description?.trim(),
      tags: input.tags ?? [],
      projectId: input.projectId,
      userId: input.userId,
      parentId: undefined,
      usageCount: 0,
      lastUsedAt: undefined,
      createdAt: now,
      updatedAt: now,
      deletedAt: undefined,
    }
  }

  /**
   * 콘텐츠 ID 생성 (타입별 prefix 적용)
   */
  private static generateContentId(type: ContentType): string {
    const prefixes = {
      scenario: 'scn',
      prompt: 'pmt',
      image: 'img',
      video: 'vid',
    } as const

    const prefix = prefixes[type]
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)

    return `${prefix}_${timestamp}_${random}`
  }

  /**
   * 콘텐츠 체크섬 생성
   */
  static generateChecksum(content: unknown): string {
    const contentStr = JSON.stringify(content)
    // 간단한 해시 함수 (실제로는 crypto 모듈 사용 권장)
    let hash = 0
    for (let i = 0; i < contentStr.length; i++) {
      const char = contentStr.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 32비트 정수로 변환
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * 콘텐츠 검증
   */
  static validateContent<T>(input: ContentCreateInput<T>): ContentValidationResult {
    const errors: ContentValidationError[] = []
    const warnings: ContentValidationWarning[] = []

    // 기본 필드 검증
    this.validateBasicFields(input, errors)

    // 타입별 특화 검증
    this.validateTypeSpecificContent(input, errors, warnings)

    // 비즈니스 규칙 검증
    this.validateBusinessRules(input, errors, warnings)

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * 기본 필드 검증
   */
  private static validateBasicFields<T>(
    input: ContentCreateInput<T>,
    errors: ContentValidationError[]
  ): void {
    // 타입 검증
    if (!isContentType(input.type)) {
      errors.push({
        field: 'type',
        code: 'INVALID_CONTENT_TYPE',
        message: `유효하지 않은 콘텐츠 타입: ${input.type}`,
      })
    }

    // 제목 검증
    if (!input.title || input.title.trim().length === 0) {
      errors.push({
        field: 'title',
        code: 'TITLE_REQUIRED',
        message: '제목은 필수입니다.',
      })
    } else if (input.title.length > CONTENT_BUSINESS_RULES.MAX_TITLE_LENGTH) {
      errors.push({
        field: 'title',
        code: 'TITLE_TOO_LONG',
        message: `제목은 ${CONTENT_BUSINESS_RULES.MAX_TITLE_LENGTH}자를 초과할 수 없습니다.`,
      })
    }

    // 설명 검증
    if (input.description && input.description.length > CONTENT_BUSINESS_RULES.MAX_DESCRIPTION_LENGTH) {
      errors.push({
        field: 'description',
        code: 'DESCRIPTION_TOO_LONG',
        message: `설명은 ${CONTENT_BUSINESS_RULES.MAX_DESCRIPTION_LENGTH}자를 초과할 수 없습니다.`,
      })
    }

    // 태그 검증
    if (input.tags) {
      if (input.tags.length > CONTENT_BUSINESS_RULES.MAX_TAGS_COUNT) {
        errors.push({
          field: 'tags',
          code: 'TOO_MANY_TAGS',
          message: `태그는 최대 ${CONTENT_BUSINESS_RULES.MAX_TAGS_COUNT}개까지 가능합니다.`,
        })
      }

      input.tags.forEach((tag, index) => {
        if (tag.length > CONTENT_BUSINESS_RULES.MAX_TAG_LENGTH) {
          errors.push({
            field: `tags.${index}`,
            code: 'TAG_TOO_LONG',
            message: `태그는 ${CONTENT_BUSINESS_RULES.MAX_TAG_LENGTH}자를 초과할 수 없습니다.`,
          })
        }
      })
    }

    // 사용 용도 검증
    if (input.usage && !isContentUsage(input.usage)) {
      errors.push({
        field: 'usage',
        code: 'INVALID_USAGE',
        message: `유효하지 않은 사용 용도: ${input.usage}`,
      })
    }
  }

  /**
   * 타입별 특화 콘텐츠 검증
   */
  private static validateTypeSpecificContent<T>(
    input: ContentCreateInput<T>,
    errors: ContentValidationError[],
    warnings: ContentValidationWarning[]
  ): void {
    if (!input.content) {
      errors.push({
        field: 'content',
        code: 'CONTENT_REQUIRED',
        message: '콘텐츠가 필요합니다.',
      })
      return
    }

    switch (input.type) {
      case 'scenario':
        this.validateScenarioContent(input.content, errors, warnings)
        break
      case 'prompt':
        this.validatePromptContent(input.content, errors, warnings)
        break
      case 'image':
        this.validateImageContent(input.content, errors, warnings)
        break
      case 'video':
        this.validateVideoContent(input.content, errors, warnings)
        break
    }
  }

  /**
   * 시나리오 콘텐츠 검증
   */
  private static validateScenarioContent(
    content: unknown,
    errors: ContentValidationError[],
    warnings: ContentValidationWarning[]
  ): void {
    if (typeof content !== 'object' || content === null) {
      errors.push({
        field: 'content',
        code: 'INVALID_SCENARIO_CONTENT',
        message: '시나리오 콘텐츠는 객체여야 합니다.',
      })
      return
    }

    const scenario = content as Record<string, unknown>

    if (!scenario.story || typeof scenario.story !== 'string') {
      errors.push({
        field: 'content.story',
        code: 'STORY_REQUIRED',
        message: '스토리는 필수입니다.',
      })
    }

    if (!scenario.scenes || !Array.isArray(scenario.scenes)) {
      warnings.push({
        field: 'content.scenes',
        code: 'SCENES_MISSING',
        message: '씬 정보가 없습니다. 자동으로 생성됩니다.',
      })
    }
  }

  /**
   * 프롬프트 콘텐츠 검증
   */
  private static validatePromptContent(
    content: unknown,
    errors: ContentValidationError[],
    warnings: ContentValidationWarning[]
  ): void {
    if (typeof content !== 'object' || content === null) {
      errors.push({
        field: 'content',
        code: 'INVALID_PROMPT_CONTENT',
        message: '프롬프트 콘텐츠는 객체여야 합니다.',
      })
      return
    }

    const prompt = content as Record<string, unknown>

    if (!prompt.template || typeof prompt.template !== 'string') {
      errors.push({
        field: 'content.template',
        code: 'TEMPLATE_REQUIRED',
        message: '프롬프트 템플릿은 필수입니다.',
      })
    }

    if (!prompt.category || typeof prompt.category !== 'string') {
      warnings.push({
        field: 'content.category',
        code: 'CATEGORY_MISSING',
        message: '카테고리가 지정되지 않았습니다.',
      })
    }
  }

  /**
   * 이미지 콘텐츠 검증
   */
  private static validateImageContent(
    content: unknown,
    errors: ContentValidationError[],
    warnings: ContentValidationWarning[]
  ): void {
    if (typeof content !== 'object' || content === null) {
      errors.push({
        field: 'content',
        code: 'INVALID_IMAGE_CONTENT',
        message: '이미지 콘텐츠는 객체여야 합니다.',
      })
      return
    }

    const image = content as Record<string, unknown>

    if (!image.url || typeof image.url !== 'string') {
      errors.push({
        field: 'content.url',
        code: 'IMAGE_URL_REQUIRED',
        message: '이미지 URL은 필수입니다.',
      })
    }

    if (!image.prompt || typeof image.prompt !== 'string') {
      warnings.push({
        field: 'content.prompt',
        code: 'PROMPT_MISSING',
        message: '생성 프롬프트가 없습니다.',
      })
    }

    if (image.format && !CONTENT_BUSINESS_RULES.ALLOWED_IMAGE_FORMATS.includes(image.format as any)) {
      errors.push({
        field: 'content.format',
        code: 'INVALID_IMAGE_FORMAT',
        message: `지원하지 않는 이미지 형식: ${image.format}`,
      })
    }
  }

  /**
   * 비디오 콘텐츠 검증
   */
  private static validateVideoContent(
    content: unknown,
    errors: ContentValidationError[],
    warnings: ContentValidationWarning[]
  ): void {
    if (typeof content !== 'object' || content === null) {
      errors.push({
        field: 'content',
        code: 'INVALID_VIDEO_CONTENT',
        message: '비디오 콘텐츠는 객체여야 합니다.',
      })
      return
    }

    const video = content as Record<string, unknown>

    if (!video.url || typeof video.url !== 'string') {
      errors.push({
        field: 'content.url',
        code: 'VIDEO_URL_REQUIRED',
        message: '비디오 URL은 필수입니다.',
      })
    }

    if (video.format && !CONTENT_BUSINESS_RULES.ALLOWED_VIDEO_FORMATS.includes(video.format as any)) {
      errors.push({
        field: 'content.format',
        code: 'INVALID_VIDEO_FORMAT',
        message: `지원하지 않는 비디오 형식: ${video.format}`,
      })
    }

    if (typeof video.duration === 'number' && video.duration <= 0) {
      errors.push({
        field: 'content.duration',
        code: 'INVALID_DURATION',
        message: '비디오 재생 시간은 0보다 커야 합니다.',
      })
    }
  }

  /**
   * 비즈니스 규칙 검증
   */
  private static validateBusinessRules<T>(
    input: ContentCreateInput<T>,
    errors: ContentValidationError[],
    warnings: ContentValidationWarning[]
  ): void {
    // 해상도 검증 (이미지/비디오)
    if (input.type === 'image' || input.type === 'video') {
      const content = input.content as any
      if (content?.resolution) {
        const { width, height } = content.resolution
        const { MIN_RESOLUTION, MAX_RESOLUTION } = CONTENT_BUSINESS_RULES

        if (width < MIN_RESOLUTION.width || height < MIN_RESOLUTION.height) {
          errors.push({
            field: 'content.resolution',
            code: 'RESOLUTION_TOO_SMALL',
            message: `해상도가 너무 작습니다. 최소: ${MIN_RESOLUTION.width}x${MIN_RESOLUTION.height}`,
          })
        }

        if (width > MAX_RESOLUTION.width || height > MAX_RESOLUTION.height) {
          errors.push({
            field: 'content.resolution',
            code: 'RESOLUTION_TOO_LARGE',
            message: `해상도가 너무 큽니다. 최대: ${MAX_RESOLUTION.width}x${MAX_RESOLUTION.height}`,
          })
        }
      }
    }

    // 파일 크기 검증
    if (input.type === 'image' || input.type === 'video') {
      const content = input.content as any
      if (content?.fileSize) {
        const fileSizeMB = content.fileSize / (1024 * 1024)
        if (fileSizeMB > CONTENT_BUSINESS_RULES.MAX_CONTENT_SIZE_MB) {
          errors.push({
            field: 'content.fileSize',
            code: 'FILE_TOO_LARGE',
            message: `파일 크기가 너무 큽니다. 최대: ${CONTENT_BUSINESS_RULES.MAX_CONTENT_SIZE_MB}MB`,
          })
        }
      }
    }
  }

  /**
   * 콘텐츠 업데이트 검증
   */
  static validateUpdate<T>(
    current: AnyContentItem,
    updates: ContentUpdateInput<T>
  ): ContentValidationResult {
    const errors: ContentValidationError[] = []
    const warnings: ContentValidationWarning[] = []

    // 상태 변경 검증
    if (updates.status && !isContentStatus(updates.status)) {
      errors.push({
        field: 'status',
        code: 'INVALID_STATUS',
        message: `유효하지 않은 상태: ${updates.status}`,
      })
    }

    // 상태 전환 규칙 검증
    if (updates.status) {
      this.validateStatusTransition(current.metadata.status, updates.status, errors)
    }

    // 제목 길이 검증
    if (updates.title !== undefined) {
      if (updates.title.length === 0) {
        errors.push({
          field: 'title',
          code: 'TITLE_REQUIRED',
          message: '제목은 필수입니다.',
        })
      } else if (updates.title.length > CONTENT_BUSINESS_RULES.MAX_TITLE_LENGTH) {
        errors.push({
          field: 'title',
          code: 'TITLE_TOO_LONG',
          message: `제목은 ${CONTENT_BUSINESS_RULES.MAX_TITLE_LENGTH}자를 초과할 수 없습니다.`,
        })
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * 상태 전환 규칙 검증
   */
  private static validateStatusTransition(
    currentStatus: ContentStatus,
    newStatus: ContentStatus,
    errors: ContentValidationError[]
  ): void {
    const allowedTransitions: Record<ContentStatus, ContentStatus[]> = {
      draft: ['active', 'archived', 'deleted'],
      active: ['archived', 'deleted'],
      archived: ['active', 'deleted'],
      processing: ['active', 'failed', 'deleted'],
      failed: ['processing', 'deleted'],
      deleted: [], // 삭제된 콘텐츠는 복원 불가
    }

    const allowed = allowedTransitions[currentStatus] || []
    if (!allowed.includes(newStatus)) {
      errors.push({
        field: 'status',
        code: 'INVALID_STATUS_TRANSITION',
        message: `'${currentStatus}'에서 '${newStatus}'로 변경할 수 없습니다.`,
      })
    }
  }

  /**
   * 콘텐츠 사용 증가
   */
  static incrementUsage(item: AnyContentItem): ContentMetadata {
    return {
      ...item.metadata,
      usageCount: item.metadata.usageCount + 1,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    }
  }

  /**
   * 콘텐츠 변형 생성 (파생 콘텐츠)
   */
  static createVariation<T>(
    original: ContentItem<T>,
    modifications: Partial<T>,
    userId: string
  ): ContentMetadata {
    const now = new Date()

    return {
      ...original.metadata,
      id: this.generateContentId(original.metadata.type),
      parentId: original.metadata.id,
      usage: 'variation',
      usageCount: 0,
      lastUsedAt: undefined,
      createdAt: now,
      updatedAt: now,
    }
  }
}