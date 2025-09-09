import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import ScenarioPage from '../page';
import { useProjectStore } from '@/entities/project';
import * as hooks from '@/shared/lib/hooks/useAutoSave';
import { ToastProvider } from '@/shared/ui/Toast';

// Mock the project store
vi.mock('@/entities/project', () => ({
  useProjectStore: vi.fn(),
}));

// Mock the useAutoSave hook
vi.mock('@/shared/lib/hooks/useAutoSave', () => ({
  useAutoSave: vi.fn(),
}));

// Mock other dependencies
vi.mock('@/lib/ai-client', () => ({
  extractSceneComponents: vi.fn(),
}));

vi.mock('@/lib/utils/prompt-consistency', () => ({
  generateConsistentPrompt: vi.fn(),
  extractStoryboardConfig: vi.fn(),
}));

describe('ScenarioPage - AutoSave Integration', () => {
  const mockSetScenario = vi.fn();
  const mockUseAutoSave = vi.fn();
  
  const mockProjectStore = {
    id: 'test-project',
    scenario: {},
    prompt: {},
    video: {},
    versions: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    setScenario: mockSetScenario,
    setPrompt: vi.fn(),
    setVideo: vi.fn(),
    addVersion: vi.fn(),
    setScenarioId: vi.fn(),
    setPromptId: vi.fn(),
    setVideoAssetId: vi.fn(),
    reset: vi.fn(),
    init: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useProjectStore as any).mockReturnValue(mockProjectStore);
    (hooks.useAutoSave as any).mockReturnValue({
      isSaving: false,
      lastSaved: null,
      saveNow: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderWithToast = (component: React.ReactElement) => {
    return render(
      <ToastProvider>
        {component}
      </ToastProvider>
    );
  };

  it('should integrate useAutoSave hook with scenario data', async () => {
    renderWithToast(<ScenarioPage />);

    // useAutoSave가 호출되었는지 확인
    expect(hooks.useAutoSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '',
        oneLineStory: '',
        toneAndManner: [],
        genre: '',
        target: '',
        duration: '',
        format: '',
        tempo: '',
        developmentMethod: '',
        developmentIntensity: '',
      }),
      expect.any(Function),
      expect.objectContaining({
        delay: 2000,
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    );
  });

  it('should trigger auto save when form data changes', async () => {
    const mockSaveFunction = vi.fn();
    (hooks.useAutoSave as any).mockImplementation((data, saveFn, options) => {
      mockSaveFunction.mockImplementation(saveFn);
      return {
        isSaving: false,
        lastSaved: null,
        saveNow: vi.fn(),
      };
    });

    renderWithToast(<ScenarioPage />);

    // 제목 입력 필드 찾고 변경
    const titleInput = screen.getByPlaceholderText('시나리오 제목을 입력하세요');
    fireEvent.change(titleInput, { target: { value: '테스트 시나리오' } });

    // useAutoSave가 데이터 변경과 함께 호출되었는지 확인
    expect(hooks.useAutoSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '테스트 시나리오',
      }),
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('should show saving indicator when auto save is in progress', async () => {
    (hooks.useAutoSave as any).mockReturnValue({
      isSaving: true,
      lastSaved: null,
      saveNow: vi.fn(),
    });

    renderWithToast(<ScenarioPage />);

    // 저장 중 표시가 나타나는지 확인
    expect(screen.getByText('저장 중...')).toBeInTheDocument();
  });

  it('should show last saved time when available', async () => {
    const lastSavedTime = new Date('2024-01-01T12:00:00.000Z');
    (hooks.useAutoSave as any).mockReturnValue({
      isSaving: false,
      lastSaved: lastSavedTime,
      saveNow: vi.fn(),
    });

    renderWithToast(<ScenarioPage />);

    // 마지막 저장 시간이 표시되는지 확인
    expect(screen.getByText(/마지막 저장:/)).toBeInTheDocument();
  });

  it('should show success toast when auto save succeeds', async () => {
    let onSuccessCallback: (() => void) | undefined;
    
    (hooks.useAutoSave as any).mockImplementation((data, saveFn, options) => {
      onSuccessCallback = options.onSuccess;
      return {
        isSaving: false,
        lastSaved: null,
        saveNow: vi.fn(),
      };
    });

    renderWithToast(<ScenarioPage />);

    // 성공 콜백 실행
    if (onSuccessCallback) {
      onSuccessCallback();
    }

    // 성공 토스트가 표시되는지 확인
    await waitFor(() => {
      expect(screen.getByText('자동 저장 완료')).toBeInTheDocument();
    });
  });

  it('should show error toast when auto save fails', async () => {
    let onErrorCallback: ((error: Error) => void) | undefined;
    
    (hooks.useAutoSave as any).mockImplementation((data, saveFn, options) => {
      onErrorCallback = options.onError;
      return {
        isSaving: false,
        lastSaved: null,
        saveNow: vi.fn(),
      };
    });

    renderWithToast(<ScenarioPage />);

    // 에러 콜백 실행
    if (onErrorCallback) {
      onErrorCallback(new Error('Save failed'));
    }

    // 에러 토스트가 표시되는지 확인
    await waitFor(() => {
      expect(screen.getByText('자동 저장 실패')).toBeInTheDocument();
      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });
  });

  it('should use project store setScenario method for saving', async () => {
    let saveFunction: ((data: any) => Promise<void>) | undefined;
    
    (hooks.useAutoSave as any).mockImplementation((data, saveFn) => {
      saveFunction = saveFn;
      return {
        isSaving: false,
        lastSaved: null,
        saveNow: vi.fn(),
      };
    });

    renderWithToast(<ScenarioPage />);

    // 저장 함수 실행
    if (saveFunction) {
      const testData = { title: '테스트', genre: '드라마' };
      await saveFunction(testData);
    }

    // setScenario가 호출되었는지 확인
    expect(mockSetScenario).toHaveBeenCalledWith({
      title: '테스트',
      genre: '드라마',
    });
  });

  it('should debounce auto save with 2 second delay', () => {
    renderWithToast(<ScenarioPage />);

    // useAutoSave가 2초 지연으로 호출되었는지 확인
    expect(hooks.useAutoSave).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Function),
      expect.objectContaining({
        delay: 2000,
      })
    );
  });

  it('should provide manual save trigger', async () => {
    const mockSaveNow = vi.fn();
    (hooks.useAutoSave as any).mockReturnValue({
      isSaving: false,
      lastSaved: null,
      saveNow: mockSaveNow,
    });

    renderWithToast(<ScenarioPage />);

    // 수동 저장 버튼이 있는지 확인
    const saveButton = screen.getByText('저장');
    fireEvent.click(saveButton);

    // 즉시 저장 함수가 호출되었는지 확인
    expect(mockSaveNow).toHaveBeenCalled();
  });
});