/**
 * useSceneWizard 훅 단위 테스트
 */

import { renderHook, act } from '@testing-library/react';
import { useSceneWizard } from '../useSceneWizard';

describe('useSceneWizard', () => {
  it('초기 상태가 올바르게 설정된다', () => {
    const { result } = renderHook(() => useSceneWizard());
    
    expect(result.current.scenario).toBe('');
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.generatedPrompt).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.lastEnhancedPrompt).toBe('');
    expect(result.current.lastSuggestions).toEqual([]);
    expect(result.current.recentPrompts).toEqual([]);
    expect(result.current.expandedRecent).toEqual({});
    expect(result.current.veo3Preview).toBe('');
    expect(result.current.imagePreviews).toEqual([]);
    expect(result.current.isImageLoading).toBe(false);
    expect(result.current.negativePromptsText).toBe('');
    expect(result.current.enableFullSfx).toBe(false);
    expect(result.current.enableMoviePack).toBe(false);
    expect(result.current.statusMsg).toBeNull();
    expect(result.current.statusKind).toBe('info');
    expect(result.current.seedanceJobIds).toEqual([]);
  });

  it('시나리오 설정이 올바르게 동작한다', () => {
    const { result } = renderHook(() => useSceneWizard());
    
    act(() => {
      result.current.setScenario('테스트 시나리오');
    });
    
    expect(result.current.scenario).toBe('테스트 시나리오');
  });

  it('로딩 상태 전환이 올바르게 동작한다', () => {
    const { result } = renderHook(() => useSceneWizard());
    
    act(() => {
      result.current.setIsGenerating(true);
    });
    
    expect(result.current.isGenerating).toBe(true);
    
    act(() => {
      result.current.setIsGenerating(false);
    });
    
    expect(result.current.isGenerating).toBe(false);
  });

  it('에러 상태 설정이 올바르게 동작한다', () => {
    const { result } = renderHook(() => useSceneWizard());
    
    act(() => {
      result.current.setError('테스트 에러');
    });
    
    expect(result.current.error).toBe('테스트 에러');
    
    act(() => {
      result.current.setError(null);
    });
    
    expect(result.current.error).toBeNull();
  });

  it('생성된 프롬프트 설정이 올바르게 동작한다', () => {
    const { result } = renderHook(() => useSceneWizard());
    
    const testPrompt = { id: 'test-1', prompt: '테스트 프롬프트' };
    
    act(() => {
      result.current.setGeneratedPrompt(testPrompt);
    });
    
    expect(result.current.generatedPrompt).toEqual(testPrompt);
  });

  it('최근 프롬프트 목록 관리가 올바르게 동작한다', () => {
    const { result } = renderHook(() => useSceneWizard());
    
    const testPrompts = [
      { id: 'test-1', savedAt: Date.now(), name: '테스트 1', prompt: { prompt: 'test1' } },
      { id: 'test-2', savedAt: Date.now(), name: '테스트 2', prompt: { prompt: 'test2' } },
    ];
    
    act(() => {
      result.current.setRecentPrompts(testPrompts);
    });
    
    expect(result.current.recentPrompts).toEqual(testPrompts);
  });

  it('이미지 미리보기 관리가 올바르게 동작한다', () => {
    const { result } = renderHook(() => useSceneWizard());
    
    const testPreviews = ['preview1.jpg', 'preview2.jpg'];
    
    act(() => {
      result.current.setImagePreviews(testPreviews);
    });
    
    expect(result.current.imagePreviews).toEqual(testPreviews);
  });

  it('옵션 플래그들이 올바르게 토글된다', () => {
    const { result } = renderHook(() => useSceneWizard());
    
    act(() => {
      result.current.setEnableFullSfx(true);
      result.current.setEnableMoviePack(true);
    });
    
    expect(result.current.enableFullSfx).toBe(true);
    expect(result.current.enableMoviePack).toBe(true);
  });

  it('상태 메시지와 종류가 올바르게 설정된다', () => {
    const { result } = renderHook(() => useSceneWizard());
    
    act(() => {
      result.current.setStatusMsg('성공 메시지');
      result.current.setStatusKind('success');
    });
    
    expect(result.current.statusMsg).toBe('성공 메시지');
    expect(result.current.statusKind).toBe('success');
    
    act(() => {
      result.current.setStatusKind('error');
    });
    
    expect(result.current.statusKind).toBe('error');
  });

  it('Seedance 작업 ID 관리가 올바르게 동작한다', () => {
    const { result } = renderHook(() => useSceneWizard());
    
    const testJobIds = ['job-1', 'job-2', 'job-3'];
    
    act(() => {
      result.current.setSeedanceJobIds(testJobIds);
    });
    
    expect(result.current.seedanceJobIds).toEqual(testJobIds);
  });
});