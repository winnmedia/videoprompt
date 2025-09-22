/**
 * Shared UI Public API
 *
 * CLAUDE.md FSD 규칙 준수: 모든 UI 컴포넌트는 이 Public API를 통해서만 접근 가능
 * 디자인 시스템과 기본 UI 요소들을 제공합니다.
 * WCAG 2.1 AA 준수, 임의값 사용 금지, 200ms 이하 애니메이션
 */

// Button 컴포넌트 (cva 기반 variant 시스템)
export { Button } from './button';
export type { ButtonProps } from './button';

// Card 컴포넌트 (접근성 포함)
export { Card, CardHeader, CardContent, CardFooter } from './card';
export type { CardProps, CardHeaderProps, CardContentProps, CardFooterProps } from './card';

// Modal 컴포넌트 (포커스 트랩, ESC 키 처리)
export { Modal, ModalFooter } from './modal';
export type { ModalProps, ModalFooterProps } from './modal';

// Input 컴포넌트 (검증 상태 지원)
export { Input, Textarea, Select } from './input';
export type { InputProps, TextareaProps, SelectProps } from './input';

// Navigation 컴포넌트 (브랜딩, 라우팅)
export { Navigation } from './navigation';
export type { NavigationProps, NavItem } from './navigation';

// Client Navigation Wrapper (Server Component 호환)
export { ClientNavigation } from './client-navigation';

// Grid 시스템 (반응형 그리드: 데스크탑 2열, 모바일 1열)
export {
  Grid,
  GridItem,
  Container,
  CardGrid,
  DashboardGrid,
  ListGrid,
} from './grid';
export type {
  GridProps,
  GridItemProps,
  ContainerProps,
  CardGridProps,
  DashboardGridProps,
  ListGridProps,
} from './grid';

// Error Boundary 컴포넌트들 (전역 에러 처리)
export {
  ErrorBoundary,
  PageErrorBoundary,
  SectionErrorBoundary,
  ComponentErrorBoundary,
  setupGlobalErrorHandlers,
} from './error-boundary';

// Error Actions (Client Component)
export { ErrorActions } from './error-actions';

// Loading & Error UI 컴포넌트
export { LoadingSpinner } from './LoadingSpinner';
export { ErrorAlert } from './ErrorAlert';

// EmptyState 컴포넌트 (환각 코드 수정)
export {
  default as EmptyState,
  EmptySearchState,
  EmptyDataState,
  LoadingState,
  ErrorState,
  type EmptyStateProps
} from './EmptyState';

// 유틸리티 타입
export type { ComponentProps, VariantProps } from 'react';
export type { VariantProps as CVAVariantProps } from 'class-variance-authority';
