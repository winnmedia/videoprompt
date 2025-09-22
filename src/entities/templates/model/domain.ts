/**
 * 템플릿 도메인 비즈니스 로직
 *
 * CLAUDE.md 준수사항:
 * - 순수한 도메인 로직 (사이드 이펙트 없음)
 * - 외부 기술 의존성 없음
 * - 불변성 및 타입 안전성 보장
 */

import type {
  ProjectTemplate,
  TemplateStoryStep,
  TemplateShotSequence,
  TemplateSearchFilters,
  TemplateSortOption,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateUsageHistory,
  TemplateReview,
  TemplateMetadata
} from '../types'

/**
 * 템플릿 도메인 서비스
 */
export class TemplateDomain {
  /**
   * 새로운 템플릿 생성
   */
  static createTemplate(request: CreateTemplateRequest): ProjectTemplate {
    const templateId = this.generateTemplateId(request.name)
    const now = new Date()

    // 4단계 스토리 순서 설정
    const storySteps: TemplateStoryStep[] = request.storySteps.map((step, index) => ({
      ...step,
      order: index + 1
    }))

    // 12숏 시퀀스 설정 (각 4단계 스토리당 3개씩)
    const shotSequences: TemplateShotSequence[] = []
    storySteps.forEach((step, stepIndex) => {
      const stepShots = request.shotSequences.slice(stepIndex * 3, (stepIndex + 1) * 3)
      stepShots.forEach((shot, shotIndex) => {
        shotSequences.push({
          ...shot,
          stepId: `step-${step.order}`,
          order: stepIndex * 3 + shotIndex + 1
        })
      })
    })

    const metadata: TemplateMetadata = {
      createdAt: now,
      updatedAt: now,
      version: '1.0.0',
      author: {
        id: 'system',
        name: 'VideoPlanet',
        avatar: '/avatars/system.png'
      },
      usage: {
        downloadCount: 0,
        likeCount: 0,
        viewCount: 0,
        forkCount: 0
      },
      seo: {
        title: request.name,
        description: request.description,
        keywords: [request.category, request.difficulty, ...request.tags || []],
        ogImage: undefined
      }
    }

    return {
      id: templateId,
      name: request.name,
      description: request.description,
      shortDescription: request.shortDescription,
      thumbnailUrl: this.generateThumbnailUrl(templateId),
      category: request.category,
      tags: [],
      difficulty: request.difficulty,
      duration: request.duration,
      estimatedCompletionTime: request.estimatedCompletionTime,
      status: 'draft',
      metadata,
      storySteps,
      shotSequences,
      promptConfig: request.promptConfig,
      assets: [],
      customizableFields: request.customizableFields || [],
      variationSuggestions: request.variationSuggestions || []
    }
  }

  /**
   * 템플릿 업데이트
   */
  static updateTemplate(
    existingTemplate: ProjectTemplate,
    updates: UpdateTemplateRequest
  ): ProjectTemplate {
    const now = new Date()

    return {
      ...existingTemplate,
      name: updates.name ?? existingTemplate.name,
      description: updates.description ?? existingTemplate.description,
      shortDescription: updates.shortDescription ?? existingTemplate.shortDescription,
      category: updates.category ?? existingTemplate.category,
      difficulty: updates.difficulty ?? existingTemplate.difficulty,
      status: updates.status ?? existingTemplate.status,
      storySteps: updates.storySteps ?? existingTemplate.storySteps,
      shotSequences: updates.shotSequences ?? existingTemplate.shotSequences,
      promptConfig: updates.promptConfig ?? existingTemplate.promptConfig,
      tags: updates.tags ?? existingTemplate.tags,
      metadata: {
        ...existingTemplate.metadata,
        updatedAt: now,
        version: this.incrementVersion(existingTemplate.metadata.version)
      }
    }
  }

