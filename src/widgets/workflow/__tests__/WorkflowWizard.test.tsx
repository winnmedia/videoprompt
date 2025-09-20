/**
 * WorkflowWizard TDD 테스트
 * RED → GREEN → REFACTOR 사이클 적용
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowWizard } from '../WorkflowWizard';

// MSW 및 테스트 유틸리티
import { server } from '@/shared/lib/test-utils/msw-server';
import { http, HttpResponse } from 'msw';

describe('WorkflowWizard - UX 개선 테스트', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  describe('🚀 개선된 시작 화면 (RED 테스트)', () => {
    it('템플릿 기반 빠른 시작 옵션을 제공해야 함', () => {
      render(<WorkflowWizard />);

      // 현재는 실패할 테스트 - 개선 후 통과 예정
      expect(screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /직접 설정하여 시작/i })).toBeInTheDocument();
    });

    it('각 옵션에 예상 시간과 설명이 표시되어야 함', () => {
      render(<WorkflowWizard />);

      expect(screen.getByText(/약 2분 내 완성/i)).toBeInTheDocument();
      expect(screen.getByText(/상세 설정 가능/i)).toBeInTheDocument();
    });
  });

  describe('⚡ 성능 및 피드백 (RED 테스트)', () => {
    it('버튼 클릭 시 50ms 이내 시각적 피드백을 제공해야 함', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      const startTime = performance.now();
      const templateButton = screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i });

      await user.click(templateButton);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // 50ms 이내 피드백 검증
      expect(responseTime).toBeLessThan(50);
      expect(screen.getByRole('status', { name: /처리 중/i })).toBeInTheDocument();
    });

    it('단계 전환 시 200ms 이내 새 콘텐츠가 로드되어야 함', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      // 템플릿 선택 후 단계 전환 시간 측정
      const startTime = performance.now();

      const templateButton = screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i });
      await user.click(templateButton);

      await waitFor(() => {
        const endTime = performance.now();
        const loadTime = endTime - startTime;
        expect(loadTime).toBeLessThan(200);
        expect(screen.getByRole('main', { name: /프롬프트 설정/i })).toBeInTheDocument();
      });
    });
  });

  describe('♿ 접근성 준수 (RED 테스트)', () => {
    it('키보드만으로 모든 단계를 진행할 수 있어야 함', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      // Tab 키로 네비게이션
      await user.tab();
      expect(screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i })).toHaveFocus();

      // Enter로 선택
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByRole('main', { name: /프롬프트 설정/i })).toBeInTheDocument();
      });
    });

    it('스크린 리더용 실시간 상태 업데이트를 제공해야 함', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      // aria-live 영역이 존재해야 함
      expect(screen.getByRole('status')).toBeInTheDocument();

      const templateButton = screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i });
      await user.click(templateButton);

      // 상태 변경 시 스크린 리더에 알림
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/프롬프트 설정 단계로 이동/i);
      });
    });

    it('적절한 색상 대비를 유지해야 함 (4.5:1 이상)', () => {
      render(<WorkflowWizard />);

      const primaryButton = screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i });
      const computedStyle = window.getComputedStyle(primaryButton);

      // 색상 대비 검증 (임시 구현 - 실제로는 contrast-ratio 라이브러리 사용)
      expect(computedStyle.backgroundColor).not.toBe(computedStyle.color);
    });
  });

  describe('📱 템플릿 선택 개선 (RED 테스트)', () => {
    it('템플릿 선택 시 설정이 자동으로 적용되어야 함', async () => {
      const user = userEvent.setup();

      // MSW로 템플릿 API 모킹
      server.use(
        http.get('/api/templates', () => {
          return HttpResponse.json({
            templates: [
              {
                id: 'brand-promo',
                name: '브랜드 홍보',
                description: '제품/서비스를 효과적으로 홍보하는 영상',
                template: {
                  genre: 'commercial',
                  target: 'general',
                  toneAndManner: ['professional', 'engaging'],
                  duration: '30s'
                }
              }
            ]
          });
        })
      );

      render(<WorkflowWizard />);

      const templateButton = screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i });
      await user.click(templateButton);

      // 템플릿 선택
      await waitFor(() => {
        expect(screen.getByText(/브랜드 홍보/i)).toBeInTheDocument();
      });

      const brandTemplate = screen.getByText(/브랜드 홍보/i);
      await user.click(brandTemplate);

      // 설정 자동 적용 확인
      await waitFor(() => {
        expect(screen.getByDisplayValue(/commercial/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue(/30s/i)).toBeInTheDocument();
      });
    });

    it('템플릿 사용 시 2단계를 건너뛰고 3단계로 이동해야 함', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      const templateButton = screen.getByRole('button', { name: /템플릿으로 빠르게 시작/i });
      await user.click(templateButton);

      // 템플릿 선택 후 3단계로 바로 이동
      await waitFor(() => {
        expect(screen.getByRole('main', { name: /프롬프트 설정/i })).toBeInTheDocument();
        expect(screen.queryByRole('main', { name: /시나리오 설정/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('🔄 진행 상황 및 피드백 (RED 테스트)', () => {
    it('진행률 표시기가 정확한 퍼센트를 보여줘야 함', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      // 초기 상태
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

      // 1단계 완료 후
      const directButton = screen.getByRole('button', { name: /직접 설정하여 시작/i });
      await user.click(directButton);

      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
      });
    });

    it('각 단계별 예상 소요 시간을 표시해야 함', () => {
      render(<WorkflowWizard />);

      expect(screen.getByText(/예상 소요시간: 30초/i)).toBeInTheDocument();
    });

    it('API 호출 시 실시간 상태를 업데이트해야 함', async () => {
      const user = userEvent.setup();

      // MSW로 영상 생성 API 모킹 (지연 포함)
      server.use(
        http.post('/api/seedance/create', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: { jobId: 'test-job-123' }
          });
        })
      );

      render(<WorkflowWizard />);

      // 마지막 단계에서 영상 생성
      const generateButton = screen.getByRole('button', { name: /영상 생성/i });
      await user.click(generateButton);

      // 로딩 상태 확인
      expect(screen.getByText(/생성 중.../i)).toBeInTheDocument();

      // 완료 상태 확인
      await waitFor(() => {
        expect(screen.getByText(/대기 중/i)).toBeInTheDocument();
      });
    });
  });

  describe('🚨 오류 처리 개선 (RED 테스트)', () => {
    it('API 오류 시 명확한 오류 메시지와 재시도 버튼을 제공해야 함', async () => {
      const user = userEvent.setup();

      // MSW로 API 오류 모킹
      server.use(
        http.post('/api/seedance/create', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      render(<WorkflowWizard />);

      const generateButton = screen.getByRole('button', { name: /영상 생성/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/네트워크 오류가 발생했습니다/i);
        expect(screen.getByRole('button', { name: /다시 시도/i })).toBeInTheDocument();
      });
    });

    it('폼 유효성 검사 오류를 실시간으로 표시해야 함', async () => {
      const user = userEvent.setup();
      render(<WorkflowWizard />);

      // 직접 입력 모드로 진행
      const directButton = screen.getByRole('button', { name: /직접 설정하여 시작/i });
      await user.click(directButton);

      const storyInput = screen.getByRole('textbox', { name: /스토리 입력/i });

      // 빈 값 입력 시 실시간 검증
      await user.clear(storyInput);
      await user.tab(); // 포커스 이동으로 검증 트리거

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/스토리를 입력해주세요/i);
      });
    });
  });
});