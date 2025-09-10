'use client';

import React, { useState, useMemo } from 'react';
import { extractSceneComponents } from '@/shared/lib';
import { Button, ErrorBoundary } from '@/shared/ui';
import { useProjectStore } from '@/entities/project';
import { Icon } from '@/shared/ui';
import { Logo } from '@/shared/ui';
import { Loading, Skeleton } from '@/shared/ui/Loading';
import { useToast } from '@/shared/lib/hooks';
import { createErrorPlaceholder } from '@/shared/lib/encoding-utils';
import { generatePlanningPDFWithProgress } from '@/shared/lib/pdf-generator';
import { StepProgress } from '@/shared/ui/Progress';
import { generateImageWithPolling } from '@/shared/lib/image-generation-polling';
import { registerScenarioContent, type ContentRegistrationResult } from '@/shared/lib/upload-utils';
import { 
  generateConsistentPrompt, 
  extractStoryboardConfig,
  type StoryboardConfig,
  type ShotPromptOptions 
} from '@/lib/utils/prompt-consistency';
import {
  StoryboardGallery,
  GenerateStoryboardButton,
  StoryboardProgress
} from '@/components/storyboard';
import { StoryInput, StoryStep, Shot, InsertShot, StoryboardShot } from '@/entities/scenario';
import { generateStorySteps, generateShots } from '@/features/scenario';
import { StoryInputForm, StoryStepsEditor, ShotsGrid } from '@/widgets/scenario';

// 타입들은 이제 entities 레이어에서 가져옴

