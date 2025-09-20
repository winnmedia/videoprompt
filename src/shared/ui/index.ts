/**
 * ✨ Shared UI Components - FSD Public API
 *
 * 🎯 Design System Primitives
 * - 모든 UI 컴포넌트는 Tailwind 디자인 토큰 사용
 * - 접근성(a11y) 기본 구현
 * - 임의값(arbitrary values) 금지
 *
 * 🏗️ Architecture Rules
 * - 순수 presentational 컴포넌트만 포함
 * - 비즈니스 로직 없음
 * - 재사용 가능하고 조합 가능
 */

// 🔵 Core Primitives
export { Button } from './button';
export { Input } from './input';
export { Card } from './card';
export { Badge } from './badge';
export { Modal } from './Modal';

// 🎨 Layout & Visual
export { Logo } from './Logo';
export { Icon } from './Icon';
export { Progress } from './Progress';

// 📊 Data Display
export { StatCard } from './stat-card';
export { DataTable } from './data-table';
export { IntegrationGrid } from './IntegrationGrid';
export { IntegrationCard } from './IntegrationCard';

// ⚡ Feedback & Status
export { Loading } from './Loading';
export { LoadingSpinner, LoadingOverlay, InlineLoadingSpinner } from './LoadingSpinner';
export { EmptyState } from './EmptyState';
export { AutoSaveStatus } from './AutoSaveStatus';
export { ToastProvider, useToast } from './Toast';

// 🚨 Error Handling
export { ErrorBoundary, withErrorBoundary } from './ErrorBoundary';
export { ErrorFallback, ErrorCard } from './ErrorFallback';
export { FormError } from './FormError';

// 🔐 Authentication UI
export { VerificationCodeInput } from './VerificationCodeInput';
export { EmailSentMessage } from './EmailSentMessage';
export { ResendEmailButton } from './ResendEmailButton';
export { PasswordInput } from './PasswordInput';
export { PasswordStrengthIndicator } from './PasswordStrengthIndicator';

// 🏛️ Layout (Note: Header will move to widgets/header)
export { Header } from './Header';

// ♿ Accessibility Utilities
export {
  SkipLink,
  VisuallyHidden,
  Announcement,
  FocusTrap,
  Landmark
} from './accessibility';