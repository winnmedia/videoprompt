/**
 * Error Boundary 및 로깅 시스템 테스트
 *
 * 테스트 범위:
 * - Error Boundary 에러 캐치
 * - 구조화된 로깅
 * - 폴백 UI 렌더링
 * - 에러 복구 메커니즘
 */

import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, PageErrorBoundary, SectionErrorBoundary } from '../shared/ui/error-boundary';
import { StructuredLogger } from '../shared/lib/structured-logger';

// 테스트용 에러 컴포넌트
function ThrowError({ shouldThrow = false }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('테스트 에러');
  }
  return <div>정상 컴포넌트</div>;
}

describe('Error Boundary 시스템', () => {
  let consoleSpy: jest.SpyInstance;
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    // 콘솔 에러 숨기기 (테스트에서 예상된 에러)
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // 로거 스파이
    loggerSpy = jest.spyOn(StructuredLogger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    loggerSpy.mockRestore();
  });

  describe('기본 Error Boundary', () => {
    it('정상적인 컴포넌트는 그대로 렌더링해야 한다', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('정상 컴포넌트')).toBeInTheDocument();
    });

    it('에러 발생 시 폴백 UI를 렌더링해야 한다', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/컴포넌트 오류가 발생했습니다/)).toBeInTheDocument();
      expect(screen.getByText('다시 시도')).toBeInTheDocument();
      expect(screen.getByText('페이지 새로고침')).toBeInTheDocument();
      expect(screen.getByText('에러 신고')).toBeInTheDocument();
    });

    it('에러 발생 시 구조화된 로깅을 수행해야 한다', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'React Error Boundary에서 에러 포착',
        expect.any(Error),
        expect.objectContaining({
          component: 'ErrorBoundary',
          metadata: expect.objectContaining({
            errorLevel: 'component',
            componentStack: expect.any(String),
          }),
        })
      );
    });

    it('커스텀 폴백 UI를 렌더링해야 한다', () => {
      const customFallback = <div>커스텀 에러 UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('커스텀 에러 UI')).toBeInTheDocument();
    });

    it('다시 시도 버튼이 작동해야 한다', () => {
      // 상태가 리셋되는지 확인하는 테스트
      const TestWrapper = () => {
        const [shouldThrow, setShouldThrow] = React.useState(true);

        return (
          <div>
            <button onClick={() => setShouldThrow(false)}>Fix Error</button>
            <ErrorBoundary>
              <ThrowError shouldThrow={shouldThrow} />
            </ErrorBoundary>
          </div>
        );
      };

      render(<TestWrapper />);

      // 에러 UI가 표시되어야 함
      expect(screen.getByText(/컴포넌트 오류가 발생했습니다/)).toBeInTheDocument();
      expect(screen.getByText('다시 시도')).toBeInTheDocument();

      // Fix Error 버튼을 먼저 클릭하여 상태 변경
      fireEvent.click(screen.getByText('Fix Error'));

      // 그 다음 다시 시도 버튼 클릭
      fireEvent.click(screen.getByText('다시 시도'));

      // 정상 컴포넌트가 렌더링되어야 함
      expect(screen.getByText('정상 컴포넌트')).toBeInTheDocument();
      expect(screen.queryByText(/컴포넌트 오류가 발생했습니다/)).not.toBeInTheDocument();
    });

    it('커스텀 에러 핸들러가 호출되어야 한다', () => {
      const customErrorHandler = jest.fn();

      render(
        <ErrorBoundary onError={customErrorHandler}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(customErrorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });
  });

  describe('특화된 Error Boundary들', () => {
    it('PageErrorBoundary는 페이지 레벨 메시지를 표시해야 한다', () => {
      render(
        <PageErrorBoundary>
          <ThrowError shouldThrow={true} />
        </PageErrorBoundary>
      );

      expect(screen.getByText(/페이지 로딩 중 오류가 발생했습니다/)).toBeInTheDocument();
    });

    it('SectionErrorBoundary는 격리된 폴백 UI를 표시해야 한다', () => {
      render(
        <SectionErrorBoundary>
          <ThrowError shouldThrow={true} />
        </SectionErrorBoundary>
      );

      expect(screen.getByText(/이 섹션을 일시적으로 불러올 수 없습니다/)).toBeInTheDocument();
    });
  });

  describe('개발 환경 기능', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('개발 환경에서는 에러 메시지를 표시해야 한다', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('테스트 에러')).toBeInTheDocument();
    });

    it('개발 환경에서는 상세 정보를 제공해야 한다', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/개발자 정보/)).toBeInTheDocument();
    });
  });

  describe('프로덕션 환경 기능', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('프로덕션 환경에서는 일반적인 메시지를 표시해야 한다', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/예상치 못한 오류가 발생했습니다/)).toBeInTheDocument();
      expect(screen.queryByText('테스트 에러')).not.toBeInTheDocument();
    });

    it('프로덕션 환경에서는 상세 정보를 숨겨야 한다', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.queryByText(/개발자 정보/)).not.toBeInTheDocument();
    });
  });
});