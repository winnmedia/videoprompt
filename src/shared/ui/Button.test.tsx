/**
 * Button Component Tests
 * 기본 UI 컴포넌트 테스트
 */

import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('기본 버튼을 렌더링한다', () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('inline-flex');
  });

  it('variant props를 올바르게 적용한다', () => {
    render(<Button variant="destructive">Delete</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-red-600');
  });

  it('disabled 상태를 올바르게 적용한다', () => {
    render(<Button disabled>Disabled</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:opacity-50');
  });

  it('loading 상태를 표시한다', () => {
    render(<Button loading>Loading</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('커스텀 className을 적용한다', () => {
    render(<Button className="custom-class">Custom</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });
});
