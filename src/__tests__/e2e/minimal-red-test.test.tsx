/**
 * 최소한의 Red Phase 테스트
 * TDD 사이클의 Red 단계를 확인하기 위한 간단한 테스트
 */

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('Red Phase - 기본 테스트', () => {
  it('FAIL: 의도적으로 실패하는 테스트', () => {
    // Red Phase: 일부러 실패시킴
    expect(1 + 1).toBe(3); // 1 + 1 = 2이지만 3을 기대함
  });

  it('FAIL: 간단한 React 컴포넌트 렌더링 실패', () => {
    // 간단한 컴포넌트 렌더링
    const TestComponent = () => <div>Hello World</div>;
    const { getByText } = render(<TestComponent />);

    // Red Phase: 존재하지 않는 텍스트 기대
    expect(getByText('Goodbye World')).toBeInTheDocument();
  });

  it('FAIL: API 응답 형식 검증 실패', () => {
    const mockApiResponse = {
      success: true,
      data: { id: 1, name: 'test' }
    };

    // Red Phase: 잘못된 구조 기대
    expect(mockApiResponse).toHaveProperty('error');
    expect(mockApiResponse.data).toHaveProperty('username'); // name이 있지만 username 기대
  });
});