  /**
   * 템플릿 사용량 업데이트
   */
  static updateTemplateUsage(
    template: ProjectTemplate,
    usageType: 'download' | 'like' | 'view' | 'fork'
  ): ProjectTemplate {
    const updatedUsage = { ...template.metadata.usage }

    switch (usageType) {
      case 'download':
        updatedUsage.downloadCount += 1
        break
      case 'like':
        updatedUsage.likeCount += 1
        break
      case 'view':
        updatedUsage.viewCount += 1
        break
      case 'fork':
        updatedUsage.forkCount += 1
        break
    }

    return {
      ...template,
      metadata: {
        ...template.metadata,
        usage: updatedUsage,
        updatedAt: new Date()
      }
    }
  }

  /**
   * 템플릿 필터링
   */
  static filterTemplates(
    templates: readonly ProjectTemplate[],
    filters: TemplateSearchFilters
  ): ProjectTemplate[] {
    return templates.filter(template => {
      // 카테고리 필터
      if (filters.category && template.category !== filters.category) {
        return false
      }

      // 난이도 필터
      if (filters.difficulty && template.difficulty !== filters.difficulty) {
        return false
      }

      // 길이 필터
      if (filters.duration && template.duration !== filters.duration) {
        return false
      }

      // 태그 필터
      if (filters.tags && filters.tags.length > 0) {
        const templateTagNames = template.tags.map(tag => tag.name)
        const hasMatchingTag = filters.tags.some(filterTag =>
          templateTagNames.includes(filterTag)
        )
        if (!hasMatchingTag) {
          return false
        }
      }

      // 최소 평점 필터 (리뷰 시스템 연동 필요)
      if (filters.minRating && filters.minRating > 0) {
        // 실제로는 리뷰 데이터와 연계해야 함
        // 현재는 사용량 기반으로 임시 계산
        const estimatedRating = this.calculateEstimatedRating(template)
        if (estimatedRating < filters.minRating) {
          return false
        }
      }

      // 인기 템플릿 필터
      if (filters.isPopular) {
        const isPopular = this.isPopularTemplate(template)
        if (!isPopular) {
          return false
        }
      }

      // 추천 템플릿 필터
      if (filters.isFeatured && template.status !== 'featured') {
        return false
      }

      // 미리보기 영상 필터
      if (filters.hasPreview && !template.previewVideoUrl) {
        return false
      }

      return true
    })
  }

  /**
   * 템플릿 정렬
   */
  static sortTemplates(
    templates: readonly ProjectTemplate[],
    sortBy: TemplateSortOption = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): ProjectTemplate[] {
    const sorted = [...templates].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'createdAt':
          comparison = a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime()
          break
        case 'updatedAt':
          comparison = a.metadata.updatedAt.getTime() - b.metadata.updatedAt.getTime()
          break
        case 'downloadCount':
          comparison = a.metadata.usage.downloadCount - b.metadata.usage.downloadCount
          break
        case 'rating':
          const ratingA = this.calculateEstimatedRating(a)
          const ratingB = this.calculateEstimatedRating(b)
          comparison = ratingA - ratingB
          break
        case 'popularity':
          const popularityA = this.calculatePopularityScore(a)
          const popularityB = this.calculatePopularityScore(b)
          comparison = popularityA - popularityB
          break
        case 'difficulty':
          const difficultyOrder = { 'beginner': 1, 'intermediate': 2, 'advanced': 3 }
          comparison = difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return sorted
  }

