/**
 * Widgets Layer Public API
 * UI 위젯 컴포넌트 export
 * + Cost Safety 관리 대시보드
 */

// Layout 위젯들
export * from './layout';

// Cost Safety 관리 대시보드
export { CostSafetyDashboard } from './admin/CostSafetyDashboard';

// 카드 위젯들
export { ActionCard } from './ActionCard';
export { ProjectCard } from './ProjectCard';
export { FeatureCard } from './FeatureCard';

// Shared UI 컴포넌트 re-export (FSD 계층 준수)
export { Button } from '@/shared/ui';
export { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
export { Input } from '@/shared/ui';

// Story Form 위젯 (4단계 스토리)
export * from './story-form';

// Shots 위젯 (12단계 숏트 시스템)
export * from './shots';

// Scenario 위젯 (NEW - UserJourneyMap 3-4단계)
export * from './scenario';

// Prompt 위젯 (UserJourneyMap 12-14단계)
export * from './prompt';

// Video 위젯 (UserJourneyMap 15-17단계)
export * from './video';

// 타입 exports
export type { ActionCardProps } from './ActionCard';
export type { ProjectCardProps } from './ProjectCard';
export type { FeatureCardProps } from './FeatureCard';
