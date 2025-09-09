'use client';

import React, { useState } from 'react';
import { extractSceneComponents } from '@/lib/ai-client';
import { Button } from '@/components/ui/Button';
import { useProjectStore } from '@/entities/project';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { Loading, Skeleton } from '@/shared/ui/Loading';
import { StepProgress } from '@/shared/ui/Progress';
import { 
  generateConsistentPrompt, 
  extractStoryboardConfig,
  type StoryboardConfig,
  type ShotPromptOptions 
} from '@/lib/utils/prompt-consistency';
import {
  StoryboardGallery,
  GenerateStoryboardButton,
  StoryboardProgress,
  type Shot as StoryboardShot
} from '@/components/storyboard';

interface StoryInput {
  title: string;
  oneLineStory: string;
  toneAndManner: string[];
  genre: string;
  target: string;
  duration: string;
  format: string;
  tempo: string;
  developmentMethod: string;
  developmentIntensity: string;
}

interface StoryStep {
  id: string;
  title: string;
  summary: string;
  content: string;
  goal: string;
  lengthHint: string;
  isEditing: boolean;
}

interface Shot {
  id: string;
  stepId: string;
  title: string;
  description: string;
  shotType: string;
  camera: string;
  composition: string;
  length: number;
  dialogue: string;
  subtitle: string;
  transition: string;
  contiImage?: string;
  insertShots: InsertShot[];
}

interface InsertShot {
  id: string;
  purpose: string;
  description: string;
  framing: string;
}