  /**
   * 템플릿 검색 (텍스트 기반)
   */
  static searchTemplates(
    templates: readonly ProjectTemplate[],
    searchQuery: string
  ): ProjectTemplate[] {
    if (!searchQuery.trim()) {
      return [...templates]
    }

    const query = searchQuery.toLowerCase().trim()

    return templates.filter(template => {
      // 이름 검색
      if (template.name.toLowerCase().includes(query)) {
        return true
      }

      // 설명 검색
      if (template.description.toLowerCase().includes(query) ||
          template.shortDescription.toLowerCase().includes(query)) {
        return true
      }

      // 태그 검색
      const hasMatchingTag = template.tags.some(tag =>
        tag.name.toLowerCase().includes(query)
      )
      if (hasMatchingTag) {
        return true
      }

      // 스토리 내용 검색
      const hasMatchingStory = template.storySteps.some(step =>
        step.title.toLowerCase().includes(query) ||
        step.content.toLowerCase().includes(query)
      )
      if (hasMatchingStory) {
        return true
      }

      // SEO 키워드 검색
      const hasMatchingKeyword = template.metadata.seo.keywords.some(keyword =>
        keyword.toLowerCase().includes(query)
      )
      if (hasMatchingKeyword) {
        return true
      }

      return false
    })
  }

  /**
   * 추천 템플릿 계산
   */
  static getRecommendedTemplates(
    templates: readonly ProjectTemplate[],
    userHistory?: readonly TemplateUsageHistory[],
    limit: number = 6
  ): ProjectTemplate[] {
    // 사용자 히스토리가 있으면 개인화된 추천
    if (userHistory && userHistory.length > 0) {
      return this.getPersonalizedRecommendations(templates, userHistory, limit)
    }

    // 일반적인 추천 (인기도 기반)
    return this.getPopularTemplates(templates, limit)
  }

