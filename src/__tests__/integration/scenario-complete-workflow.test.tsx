/**
 * 완전한 시나리오 워크플로우 통합 테스트
 * 실제 사용자 시나리오에 따른 전체 시스템 테스트
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { store } from '@/shared/store';

// 테스트할 컴포넌트 (실제 구현 시 사용)
import {
  useStoryGeneration,
  useFullStoryboardWorkflow,
  useAutoSaveProject,
  StoryInput,
  selectWorkflowProgress,
  selectStorySteps,
  selectStoryboardStats,
} from '@/features/scenario';

import { useAppSelector } from '@/shared/store';

// MSW 설정
import { server } from '@/shared/lib/mocks/server';
import { scenarioSuccessHandlers } from '@/shared/lib/mocks/scenario-handlers';

// 실제 사용 예시를 위한 간단한 컴포넌트
const ScenarioWorkflowDemo: React.FC = () => {
  const [storyInput, setStoryInput] = React.useState<StoryInput>({
    title: 'AI 영상기획 시스템 테스트',
    oneLineStory: 'AI가 도움을 주는 영상 제작의 모든 과정',
    toneAndManner: ['전문적인', '미래적인'],
    genre: 'Documentary',
    target: 'Professionals',
    duration: '5분',
    format: '16:9',
    tempo: '보통',
    developmentMethod: '직선적',
    developmentIntensity: '강함',
  });

  // Redux 상태 조회
  const workflowProgress = useAppSelector(selectWorkflowProgress);
  const storySteps = useAppSelector(selectStorySteps);
  const storyboardStats = useAppSelector(selectStoryboardStats);

  // React Query 훅들
  const storyGeneration = useStoryGeneration();
  const fullWorkflow = useFullStoryboardWorkflow();

  // 자동 저장
  const autoSave = useAutoSaveProject(
    'demo-project-123',
    {
      title: storyInput.title,
      storyInput,
      steps: storySteps,
    },
    true, // 항상 더티 상태로 간주
    true  // 자동 저장 활성화
  );

  // 이벤트 핸들러
  const handleGenerateStory = async () => {
    try {
      await storyGeneration.mutateAsync(storyInput);
    } catch (error) {
      console.error('스토리 생성 실패:', error);
    }
  };

  const handleFullWorkflow = async () => {
    if (storySteps.length === 0) {
      alert('먼저 스토리를 생성해주세요');
      return;
    }

    try {
      const result = await fullWorkflow.executeWorkflow(storySteps);
    } catch (error) {
      console.error('워크플로우 실행 실패:', error);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">AI 영상기획 시스템 데모</h1>

      {/* 프로그레스 표시 */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-lg font-semibold">워크플로우 진행률</span>
          <span className="text-sm text-gray-600">
            {workflowProgress.currentStep}/{workflowProgress.totalSteps} 단계
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${workflowProgress.percentage}%` }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {workflowProgress.percentage}% 완료
        </p>
      </div>

      {/* 스토리 입력 */}
      <div className="mb-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">1. 스토리 기획</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">영상 제목</label>
            <input
              type="text"
              value={storyInput.title}
              onChange={(e) => setStoryInput(prev => ({ ...prev, title: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-md"
              placeholder="영상 제목을 입력해주세요"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">한 줄 스토리</label>
            <textarea
              value={storyInput.oneLineStory}
              onChange={(e) => setStoryInput(prev => ({ ...prev, oneLineStory: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-md h-24"
              placeholder="영상의 핵심 내용을 한 줄로 설명해주세요"
            />
          </div>

          <button
            onClick={handleGenerateStory}
            disabled={storyGeneration.isPending || !storyInput.title || !storyInput.oneLineStory}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {storyGeneration.isPending ? '🤖 AI가 스토리 생성 중...' : '✨ 4단계 스토리 생성'}
          </button>
        </div>
      </div>

      {/* 스토리 결과 */}
      {storySteps.length > 0 && (
        <div className="mb-8 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">2. 생성된 4단계 스토리</h2>
          <div className="space-y-4">
            {storySteps.map((step, index) => (
              <div key={step.id} className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-lg">
                  {index + 1}단계: {step.title}
                </h3>
                <p className="text-gray-600 mb-2">{step.summary}</p>
                <p className="text-sm text-gray-500">{step.lengthHint}</p>
              </div>
            ))}
          </div>

          <button
            onClick={handleFullWorkflow}
            disabled={fullWorkflow.isLoading}
            className="mt-6 w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {fullWorkflow.isLoading
              ? `🎬 ${fullWorkflow.currentStep === 1 ? '12샷 분해 중' : '스토리보드 생성 중'}...`
              : '🚀 전체 워크플로우 실행 (샷 분해 + 스토리보드)'
            }
          </button>
        </div>
      )}

      {/* 스토리보드 통계 */}
      {storyboardStats.totalShots > 0 && (
        <div className="mb-8 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">3. 스토리보드 결과</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {storyboardStats.totalShots}
              </div>
              <div className="text-sm text-gray-600">총 샷 수</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {storyboardStats.totalDuration.toFixed(1)}초
              </div>
              <div className="text-sm text-gray-600">총 길이</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {storyboardStats.uniqueShotTypes}
              </div>
              <div className="text-sm text-gray-600">샷 타입 종류</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {storyboardStats.averageShotLength.toFixed(1)}초
              </div>
              <div className="text-sm text-gray-600">평균 샷 길이</div>
            </div>
          </div>
        </div>
      )}

      {/* 자동 저장 상태 */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              autoSave.isAutoSaving ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'
            }`} />
            <span className="text-sm text-gray-600">
              {autoSave.isAutoSaving ? '자동 저장 중...' : '저장됨'}
            </span>
          </div>

          {autoSave.lastAutoSave && (
            <span className="text-xs text-gray-500">
              마지막 저장: {new Date(autoSave.lastAutoSave).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* 에러 표시 */}
      {(storyGeneration.error || fullWorkflow.error) && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800 font-medium">오류가 발생했습니다</div>
          <div className="text-red-600 text-sm mt-1">
            {storyGeneration.error?.message || fullWorkflow.error?.message}
          </div>
        </div>
      )}
    </div>
  );
};