export default function ScenarioPage() {
  const project = useProjectStore();
  const toast = useToast();
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
  
  // 사용자 입력 상태 추가
  const [customTone, setCustomTone] = useState('');
  const [customGenre, setCustomGenre] = useState('');
  const [showCustomToneInput, setShowCustomToneInput] = useState(false);
  const [showCustomGenreInput, setShowCustomGenreInput] = useState(false);

  // 자동 저장을 위한 데이터를 Zustand 스토어에만 저장
  const autoSaveData = useMemo(() => {
    // 데이터가 있는 경우에만 프로젝트 스토어에 자동 저장
    if (storyInput.title || storyInput.oneLineStory || storySteps.length > 0) {
      project.setScenario({
        title: storyInput.title,
        story: storyInput.oneLineStory,
        tone: storyInput.toneAndManner,
        genre: storyInput.genre,
        target: storyInput.target,
        format: storyInput.format,
        tempo: storyInput.tempo,
        developmentMethod: storyInput.developmentMethod,
        developmentIntensity: storyInput.developmentIntensity,
        durationSec: parseInt(storyInput.duration, 10) || undefined,
      });
    }
    
    return {
      title: storyInput.title,
      oneLineStory: storyInput.oneLineStory,
      toneAndManner: storyInput.toneAndManner,
      genre: storyInput.genre,
      target: storyInput.target,
      duration: storyInput.duration,
      format: storyInput.format,
      tempo: storyInput.tempo,
      developmentMethod: storyInput.developmentMethod,
      developmentIntensity: storyInput.developmentIntensity,
      storySteps,
      shots,
    };
  }, [storyInput, storySteps, shots, project]);

  // 수동 저장 기능
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  const saveManually = async () => {
    if (isSaving) return;
    
    try {
      setIsSaving(true);
      
      // 프로젝트 스토어에 저장
      project.setScenario({
        title: autoSaveData.title,
        story: autoSaveData.oneLineStory,
        tone: autoSaveData.toneAndManner,
        genre: autoSaveData.genre,
        target: autoSaveData.target,
        format: autoSaveData.format,
        tempo: autoSaveData.tempo,
        developmentMethod: autoSaveData.developmentMethod,
        developmentIntensity: autoSaveData.developmentIntensity,
        durationSec: parseInt(autoSaveData.duration, 10) || undefined,
      });
      
      setLastSaved(new Date());
      toast.success('시나리오가 임시 저장되었습니다.', '저장 완료', { duration: 3000 });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.',
        '저장 실패',
        { duration: 5000 }
      );
    } finally {
      setIsSaving(false);
    }
  };

  // 에러 상태 추가
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'network' | 'server' | 'client' | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // API 응답을 StoryStep 형식으로 변환하는 함수
  const convertStructureToSteps = (structure: Record<string, unknown> | null | undefined): StoryStep[] => {
    if (!structure) return [];
    
    return Object.entries(structure).map(([key, act], index) => {
      const actData = act as { title?: string; description?: string };
      // title을 기반으로 한 줄 요약 생성
      const generateSummary = (title: string, description: string) => {
        if (!title || !description) return '설명 없음';
        
        // title이 이미 요약적이라면 그대로 사용
        if (title.length <= 30) return title;
        
        // description의 첫 문장을 요약으로 사용
        const firstSentence = description.split('.')[0] || description.split('。')[0];
        return firstSentence.length <= 50 ? firstSentence : firstSentence.substring(0, 47) + '...';
      };

      return {
        id: (index + 1).toString(),
        title: actData.title || `${index + 1}단계`,
        summary: generateSummary(actData.title || '', actData.description || ''),
        content: actData.description || '내용 없음',
        goal: (actData as any).emotional_arc || '목표 없음',
        lengthHint: `전체의 ${Math.round(100 / 4)}%`,
        isEditing: false,
      };
    });
  };

  // 검색 및 필터링 상태

  // 톤앤매너 옵션 (분위기와 감정적 특성)
  const toneOptions = [
    '감성적',
    '유머러스', 
    '진지한',
    '밝고 경쾌한',
    '어둡고 무거운',
    '따뜻하고 희망적',
    '쿨하고 세련된',
    '긴장감 넘치는',
    '몽환적인',
    '현실적인',
    '극적인',
    '서정적인'
  ];

  // 장르 옵션 (스토리 유형과 설정)
  const genreOptions = [
    '드라마',
    '코미디',
    '액션',
    '스릴러',
    '로맨스',
    '판타지',
    'SF',
    '호러',
    '미스터리',
    '다큐멘터리',
    '애니메이션',
    '뮤지컬',
    '웨스턴',
    '범죄',
    '전쟁',
    '가족',
    '청춘',
    '역사'
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
  const handleStoryInputChange = (field: keyof StoryInput, value: string | number | string[]) => {
    if (field === 'toneAndManner') {
      setStoryInput((prev) => ({
        ...prev,
        toneAndManner: Array.isArray(value) ? value : [String(value)],
      }));
    } else {
      setStoryInput((prev) => ({
        ...prev,
        [field]: String(value),
      }));
    }
    // FSD: entities 업데이트(스토어 동기화)
    try {
      const patch: any = {};
      if (field === 'genre') patch.genre = String(value);
      if (field === 'toneAndManner') patch.tone = Array.isArray(value) ? value : [String(value)];
      if (field === 'target') patch.target = String(value);
      if (field === 'format') patch.format = String(value);
      if (field === 'tempo') patch.tempo = String(value);
      if (field === 'developmentMethod') patch.developmentMethod = String(value);
      if (field === 'developmentIntensity') patch.developmentIntensity = String(value);
      if (field === 'duration') patch.durationSec = parseInt(String(value), 10) || undefined;
      if (Object.keys(patch).length) project.setScenario(patch);
    } catch {}
  };

  // 커스텀 톤앤매너 추가 처리
  const handleCustomToneAdd = () => {
    if (customTone.trim() && !storyInput.toneAndManner.includes(customTone.trim())) {
      const newTones = [...storyInput.toneAndManner, customTone.trim()];
      handleStoryInputChange('toneAndManner', newTones);
      setCustomTone('');
      setShowCustomToneInput(false);
    }
  };

  // 커스텀 장르 설정 처리
  const handleCustomGenreSet = () => {
    if (customGenre.trim()) {
      handleStoryInputChange('genre', customGenre.trim());
      setCustomGenre('');
      setShowCustomGenreInput(false);
    }
  };

  // 톤앤매너 제거 처리
  const handleToneRemove = (toneToRemove: string) => {
    const newTones = storyInput.toneAndManner.filter(tone => tone !== toneToRemove);
    handleStoryInputChange('toneAndManner', newTones);
  };

  // 2단계: 4단계 스토리 생성
  const handleGenerateStorySteps = async () => {
    try {
      const steps = await generateStorySteps({
        storyInput,
        onLoadingStart: (message) => {
          setLoading(true);
          setError(null);
          setErrorType(null);
          setLoadingMessage(message);
        },
        onLoadingEnd: () => {
          setLoading(false);
          setLoadingMessage('');
        },
        onError: (error, type) => {
          setError(error);
          setErrorType(type);
          toast.error(error, type === 'client' ? '요청 오류' : type === 'network' ? '네트워크 오류' : '서버 오류');
        },
        onSuccess: (steps, message) => {
          setStorySteps(steps);
          setCurrentStep(2);
          setRetryCount(0);
          toast.success(message, '생성 완료');
        }
      });
    } catch (error) {
      // 에러는 이미 콜백에서 처리됨
    }
  };

  // 재시도 함수
  const handleRetry = async () => {
    setRetryCount(prev => prev + 1);
    await handleGenerateStorySteps();
  };

  // 관리 페이지 등록 상태
  const [registrationStatus, setRegistrationStatus] = useState<{
    isRegistering: boolean;
    result: ContentRegistrationResult | null;
  }>({ isRegistering: false, result: null });

  // 시나리오를 관리 페이지에 등록하는 함수
  const registerToManagement = async () => {
    if (!autoSaveData.title || !autoSaveData.oneLineStory) {
      toast.warning('제목과 스토리 내용이 필요합니다.', '등록 실패');
      return;
    }

    setRegistrationStatus({ isRegistering: true, result: null });

    try {
      const scenarioData = {
        title: autoSaveData.title,
        story: autoSaveData.oneLineStory,
        genre: autoSaveData.genre,
        tone: autoSaveData.toneAndManner,
        target: autoSaveData.target,
        format: autoSaveData.format,
        tempo: autoSaveData.tempo,
        developmentMethod: autoSaveData.developmentMethod,
        developmentIntensity: autoSaveData.developmentIntensity,
        durationSec: parseInt(autoSaveData.duration, 10) || undefined,
      };

      const result = await registerScenarioContent(scenarioData, project.id);
      
      setRegistrationStatus({ isRegistering: false, result });

      if (result.success) {
        toast.success(result.message || '시나리오가 관리 페이지에 등록되었습니다.', '등록 완료');
        
        // 프로젝트 스토어에 ID 저장
        if (result.scenarioId) {
          project.setScenarioId(result.scenarioId);
        }
      } else {
        toast.error(result.error || '등록에 실패했습니다.', '등록 실패');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Registration error:', error);
      }
      setRegistrationStatus({ 
        isRegistering: false, 
        result: {
          success: false,
          error: '등록 중 오류가 발생했습니다.'
        }
      });
      toast.error('등록 중 오류가 발생했습니다.', '등록 실패');
    }
  };

  // 3단계: 12개 숏트 생성
  const handleGenerateShots = async () => {
    try {
      const result = await generateShots({
        storyInput,
        storySteps,
        projectData: {
          scenario: {
            story: project.scenario.story,
            tone: project.scenario.tone,
            format: project.scenario.format,
            durationSec: project.scenario.durationSec,
            tempo: project.scenario.tempo,
          }
        },
        onLoadingStart: (message) => {
          setLoading(true);
          setError(null);
          setLoadingMessage(message);
        },
        onLoadingEnd: () => {
          setLoading(false);
          setLoadingMessage('');
        },
        onError: (error) => {
          toast.error(error, '숏트 생성 실패');
        },
        onSuccess: (shots, storyboardShots, message) => {
          setShots(shots);
          setStoryboardShots(storyboardShots);
          setCurrentStep(3);
          toast.success(message, '숏트 생성 완료');
        }
      });
    } catch (error) {
      // 에러는 이미 콜백에서 처리됨
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
    
    toast.success(`${shotsToGenerate.length}개의 스토리보드 이미지가 모두 생성되었습니다!`, '배치 생성 완료');
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
        // 다운로드 간격 조절을 위한 지연
        let downloadDelayId: NodeJS.Timeout | null = null;
        try {
          await new Promise(resolve => {
            downloadDelayId = setTimeout(resolve, 500);
          });
        } finally {
          if (downloadDelayId) clearTimeout(downloadDelayId);
        }
      }
    }
  };
  
  const handleExportPlan = async (format: 'json' | 'pdf' = 'pdf') => {
    try {
      if (format === 'pdf') {
        // 클라이언트에서 PDF 생성
        const pdfData = {
          title: 'VLANET • 기획안 내보내기',
          generatedAt: new Date().toLocaleString('ko-KR'),
          scenario: {
            title: storyInput.title,
            oneLine: storyInput.oneLineStory,
            structure4: storySteps,
          },
          shots: shots.slice(0, 12), // 최대 12개 숏트만 포함
        };
        
        await generatePlanningPDFWithProgress(pdfData, (progress) => {
          if (process.env.NODE_ENV === 'development') {
            console.log(`PDF 생성 진행률: ${progress}%`);
          }
        });
        
        toast.success('PDF 기획안이 성공적으로 다운로드되었습니다.', 'PDF 다운로드 완료');
        
      } else {
        // JSON 형식으로 다운로드
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
            format: 'json',
          }),
        });
        
        if (!res.ok) throw new Error('export failed');
        const data = await res.json();
        if (data?.ok && data?.data?.jsonUrl) {
          const a = document.createElement('a');
          a.href = data.data.jsonUrl;
          a.download = `${storyInput.title || 'scenario'}.json`;
          a.click();
          toast.success('JSON 기획안이 성공적으로 다운로드되었습니다.', 'JSON 다운로드 완료');
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('기획안 다운로드 실패:', e);
      }
      toast.error('기획안 다운로드에 실패했습니다.', '다운로드 실패');
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
        '오버숄더': 'over-shoulder',
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

      // 재시도 로직 구현 - 메모리 보호를 위해 3회로 제한
      const MAX_RETRIES = 3;
      const RETRY_BASE_DELAY = 1000;
      
      // 지수 백오프 계산 함수
      const calculateDelay = (attempt: number) => {
        const maxDelay = 10000; // 최대 10초
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
        return Math.min(delay, maxDelay);
      };
      let lastError: Error | null = null;
      let data: { structure?: Record<string, unknown> } | null = null;
      
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          if (process.env.NODE_ENV === 'development') {
            console.log(`이미지 생성 시도 ${attempt + 1}/${MAX_RETRIES} for shot ${shotId}`);
          }
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000); // 1분 타임아웃으로 단축
          
          let response: Response;
          
          try {
            response = await fetch('/api/imagen/preview', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                prompt,
                aspectRatio: '16:9',
                quality: 'standard'
              }),
              signal: controller.signal
            });
          } finally {
            // 항상 타임아웃 정리
            clearTimeout(timeoutId);
          }

          // 재시도 가능한 오류 확인 (5xx 서버 오류, 408 타임아웃, 429 Rate Limit, 503, 504)
          if (!response.ok) {
            const isRetryable = response.status >= 500 || 
                              response.status === 408 || 
                              response.status === 429 ||
                              response.status === 503 ||
                              response.status === 504;
                              
            if (!isRetryable || attempt === MAX_RETRIES - 1) {
              throw new Error(`Image generation failed: ${response.status} ${response.statusText}`);
            }
            
            // 재시도 가능한 오류인 경우 다음 시도를 위해 지수 백오프로 대기
            const delay = calculateDelay(attempt);
            if (process.env.NODE_ENV === 'development') {
              console.log(`재시도 가능한 오류 (${response.status}). ${delay}ms 후 재시도...`);
            }
            
            let retryTimeoutId: NodeJS.Timeout | null = null;
            try {
              await new Promise(resolve => {
                retryTimeoutId = setTimeout(resolve, delay);
              });
            } finally {
              if (retryTimeoutId) clearTimeout(retryTimeoutId);
            }
            continue;
          }

          data = await response.json();
          break; // 성공 시 루프 탈출
          
        } catch (fetchError: unknown) {
          const error = fetchError as Error;
          lastError = error;
          if (process.env.NODE_ENV === 'development') {
            console.error(`이미지 생성 시도 ${attempt + 1} 실패:`, error.message || fetchError);
          }
          
          // AbortController로 인한 타임아웃인지 확인
          const isTimeout = error.name === 'AbortError' || (error.message && error.message.includes('timeout'));
          const isNetworkError = error.message && (error.message.includes('fetch') || error.message.includes('network'));
          
          // 재시도 가능한 오류가 아니거나 마지막 시도인 경우
          if ((!isTimeout && !isNetworkError && (!error.message || !error.message.includes('5'))) || attempt === MAX_RETRIES - 1) {
            throw error;
          }
          
          // 재시도 가능한 경우 지수 백오프로 지연 후 계속
          const delay = calculateDelay(attempt);
          if (process.env.NODE_ENV === 'development') {
            console.log(`네트워크/타임아웃 오류. ${delay}ms 후 재시도...`);
          }
          
          let errorTimeoutId: NodeJS.Timeout | null = null;
          try {
            await new Promise(resolve => {
              errorTimeoutId = setTimeout(resolve, delay);
            });
          } finally {
            if (errorTimeoutId) clearTimeout(errorTimeoutId);
          }
        }
      }
      
      if (!data) {
        throw lastError || new Error('All retry attempts failed');
      }
      
      // 더 안전한 데이터 검증 및 fallback 처리
      const apiResponse = data as { ok?: boolean; imageUrl?: string; structure?: Record<string, unknown> };
      if (apiResponse && apiResponse.ok && apiResponse.imageUrl) {
        // 스토리보드 샷 업데이트
        setStoryboardShots(prev => prev.map(s => 
          s.id === shotId 
            ? { ...s, imageUrl: apiResponse.imageUrl, prompt } 
            : s
        ));
        
        // 기존 shots도 업데이트
        setShots(prev => prev.map(s => 
          s.id === shotId 
            ? { ...s, contiImage: apiResponse.imageUrl } 
            : s
        ));
        
        const shotInfo = storyboardShots.find(s => s.id === shotId);
        const successMessage = `"${shotInfo?.title || '이미지'}" 콘티 이미지가 생성되었습니다.`;
        toast.success(successMessage, '이미지 생성 완료');
      } else {
        // 데이터가 없거나 imageUrl이 없는 경우에 대한 fallback 처리
        console.warn('Invalid response data, using fallback image');
        const fallbackImageUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzA4NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+7J2066mV IOyDnOyEsSDsm5A8L3RleHQ+Cjwvc3ZnPg==';
        
        // fallback 이미지로 업데이트
        setStoryboardShots(prev => prev.map(s => 
          s.id === shotId 
            ? { ...s, imageUrl: fallbackImageUrl, prompt } 
            : s
        ));
        
        setShots(prev => prev.map(s => 
          s.id === shotId 
            ? { ...s, contiImage: fallbackImageUrl } 
            : s
        ));
        
        // 경고 메시지 표시하지만 완전히 실패로 처리하지 않음
        const shotInfo = storyboardShots.find(s => s.id === shotId);
        toast.warning(`"${shotInfo?.title || '이미지'}" 이미지 생성에 일부 문제가 있어 기본 이미지를 사용합니다.`, '이미지 생성 경고');
      }
    } catch (error: unknown) {
      const err = error as Error;
      if (process.env.NODE_ENV === 'development') {
        console.error('이미지 생성 최종 실패:', err);
      }
      const shot = storyboardShots.find(s => s.id === shotId);
      
      let errorMessage = `"${shot?.title || '이미지'}" 콘티 이미지 생성에 실패했습니다.`;
      if (err.name === 'AbortError') {
        errorMessage += ' (타임아웃)';
      } else if (err.message && (err.message.includes('fetch') || err.message.includes('network'))) {
        errorMessage += ' (네트워크 오류)';
      }
      
      toast.error(errorMessage, '이미지 생성 실패');
      
      // 실패 시 더 자세한 플레이스홀더 생성
      const errorType = err.name === 'AbortError' ? 'Timeout' : 
                       (err.message && err.message.includes('5')) ? 'Server Error' : 
                       'Generation Failed';
                       
      const errorPlaceholder = createErrorPlaceholder(
        errorType,
        shot?.title || 'Unknown',
        320,
        180
      );
      
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

      if (process.env.NODE_ENV === 'development') {
        console.log('Generating image with prompt:', prompt);
      }

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
      
      // 더 안전한 데이터 검증 및 fallback 처리
      if (data && data.ok && data.imageUrl) {
        // Update shot with generated image
        setShots((prev) =>
          prev.map((s) => 
            s.id === shotId 
              ? { ...s, contiImage: data.imageUrl } 
              : s
          ),
        );
      } else {
        // 데이터가 없거나 imageUrl이 없는 경우에 대한 fallback 처리
        console.warn('Invalid response data in generateContiImage, using fallback image');
        const fallbackImageUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzA4NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+7J2066mV IOyDnOyEsSDsm5A8L3RleHQ+Cjwvc3ZnPg==';
        
        setShots((prev) =>
          prev.map((s) => 
            s.id === shotId 
              ? { ...s, contiImage: fallbackImageUrl } 
              : s
          ),
        );
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Image generation error:', error);
      }
      // Fallback to a placeholder with error message
      const errorPlaceholder = createErrorPlaceholder('Generation Failed');
      
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

  // 인서트샷 생성 - LLM API 연동
  const generateInsertShots = async (shotId: string) => {
    try {
      const shot = shots.find(s => s.id === shotId);
      if (!shot) {
        toast.error('샷을 찾을 수 없습니다.', '인서트 생성 실패');
        return;
      }

      const response = await fetch('/api/ai/generate-inserts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shotTitle: shot.title,
          shotDescription: shot.description,
          genre: storyInput.genre,
          tone: storyInput.toneAndManner.join(', '),
          context: storyInput.oneLineStory,
        }),
      });

      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }

      const data = await response.json();

      if (data.insertShots && Array.isArray(data.insertShots)) {
        setShots((prev) =>
          prev.map((s) => (s.id === shotId ? { ...s, insertShots: data.insertShots } : s)),
        );
        toast.success(`${data.insertShots.length}개의 인서트 샷이 생성되었습니다.`, '인서트 생성 완료');
      } else {
        throw new Error('올바르지 않은 응답 형식');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('인서트 샷 생성 실패:', error);
      }
      toast.error(
        error instanceof Error ? error.message : '인서트 샷 생성 중 오류가 발생했습니다.',
        '인서트 생성 실패'
      );

      // 실패 시 기본 인서트 샷 사용 (폴백)
      const fallbackInsertShots: InsertShot[] = [
        {
          id: `insert-${Date.now()}-1`,
          purpose: '정보 보강',
          description: '주요 정보를 강조하는 클로즈업',
          framing: '클로즈업',
        },
        {
          id: `insert-${Date.now()}-2`,
          purpose: '리듬 조절',
          description: '템포를 조절하는 중간 샷',
          framing: '미디엄 샷',
        },
        {
          id: `insert-${Date.now()}-3`,
          purpose: '관계 강조',
          description: '캐릭터 간 관계를 보여주는 투샷',
          framing: '투샷',
        },
      ];

      setShots((prev) =>
        prev.map((shot) => (shot.id === shotId ? { ...shot, insertShots: fallbackInsertShots } : shot)),
      );
    }
  };

  // 숏트 정보 업데이트
  const updateShot = (shotId: string, field: keyof Shot, value: string | number | boolean) => {
    setShots((prev) =>
      prev.map((shot) => (shot.id === shotId ? { ...shot, [field]: value } : shot)),
    );
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
      {/* 임시저장 상태바 */}
      <div className="bg-white border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-12 items-center justify-end space-x-4">
            {lastSaved && (
              <div className="hidden sm:flex items-center space-x-2 text-sm" role="status" aria-label="저장 상태">
                <div className="h-2 w-2 rounded-full bg-success-500" aria-hidden="true" />
                <span className="text-gray-600">
                  마지막 저장: {lastSaved.toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={saveManually}
              disabled={isSaving}
              aria-label={isSaving ? '저장 중' : '임시저장 실행'}
            >
              {isSaving ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" aria-hidden="true" />
                  저장 중...
                </>
              ) : (
                '임시저장'
              )}
            </Button>
          </div>
        </div>
      </div>

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
                    <button
                      type="button"
                      onClick={() => setShowCustomToneInput(true)}
                      className="flex cursor-pointer items-center space-x-2 text-brand-600 hover:text-brand-700"
                    >
                      <div className="h-4 w-4 rounded border-2 border-brand-600 flex items-center justify-center">
                        <span className="text-xs">+</span>
                      </div>
                      <span className="text-sm">기타 추가</span>
                    </button>
                  </div>
                  
                  {/* 선택된 톤앤매너 태그 표시 */}
                  {storyInput.toneAndManner.length > 0 && (
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-2">
                        {storyInput.toneAndManner.map((tone) => (
                          <span 
                            key={tone}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800"
                          >
                            {tone}
                            <button
                              type="button"
                              onClick={() => handleToneRemove(tone)}
                              className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-brand-400 hover:bg-brand-200 hover:text-brand-500 focus:bg-brand-500 focus:text-white focus:outline-none"
                            >
                              <span className="sr-only">Remove {tone}</span>
                              <span aria-hidden="true">×</span>
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* 커스텀 톤앤매너 입력 */}
                  {showCustomToneInput && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={customTone}
                        onChange={(e) => setCustomTone(e.target.value)}
                        placeholder="새로운 톤앤매너를 입력하세요"
                        className="flex-1 rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleCustomToneAdd();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleCustomToneAdd}
                        className="px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      >
                        추가
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomToneInput(false);
                          setCustomTone('');
                        }}
                        className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">장르</label>
                    {showCustomGenreInput ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customGenre}
                          onChange={(e) => setCustomGenre(e.target.value)}
                          placeholder="새로운 장르를 입력하세요"
                          className="flex-1 rounded-lg border-2 border-brand-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleCustomGenreSet();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleCustomGenreSet}
                          className="px-4 py-3 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        >
                          추가
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomGenreInput(false);
                            setCustomGenre('');
                          }}
                          className="px-4 py-3 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <select
                        value={storyInput.genre === customGenre ? '기타' : storyInput.genre}
                        onChange={(e) => {
                          if (e.target.value === '기타') {
                            setShowCustomGenreInput(true);
                          } else {
                            handleStoryInputChange('genre', e.target.value);
                          }
                        }}
                        className="w-full rounded-lg border-2 border-brand-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      >
                        <option value="">장르를 선택하세요</option>
                        {genreOptions.map((genre) => (
                          <option key={genre} value={genre}>
                            {genre}
                          </option>
                        ))}
                        <option value="기타">기타 (직접 입력)</option>
                      </select>
                    )}
                    {storyInput.genre && !genreOptions.includes(storyInput.genre) && (
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800">
                          커스텀: {storyInput.genre}
                          <button
                            type="button"
                            onClick={() => handleStoryInputChange('genre', '')}
                            className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-brand-400 hover:bg-brand-200 hover:text-brand-500 focus:bg-brand-500 focus:text-white focus:outline-none"
                          >
                            <span className="sr-only">Remove custom genre</span>
                            <span aria-hidden="true">×</span>
                          </button>
                        </span>
                      </div>
                    )}
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
                onClick={handleGenerateStorySteps}
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
                onClick={handleGenerateShots}
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
                    variant="outline"
                    size="lg"
                    onClick={registerToManagement}
                    disabled={registrationStatus.isRegistering || !autoSaveData.title || !autoSaveData.oneLineStory}
                    className="px-6"
                  >
                    {registrationStatus.isRegistering ? '등록 중...' : '관리 페이지에 등록'}
                  </Button>
                  <Button
                    size="lg"
                    className="btn-primary px-6"
                    onClick={() => handleExportPlan()}
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
                onClick={() => handleExportPlan('pdf')}
              >
                기획안 다운로드
              </Button>
            </div>

            {/* 숏트 그리드 - 3열×4행 */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {shots.map((shot, index) => (
                <div key={shot.id} className="card-hover p-4">
                  {/* 콘티 이미지 프레임 */}
                  <div className="mb-4">
                    <div className="border-border relative flex min-h-32 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-gray-50">
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
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <Icon name="image" className="mx-auto text-gray-400" />
                          <p className="mt-2 text-sm text-text-lighter">콘티 이미지를 생성하세요</p>
                          <div className="mt-4 flex space-x-2">
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
                      )}
                    </div>
                  </div>

                  {/* 숏트 정보 - 이미지 아래로 이동 */}
                  <div className="mb-3">
                    <h3 className="text-text text-lg font-medium">{shot.title}</h3>
                    <p className="text-text-light mt-1 text-sm">{shot.description}</p>
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
    </ErrorBoundary>
  );
}