  /**
   * 개인화된 추천
   */
  static getPersonalizedRecommendations(
    templates: readonly ProjectTemplate[],
    userHistory: readonly TemplateUsageHistory[],
    limit: number
  ): ProjectTemplate[] {
    // 사용자가 사용한 템플릿들의 카테고리/태그 분석
    const usedTemplateIds = new Set(userHistory.map(h => h.templateId))
    const usedTemplates = templates.filter(t => usedTemplateIds.has(t.id))

    // 선호 카테고리 계산
    const categoryPreferences = this.calculateCategoryPreferences(usedTemplates)
    const tagPreferences = this.calculateTagPreferences(usedTemplates)

    // 사용하지 않은 템플릿 중에서 선호도 기반 점수 계산
    const unusedTemplates = templates.filter(t => !usedTemplateIds.has(t.id))

    const scoredTemplates = unusedTemplates.map(template => ({
      template,
      score: this.calculateRecommendationScore(template, categoryPreferences, tagPreferences)
    }))

    return scoredTemplates
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.template)
  }

  /**
   * 인기 템플릿 조회
   */
  static getPopularTemplates(
    templates: readonly ProjectTemplate[],
    limit: number
  ): ProjectTemplate[] {
    return templates
      .filter(template => template.status === 'published' || template.status === 'featured')
      .sort((a, b) => this.calculatePopularityScore(b) - this.calculatePopularityScore(a))
      .slice(0, limit)
  }

  /**
   * 템플릿 유효성 검증
   */
  static validateTemplate(template: ProjectTemplate): string[] {
    const errors: string[] = []

    // 기본 필드 검증
    if (!template.name.trim()) errors.push('Template name is required')
    if (!template.description.trim()) errors.push('Template description is required')
    if (!template.shortDescription.trim()) errors.push('Template short description is required')

    // 스토리 단계 검증
    if (template.storySteps.length !== 4) {
      errors.push('Template must have exactly 4 story steps')
    }

    template.storySteps.forEach((step, index) => {
      if (step.order !== index + 1) {
        errors.push(`Story step ${index + 1} has incorrect order: ${step.order}`)
      }
      if (!step.title.trim()) {
        errors.push(`Story step ${index + 1} is missing title`)
      }
      if (!step.content.trim()) {
        errors.push(`Story step ${index + 1} is missing content`)
      }
      if (step.duration <= 0) {
        errors.push(`Story step ${index + 1} must have positive duration`)
      }
    })

    // 숏 시퀀스 검증
    if (template.shotSequences.length !== 12) {
      errors.push('Template must have exactly 12 shot sequences')
    }

    template.shotSequences.forEach((shot, index) => {
      if (shot.order !== index + 1) {
        errors.push(`Shot sequence ${index + 1} has incorrect order: ${shot.order}`)
      }
      if (!shot.title.trim()) {
        errors.push(`Shot sequence ${index + 1} is missing title`)
      }
      if (!shot.visualPrompt.trim()) {
        errors.push(`Shot sequence ${index + 1} is missing visual prompt`)
      }
    })

    // 프롬프트 설정 검증
    if (!template.promptConfig.basePrompt.trim()) {
      errors.push('Base prompt is required')
    }

    if (!template.promptConfig.qualitySettings.resolution) {
      errors.push('Quality settings resolution is required')
    }

    return errors
  }

  // === Private Helper Methods ===

  private static generateTemplateId(name: string): string {
    const timestamp = Date.now()
    const normalizedName = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    return `template-${normalizedName}-${timestamp}`
  }

  private static generateThumbnailUrl(templateId: string): string {
    return `/templates/thumbnails/${templateId}.jpg`
  }

  private static incrementVersion(version: string): string {
    const parts = version.split('.')
    const patch = parseInt(parts[2] || '0', 10) + 1
    return `${parts[0]}.${parts[1]}.${patch}`
  }

  private static calculateEstimatedRating(template: ProjectTemplate): number {
    const { downloadCount, likeCount, viewCount } = template.metadata.usage

    if (viewCount === 0) return 0

    // 간단한 평점 추정 공식
    const likeRatio = likeCount / Math.max(viewCount, 1)
    const downloadRatio = downloadCount / Math.max(viewCount, 1)

    // 0-5 점 사이로 정규화
    return Math.min(5, (likeRatio * 3 + downloadRatio * 2) * 5)
  }

  private static isPopularTemplate(template: ProjectTemplate): boolean {
    const { downloadCount, viewCount } = template.metadata.usage
    return downloadCount >= 50 || viewCount >= 500
  }

  private static calculatePopularityScore(template: ProjectTemplate): number {
    const { downloadCount, likeCount, viewCount, forkCount } = template.metadata.usage

    // 가중치를 적용한 인기도 계산
    return (
      downloadCount * 5 +
      likeCount * 3 +
      viewCount * 1 +
      forkCount * 10
    )
  }

  private static calculateCategoryPreferences(
    usedTemplates: readonly ProjectTemplate[]
  ): Record<string, number> {
    const preferences: Record<string, number> = {}

    usedTemplates.forEach(template => {
      preferences[template.category] = (preferences[template.category] || 0) + 1
    })

    // 정규화
    const total = usedTemplates.length
    Object.keys(preferences).forEach(category => {
      preferences[category] = preferences[category] / total
    })

    return preferences
  }

  private static calculateTagPreferences(
    usedTemplates: readonly ProjectTemplate[]
  ): Record<string, number> {
    const preferences: Record<string, number> = {}
    let totalTags = 0

    usedTemplates.forEach(template => {
      template.tags.forEach(tag => {
        preferences[tag.name] = (preferences[tag.name] || 0) + 1
        totalTags++
      })
    })

    // 정규화
    Object.keys(preferences).forEach(tag => {
      preferences[tag] = preferences[tag] / totalTags
    })

    return preferences
  }

  private static calculateRecommendationScore(
    template: ProjectTemplate,
    categoryPreferences: Record<string, number>,
    tagPreferences: Record<string, number>
  ): number {
    let score = 0

    // 카테고리 선호도 (50% 가중치)
    const categoryScore = categoryPreferences[template.category] || 0
    score += categoryScore * 0.5

    // 태그 선호도 (30% 가중치)
    const tagScore = template.tags.reduce((acc, tag) => {
      return acc + (tagPreferences[tag.name] || 0)
    }, 0) / Math.max(template.tags.length, 1)
    score += tagScore * 0.3

    // 인기도 (20% 가중치)
    const popularityScore = this.calculatePopularityScore(template) / 1000 // 정규화
    score += Math.min(popularityScore, 1) * 0.2

    return score
  }
}