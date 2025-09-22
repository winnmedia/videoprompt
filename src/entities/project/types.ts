/**
 * Project Entity Types
 *
 * CLAUDE.md 준수: TypeScript 5.x, 도메인 순수성 (entities)
 * 시나리오와 연동되는 프로젝트 도메인 타입 정의
 */

/**
 * 프로젝트 상태
 */
export type ProjectStatus =
  | 'draft'       // 초안
  | 'planning'    // 기획 중
  | 'production'  // 제작 중
  | 'review'      // 검토 중
  | 'completed'   // 완료
  | 'archived'    // 보관됨

/**
 * 프로젝트 우선순위
 */
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * 프로젝트 메타데이터
 */
export interface ProjectMetadata {
  id: string
  title: string
  description?: string
  createdAt: Date
  updatedAt: Date
  version: string
  tags: string[]
  author: string
  collaborators?: string[]
}

/**
 * 프로젝트 설정
 */
export interface ProjectSettings {
  // 기본 설정
  status: ProjectStatus
  priority: ProjectPriority
  dueDate?: Date
  estimatedDuration: number // 분 단위

  // 미디어 설정
  targetFormat: 'video' | 'audio' | 'interactive'
  resolution?: '720p' | '1080p' | '4k'
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3'

  // 워크플로우 설정
  autoSave: boolean
  versionControl: boolean
  approvalRequired: boolean
}

/**
 * 프로젝트 리소스
 */
export interface ProjectResources {
  // 연결된 시나리오들
  scenarioIds: string[]

  // 미디어 에셋
  videoAssets: string[]
  audioAssets: string[]
  imageAssets: string[]

  // 외부 참조
  referenceLinks: string[]
  documents: string[]
}

/**
 * 프로젝트 진행 상황
 */
export interface ProjectProgress {
  completedTasks: number
  totalTasks: number
  completionPercentage: number

  // 단계별 진행률
  planning: number    // 0-100
  production: number  // 0-100
  review: number      // 0-100

  // 마일스톤
  milestones: {
    name: string
    completed: boolean
    completedAt?: Date
    description?: string
  }[]
}

/**
 * 프로젝트 엔티티
 */
export interface Project {
  metadata: ProjectMetadata
  settings: ProjectSettings
  resources: ProjectResources
  progress: ProjectProgress
}

/**
 * 프로젝트 생성 입력
 */
export interface ProjectCreateInput {
  title: string
  description?: string
  tags?: string[]
  author: string
  collaborators?: string[]

  // 초기 설정
  priority?: ProjectPriority
  dueDate?: Date
  estimatedDuration?: number
  targetFormat?: 'video' | 'audio' | 'interactive'

  // 옵션
  autoSave?: boolean
  versionControl?: boolean
}

/**
 * 프로젝트 업데이트 입력
 */
export interface ProjectUpdateInput {
  metadata?: Partial<ProjectMetadata>
  settings?: Partial<ProjectSettings>
  resources?: Partial<ProjectResources>
  progress?: Partial<ProjectProgress>
}

/**
 * 프로젝트 필터
 */
export interface ProjectFilter {
  status?: ProjectStatus[]
  priority?: ProjectPriority[]
  author?: string
  tags?: string[]
  dateRange?: {
    from: Date
    to: Date
  }
  hasScenarios?: boolean
}

/**
 * 프로젝트 정렬 옵션
 */
export type ProjectSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'dueDate'
  | 'priority'
  | 'progress'
  | 'title'

export interface ProjectSortOptions {
  sortBy: ProjectSortBy
  order: 'asc' | 'desc'
}

/**
 * 프로젝트 검증 결과
 */
export interface ProjectValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * 프로젝트-시나리오 연결 정보
 */
export interface ProjectScenarioLink {
  projectId: string
  scenarioId: string
  order: number
  role: 'primary' | 'reference' | 'template'
  linkedAt: Date
}