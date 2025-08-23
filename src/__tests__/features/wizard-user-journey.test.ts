import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transformPromptForTarget, rewritePromptForSeedance } from '@/lib/ai-client';

// Mock fetch globally
global.fetch = vi.fn();

describe('Wizard User Journey - LLM Prompt Transformation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('이미지용 프롬프트 변환이 올바르게 작동한다', async () => {
    const mockResponse = { ok: true, json: () => Promise.resolve({ choices: [{ message: { content: 'Static image prompt' } }] }) };
    (global.fetch as any).mockResolvedValue(mockResponse);
    
    const result = await transformPromptForTarget('A cinematic scene', { target: 'image' });
    expect(result).toBe('Static image prompt');
  });

  it('비디오용 프롬프트 변환이 올바르게 작동한다', async () => {
    const mockResponse = { ok: true, json: () => Promise.resolve({ choices: [{ message: { content: 'Video prompt with motion' } }] }) };
    (global.fetch as any).mockResolvedValue(mockResponse);
    
    const result = await transformPromptForTarget('A cinematic scene', { 
      target: 'video', 
      aspectRatio: '16:9', 
      duration: 3 
    });
    expect(result).toBe('Video prompt with motion');
  });

  it('Seedance 전용 프롬프트 변환이 올바르게 작동한다', async () => {
    const mockResponse = { ok: true, json: () => Promise.resolve({ choices: [{ message: { content: 'Optimized video prompt' } }] }) };
    (global.fetch as any).mockResolvedValue(mockResponse);
    
    const result = await rewritePromptForSeedance('A cinematic scene', {
      aspectRatio: '21:9',
      duration: 5,
      style: 'cinematic'
    });
    expect(result).toBe('Optimized video prompt');
  });

  it('API 실패 시 원본 프롬프트를 반환한다', async () => {
    (global.fetch as any).mockRejectedValue(new Error('API Error'));
    
    const result = await transformPromptForTarget('Original prompt', { target: 'image' });
    expect(result).toBe('Original prompt');
  });

  it('빈 프롬프트는 빈 문자열을 반환한다', async () => {
    const result = await transformPromptForTarget('', { target: 'image' });
    expect(result).toBe('');
  });
});
