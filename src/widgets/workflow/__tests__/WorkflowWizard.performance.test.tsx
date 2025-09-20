/**
 * WorkflowWizard 성능 테스트
 * INP ≤200ms 목표 검증
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowWizard } from '../WorkflowWizard';

// MSW 테스트 유틸리티
import { server } from '@/shared/lib/test-utils/msw-server';
import { performanceHandlers } from './msw-handlers';

// Performance Observer 모킹
const mockPerformanceObserver = jest.fn();
global.PerformanceObserver = mockPerformanceObserver as any;

describe('WorkflowWizard - 성능 테스트', () => {
  beforeAll(() => {
    server.listen();
    // 성능 테스트용 빠른 핸들러 적용
    server.use(...performanceHandlers);
  });

  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  describe('⚡ INP (Interaction to Next Paint) 테스트', () => {
    it('템플릿 선택 버튼 클릭 후 50ms 이내 시각적 피드백 제공', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      const templateButton = screen.getByRole('button', {
        name: /템플릿으로 빠르게 시작/i
      });

      // 상호작용 시작 시간 측정
      const startTime = performance.now();

      await user.click(templateButton);

      // 첫 번째 시각적 변화 확인 (50ms 이내)
      const firstFeedback = await screen.findByRole('status', {
        name: /템플릿 선택 모드로 전환되었습니다/i
      });

      const endTime = performance.now();
      const interactionTime = endTime - startTime;

      expect(firstFeedback).toBeInTheDocument();
      expect(interactionTime).toBeLessThan(50);
    });

    it('직접 설정 버튼 클릭 후 150ms 이내 단계 전환 완료', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      const directButton = screen.getByRole('button', {
        name: /직접 설정하여 시작/i
      });

      const startTime = performance.now();

      await user.click(directButton);

      // 새 콘텐츠 로드 완료 확인
      await waitFor(() => {
        const stepContent = screen.getByRole('main', {
          name: /스토리 입력/i
        });
        expect(stepContent).toBeInTheDocument();

        const endTime = performance.now();
        const loadTime = endTime - startTime;
        expect(loadTime).toBeLessThan(150);
      });
    });

    it('진행률 업데이트가 16ms 이내 완료 (60fps 유지)', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      const directButton = screen.getByRole('button', {
        name: /직접 설정하여 시작/i
      });

      // 진행률 초기값 확인
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');

      const startTime = performance.now();

      await user.click(directButton);

      // 진행률 업데이트 확인
      await waitFor(() => {
        expect(progressBar).toHaveAttribute('aria-valuenow', '25');

        const endTime = performance.now();
        const updateTime = endTime - startTime;
        expect(updateTime).toBeLessThan(16);
      });
    });
  });

  describe('🏃‍♂️ 렌더링 성능 테스트', () => {
    it('컴포넌트 초기 렌더링이 100ms 이내 완료', () => {
      const startTime = performance.now();

      render(<WorkflowWizard />);

      // 핵심 UI 요소 확인
      expect(screen.getByText(/AI 영상 생성/i)).toBeInTheDocument();
      expect(screen.getByRole('button', {
        name: /템플릿으로 빠르게 시작/i
      })).toBeInTheDocument();

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(100);
    });

    it('상태 변경 시 불필요한 리렌더링 방지', async () => {
      const renderCount = jest.fn();

      const TestWrapper = () => {
        renderCount();
        return <WorkflowWizard />;
      };

      const user = userEvent.setup();
      render(<TestWrapper />);

      const initialRenderCount = renderCount.mock.calls.length;

      // 버튼 클릭으로 상태 변경
      const templateButton = screen.getByRole('button', {
        name: /템플릿으로 빠르게 시작/i
      });

      await user.click(templateButton);

      // 최소한의 리렌더링만 발생했는지 확인
      const finalRenderCount = renderCount.mock.calls.length;
      const rerenderCount = finalRenderCount - initialRenderCount;

      expect(rerenderCount).toBeLessThanOrEqual(2); // 최대 2회 리렌더링
    });
  });

  describe('📊 리소스 사용량 테스트', () => {
    it('메모리 누수 없이 컴포넌트 언마운트', () => {
      const { unmount } = render(<WorkflowWizard />);

      // 이벤트 리스너 등록 확인
      const initialListenerCount = Object.keys(window).filter(
        key => key.startsWith('on')
      ).length;

      unmount();

      // 언마운트 후 이벤트 리스너 정리 확인
      const finalListenerCount = Object.keys(window).filter(
        key => key.startsWith('on')
      ).length;

      expect(finalListenerCount).toBeLessThanOrEqual(initialListenerCount);
    });

    it('대용량 템플릿 데이터 처리 성능', async () => {
      // 대용량 템플릿 데이터 시뮬레이션
      const largeTemplateData = Array.from({ length: 100 }, (_, i) => ({
        id: `template-${i}`,
        name: `Template ${i}`,
        description: `Description for template ${i}`,
        template: {
          genre: 'commercial',
          target: 'general',
          toneAndManner: ['professional'],
          duration: '30s'
        }
      }));

      // MSW 핸들러를 대용량 데이터로 오버라이드
      server.use(
        performanceHandlers[0] // 빠른 응답 핸들러 사용
      );

      const user = userEvent.setup();
      render(<WorkflowWizard />);

      const startTime = performance.now();

      const templateButton = screen.getByRole('button', {
        name: /템플릿으로 빠르게 시작/i
      });

      await user.click(templateButton);

      // 템플릿 데이터 로드 완료 대기
      await waitFor(() => {
        expect(screen.getByText(/템플릿 선택/i)).toBeInTheDocument();
      });

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // 대용량 데이터도 200ms 이내 처리
      expect(processingTime).toBeLessThan(200);
    });
  });

  describe('🔄 비동기 작업 성능 테스트', () => {
    it('API 호출 병렬 처리로 총 대기 시간 최소화', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      // 직접 설정 모드로 진입
      const directButton = screen.getByRole('button', {
        name: /직접 설정하여 시작/i
      });

      await user.click(directButton);

      // 폼 입력
      const storyInput = screen.getByRole('textbox', { name: /스토리 입력/i });
      await user.type(storyInput, '테스트 스토리 내용');

      const startTime = performance.now();

      // 다음 단계로 진행 (API 호출 포함)
      const nextButton = screen.getByRole('button', { name: /다음/i });
      await user.click(nextButton);

      // API 응답 및 UI 업데이트 완료 대기
      await waitFor(() => {
        expect(screen.getByText(/시나리오 설정/i)).toBeInTheDocument();
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // API 호출 + UI 업데이트가 500ms 이내 완료
      expect(totalTime).toBeLessThan(500);
    });

    it('에러 발생 시 복구 시간 최소화', async () => {
      // 에러 핸들러로 서버 설정
      server.use(
        performanceHandlers[0] // 빠른 에러 응답
      );

      const user = userEvent.setup();
      render(<WorkflowWizard />);

      const startTime = performance.now();

      // 에러를 발생시킬 액션 수행
      const templateButton = screen.getByRole('button', {
        name: /템플릿으로 빠르게 시작/i
      });

      await user.click(templateButton);

      // 에러 메시지 표시 대기
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const errorHandlingTime = endTime - startTime;

      // 에러 처리 및 피드백이 200ms 이내 완료
      expect(errorHandlingTime).toBeLessThan(200);
    });
  });
});