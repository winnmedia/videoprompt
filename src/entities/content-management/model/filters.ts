/**
 * Content Management Filtering & Sorting Logic
 *
 * CLAUDE.md 준수: entities 레이어 순수 비즈니스 로직
 * 필터링, 정렬, 검색 도메인 로직
 */

import {
  type ContentFilter,
  type ContentSort,
  type AnyContentItem,
  type ContentType,
  type ContentStatus,
  type ContentUsage,
  CONTENT_CONSTANTS,
} from '../types'

/**
 * 콘텐츠 필터링 및 정렬 도메인 서비스
 */
export class ContentFilteringDomain {
  /**
   * 콘텐츠 아이템 필터링
   */
  static filterContent(
    items: readonly AnyContentItem[],
    filter: ContentFilter
  ): AnyContentItem[] {
    return items.filter(item => this.matchesFilter(item, filter))
  }

  /**
   * 단일 아이템이 필터와 매치되는지 확인
   */
  private static matchesFilter(item: AnyContentItem, filter: ContentFilter): boolean {
    // 타입 필터
    if (filter.types && filter.types.length > 0) {
      if (!filter.types.includes(item.metadata.type)) {
        return false
      }
    }

    // 상태 필터
    if (filter.statuses && filter.statuses.length > 0) {
      if (!filter.statuses.includes(item.metadata.status)) {
        return false
      }
    }

    // 사용 용도 필터
    if (filter.usages && filter.usages.length > 0) {
      if (!filter.usages.includes(item.metadata.usage)) {
        return false
      }
    }

    // 프로젝트 ID 필터
    if (filter.projectIds && filter.projectIds.length > 0) {
      if (!item.metadata.projectId || !filter.projectIds.includes(item.metadata.projectId)) {
        return false
      }
    }

    // 사용자 ID 필터
    if (filter.userId) {
      if (item.metadata.userId !== filter.userId) {
        return false
      }
    }

    // 태그 필터 (OR 조건: 하나라도 매치되면 통과)
    if (filter.tags && filter.tags.length > 0) {
      const hasMatchingTag = filter.tags.some(filterTag =>
        item.metadata.tags.some(itemTag =>
          itemTag.toLowerCase().includes(filterTag.toLowerCase())
        )
      )
      if (!hasMatchingTag) {
        return false
      }
    }

    // 날짜 범위 필터
    if (filter.dateRange) {
      const { from, to } = filter.dateRange
      const createdAt = item.metadata.createdAt

      if (createdAt < from || createdAt > to) {
        return false
      }
    }

    // 텍스트 검색 필터
    if (filter.searchText) {
      if (!this.matchesSearchText(item, filter.searchText)) {
        return false
      }
    }

    return true
  }

  /**
   * 텍스트 검색 매칭
   */
  private static matchesSearchText(item: AnyContentItem, searchText: string): boolean {
    const searchLower = searchText.toLowerCase()
    const metadata = item.metadata

    // 제목에서 검색
    if (metadata.title.toLowerCase().includes(searchLower)) {
      return true
    }

    // 설명에서 검색
    if (metadata.description?.toLowerCase().includes(searchLower)) {
      return true
    }

    // 태그에서 검색
    if (metadata.tags.some(tag => tag.toLowerCase().includes(searchLower))) {
      return true
    }

    // 콘텐츠별 특화 검색
    return this.searchInContent(item, searchLower)
  }

  /**
   * 콘텐츠별 특화 검색
   */
  private static searchInContent(item: AnyContentItem, searchText: string): boolean {
    switch (item.metadata.type) {
      case 'scenario':
        return this.searchInScenarioContent(item as any, searchText)
      case 'prompt':
        return this.searchInPromptContent(item as any, searchText)
      case 'image':
        return this.searchInImageContent(item as any, searchText)
      case 'video':
        return this.searchInVideoContent(item as any, searchText)
      default:
        return false
    }
  }

  /**
   * 시나리오 콘텐츠 내 검색
   */
  private static searchInScenarioContent(
    item: { content: { story?: string; scenes?: Array<{ description?: string }> } },
    searchText: string
  ): boolean {
    // 스토리 텍스트 검색
    if (item.content.story?.toLowerCase().includes(searchText)) {
      return true
    }

    // 씬 설명 검색
    if (item.content.scenes?.some(scene =>
      scene.description?.toLowerCase().includes(searchText)
    )) {
      return true
    }

    return false
  }

  /**
   * 프롬프트 콘텐츠 내 검색
   */
  private static searchInPromptContent(
    item: { content: { template?: string; instructions?: string } },
    searchText: string
  ): boolean {
    // 템플릿 텍스트 검색
    if (item.content.template?.toLowerCase().includes(searchText)) {
      return true
    }

    // 지시사항 검색
    if (item.content.instructions?.toLowerCase().includes(searchText)) {
      return true
    }

    return false
  }

  /**
   * 이미지 콘텐츠 내 검색
   */
  private static searchInImageContent(
    item: { content: { prompt?: string; style?: string } },
    searchText: string
  ): boolean {
    // 생성 프롬프트 검색
    if (item.content.prompt?.toLowerCase().includes(searchText)) {
      return true
    }

    // 스타일 검색
    if (item.content.style?.toLowerCase().includes(searchText)) {
      return true
    }

    return false
  }

