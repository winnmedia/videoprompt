/**
 * Storyboard Widgets Public API
 *
 * CLAUDE.md FSD 규칙 준수: 모든 스토리보드 위젯 컴포넌트는 이 Public API를 통해서만 접근 가능
 * 스토리보드 이미지 생성 및 관리를 위한 UI 컴포넌트들을 제공합니다.
 * WCAG 2.1 AA 준수, 드래그앤드롭, 접근성, 반응형 디자인 포함
 */

// StoryboardGenerator - 12개 숏트 기반 스토리보드 생성 UI
export { StoryboardGenerator } from './StoryboardGenerator'
export type {
  StoryboardGeneratorProps,
  StoryboardGenerationRequest
} from './StoryboardGenerator'

// StoryboardGrid - 4x3 그리드 레이아웃으로 생성된 스토리보드 표시
export { StoryboardGrid } from './StoryboardGrid'
export type {
  StoryboardGridProps,
  StoryboardImage
} from './StoryboardGrid'

// ConsistencyControls - 스토리보드 일관성 설정 컨트롤
export { ConsistencyControls } from './ConsistencyControls'
export type {
  ConsistencyControlsProps,
  ConsistencySettings
} from './ConsistencyControls'

/**
 * FSD 아키텍처 배치 다이어그램:
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    widgets/storyboard                       │
 * │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
 * │  │StoryboardGenera │ │ StoryboardGrid  │ │ConsistencyContr │ │
 * │  │tor              │ │                 │ │ols              │ │
 * │  │                 │ │                 │ │                 │ │
 * │  │• 12개 숏트 설정  │ │• 4x3 그리드     │ │• 스타일 선택    │ │
 * │  │• 생성 진행률    │ │• 드래그앤드롭   │ │• 일관성 레벨    │ │
 * │  │• 설정 컨트롤    │ │• 이미지 확대    │ │• 참조 이미지    │ │
 * │  │• 참조 이미지    │ │• 다운로드       │ │• 고급 설정      │ │
 * │  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
 * │                               │                               │
 * │                               ▼                               │
 * │                    shared/ui (Button, Card, Modal, Input)    │
 * │                    shared/lib (logger)                       │
 * │                    @dnd-kit/* (드래그앤드롭)                  │
 * └─────────────────────────────────────────────────────────────┘
 */

/**
 * 컴포넌트 사용 예시:
 *
 * ```tsx
 * import {
 *   StoryboardGenerator,
 *   StoryboardGrid,
 *   ConsistencyControls
 * } from '@/widgets/storyboard'
 *
 * function StoryboardPage() {
 *   const [images, setImages] = useState<StoryboardImage[]>([])
 *   const [settings, setSettings] = useState<ConsistencySettings>(defaultSettings)
 *
 *   return (
 *     <div className="space-y-6">
 *       <StoryboardGenerator
 *         scenarioTitle="브이로그 영상"
 *         onGenerate={handleGenerate}
 *         isGenerating={isGenerating}
 *         progress={progress}
 *       />
 *
 *       <ConsistencyControls
 *         settings={settings}
 *         onSettingsChange={setSettings}
 *         showAdvanced={true}
 *       />
 *
 *       <StoryboardGrid
 *         images={images}
 *         onImageClick={handleImageClick}
 *         onImageReorder={handleReorder}
 *         enableDragDrop={true}
 *         showMetadata={true}
 *       />
 *     </div>
 *   )
 * }
 * ```
 */

/**
 * 접근성 특징:
 *
 * • WCAG 2.1 AA 준수
 * • 키보드 네비게이션 완전 지원
 * • 스크린 리더 호환성
 * • 적절한 ARIA 레이블 및 역할
 * • 포커스 관리 및 트랩
 * • 색상 대비 4.5:1 이상
 * • 터치 타겟 44px 이상
 *
 * 반응형 디자인:
 *
 * • 모바일: 2열 그리드
 * • 태블릿: 3열 그리드
 * • 데스크탑: 4열 그리드
 * • 유연한 레이아웃 및 스페이싱
 *
 * 성능 최적화:
 *
 * • 이미지 지연 로딩 (lazy loading)
 * • 가상화된 대용량 목록 지원
 * • 메모이제이션 및 최적화된 리렌더링
 * • 드래그앤드롭 성능 최적화
 */