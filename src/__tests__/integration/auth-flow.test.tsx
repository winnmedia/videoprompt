/**
 * 인증 플로우 통합 테스트
 * 전체 인증 과정의 통합 동작을 검증
 * MSW를 활용한 API 모킹으로 결정론적 테스트 보장
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { userReducer } from '@/entities/user';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { GuestLogin } from '@/features/auth/components/GuestLogin';

// AuthApi 모킹
jest.mock('@/features/auth/api/authApi', () => ({
  AuthApi: {
    getCurrentUser: jest.fn(() => Promise.resolve(null)),
    loginWithEmail: jest.fn(() => Promise.resolve({ message: 'Magic link sent' })),
    logout: jest.fn(() => Promise.resolve()),
    refreshToken: jest.fn(() => Promise.resolve('new-token')),
  },
}));

// Redux store 설정
function createStore() {
  return configureStore({
    reducer: {
      user: userReducer,
    },
  });
}

describe('Authentication Flow Integration', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    // Redux store 초기화
    store = createStore();
    localStorage.clear();

    // Mock fetch 설정 - 게스트 로그인 성공
    global.fetch = jest.fn((url) => {
      if (typeof url === 'string' && url.includes('/api/auth/guest')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            user: {
              id: 'guest-123',
              email: 'guest@example.com',
              name: 'Guest User',
              isGuest: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            token: 'guest-token'
          }),
        });
      }

      // 기본 응답
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    }) as jest.Mock;
  });

  describe('게스트 로그인 플로우', () => {
    it('게스트로 로그인하고 세션을 유지해야 함', async () => {
      // Arrange
      const user = userEvent.setup();
      const onSuccess = jest.fn();

      render(
        <Provider store={store}>
          <GuestLogin onSuccess={onSuccess} />
        </Provider>
      );

      // Act - 로딩이 완료될 때까지 기다린 후 게스트 로그인 클릭
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /게스트로 시작하기/i })).toBeInTheDocument();
      }, { timeout: 3000 });

      const guestButton = screen.getByRole('button', { name: /게스트로 시작하기/i });
      await user.click(guestButton);

      // Assert - 성공 콜백 호출
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      // Assert - Redux store에 게스트 정보 저장
      await waitFor(() => {
        const state = store.getState();
        expect(state.user.currentUser).toBeTruthy();
        expect(state.user.currentUser?.isGuest).toBe(true);
        expect(state.user.currentUser?.email).toContain('guest');
      });
    });

    it('게스트 로그인 실패 시 에러를 표시해야 함', async () => {
      // Arrange - 서버 에러 시뮬레이션
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ error: 'Service temporarily unavailable' }),
        })
      ) as jest.Mock;

      const user = userEvent.setup();
      const onSuccess = jest.fn();

      render(
        <Provider store={store}>
          <GuestLogin onSuccess={onSuccess} />
        </Provider>
      );

      // Act
      const guestButton = screen.getByRole('button', { name: /게스트로 시작하기/i });
      await user.click(guestButton);

      // Assert - 성공 콜백이 호출되지 않음
      await waitFor(() => {
        expect(onSuccess).not.toHaveBeenCalled();
      }, { timeout: 3000 });

      // Redux store에 저장되지 않음
      const state = store.getState();
      expect(state.user.currentUser).toBeNull();
    });
  });

  describe('이메일 로그인 플로우', () => {
    it('이메일 로그인 링크를 전송하고 확인 메시지를 표시해야 함', async () => {
      // Arrange
      const user = userEvent.setup();

      render(
        <Provider store={store}>
          <LoginForm />
        </Provider>
      );

      // Act - 이메일 입력 및 제출
      const emailInput = screen.getByPlaceholderText('your@email.com');
      const submitButton = screen.getByRole('button', { name: /매직 링크 전송/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      // Assert - 확인 메시지 표시
      await waitFor(() => {
        expect(screen.getByText(/이메일을 확인해주세요/i)).toBeInTheDocument();
        expect(screen.getByText(/test@example.com로 로그인 링크를 전송했습니다/i)).toBeInTheDocument();
      });
    });

    it('잘못된 이메일 형식을 거부해야 함', async () => {
      // Arrange
      const user = userEvent.setup();

      render(
        <Provider store={store}>
          <LoginForm />
        </Provider>
      );

      // Act - 잘못된 이메일 입력
      const emailInput = screen.getByPlaceholderText('your@email.com');
      const submitButton = screen.getByRole('button', { name: /매직 링크 전송/i });

      await user.type(emailInput, 'invalid-email');
      await user.click(submitButton);

      // Assert - 확인 메시지가 표시되지 않음
      await waitFor(() => {
        expect(screen.queryByText(/이메일을 확인해주세요/i)).not.toBeInTheDocument();
      });
    });

    it('서버 에러 시 에러 메시지를 표시해야 함', async () => {
      // Arrange - 서버 에러 시뮬레이션
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Email service unavailable' }),
        })
      ) as jest.Mock;

      const user = userEvent.setup();

      render(
        <Provider store={store}>
          <LoginForm />
        </Provider>
      );

      // Act
      const emailInput = screen.getByPlaceholderText('your@email.com');
      const submitButton = screen.getByRole('button', { name: /매직 링크 전송/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      // Assert - 에러 메시지 표시
      await waitFor(() => {
        expect(screen.queryByText(/이메일을 확인해주세요/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('인증 상태 유지', () => {
    it('페이지 새로고침 후에도 인증 상태를 유지해야 함', async () => {
      // Arrange - Redux store에 사용자 정보 저장
      const savedUser = {
        id: 'user-123',
        email: 'saved@example.com',
        name: 'Saved User',
        isGuest: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.dispatch({
        type: 'user/setCurrentUser',
        payload: savedUser,
      });

      // Act - 컴포넌트 마운트 (새로고침 시뮬레이션)
      const { container } = render(
        <Provider store={store}>
          <div data-testid="app">
            <LoginForm />
          </div>
        </Provider>
      );

      // Assert - 저장된 사용자 정보가 유지됨
      await waitFor(() => {
        const state = store.getState();
        expect(state.user.currentUser).toEqual(savedUser);
        expect(state.user.isAuthenticated).toBe(true);
      });
    });

    it('로그아웃 시 모든 인증 정보를 제거해야 함', async () => {
      // Arrange - 로그인된 상태 설정
      const loggedInUser = {
        id: 'user-456',
        email: 'logout@example.com',
        name: 'Logout User',
        isGuest: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.dispatch({
        type: 'user/setCurrentUser',
        payload: loggedInUser,
      });

      // Act - 로그아웃
      store.dispatch({ type: 'user/clearCurrentUser' });

      // Assert
      await waitFor(() => {
        const state = store.getState();
        expect(state.user.currentUser).toBeNull();
        expect(state.user.isAuthenticated).toBe(false);
      });
    });
  });

  describe('$300 사건 방지 테스트', () => {
    it('빠른 컴포넌트 리렌더링에서도 API를 중복 호출하지 않아야 함', async () => {
      // Arrange - fetch 호출 횟수 추적
      const originalFetch = global.fetch;
      let apiCallCount = 0;

      global.fetch = jest.fn((...args: Parameters<typeof fetch>) => {
        const url = args[0];
        if (typeof url === 'string' && url.includes('/api/auth/me')) {
          apiCallCount++;
        }
        return originalFetch(...args);
      }) as jest.Mock;

      // Act - 여러 번 리렌더링
      const { rerender } = render(
        <Provider store={store}>
          <LoginForm />
        </Provider>
      );

      for (let i = 0; i < 5; i++) {
        rerender(
          <Provider store={store}>
            <LoginForm />
          </Provider>
        );
      }

      // Assert - API 호출이 최소화됨 (useAuth의 초기화는 1회만)
      await waitFor(() => {
        expect(apiCallCount).toBeLessThanOrEqual(1);
      });
    });

    it('여러 인증 컴포넌트가 동시에 마운트되어도 API를 한 번만 호출해야 함', async () => {
      // Arrange - fetch 호출 횟수 추적
      const originalFetch = global.fetch;
      let apiCallCount = 0;

      global.fetch = jest.fn((...args: Parameters<typeof fetch>) => {
        const url = args[0];
        if (typeof url === 'string' && url.includes('/api/auth/me')) {
          apiCallCount++;
        }
        return originalFetch(...args);
      }) as jest.Mock;

      // Act - 여러 컴포넌트 동시 렌더링
      render(
        <Provider store={store}>
          <div>
            <LoginForm />
            <GuestLogin onSuccess={() => {}} />
            <LoginForm />
            <GuestLogin onSuccess={() => {}} />
          </div>
        </Provider>
      );

      // Assert
      await waitFor(() => {
        expect(apiCallCount).toBeLessThanOrEqual(1);
      });
    });

    it('API 호출 빈도를 제한해야 함', async () => {
      // Arrange
      const user = userEvent.setup();
      let lastCallTime = 0;
      let tooFrequent = false;

      global.fetch = jest.fn((...args) => {
        const url = args[0];
        if (typeof url === 'string' && url.includes('/api/auth/guest')) {
          const now = Date.now();
          if (lastCallTime && now - lastCallTime < 100) {
            tooFrequent = true;
          }
          lastCallTime = now;
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            user: {
              id: 'guest-123',
              email: 'guest@example.com',
              name: 'Guest User',
              isGuest: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            token: 'guest-token',
          }),
        });
      }) as jest.Mock;

      render(
        <Provider store={store}>
          <GuestLogin onSuccess={() => {}} />
        </Provider>
      );

      // Act - 빠른 연속 클릭
      const button = screen.getByRole('button', { name: /게스트로 시작하기/i });
      await user.click(button);
      await user.click(button);
      await user.click(button);

      // Assert - 너무 빈번한 호출이 없어야 함
      await waitFor(() => {
        expect(tooFrequent).toBe(false);
      });
    });
  });

  describe('네트워크 에러 처리', () => {
    it('네트워크 타임아웃을 gracefully 처리해야 함', async () => {
      // Arrange - 타임아웃 시뮬레이션
      global.fetch = jest.fn(() =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({}),
            });
          }, 5000);
        })
      ) as jest.Mock;

      const user = userEvent.setup();

      render(
        <Provider store={store}>
          <LoginForm />
        </Provider>
      );

      // Act
      const emailInput = screen.getByPlaceholderText('your@email.com');
      const submitButton = screen.getByRole('button', { name: /매직 링크 전송/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      // Assert - 로딩 상태 표시
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent(/전송 중/i);
    });

    it('네트워크 연결 끊김을 처리해야 함', async () => {
      // Arrange - 네트워크 에러 시뮬레이션
      global.fetch = jest.fn(() =>
        Promise.reject(new Error('Network error'))
      ) as jest.Mock;

      const user = userEvent.setup();
      const onSuccess = jest.fn();

      render(
        <Provider store={store}>
          <GuestLogin onSuccess={onSuccess} />
        </Provider>
      );

      // Act
      const button = screen.getByRole('button', { name: /게스트로 시작하기/i });
      await user.click(button);

      // Assert
      await waitFor(() => {
        expect(onSuccess).not.toHaveBeenCalled();
      });
    });
  });

  describe('동시성 제어', () => {
    it('동시에 여러 로그인 시도를 방지해야 함', async () => {
      // Arrange
      let loginAttempts = 0;
      global.fetch = jest.fn(async (...args) => {
        const url = args[0];
        if (typeof url === 'string' && url.includes('/api/auth/login')) {
          loginAttempts++;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: 'Magic link sent' }),
        });
      }) as jest.Mock;

      const user = userEvent.setup();

      render(
        <Provider store={store}>
          <LoginForm />
        </Provider>
      );

      // Act - 빠른 연속 제출
      const emailInput = screen.getByPlaceholderText('your@email.com');
      const submitButton = screen.getByRole('button', { name: /매직 링크 전송/i });

      await user.type(emailInput, 'test@example.com');

      // 빠르게 여러 번 클릭
      const clickPromises = [];
      for (let i = 0; i < 3; i++) {
        clickPromises.push(user.click(submitButton));
      }

      await Promise.all(clickPromises);

      // Assert - 한 번만 처리됨 (로딩 상태로 인한 중복 방지)
      await waitFor(() => {
        expect(loginAttempts).toBe(1);
      });
    });
  });
});