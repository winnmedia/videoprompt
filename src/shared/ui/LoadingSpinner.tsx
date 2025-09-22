/**
 * Loading Spinner Component
 *
 * 로딩 상태를 표시하는 스피너 컴포넌트입니다.
 * 다양한 크기와 색상을 지원합니다.
 */

'use client';

interface LoadingSpinnerProps {
  /** 스피너 크기 */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** 스피너 색상 */
  color?: 'blue' | 'gray' | 'white';
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 로딩 스피너 컴포넌트
 */
export function LoadingSpinner({
  size = 'md',
  color = 'blue',
  className = ''
}: LoadingSpinnerProps) {
  // 크기별 스타일
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  // 색상별 스타일
  const colorClasses = {
    blue: 'border-blue-600 border-t-transparent',
    gray: 'border-gray-600 border-t-transparent',
    white: 'border-white border-t-transparent'
  };

  return (
    <div
      className={`
        border-2 rounded-full animate-spin
        ${sizeClasses[size]}
        ${colorClasses[color]}
        ${className}
      `}
      role="status"
      aria-label="로딩 중"
    >
      <span className="sr-only">로딩 중...</span>
    </div>
  );
}