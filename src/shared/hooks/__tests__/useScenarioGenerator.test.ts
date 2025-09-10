/**
 * useScenarioGenerator 훅 단위 테스트
 */

import { renderHook, act } from '@testing-library/react';
import { useScenarioGenerator } from '../useScenarioGenerator';

describe('useScenarioGenerator', () => {
  it('초기 상태가 올바르게 설정된다', () => {
    const { result } = renderHook(() => useScenarioGenerator());
    
    expect(result.current.currentStep).toBe(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.errorType).toBeNull();
    expect(result.current.loadingMessage).toBe('');
    expect(result.current.retryCount).toBe(0);
    expect(result.current.steps).toEqual([]);
    expect(result.current.storyInput.title).toBe('');
    expect(result.current.storyInput.story).toBe('');
    expect(result.current.storyInput.genre).toBe('드라마');
    expect(result.current.storyInput.toneAndManner).toEqual(['진중한']);
    expect(result.current.storyInput.target).toBe('일반 대중');
    expect(result.current.storyInput.format).toBe('16:9');
    expect(result.current.storyInput.tempo).toBe('보통');
    expect(result.current.storyInput.developmentMethod).toBe('Freytag 피라미드');
    expect(result.current.storyInput.developmentIntensity).toBe('적당히');
    expect(result.current.storyInput.durationSec).toBe(60);
  });

  it('현재 단계 설정이 올바르게 동작한다', () => {
    const { result } = renderHook(() => useScenarioGenerator());
    
    act(() => {
      result.current.setCurrentStep(2);
    });
    
    expect(result.current.currentStep).toBe(2);
  });

  it('로딩 상태 전환이 올바르게 동작한다', () => {
    const { result } = renderHook(() => useScenarioGenerator());
    
    act(() => {
      result.current.setIsLoading(true);
    });
    
    expect(result.current.isLoading).toBe(true);
    
    act(() => {
      result.current.setIsLoading(false);
    });
    
    expect(result.current.isLoading).toBe(false);
  });

  it('에러 상태 관리가 올바르게 동작한다', () => {
    const { result } = renderHook(() => useScenarioGenerator());
    
    act(() => {
      result.current.setError('네트워크 오류');
      result.current.setErrorType('network');
    });
    
    expect(result.current.error).toBe('네트워크 오류');
    expect(result.current.errorType).toBe('network');
    
    act(() => {
      result.current.setErrorType('server');
    });
    
    expect(result.current.errorType).toBe('server');
  });

  it('스토리 입력 변경이 올바르게 동작한다', () => {
    const { result } = renderHook(() => useScenarioGenerator());
    
    act(() => {
      result.current.handleStoryInputChange('title', '테스트 제목');
    });
    
    expect(result.current.storyInput.title).toBe('테스트 제목');
    
    act(() => {
      result.current.handleStoryInputChange('story', '테스트 스토리');
    });
    
    expect(result.current.storyInput.story).toBe('테스트 스토리');
    
    act(() => {
      result.current.handleStoryInputChange('durationSec', 120);
    });
    
    expect(result.current.storyInput.durationSec).toBe(120);
  });

  it('톤앤매너 배열 처리가 올바르게 동작한다', () => {
    const { result } = renderHook(() => useScenarioGenerator());
    
    act(() => {
      result.current.handleStoryInputChange('toneAndManner', ['유머러스한', '경쾌한']);
    });
    
    expect(result.current.storyInput.toneAndManner).toEqual(['유머러스한', '경쾌한']);
    
    // 문자열을 배열로 변환하는 경우
    act(() => {
      result.current.handleStoryInputChange('toneAndManner', '감동적인');
    });
    
    expect(result.current.storyInput.toneAndManner).toEqual(['감동적인']);
  });

  it('구조를 스텝으로 변환하는 기능이 올바르게 동작한다', () => {
    const { result } = renderHook(() => useScenarioGenerator());
    
    const testStructure = {
      act1: {
        title: '발단',
        description: '이야기의 시작 부분입니다.'
      },
      act2: {
        title: '전개',
        description: '갈등이 심화되는 부분입니다.'
      }
    };
    
    const steps = result.current.convertStructureToSteps(testStructure);
    
    expect(steps).toHaveLength(2);
    expect(steps[0].title).toBe('발단');
    expect(steps[0].description).toBe('이야기의 시작 부분입니다.');
    expect(steps[0].summary).toBe('발단');
    expect(steps[0].index).toBe(1);
    expect(steps[1].title).toBe('전개');
    expect(steps[1].index).toBe(2);
  });

  it('빈 구조 처리가 올바르게 동작한다', () => {
    const { result } = renderHook(() => useScenarioGenerator());
    
    expect(result.current.convertStructureToSteps(null)).toEqual([]);
    expect(result.current.convertStructureToSteps(undefined)).toEqual([]);
    expect(result.current.convertStructureToSteps({})).toEqual([]);
  });

  it('스텝 설정이 올바르게 동작한다', () => {
    const { result } = renderHook(() => useScenarioGenerator());
    
    const testSteps = [
      { id: 'step-1', title: '제목1', description: '설명1', summary: '요약1', index: 1 },
      { id: 'step-2', title: '제목2', description: '설명2', summary: '요약2', index: 2 },
    ];
    
    act(() => {
      result.current.setSteps(testSteps);
    });
    
    expect(result.current.steps).toEqual(testSteps);
  });

  it('상태 초기화가 올바르게 동작한다', () => {
    const { result } = renderHook(() => useScenarioGenerator());
    
    // 상태 변경
    act(() => {
      result.current.setCurrentStep(3);
      result.current.setIsLoading(true);
      result.current.setError('테스트 에러');
      result.current.handleStoryInputChange('title', '테스트');
    });
    
    // 초기화
    act(() => {
      result.current.resetState();
    });
    
    expect(result.current.currentStep).toBe(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.storyInput.title).toBe('');
  });

  it('재시도 횟수 관리가 올바르게 동작한다', () => {
    const { result } = renderHook(() => useScenarioGenerator());
    
    act(() => {
      result.current.setRetryCount(3);
    });
    
    expect(result.current.retryCount).toBe(3);
  });

  it('로딩 메시지 설정이 올바르게 동작한다', () => {
    const { result } = renderHook(() => useScenarioGenerator());
    
    act(() => {
      result.current.setLoadingMessage('AI가 시나리오를 생성하고 있습니다...');
    });
    
    expect(result.current.loadingMessage).toBe('AI가 시나리오를 생성하고 있습니다...');
  });
});