  /**
   * 비디오 콘텐츠 내 검색
   */
  private static searchInVideoContent(
    item: { content: { prompt?: string; provider?: string } },
    searchText: string
  ): boolean {
    // 생성 프롬프트 검색
    if (item.content.prompt?.toLowerCase().includes(searchText)) {
      return true
    }

    // 제공자 검색
    if (item.content.provider?.toLowerCase().includes(searchText)) {
      return true
    }

    return false
  }

  /**
   * 콘텐츠 정렬
   */
  static sortContent(
    items: readonly AnyContentItem[],
    sort: ContentSort
  ): AnyContentItem[] {
    const sortedItems = [...items]

    sortedItems.sort((a, b) => {
      const comparison = this.compareItems(a, b, sort.field)
      return sort.direction === 'asc' ? comparison : -comparison
    })

    return sortedItems
  }

  /**
   * 두 아이템 비교
   */
  private static compareItems(
    a: AnyContentItem,
    b: AnyContentItem,
    field: ContentSort['field']
  ): number {
    switch (field) {
      case 'createdAt':
        return a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime()

      case 'updatedAt':
        return a.metadata.updatedAt.getTime() - b.metadata.updatedAt.getTime()

      case 'lastUsedAt':
        const aLastUsed = a.metadata.lastUsedAt?.getTime() ?? 0
        const bLastUsed = b.metadata.lastUsedAt?.getTime() ?? 0
        return aLastUsed - bLastUsed

      case 'usageCount':
        return a.metadata.usageCount - b.metadata.usageCount

      case 'title':
        return a.metadata.title.localeCompare(b.metadata.title, 'ko-KR')

      case 'type':
        return a.metadata.type.localeCompare(b.metadata.type)

      case 'status':
        return a.metadata.status.localeCompare(b.metadata.status)

      default:
        return 0
    }
  }

  /**
   * 기본 필터 생성
   */
  static createDefaultFilter(overrides: Partial<ContentFilter> = {}): ContentFilter {
    return {
      types: undefined,
      statuses: ['draft', 'active'], // 기본적으로 삭제된 항목 제외
      usages: undefined,
      tags: undefined,
      projectIds: undefined,
      userId: undefined,
      dateRange: undefined,
      searchText: undefined,
      ...overrides,
    }
  }

  /**
   * 기본 정렬 생성
   */
  static createDefaultSort(overrides: Partial<ContentSort> = {}): ContentSort {
    return {
      ...CONTENT_CONSTANTS.DEFAULT_SORT,
      ...overrides,
    }
  }

  /**
   * 타입별 필터 생성
   */
  static createTypeFilter(types: ContentType[]): ContentFilter {
    return this.createDefaultFilter({ types })
  }

  /**
   * 프로젝트별 필터 생성
   */
  static createProjectFilter(projectId: string): ContentFilter {
    return this.createDefaultFilter({ projectIds: [projectId] })
  }

  /**
   * 사용자별 필터 생성
   */
  static createUserFilter(userId: string): ContentFilter {
    return this.createDefaultFilter({ userId })
  }

  /**
   * 검색 필터 생성
   */
  static createSearchFilter(searchText: string): ContentFilter {
    return this.createDefaultFilter({ searchText })
  }

  /**
   * 날짜 범위 필터 생성
   */
  static createDateRangeFilter(from: Date, to: Date): ContentFilter {
    return this.createDefaultFilter({
      dateRange: { from, to }
    })
  }

  /**
   * 최근 항목 필터 생성 (지난 N일)
   */
  static createRecentFilter(days: number): ContentFilter {
    const to = new Date()
    const from = new Date(to.getTime() - (days * 24 * 60 * 60 * 1000))

    return this.createDateRangeFilter(from, to)
  }

  /**
   * 자주 사용된 항목 필터 생성
   */
  static createPopularFilter(minUsageCount: number = 1): ContentFilter {
    // 이 함수는 실제로는 추가 로직이 필요하지만,
    // 필터 조합의 예시로 제공
    return this.createDefaultFilter({
      statuses: ['active']
    })
  }

  /**
   * 복합 필터 조합
   */
  static combineFilters(filters: ContentFilter[]): ContentFilter {
    const combined: ContentFilter = {}

    filters.forEach(filter => {
      // 배열 필드들은 합집합으로 처리
      if (filter.types) {
        combined.types = [...(combined.types || []), ...filter.types]
      }
      if (filter.statuses) {
        combined.statuses = [...(combined.statuses || []), ...filter.statuses]
      }
      if (filter.usages) {
        combined.usages = [...(combined.usages || []), ...filter.usages]
      }
      if (filter.tags) {
        combined.tags = [...(combined.tags || []), ...filter.tags]
      }
      if (filter.projectIds) {
        combined.projectIds = [...(combined.projectIds || []), ...filter.projectIds]
      }

      // 단일 값 필드들은 마지막 값 우선
      if (filter.userId) combined.userId = filter.userId
      if (filter.searchText) combined.searchText = filter.searchText
      if (filter.dateRange) combined.dateRange = filter.dateRange
    })

    // 중복 제거
    if (combined.types) combined.types = [...new Set(combined.types)]
    if (combined.statuses) combined.statuses = [...new Set(combined.statuses)]
    if (combined.usages) combined.usages = [...new Set(combined.usages)]
    if (combined.tags) combined.tags = [...new Set(combined.tags)]
    if (combined.projectIds) combined.projectIds = [...new Set(combined.projectIds)]

    return combined
  }
}