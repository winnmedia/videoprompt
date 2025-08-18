import { describe, it, expect } from 'vitest';

describe('Simple Test', () => {
  it('should work correctly', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle strings', () => {
    expect('Hello').toBe('Hello');
  });

  it('should handle arrays', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr[0]).toBe(1);
  });
});
