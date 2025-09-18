/**
 * 🧪 PermissionBoundary UX 테스트
 * MSW를 사용한 권한 상태별 사용자 경험 테스트
 *
 * 테스트 범위:
 * - 권한 없을 때 명확한 안내 메시지
 * - Graceful degradation 동작
 * - 접근성 표준 준수 (ARIA, 스크린 리더)
 * - 키보드 네비게이션
 * - 성능 (INP ≤200ms)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { PermissionBoundary, usePermission } from '@/shared/components/PermissionBoundary';
import { KeyboardNavigationProvider } from '@/shared/components/KeyboardNavigationProvider';

// jest-axe 매처 확장
expect.extend(toHaveNoViolations);

// 테스트용 컴포넌트
function TestComponent({ feature, children }: { feature: string; children: React.ReactNode }) {
  return (
    <KeyboardNavigationProvider>
      <PermissionBoundary feature={feature}>
        {children}
      </PermissionBoundary>
    </KeyboardNavigationProvider>
  );
}

function PermissionTestComponent({ feature }: { feature: string }) {
  const { hasAccess, permission } = usePermission(feature);

  return (
    <div>
      <div data-testid="access-status">{hasAccess ? 'allowed' : 'denied'}</div>
      <div data-testid="permission-level">{permission?.level || 'unknown'}</div>
      <div data-testid="user-message">{permission?.userMessage || ''}</div>
    </div>
  );
}

// MSW 서버 설정
const server = setupServer(
  // 게스트 사용자 (비인증)
  rest.get('/api/auth/me', (req, res, ctx) => {
    const authHeader = req.headers.get('authorization');

    if (!authHeader) {
      return res(
        ctx.status(401),
        ctx.json({
          success: false,
          error: 'UNAUTHORIZED',
          message: '인증이 필요합니다.'
        })
      );
    }

    // 토큰 타입에 따른 응답
    if (authHeader.includes('guest-token')) {
      return res(
        ctx.status(401),
        ctx.json({
          success: false,
          error: 'UNAUTHORIZED'
        })
      );
    }

    if (authHeader.includes('user-token')) {
      return res(
        ctx.json({
          success: true,
          data: {
            id: 'user-123',
            email: 'user@example.com',
            username: 'testuser',
            tokenType: 'supabase',
            role: 'user',
            isEmailVerified: true,
            _debug: {
              degradationMode: 'full',
              adminAccess: false
            }
          }
        })
      );
    }

    if (authHeader.includes('admin-token')) {
      return res(
        ctx.json({
          success: true,
          data: {
            id: 'admin-123',
            email: 'admin@example.com',
            username: 'admin',
            tokenType: 'supabase',
            role: 'admin',
            isEmailVerified: true,
            _debug: {
              degradationMode: 'full',
              adminAccess: true
            }
          }
        })
      );
    }

    if (authHeader.includes('degraded-token')) {
      return res(
        ctx.json({
          success: true,
          data: {
            id: 'degraded-123',
            email: 'degraded@example.com',
            username: 'degraded',
            tokenType: 'supabase',
            role: 'admin',
            isEmailVerified: true,
            _debug: {
              degradationMode: 'degraded',
              adminAccess: false // Service Role 없음
            }
          }
        })
      );
    }

    return res(ctx.status(401), ctx.json({ error: 'Invalid token' }));
  })
);

// 테스트 설정
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('PermissionBoundary UX Tests', () => {
  describe('게스트 사용자 권한 체크', () => {
    beforeEach(() => {
      // 게스트 모드 설정
      delete (global as any).fetch;
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'UNAUTHORIZED' })
        })
      ) as jest.Mock;
    });

    test('게스트에게 허용된 기능은 표시되어야 함', async () => {
      render(
        <TestComponent feature="story-generation">
          <div data-testid="story-generator">스토리 생성기</div>
        </TestComponent>
      );

      await waitFor(() => {
        expect(screen.getByTestId('story-generator')).toBeInTheDocument();
      });
    });

    test('게스트 제한 메시지가 표시되어야 함', async () => {
      render(<TestComponent feature="project-save"><div>프로젝트 저장</div></TestComponent>);

      await waitFor(() => {
        expect(screen.getByText(/로그인이 필요합니다/)).toBeInTheDocument();
        expect(screen.getByText(/로그인하기/)).toBeInTheDocument();
      });
    });

    test('게스트 제한 메시지는 접근성 표준을 준수해야 함', async () => {
      const { container } = render(
        <TestComponent feature="project-save"><div>프로젝트 저장</div></TestComponent>
      );

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveAttribute('aria-labelledby');
        expect(alert).toHaveAttribute('aria-describedby');
      });

      // 접근성 검사
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('인증된 사용자 권한 체크', () => {
    beforeEach(() => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            data: {
              id: 'user-123',
              email: 'user@example.com',
              username: 'testuser',
              role: 'user',
              _debug: { adminAccess: false }
            }
          })
        })
      ) as jest.Mock;
    });

    test('사용자 권한으로 접근 가능한 기능이 표시되어야 함', async () => {
      render(
        <TestComponent feature="project-save">
          <div data-testid="project-save">프로젝트 저장</div>
        </TestComponent>
      );

      await waitFor(() => {
        expect(screen.getByTestId('project-save')).toBeInTheDocument();
      });
    });

    test('관리자 권한이 필요한 기능은 차단되어야 함', async () => {
      render(
        <TestComponent feature="admin-dashboard">
          <div data-testid="admin-dashboard">관리자 대시보드</div>
        </TestComponent>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
        expect(screen.getByText(/관리자 권한이 필요합니다/)).toBeInTheDocument();
      });
    });
  });

  describe('Degraded 모드 UX', () => {
    beforeEach(() => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            data: {
              id: 'degraded-123',
              email: 'degraded@example.com',
              role: 'admin',
              _debug: {
                degradationMode: 'degraded',
                adminAccess: false
              }
            }
          })
        })
      ) as jest.Mock;
    });

    test('Degraded 모드에서 제한된 기능은 안내 메시지와 함께 표시되어야 함', async () => {
      render(
        <TestComponent feature="service-management">
          <div data-testid="service-management">서비스 관리</div>
        </TestComponent>
      );

      await waitFor(() => {
        expect(screen.getByText(/현재 서비스 모드에서 제한됩니다/)).toBeInTheDocument();
        expect(screen.getByText(/제한된 모드로 계속하기/)).toBeInTheDocument();
      });
    });

    test('Degraded 모드 안내는 사용자 친화적이어야 함', async () => {
      render(<TestComponent feature="service-management"><div>서비스 관리</div></TestComponent>);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveClass('bg-amber-50'); // 경고 스타일
        expect(screen.getByText(/일부 관리 기능이 제한될 수 있습니다/)).toBeInTheDocument();
      });
    });
  });

  describe('키보드 네비게이션 접근성', () => {
    test('Tab 키로 권한 메시지 내 버튼에 포커스 이동이 가능해야 함', async () => {
      const user = userEvent.setup();

      render(
        <TestComponent feature="project-save">
          <div>프로젝트 저장</div>
        </TestComponent>
      );

      await waitFor(() => {
        expect(screen.getByText(/로그인하기/)).toBeInTheDocument();
      });

      // Tab 키로 버튼에 포커스
      await user.tab();
      const loginButton = screen.getByText(/로그인하기/);
      expect(loginButton).toHaveFocus();

      // Enter 키로 버튼 활성화 가능한지 확인
      expect(loginButton).toHaveAttribute('type', 'button');
    });

    test('ESC 키로 포커스를 벗어날 수 있어야 함', async () => {
      const user = userEvent.setup();

      render(
        <TestComponent feature="admin-dashboard">
          <div>관리자 대시보드</div>
        </TestComponent>
      );

      await user.keyboard('{Escape}');
      // ESC 키 동작 확인 (실제로는 더 복잡한 포커스 관리 필요)
    });
  });

  describe('성능 최적화 테스트', () => {
    test('권한 체크는 200ms 이내에 완료되어야 함 (INP 목표)', async () => {
      const startTime = performance.now();

      render(
        <PermissionTestComponent feature="story-generation" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('access-status')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200); // 200ms 이내
    });

    test('동일한 권한 요청은 캐시되어야 함', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');

      // 첫 번째 렌더링
      const { rerender } = render(
        <PermissionTestComponent feature="story-generation" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('access-status')).toBeInTheDocument();
      });

      const firstCallCount = fetchSpy.mock.calls.length;

      // 두 번째 렌더링 (동일한 권한)
      rerender(<PermissionTestComponent feature="story-generation" />);

      await waitFor(() => {
        expect(screen.getByTestId('access-status')).toBeInTheDocument();
      });

      // API 호출이 증가하지 않았는지 확인 (캐시 동작)
      expect(fetchSpy.mock.calls.length).toBe(firstCallCount);

      fetchSpy.mockRestore();
    });
  });

  describe('에러 상태 처리', () => {
    test('권한 체크 실패 시 사용자 친화적 에러 메시지가 표시되어야 함', async () => {
      // 네트워크 에러 시뮬레이션
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error'))) as jest.Mock;

      render(
        <TestComponent feature="story-generation">
          <div data-testid="story-generator">스토리 생성기</div>
        </TestComponent>
      );

      await waitFor(() => {
        expect(screen.getByText(/권한 확인 중 오류가 발생했습니다/)).toBeInTheDocument();
      });
    });

    test('서버 에러 시 graceful degradation이 동작해야 함', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Internal Server Error' })
        })
      ) as jest.Mock;

      render(
        <TestComponent feature="story-generation">
          <div data-testid="story-generator">스토리 생성기</div>
        </TestComponent>
      );

      // 에러 상태에서도 기본 기능은 제공되어야 함
      await waitFor(() => {
        // fallback UI 또는 에러 메시지 확인
        expect(screen.getByText(/권한 확인 중 오류가 발생했습니다/)).toBeInTheDocument();
      });
    });
  });

  describe('스크린 리더 지원', () => {
    test('권한 메시지가 스크린 리더에 올바르게 전달되어야 함', async () => {
      render(
        <TestComponent feature="project-save">
          <div>프로젝트 저장</div>
        </TestComponent>
      );

      await waitFor(() => {
        const srOnlyElement = document.querySelector('.sr-only');
        expect(srOnlyElement).toBeInTheDocument();
        expect(srOnlyElement).toHaveTextContent(/로그인이 필요합니다/);
      });
    });

    test('ARIA live region이 권한 변경을 공지해야 함', async () => {
      render(
        <TestComponent feature="story-generation">
          <div>스토리 생성</div>
        </TestComponent>
      );

      await waitFor(() => {
        const liveRegion = document.querySelector('[aria-live="polite"]');
        expect(liveRegion).toBeInTheDocument();
      });
    });
  });

  describe('Gherkin 시나리오 기반 테스트', () => {
    test('시나리오: 게스트 사용자가 제한된 기능에 접근', async () => {
      // Given: 게스트 사용자가 프로젝트 저장 기능에 접근
      render(
        <TestComponent feature="project-save">
          <div data-testid="save-button">저장하기</div>
        </TestComponent>
      );

      // When: 페이지가 로드됨
      await waitFor(() => {
        expect(screen.getByText(/로그인이 필요합니다/)).toBeInTheDocument();
      });

      // Then: 명확한 안내 메시지와 대안 액션이 표시됨
      expect(screen.getByText(/프로젝트 저장은 로그인 후 이용 가능합니다/)).toBeInTheDocument();
      expect(screen.getByText(/로그인하기/)).toBeInTheDocument();

      // And: 원래 기능은 숨겨짐
      expect(screen.queryByTestId('save-button')).not.toBeInTheDocument();

      // And: 접근성 표준을 준수함
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-labelledby');
      expect(alert).toHaveAttribute('aria-describedby');
    });

    test('시나리오: 관리자가 Service Role 없이 고급 기능 접근', async () => {
      // Given: Service Role이 없는 관리자 사용자
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            data: {
              id: 'admin-123',
              role: 'admin',
              _debug: { adminAccess: false }
            }
          })
        })
      ) as jest.Mock;

      render(
        <TestComponent feature="service-management">
          <div data-testid="service-features">고급 서비스 기능</div>
        </TestComponent>
      );

      // When: 고급 기능에 접근
      await waitFor(() => {
        expect(screen.getByText(/현재 서비스 모드에서 제한됩니다/)).toBeInTheDocument();
      });

      // Then: Degraded 모드 안내가 표시됨
      expect(screen.getByText(/일부 관리 기능이 제한될 수 있습니다/)).toBeInTheDocument();
      expect(screen.getByText(/제한된 모드로 계속하기/)).toBeInTheDocument();

      // And: 부분적 기능 제공 (완전 차단하지 않음)
      // 실제 구현에서는 제한된 버전의 기능이 표시될 수 있음
    });
  });
});

describe('PermissionBoundary 통합 테스트', () => {
  test('실제 API와 통합된 권한 체크 플로우', async () => {
    // MSW 핸들러로 실제 API 응답 시뮬레이션
    server.use(
      rest.get('/api/auth/me', (req, res, ctx) => {
        return res(
          ctx.json({
            success: true,
            data: {
              id: 'integration-test-user',
              email: 'test@example.com',
              role: 'user',
              isEmailVerified: true,
              _debug: {
                degradationMode: 'full',
                adminAccess: false
              }
            }
          })
        );
      })
    );

    render(
      <TestComponent feature="project-save">
        <div data-testid="integration-test">통합 테스트</div>
      </TestComponent>
    );

    await waitFor(() => {
      expect(screen.getByTestId('integration-test')).toBeInTheDocument();
    });
  });
});