export default function ScenarioPage() {
  const project = useProjectStore();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [storyInput, setStoryInput] = useState<StoryInput>({
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
  });

  const [storySteps, setStorySteps] = useState<StoryStep[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(false);

  // 에러 상태 추가
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'network' | 'server' | 'client' | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // API 응답을 StoryStep 형식으로 변환하는 함수
  const convertStructureToSteps = (structure: any): StoryStep[] => {
    if (!structure) return [];
    
    return Object.entries(structure).map(([key, act]: [string, any], index) => ({
      id: (index + 1).toString(),
      title: act.title || `${index + 1}단계`,
      summary: act.description || '설명 없음',
      content: act.description || '내용 없음',
      goal: act.emotional_arc || '목표 없음',
      lengthHint: `전체의 ${Math.round(100 / 4)}%`,
      isEditing: false,
    }));
  };

  // 검색 및 필터링 상태

  // 톤앤매너 옵션
  const toneOptions = [
    '드라마틱',
    '코믹',
    '로맨틱',
    '미스터리',
    '액션',
    '감성적',
    '유머러스',
    '진지한',
    '판타지',
    '현실적',
  ];

  // 장르 옵션
  const genreOptions = [
    '액션-스릴러',
    '로맨틱-코미디',
    '드라마',
    '판타지',
    'SF',
    '호러',
    '다큐멘터리',
    '애니메이션',
    '뮤지컬',
    '웨스턴',
  ];

  // 포맷 옵션
  const formatOptions = ['16:9', '9:16', '1:1', '21:9', '4:3'];

  // 템포 옵션
  const tempoOptions = ['빠르게', '보통', '느리게'];

  // 전개 방식 옵션
  const developmentOptions = [
    '훅-몰입-반전-떡밥',
    '클래식 기승전결',
    '귀납법',
    '연역법',
    '다큐(인터뷰식)',
    '픽사스토리',
  ];

  // 전개 강도 옵션
  const intensityOptions = ['그대로', '적당히', '풍부하게'];

  // 1단계: 스토리 입력 처리
  const handleStoryInputChange = (field: keyof StoryInput, value: any) => {
    if (field === 'toneAndManner') {
      setStoryInput((prev) => ({
        ...prev,
        toneAndManner: Array.isArray(value) ? value : [value],
      }));
    } else {
      setStoryInput((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
    // FSD: entities 업데이트(스토어 동기화)
    try {
      const patch: any = {};
      if (field === 'genre') patch.genre = value;
      if (field === 'toneAndManner') patch.tone = Array.isArray(value) ? value : [value];
      if (field === 'target') patch.target = value;
      if (field === 'format') patch.format = value;
      if (field === 'tempo') patch.tempo = value;
      if (field === 'developmentMethod') patch.developmentMethod = value;
      if (field === 'developmentIntensity') patch.developmentIntensity = value;
      if (field === 'duration') patch.durationSec = parseInt(value, 10) || undefined;
      if (Object.keys(patch).length) project.setScenario(patch);
    } catch {}
  };

  // 2단계: 4단계 스토리 생성
  const generateStorySteps = async () => {
    setLoading(true);
    setError(null);
    setErrorType(null);
    setLoadingMessage('AI가 스토리를 생성하고 있습니다...');

    try {
      // 실제 AI API 호출 시도
      const response = await fetch('/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          story: storyInput.oneLineStory,
          genre: storyInput.genre,
          tone: storyInput.toneAndManner.join(', '),
          target: storyInput.target,
          duration: storyInput.duration,
          format: storyInput.format,
          tempo: storyInput.tempo,
          developmentMethod: storyInput.developmentMethod,
          developmentIntensity: storyInput.developmentIntensity,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const steps = convertStructureToSteps(data.structure);
        setStorySteps(steps);
        setCurrentStep(2);
        setLoadingMessage('');
        setRetryCount(0); // 성공 시 재시도 카운트 리셋
      } else {
        // API 실패 시 에러 상태 설정
        const status = response.status;
        if (status === 400) {
          setError('필수 정보가 누락되었습니다. 모든 필드를 입력했는지 확인해주세요.');
          setErrorType('client');
        } else if (status >= 500) {
          setError('AI 서버에 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
          setErrorType('server');
        } else {
          setError(`요청 처리 중 오류가 발생했습니다. (오류 코드: ${status})`);
          setErrorType('server');
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
      console.error('AI API 호출 실패:', errorMessage);
      
      // 네트워크 에러 처리
      if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        setError('네트워크 연결을 확인해주세요. 인터넷 연결이 불안정할 수 있습니다.');
        setErrorType('network');
      } else {
        setError('AI 서비스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
        setErrorType('server');
      }
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  // 재시도 함수
  const handleRetry = async () => {
    setRetryCount(prev => prev + 1);
    await generateStorySteps();
  };

  // 3단계: 12개 숏트 생성
  const generateShots = async () => {
    setLoading(true);
    setError(null);
    setLoadingMessage('숏트를 생성하고 있습니다...');

    try {
      const components = await extractSceneComponents({
        scenario: storyInput.oneLineStory || storyInput.title || project.scenario.story || '',
        theme: storyInput.title,
        style: (project.scenario.tone as any)?.[0] || 'cinematic',
        aspectRatio: project.scenario.format || '16:9',
        durationSec: project.scenario.durationSec || 8,
        mood: project.scenario.tempo || 'normal',
        camera: 'wide',
        weather: 'clear',
      });

      const generatedShots: Shot[] = [];
      const generatedStoryboardShots: StoryboardShot[] = [];
      let shotId = 1;

      storySteps.forEach((step) => {
        const shotsPerStep = 3; // 각 단계당 3개 숏트
        for (let i = 0; i < shotsPerStep; i++) {
          const beat = components.timelineBeats?.[Math.min(shotId - 1, components.timelineBeats.length - 1)];
          const shotData = {
            id: `shot-${shotId}`,
            stepId: step.id,
            title: `${step.title} - 숏트 ${i + 1}`,
            description: beat?.action || `${step.summary}에 대한 구체적인 묘사`,
            shotType: '와이드',
            camera: '정적',
            composition: '중앙 정렬',
            length: storyInput.tempo === '빠르게' ? 4 : storyInput.tempo === '느리게' ? 10 : 6,
            dialogue: '',
            subtitle: beat?.audio || '',
            transition: '컷',
            insertShots: [],
          };
          
          generatedShots.push(shotData);
          
          // StoryboardShot 형식으로도 변환
          generatedStoryboardShots.push({
            id: shotData.id,
            title: shotData.title,
            description: shotData.description,
            imageUrl: undefined,
            prompt: undefined,
            shotType: shotData.shotType,
            camera: shotData.camera,
            duration: shotData.length,
            index: shotId,
          });
          
          shotId++;
        }
      });

      setShots(generatedShots);
      setStoryboardShots(generatedStoryboardShots);
      setCurrentStep(3);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  // 스토리 단계 편집
  const toggleStepEditing = (stepId: string) => {
    setStorySteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, isEditing: !step.isEditing } : step)),
    );
  };

  const updateStep = (stepId: string, field: keyof StoryStep, value: string) => {
    setStorySteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, [field]: value } : step)),
    );
  };

  // Storyboard configuration for consistency
  const [storyboardConfig, setStoryboardConfig] = useState<StoryboardConfig | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState<Record<string, boolean>>({});
  const [storyboardShots, setStoryboardShots] = useState<StoryboardShot[]>([]);
  const [storyboardProgress, setStoryboardProgress] = useState<any[]>([]);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // 스토리보드 관련 핸들러들
  const handleBatchGenerate = async (mode: 'all' | 'selected') => {
    setIsBatchGenerating(true);
    const shotsToGenerate = mode === 'all' 
      ? storyboardShots.filter(s => !s.imageUrl)
      : storyboardShots.filter(s => !s.imageUrl).slice(0, 3); // 예시로 처음 3개만
    
    setBatchProgress({ current: 0, total: shotsToGenerate.length });
    
    // 진행 상태 초기화
    const progressSteps = shotsToGenerate.map((shot, index) => ({
      id: `step-${shot.id}`,
      label: `${shot.title} 이미지 생성`,
      status: 'pending' as const,
      message: '대기 중',
    }));
    setStoryboardProgress(progressSteps);
    
    for (let i = 0; i < shotsToGenerate.length; i++) {
      const shot = shotsToGenerate[i];
      
      // 진행 상태 업데이트
      setStoryboardProgress(prev => prev.map((step, idx) => 
        idx === i ? { ...step, status: 'processing', message: '생성 중...' } : 
        idx < i ? { ...step, status: 'completed', message: '완료' } : 
        step
      ));
      
      await generateContiImageForStoryboard(shot.id);
      
      setBatchProgress(prev => ({ ...prev, current: i + 1 }));
    }
    
    // 모든 진행 완료
    setStoryboardProgress(prev => prev.map(step => ({ 
      ...step, 
      status: 'completed', 
      message: '완료' 
    })));
    
    setIsBatchGenerating(false);
  };
  
  const handleRegenerateShot = async (shotId: string) => {
    await generateContiImageForStoryboard(shotId);
  };
  
  const handleEditStoryboardShot = (shotId: string, updates: Partial<StoryboardShot>) => {
    setStoryboardShots(prev => prev.map(shot => 
      shot.id === shotId ? { ...shot, ...updates } : shot
    ));
    
    // 기존 shots도 동기화
    if (updates.title || updates.description) {
      updateShot(shotId, 'title', updates.title || '');
      updateShot(shotId, 'description', updates.description || '');
    }
  };
  
  const handleDownloadShot = (shotId: string, imageUrl?: string) => {
    if (!imageUrl) return;
    
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `storyboard-${shotId}.png`;
    link.click();
  };
  
  const handleDownloadAllShots = async (shots: StoryboardShot[]) => {
    // 모든 이미지를 ZIP으로 다운로드하는 로직 구현
    // 예시로 개별 다운로드
    for (const shot of shots) {
      if (shot.imageUrl) {
        handleDownloadShot(shot.id, shot.imageUrl);
        await new Promise(resolve => setTimeout(resolve, 500)); // 지연
      }
    }
  };
  
  const handleExportPlan = async () => {
    try {
      const res = await fetch('/api/planning/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: {
            title: storyInput.title,
            oneLine: storyInput.oneLineStory,
            structure4: storySteps,
          },
          shots,
        }),
      });
      if (!res.ok) throw new Error('export failed');
      const data = await res.json();
      if (data?.ok && data?.data?.jsonUrl) {
        const a = document.createElement('a');
        a.href = data.data.jsonUrl;
        a.download = `${storyInput.title || 'scenario'}.json`;
        a.click();
      }
    } catch (e) {
      console.error('기획안 다운로드 실패:', e);
    }
  };
  
  // 스토리보드용 콘티 이미지 생성
  const generateContiImageForStoryboard = async (shotId: string) => {
    try {
      setIsGeneratingImage(prev => ({ ...prev, [shotId]: true }));
      
      const shot = storyboardShots.find(s => s.id === shotId);
      if (!shot) {
        throw new Error('Shot not found');
      }

      let config = storyboardConfig;
      if (!config) {
        const storyContext = `${storyInput.title} ${storyInput.oneLineStory}`;
        config = extractStoryboardConfig(storyContext, storyInput.genre);
        setStoryboardConfig(config);
      }

      const shotTypeMap: Record<string, ShotPromptOptions['type']> = {
        '와이드': 'wide',
        '미디엄': 'medium',
        '클로즈업': 'close-up',
        '오버숙c더': 'over-shoulder',
        '투샷': 'two-shot',
        '인서트': 'insert',
        '디테일': 'detail',
        '전체': 'establishing'
      };

      const shotType: ShotPromptOptions['type'] = 
        shotTypeMap[shot.shotType || ''] || 'medium';

      const prompt = generateConsistentPrompt(config, {
        type: shotType,
        action: shot.description || '',
        cameraAngle: shot.camera,
        additionalDetails: ''
      });

      const response = await fetch('/api/imagen/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          aspectRatio: '16:9',
          quality: 'standard'
        })
      });

      if (!response.ok) {
        throw new Error(`Image generation failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.ok && data.imageUrl) {
        // 스토리보드 샷 업데이트
        setStoryboardShots(prev => prev.map(s => 
          s.id === shotId 
            ? { ...s, imageUrl: data.imageUrl, prompt } 
            : s
        ));
        
        // 기존 shots도 업데이트
        setShots(prev => prev.map(s => 
          s.id === shotId 
            ? { ...s, contiImage: data.imageUrl } 
            : s
        ));
      } else {
        throw new Error('No image URL received');
      }
    } catch (error) {
      console.error('Image generation error:', error);
      
      const errorPlaceholder = `data:image/svg+xml;base64,${btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="160" height="90">
          <rect width="100%" height="100%" fill="#f0f0f0"/>
          <text x="80" y="45" text-anchor="middle" fill="#666">Generation Failed</text>
        </svg>
      `)}`;
      
      setStoryboardShots(prev => prev.map(s => 
        s.id === shotId 
          ? { ...s, imageUrl: errorPlaceholder } 
          : s
      ));
    } finally {
      setIsGeneratingImage(prev => ({ ...prev, [shotId]: false }));
    }
  };
  
  // 콘티 이미지 생성 (Real API with consistency)
  const generateContiImage = async (shotId: string) => {
    try {
      // Set loading state for this specific shot
      setIsGeneratingImage(prev => ({ ...prev, [shotId]: true }));
      
      // Find the shot
      const shot = shots.find(s => s.id === shotId);
      if (!shot) {
        throw new Error('Shot not found');
      }

      // Extract or use existing storyboard config
      let config = storyboardConfig;
      if (!config) {
        // Extract config from story context
        const storyContext = `${storyInput.title} ${storyInput.oneLineStory}`;
        config = extractStoryboardConfig(storyContext, storyInput.genre);
        setStoryboardConfig(config);
      }

      // Determine shot type based on shot metadata
      const shotTypeMap: Record<string, ShotPromptOptions['type']> = {
        '와이드': 'wide',
        '미디엄': 'medium',
        '클로즈업': 'close-up',
        '오버숄더': 'over-shoulder',
        '투샷': 'two-shot',
        '인서트': 'insert',
        '디테일': 'detail',
        '전체': 'establishing'
      };

      const shotType: ShotPromptOptions['type'] = 
        shotTypeMap[shot.shotType] || 'medium';

      // Generate consistent prompt
      const prompt = generateConsistentPrompt(config, {
        type: shotType,
        action: shot.description,
        cameraAngle: shot.camera,
        additionalDetails: shot.composition
      });

      console.log('Generating image with prompt:', prompt);

      // Call the real API
      const response = await fetch('/api/imagen/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          aspectRatio: '16:9',
          quality: 'standard'
        })
      });

      if (!response.ok) {
        throw new Error(`Image generation failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.ok && data.imageUrl) {
        // Update shot with generated image
        setShots((prev) =>
          prev.map((s) => 
            s.id === shotId 
              ? { ...s, contiImage: data.imageUrl } 
              : s
          ),
        );
      } else {
        throw new Error('No image URL received');
      }
    } catch (error) {
      console.error('Image generation error:', error);
      // Fallback to a placeholder with error message
      const errorPlaceholder = `data:image/svg+xml;base64,${btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="160" height="90">
          <rect width="100%" height="100%" fill="#f0f0f0"/>
          <text x="80" y="45" text-anchor="middle" fill="#666">Generation Failed</text>
        </svg>
      `)}`;
      
      setShots((prev) =>
        prev.map((s) => 
          s.id === shotId 
            ? { ...s, contiImage: errorPlaceholder } 
            : s
        ),
      );
    } finally {
      // Clear loading state
      setIsGeneratingImage(prev => ({ ...prev, [shotId]: false }));
    }
  };

  // 인서트샷 생성
  const generateInsertShots = async (shotId: string) => {
    const mockInsertShots: InsertShot[] = [
      {
        id: 'insert-1',
        purpose: '정보 보강',
        description: '주요 정보를 강조하는 클로즈업',
        framing: '클로즈업',
      },
      {
        id: 'insert-2',
        purpose: '리듬 조절',
        description: '템포를 조절하는 중간 샷',
        framing: '미디엄 샷',
      },
      {
        id: 'insert-3',
        purpose: '관계 강조',
        description: '캐릭터 간 관계를 보여주는 투샷',
        framing: '투샷',
      },
    ];

    setShots((prev) =>
      prev.map((shot) => (shot.id === shotId ? { ...shot, insertShots: mockInsertShots } : shot)),
    );
  };

  // 숏트 정보 업데이트
  const updateShot = (shotId: string, field: keyof Shot, value: any) => {
    setShots((prev) =>
      prev.map((shot) => (shot.id === shotId ? { ...shot, [field]: value } : shot)),
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Logo size="lg" />
            <nav className="hidden items-center space-x-8 md:flex">
              <a href="/" className="font-medium text-gray-700 hover:text-primary-600">
                홈
              </a>
              <a href="/planning" className="font-medium text-gray-700 hover:text-primary-600">
                기획안 관리
              </a>
            </nav>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/planning/scenario', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: storyInput.title || 'Untitled',
                        logline: storyInput.oneLineStory,
                        structure4: storySteps,
                        shots12: shots,
                      }),
                    });
                    if (!res.ok) throw new Error('scenario save failed');
                    const data = await res.json();
                    if (data?.ok && data?.data?.id) {
                      project.setScenarioId(data.data.id);
                    }
                  } catch (e) {
                    console.error('시나리오 저장 실패:', e);
                  }
                }}
              >
                저장
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">AI 영상 기획</h1>
          <p className="mt-2 text-gray-600">스토리 입력 → 4단계 구성 → 12숏 분해 → PDF 다운로드</p>
        </div>

        {/* 진행 단계 표시 */}
        <div className="mb-8">
          <StepProgress
            steps={[
              {
                id: 'story',
                name: '스토리 입력',
                description: '기본 스토리 내용 작성',
                status: currentStep > 1 ? 'completed' : currentStep === 1 ? 'current' : 'pending'
              },
              {
                id: 'structure',
                name: '4단계 구성',
                description: 'AI가 스토리를 4단계로 구성',
                status: currentStep > 2 ? 'completed' : currentStep === 2 ? 'current' : 'pending'
              },
              {
                id: 'shots',
                name: '12샷 분해',
                description: '각 단계를 3개의 샷으로 분해',
                status: currentStep === 3 ? 'current' : 'pending'
              }
            ]}
          />
        </div>

        {/* 1단계: 스토리 입력 */}
        {currentStep === 1 && (
          <div className="card p-4 sm:p-6" aria-busy={loading} aria-live="polite">
            <h2 className="mb-6 text-xl font-semibold text-gray-900">스토리 입력</h2>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* 기본 정보 */}
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">제목</label>
                  <input
                    type="text"
                    value={storyInput.title}
                    onChange={(e) => handleStoryInputChange('title', e.target.value)}
                    className="w-full rounded-lg border-2 border-brand-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    placeholder="시나리오 제목을 입력하세요"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    한 줄 스토리
                  </label>
                  <textarea
                    value={storyInput.oneLineStory}
                    onChange={(e) => handleStoryInputChange('oneLineStory', e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border-2 border-brand-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    placeholder="스토리의 핵심을 한 줄로 요약하세요"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">타겟</label>
                  <input
                    type="text"
                    value={storyInput.target}
                    onChange={(e) => handleStoryInputChange('target', e.target.value)}
                    className="w-full rounded-lg border-2 border-brand-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    placeholder="타겟 시청자"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">분량</label>
                  <input
                    type="text"
                    value={storyInput.duration}
                    onChange={(e) => handleStoryInputChange('duration', e.target.value)}
                    className="w-full rounded-lg border-2 border-brand-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    placeholder="예: 30초, 60초, 90초"
                  />
                </div>
              </div>

              {/* 스타일 및 전개 */}
              <div className="space-y-4">
                <div>
                  <label className="mb-3 block text-sm font-medium text-gray-900">
                    톤앤매너 (다중 선택)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {toneOptions.map((tone) => (
                      <label key={tone} className="flex cursor-pointer items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={storyInput.toneAndManner.includes(tone)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleStoryInputChange('toneAndManner', [
                                ...storyInput.toneAndManner,
                                tone,
                              ]);
                            } else {
                              handleStoryInputChange(
                                'toneAndManner',
                                storyInput.toneAndManner.filter((t) => t !== tone),
                              );
                            }
                          }}
                          className="text-primary border-border focus:ring-primary h-4 w-4 rounded focus:ring-2 focus:ring-offset-2"
                        />
                        <span className="text-sm text-gray-900">{tone}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">장르</label>
                    <select
                      value={storyInput.genre}
                      onChange={(e) => handleStoryInputChange('genre', e.target.value)}
                      className="w-full rounded-lg border-2 border-brand-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    >
                      <option value="">장르를 선택하세요</option>
                      {genreOptions.map((genre) => (
                        <option key={genre} value={genre}>
                          {genre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">포맷</label>
                    <select
                      value={storyInput.format}
                      onChange={(e) => handleStoryInputChange('format', e.target.value)}
                      className="w-full rounded-lg border-2 border-brand-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    >
                      <option value="">포맷을 선택하세요</option>
                      {formatOptions.map((format) => (
                        <option key={format} value={format}>
                          {format}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">템포</label>
                    <div className="space-y-2">
                      {tempoOptions.map((tempo) => (
                        <label key={tempo} className="flex cursor-pointer items-center space-x-2">
                          <input
                            type="radio"
                            name="tempo"
                            value={tempo}
                            checked={storyInput.tempo === tempo}
                            onChange={(e) => handleStoryInputChange('tempo', e.target.value)}
                            className="text-primary border-border focus:ring-primary h-4 w-4 focus:ring-2 focus:ring-offset-2"
                          />
                          <span className="text-sm text-gray-900">{tempo}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">
                      전개 강도
                    </label>
                    <div className="space-y-2">
                      {intensityOptions.map((intensity) => (
                        <label
                          key={intensity}
                          className="flex cursor-pointer items-center space-x-2"
                        >
                          <input
                            type="radio"
                            name="intensity"
                            value={intensity}
                            checked={storyInput.developmentIntensity === intensity}
                            onChange={(e) =>
                              handleStoryInputChange('developmentIntensity', e.target.value)
                            }
                            className="text-primary border-border focus:ring-primary h-4 w-4 focus:ring-2 focus:ring-offset-2"
                          />
                          <span className="text-sm text-gray-900">{intensity}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">전개 방식</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {developmentOptions.map((method) => {
                      const selected = storyInput.developmentMethod === method;
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => handleStoryInputChange('developmentMethod', method)}
                          className={`rounded-md border p-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                            selected
                              ? 'border-brand-500 bg-primary-50 shadow'
                              : 'border-gray-300 bg-white hover:border-gray-400'
                          }`}
                          aria-pressed={selected ? 'true' : 'false'}
                        >
                          <div className="font-medium text-gray-900">{method}</div>
                          <div className="mt-1 text-xs text-gray-600">
                            {method === '훅-몰입-반전-떡밥' && '시작에 강한 주목→빠른 몰입→반전→후속 기대' }
                            {method === '클래식 기승전결' && '기-승-전-결의 안정적 구조'}
                            {method === '귀납법' && '사례를 모아 결론에 도달'}
                            {method === '연역법' && '결론을 먼저 제시하고 근거로 전개'}
                            {method === '다큐(인터뷰식)' && '인터뷰/내레이션 중심의 전개'}
                            {method === '픽사스토리' && '옛날 옛적에→매일→그러던 어느 날→때문에→결국'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 선택된 옵션 미리보기 */}
            {(storyInput.toneAndManner.length > 0 ||
              storyInput.genre ||
              storyInput.tempo ||
              storyInput.developmentMethod ||
              storyInput.developmentIntensity) && (
              <div className="mt-6 rounded-lg border border-brand-200 bg-primary-50 p-4">
                <h3 className="mb-2 text-sm font-medium text-primary-800">선택된 설정 미리보기</h3>
                <div className="grid grid-cols-1 gap-2 text-sm text-primary-700 sm:grid-cols-2">
                  {storyInput.toneAndManner.length > 0 && (
                    <div>
                      <span className="font-medium">톤앤매너:</span>{' '}
                      {storyInput.toneAndManner.join(', ')}
                    </div>
                  )}
                  {storyInput.genre && (
                    <div>
                      <span className="font-medium">장르:</span> {storyInput.genre}
                    </div>
                  )}
                  {storyInput.tempo && (
                    <div>
                      <span className="font-medium">템포:</span> {storyInput.tempo}
                    </div>
                  )}
                  {storyInput.developmentMethod && (
                    <div>
                      <span className="font-medium">전개 방식:</span> {storyInput.developmentMethod}
                    </div>
                  )}
                  {storyInput.developmentIntensity && (
                    <div>
                      <span className="font-medium">전개 강도:</span>{' '}
                      {storyInput.developmentIntensity}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                onClick={generateStorySteps}
                disabled={loading || !storyInput.title || !storyInput.oneLineStory}
                size="lg"
                className="btn-primary w-full px-8 sm:w-auto"
              >
                {loading ? '생성 중...' : '4단계 스토리 생성'}
              </Button>
            </div>

            {/* 로딩 */}
            {loading && (
              <div className="mt-4">
                <Loading size="md" message={loadingMessage} />
                <Skeleton lines={3} className="mt-4" />
              </div>
            )}

            {/* 에러 메시지 및 재시도 */}
            {error && !loading && (
              <div className="mt-6 rounded-lg border border-danger-200 bg-danger-50 p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-danger-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-danger-800">스토리 생성 실패</h3>
                    <div className="mt-2 text-sm text-danger-700">
                      <p>{error}</p>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <Button
                        onClick={handleRetry}
                        size="sm"
                        className="bg-danger-600 text-white hover:bg-danger-700 focus:ring-danger-500"
                      >
                        <svg
                          className="-ml-1 mr-2 h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        다시 시도
                      </Button>
                      {retryCount > 0 && (
                        <span className="text-xs text-danger-600">
                          재시도 {retryCount}회
                        </span>
                      )}
                    </div>
                    {errorType === 'network' && (
                      <div className="mt-3 rounded-md bg-danger-100 p-2">
                        <p className="text-xs text-danger-700">
                          💡 해결 방법:
                          <br />• 인터넷 연결을 확인해주세요
                          <br />• VPN을 사용 중이라면 잠시 끄고 시도해보세요
                          <br />• 브라우저를 새로고침(F5) 후 다시 시도해주세요
                        </p>
                      </div>
                    )}
                    {errorType === 'server' && retryCount >= 2 && (
                      <div className="mt-3 rounded-md bg-danger-100 p-2">
                        <p className="text-xs text-danger-700">
                          💡 AI 서버가 일시적으로 과부하 상태입니다.
                          <br />• 1-2분 후에 다시 시도해주세요
                          <br />• 계속 문제가 발생하면 고객센터로 문의해주세요
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2단계: 4단계 스토리 검토/수정 */}
        {currentStep === 2 && (
          <div className="card p-4 sm:p-6">
            <h2 className="mb-6 text-xl font-semibold text-gray-900">4단계 스토리 검토/수정</h2>

            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              {storySteps.map((step) => (
                <div key={step.id} className="card-hover p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <h3 className="text-lg font-medium text-gray-900">{step.title}</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleStepEditing(step.id)}
                      className="btn-secondary"
                    >
                      {step.isEditing ? '완료' : '편집'}
                    </Button>
                  </div>

                  {step.isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-900">요약</label>
                        <input
                          type="text"
                          value={step.summary}
                          onChange={(e) => updateStep(step.id, 'summary', e.target.value)}
                          className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-900">본문</label>
                        <textarea
                          value={step.content}
                          onChange={(e) => updateStep(step.id, 'content', e.target.value)}
                          rows={3}
                          className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-900">목표</label>
                        <input
                          type="text"
                          value={step.goal}
                          onChange={(e) => updateStep(step.id, 'goal', e.target.value)}
                          className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        <strong>요약:</strong> {step.summary}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>본문:</strong> {step.content}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>목표:</strong> {step.goal}
                      </p>
                      <p className="text-sm text-gray-500">
                        <strong>길이 힌트:</strong> {step.lengthHint}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-center">
              <Button
                onClick={generateShots}
                disabled={loading}
                size="lg"
                className="btn-primary px-8"
              >
                {loading ? '숏트 생성 중...' : '12개 숏트 생성'}
              </Button>
            </div>

            {/* 로딩 메시지 */}
            {loading && loadingMessage && (
              <div className="mt-4 text-center">
                <div className="text-primary inline-flex items-center space-x-2">
                  <div className="border-primary h-4 w-4 animate-spin rounded-full border-b-2"></div>
                  <span>{loadingMessage}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3단계: 12개 숏트 편집 및 스토리보드 생성 */}
        {currentStep === 3 && (
          <div className="space-y-8">
            {/* 스토리보드 진행 상태 */}
            {isBatchGenerating && (
              <StoryboardProgress
                steps={storyboardProgress}
                className="mb-6"
              />
            )}
            
            {/* 스토리보드 갤러리 섹션 */}
            <div className="card p-4 sm:p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-gray-900">스토리보드 갤러리</h2>
                <div className="flex gap-2">
                  <GenerateStoryboardButton
                    onGenerate={() => handleBatchGenerate('all')}
                    onBatchGenerate={handleBatchGenerate}
                    isLoading={isBatchGenerating}
                    showBatchOption={true}
                    progress={batchProgress.current}
                    total={batchProgress.total}
                    text="모든 이미지 생성"
                    loadingText="이미지 생성 중"
                  />
                  <Button
                    size="lg"
                    className="btn-primary px-6"
                    onClick={handleExportPlan}
                  >
                    기획안 다운로드
                  </Button>
                </div>
              </div>
              
              <StoryboardGallery
                shots={storyboardShots}
                isLoading={false}
                onRegenerateShot={handleRegenerateShot}
                onEditShot={handleEditStoryboardShot}
                onDownloadShot={handleDownloadShot}
                onDownloadAll={handleDownloadAllShots}
              />
            </div>
            
            {/* 기존 숏트 편집 섹션 (숨김 처리 가능) */}
            <details className="card p-4 sm:p-6">
              <summary className="cursor-pointer text-lg font-semibold text-gray-900 hover:text-primary-600">
                상세 숏트 편집 (레거시 뷰)
              </summary>
              <div className="mt-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-text text-xl font-semibold">12개 숏트 편집</h2>
                  <Button
                size="lg"
                className="btn-primary px-6"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/planning/export', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        scenario: {
                          title: storyInput.title,
                          oneLine: storyInput.oneLineStory,
                          structure4: storySteps,
                        },
                        shots,
                      }),
                    });
                    if (!res.ok) throw new Error('export failed');
                    const data = await res.json();
                    if (data?.ok && data?.data?.jsonUrl) {
                      const a = document.createElement('a');
                      a.href = data.data.jsonUrl;
                      a.download = `${storyInput.title || 'scenario'}.json`;
                      a.click();
                    }
                  } catch (e) {
                    console.error('기획안 다운로드 실패:', e);
                  }
                }}
              >
                기획안 다운로드
              </Button>
            </div>

            {/* 숏트 그리드 - 3열×4행 */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {shots.map((shot, index) => (
                <div key={shot.id} className="card-hover p-4">
                  {/* 숏트 헤더 */}
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-text text-lg font-medium">{shot.title}</h3>
                      <p className="text-text-light mt-1 text-sm">{shot.description}</p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateContiImage(shot.id)}
                        className="btn-secondary"
                        disabled={isGeneratingImage[shot.id]}
                      >
                        {isGeneratingImage[shot.id] ? '생성 중...' : '콘티 생성'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateInsertShots(shot.id)}
                        className="btn-secondary"
                      >
                        인서트
                      </Button>
                    </div>
                  </div>

                  {/* 콘티 이미지 프레임 */}
                  <div className="mb-4">
                    <div className="border-border flex min-h-32 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-gray-50">
                      {shot.contiImage ? (
                        <div className="relative w-full">
                          <img
                            src={shot.contiImage}
                            alt="Conti"
                            className="h-32 w-full object-cover"
                          />
                          <div className="absolute right-2 top-2 flex space-x-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => generateContiImage(shot.id)}
                              className="btn-secondary bg-white/80 px-2 py-1 text-xs hover:bg-white"
                              disabled={isGeneratingImage[shot.id]}
                            >
                              {isGeneratingImage[shot.id] ? '생성 중...' : '재생성'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = shot.contiImage!;
                                link.download = `conti-${shot.id}.png`;
                                link.click();
                              }}
                              className="btn-secondary bg-white/80 px-2 py-1 text-xs hover:bg-white"
                            >
                              다운로드
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-text-lighter py-8 text-center">
                          <Icon name="image" className="mx-auto text-gray-400" />
                          <p className="mt-2 text-sm">콘티 이미지를 생성하세요</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 숏 정보 편집 필드 */}
                  <div className="mb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-text mb-1 block text-xs font-medium">샷 타입</label>
                        <select
                          value={shot.shotType}
                          onChange={(e) => updateShot(shot.id, 'shotType', e.target.value)}
                          className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-xs text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        >
                          <option value="와이드">와이드</option>
                          <option value="미디엄">미디엄</option>
                          <option value="클로즈업">클로즈업</option>
                          <option value="익스트림 클로즈업">익스트림 클로즈업</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-text mb-1 block text-xs font-medium">카메라</label>
                        <select
                          value={shot.camera}
                          onChange={(e) => updateShot(shot.id, 'camera', e.target.value)}
                          className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-xs text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        >
                          <option value="정적">정적</option>
                          <option value="팬">팬</option>
                          <option value="틸트">틸트</option>
                          <option value="줌">줌</option>
                          <option value="트래킹">트래킹</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-text mb-1 block text-xs font-medium">구도</label>
                      <select
                        value={shot.composition}
                        onChange={(e) => updateShot(shot.id, 'composition', e.target.value)}
                        className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-xs text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      >
                        <option value="중앙 정렬">중앙 정렬</option>
                        <option value="3분법">3분법</option>
                        <option value="대각선">대각선</option>
                        <option value="프레임 안 프레임">프레임 안 프레임</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-text mb-1 block text-xs font-medium">길이 (초)</label>
                      <input
                        type="number"
                        value={shot.length}
                        onChange={(e) => updateShot(shot.id, 'length', Number(e.target.value))}
                        min="1"
                        max="15"
                        className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-xs text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      />
                    </div>

                    <div>
                      <label className="text-text mb-1 block text-xs font-medium">대사</label>
                      <textarea
                        value={shot.dialogue}
                        onChange={(e) => updateShot(shot.id, 'dialogue', e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-xs text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        placeholder="대사를 입력하세요..."
                      />
                    </div>

                    <div>
                      <label className="text-text mb-1 block text-xs font-medium">자막</label>
                      <input
                        type="text"
                        value={shot.subtitle}
                        onChange={(e) => updateShot(shot.id, 'subtitle', e.target.value)}
                        className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-xs text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        placeholder="자막을 입력하세요..."
                      />
                    </div>

                    <div>
                      <label className="text-text mb-1 block text-xs font-medium">전환</label>
                      <select
                        value={shot.transition}
                        onChange={(e) => updateShot(shot.id, 'transition', e.target.value)}
                        className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-xs text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      >
                        <option value="컷">컷</option>
                        <option value="페이드">페이드</option>
                        <option value="디졸브">디졸브</option>
                        <option value="와이프">와이프</option>
                      </select>
                    </div>
                  </div>

                  {/* 인서트샷 */}
                  {shot.insertShots.length > 0 && (
                    <div className="border-t pt-3">
                      <h4 className="text-text mb-2 text-sm font-medium">인서트샷 추천</h4>
                      <div className="space-y-2">
                        {shot.insertShots.map((insert) => (
                          <div key={insert.id} className="rounded bg-gray-50 p-2 text-xs">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-text font-medium">
                                  <strong>{insert.purpose}:</strong> {insert.description}
                                </p>
                                <p className="text-text-light mt-1">
                                  <strong>프레이밍:</strong> {insert.framing}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generateContiImage(shot.id)}
                                className="btn-secondary px-2 py-1 text-xs"
                                disabled={isGeneratingImage[shot.id]}
                              >
                                {isGeneratingImage[shot.id] ? '생성 중...' : '콘티 생성'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
                </div>

                <div className="mt-8 flex justify-center space-x-4">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(2)}
                    size="lg"
                    className="btn-secondary"
                  >
                    이전 단계
                  </Button>
                  <Button size="lg" className="btn-primary px-8">
                    기획안 다운로드
                  </Button>
                </div>
              </div>
            </details>
          </div>
        )}
      </main>
    </div>
  );
}
