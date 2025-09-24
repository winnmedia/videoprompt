/**
 * Lazy Loading Components for Performance Optimization
 * CLAUDE.md 성능 예산 준수
 */

import React, { lazy, Suspense } from 'react';

// 임시 LoadingSpinner 컴포넌트
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-4">
    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// 4단계 스토리 편집기 - 큰 컴포넌트이므로 지연 로딩
export const LazyFourActStoryEditor = lazy(() =>
  import('../../widgets/story-form/FourActStoryEditor').then(module => ({
    default: module.FourActStoryEditor
  }))
);

// 썸네일 생성기 - AI 기능이므로 지연 로딩
export const LazyThumbnailGenerator = lazy(() =>
  import('../../widgets/story-form/ThumbnailGenerator').then(module => ({
    default: module.ThumbnailGenerator
  }))
);

// 스토리 생성 폼 - 복잡한 폼이므로 지연 로딩
export const LazyStoryGenerationForm = lazy(() =>
  import('../../widgets/story-form/StoryGenerationForm').then(module => ({
    default: module.StoryGenerationForm
  }))
);

// 지연 로딩 래퍼 컴포넌트
interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ComponentType;
  errorBoundary?: boolean;
}

export function LazyWrapper({
  children,
  fallback: Fallback = LoadingSpinner,
  errorBoundary = true
}: LazyWrapperProps) {
  const fallbackElement = (
    <div className="flex items-center justify-center min-h-[200px]">
      <Fallback />
    </div>
  );

  if (errorBoundary) {
    return (
      <Suspense fallback={fallbackElement}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={fallbackElement}>
      {children}
    </Suspense>
  );
}

// 에러 바운더리 컴포넌트
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-500 text-2xl mb-2">⚠️</div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            컴포넌트 로딩 실패
          </h3>
          <p className="text-sm text-red-600 text-center mb-4">
            일시적인 오류가 발생했습니다. 페이지를 새로고침해주세요.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 메모화된 지연 로딩 HOC
export function withLazyLoading<T extends object>(
  Component: React.ComponentType<T>,
  displayName?: string
) {
  const LazyComponent = lazy(() => Promise.resolve({ default: Component }));
  // TODO: displayName 설정이 필요하면 다른 방법으로 구현
  // LazyComponent.displayName = displayName || `Lazy(${Component.displayName || Component.name})`;

  return function LazyWrappedComponent(props: T) {
    return (
      <LazyWrapper>
        <LazyComponent {...props} />
      </LazyWrapper>
    );
  };
}

// 스토리 관련 컴포넌트들의 사전 로딩
export function preloadStoryComponents() {
  // 사용자 상호작용 전에 미리 로드
  if (typeof window !== 'undefined') {
    // 호버나 포커스 시 사전 로딩
    const preloadActions = [
      () => import('../../widgets/story-form/FourActStoryEditor'),
      () => import('../../widgets/story-form/StoryGenerationForm'),
      () => import('../../widgets/story-form/ThumbnailGenerator')
    ];

    // 유휴 시간에 사전 로딩
    if ('requestIdleCallback' in window) {
      preloadActions.forEach(action => {
        requestIdleCallback(() => action());
      });
    } else {
      // requestIdleCallback이 지원되지 않는 경우 setTimeout 사용
      preloadActions.forEach((action, index) => {
        setTimeout(action, index * 100);
      });
    }
  }
}

// 이미지 지연 로딩을 위한 커스텀 훅
export function useLazyImage(src: string, placeholder?: string) {
  const [imageSrc, setImageSrc] = React.useState(placeholder || '');
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isError, setIsError] = React.useState(false);

  React.useEffect(() => {
    if (!src) return;

    const img = new Image();
    img.onload = () => {
      setImageSrc(src);
      setIsLoaded(true);
    };
    img.onerror = () => {
      setIsError(true);
    };
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { imageSrc, isLoaded, isError };
}