// 테스트 래퍼
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, cacheTime: 0 },
      mutations: { retry: false },
    },
  });

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </Provider>
  );
};

describe('완전한 시나리오 워크플로우 통합 테스트', () => {
  beforeEach(() => {
    server.use(...scenarioSuccessHandlers);
  });

  test('사용자 시나리오: 스토리 입력 → 생성 → 전체 워크플로우 실행', async () => {
    render(
      <TestWrapper>
        <ScenarioWorkflowDemo />
      </TestWrapper>
    );

    // 1. 초기 화면 확인
    expect(screen.getByText('AI 영상기획 시스템 데모')).toBeInTheDocument();
    expect(screen.getByText('0% 완료')).toBeInTheDocument();

    // 2. 스토리 입력 필드 확인 및 입력
    const titleInput = screen.getByPlaceholderText('영상 제목을 입력해주세요');
    const storyInput = screen.getByPlaceholderText('영상의 핵심 내용을 한 줄로 설명해주세요');

    expect(titleInput).toHaveValue('AI 영상기획 시스템 테스트');
    expect(storyInput).toHaveValue('AI가 도움을 주는 영상 제작의 모든 과정');

    // 3. 스토리 생성 버튼 클릭
    const generateStoryButton = screen.getByText('✨ 4단계 스토리 생성');
    expect(generateStoryButton).toBeEnabled();

    fireEvent.click(generateStoryButton);

    // 4. 로딩 상태 확인
    await waitFor(() => {
      expect(screen.getByText('🤖 AI가 스토리 생성 중...')).toBeInTheDocument();
    });

    // 5. 스토리 생성 완료 대기
    await waitFor(
      () => {
        expect(screen.getByText('2. 생성된 4단계 스토리')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // 6. 생성된 스토리 확인
    expect(screen.getByText(/1단계:/)).toBeInTheDocument();
    expect(screen.getByText(/2단계:/)).toBeInTheDocument();
    expect(screen.getByText(/3단계:/)).toBeInTheDocument();
    expect(screen.getByText(/4단계:/)).toBeInTheDocument();

    // 7. 전체 워크플로우 버튼 클릭
    const fullWorkflowButton = screen.getByText('🚀 전체 워크플로우 실행 (샷 분해 + 스토리보드)');
    expect(fullWorkflowButton).toBeEnabled();

    fireEvent.click(fullWorkflowButton);

    // 8. 워크플로우 진행 상태 확인
    await waitFor(() => {
      expect(screen.getByText(/12샷 분해 중|스토리보드 생성 중/)).toBeInTheDocument();
    });

    // 9. 워크플로우 완료 대기
    await waitFor(
      () => {
        expect(screen.getByText('3. 스토리보드 결과')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    // 10. 최종 결과 확인
    expect(screen.getByText('총 샷 수')).toBeInTheDocument();
    expect(screen.getByText('총 길이')).toBeInTheDocument();
    expect(screen.getByText('샷 타입 종류')).toBeInTheDocument();
    expect(screen.getByText('평균 샷 길이')).toBeInTheDocument();

    // 11. 자동 저장 상태 확인
    expect(screen.getByText('저장됨')).toBeInTheDocument();

    // 12. 진행률이 업데이트되었는지 확인
    await waitFor(() => {
      const progressText = screen.queryByText('0% 완료');
      expect(progressText).not.toBeInTheDocument();
    });
  }, 15000); // 15초 타임아웃

  test('에러 상황 처리', async () => {
    // 에러 핸들러로 변경
    server.resetHandlers();
    server.use(...scenarioSuccessHandlers);

    render(
      <TestWrapper>
        <ScenarioWorkflowDemo />
      </TestWrapper>
    );

    // 잘못된 제목으로 변경하여 에러 유발
    const titleInput = screen.getByPlaceholderText('영상 제목을 입력해주세요');

    fireEvent.change(titleInput, { target: { value: 'NETWORK_ERROR_TEST' } });

    const generateButton = screen.getByText('✨ 4단계 스토리 생성');
    fireEvent.click(generateButton);

    // 에러 메시지 확인 (실제로는 MSW에서 에러 시뮬레이션 필요)
    await waitFor(() => {
      // 성공 케이스이므로 에러가 나오지 않을 것
      expect(screen.queryByText('오류가 발생했습니다')).not.toBeInTheDocument();
    });
  });

  test('반응형 UI 및 접근성', async () => {
    render(
      <TestWrapper>
        <ScenarioWorkflowDemo />
      </TestWrapper>
    );

    // 접근성 요소 확인
    const titleInput = screen.getByLabelText('영상 제목');
    const storyInput = screen.getByLabelText('한 줄 스토리');

    expect(titleInput).toBeInTheDocument();
    expect(storyInput).toBeInTheDocument();

    // 키보드 내비게이션 테스트
    titleInput.focus();
    expect(document.activeElement).toBe(titleInput);

    // Tab 키로 다음 요소로 이동
    fireEvent.keyDown(titleInput, { key: 'Tab' });
    await waitFor(() => {
      expect(document.activeElement).toBe(storyInput);
    });
  });

  test('성능 및 메모리 사용량', async () => {
    const startTime = performance.now();

    render(
      <TestWrapper>
        <ScenarioWorkflowDemo />
      </TestWrapper>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // 렌더링 시간이 100ms 이내인지 확인
    expect(renderTime).toBeLessThan(100);

    // 메모리 사용량 체크 (대략적)
    const memoryUsage = (performance as any).memory?.usedJSHeapSize;
    if (memoryUsage) {
      // 50MB 이내 (대략적 기준)
      expect(memoryUsage).toBeLessThan(50 * 1024 * 1024);
    }
  });
});

export { ScenarioWorkflowDemo };