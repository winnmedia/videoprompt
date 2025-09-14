/**
 * 간단한 시나리오 워크플로우 테스트 - Red Phase
 * TDD 원칙을 위한 최소한의 실패하는 테스트
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import ScenarioPage from '@/app/scenario/page';
import { server } from '@/shared/lib/mocks/server';
import { scenarioHandlers } from '@/shared/lib/mocks/scenario-handlers';

describe('시나리오 워크플로우 Red Phase', () => {
  beforeEach(() => {
    server.use(...scenarioHandlers);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    server.resetHandlers();
  });

  it('FAIL: 페이지가 로드되고 기본 요소들이 있어야 한다', async () => {
    render(<ScenarioPage />);

    // Red Phase - 이 테스트들은 실패할 것
    expect(screen.getByText('AI 영상 기획')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /제목/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /스토리/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /생성/ })).toBeInTheDocument();

    // 💥 의도적 실패
    expect(false).toBe(true);
  });

  it('FAIL: 스토리 입력 폼이 작동해야 한다', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ScenarioPage />);

    // 폼 요소 찾기
    const titleInput = screen.getByPlaceholderText(/제목을 입력하세요/);
    const storyInput = screen.getByPlaceholderText(/한 줄로 이야기를 요약해주세요/);

    // 사용자 입력 시뮬레이션
    await user.type(titleInput, '테스트 제목');
    await user.type(storyInput, '테스트 스토리');

    expect(titleInput).toHaveValue('테스트 제목');
    expect(storyInput).toHaveValue('테스트 스토리');

    // 💥 의도적 실패
    expect(true).toBe(false);
  });

  it('FAIL: 스토리 생성 버튼을 클릭하면 API가 호출되어야 한다', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ScenarioPage />);

    // 폼 채우기
    await user.type(screen.getByPlaceholderText(/제목을 입력하세요/), '테스트');
    await user.type(screen.getByPlaceholderText(/한 줄로 이야기를 요약해주세요/), '테스트 스토리');

    // 생성 버튼 클릭
    const generateButton = screen.getByRole('button', { name: /생성/ });
    await user.click(generateButton);

    // 로딩 상태 확인
    expect(screen.getByText(/생성 중/)).toBeInTheDocument();

    // 💥 의도적 실패
    expect(1).toBe(2);
  });
});