'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { extractSceneComponents } from '@/shared/lib';
import { Button, ErrorBoundary, LoadingOverlay, LoadingSpinner } from '@/shared/ui';
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
} from '@/shared/lib/prompt-consistency';
import {
  StoryboardGallery,
  GenerateStoryboardButton
} from '@/widgets/storyboard';
import { StoryInput, StoryStep, Shot, InsertShot, StoryboardShot, StoryTemplate } from '@/entities/scenario';
import { generateStorySteps, generateShots } from '@/features/scenario';
import { StoryInputForm, StoryStepsEditor, ShotsGrid } from '@/widgets/scenario';
import { safeFetch } from '@/shared/lib/api-retry';

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
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // 사용자 입력 상태 추가
  const [customTone, setCustomTone] = useState('');
  const [customGenre, setCustomGenre] = useState('');
  const [showCustomToneInput, setShowCustomToneInput] = useState(false);
  const [showCustomGenreInput, setShowCustomGenreInput] = useState(false);

  // 자동 저장용 데이터 메모이제이션 (side effect 제거)
  const autoSaveData = useMemo(() => ({
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
  }), [storyInput, storySteps, shots]);

  // 자동 저장을 위한 상태
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // 프로젝트 스토어 자동 저장 로직 (디바운싱 적용)
  useEffect(() => {
    // 데이터가 있는 경우에만 자동 저장
    if (storyInput.title || storyInput.oneLineStory || storySteps.length > 0) {
      // 기존 타이머 정리
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }

      // 1초 디바운싱 적용
      const timer = setTimeout(() => {
        try {
          project.setScenario({
            title: storyInput.title,
            story: storyInput.oneLineStory,
            // tone 필드 안전하게 처리 - 배열을 문자열로 변환
            tone: Array.isArray(storyInput.toneAndManner) 
              ? storyInput.toneAndManner.join(', ')
              : storyInput.toneAndManner || '',
            genre: storyInput.genre,
            target: storyInput.target,
            format: storyInput.format,
            tempo: storyInput.tempo,
            developmentMethod: storyInput.developmentMethod,
            developmentIntensity: storyInput.developmentIntensity,
            // duration 안전하게 파싱
            durationSec: storyInput.duration && storyInput.duration.trim() 
              ? parseInt(storyInput.duration, 10) || undefined
              : undefined,
          });
        } catch (error) {
          console.error('프로젝트 스토어 저장 중 오류:', error);
          toast.error('프로젝트 저장 중 오류가 발생했습니다.');
        }
      }, 1000);

      setAutoSaveTimer(timer);
    }

    // cleanup 함수
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [storyInput, storySteps, project, toast]); // autoSaveTimer를 의존성에서 제외

  // 자동 저장 함수
  const saveToDatabase = async (storyData: typeof autoSaveData) => {
    if (!storyData.title || !storyData.oneLineStory) return;
    
    try {
      setIsAutoSaving(true);
      
      const response = await safeFetch('/api/planning/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: storyData.title,
          oneLineStory: storyData.oneLineStory,
          genre: storyData.genre,
          tone: Array.isArray(storyData.toneAndManner) 
            ? storyData.toneAndManner.join(', ')
            : storyData.toneAndManner || '',
          target: storyData.target,
          structure: storyData.storySteps.length > 0 ? Object.fromEntries(
            storyData.storySteps.map((step, index) => [
              `act${index + 1}`,
              {
                title: step.title,
                description: step.content,
                emotional_arc: step.goal,
              },
            ])
          ) : undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('스토리 자동 저장 성공:', result.id);
        // 성공 시 저장된 ID를 프로젝트 스토어에 저장
        if (result.id) {
          project.setScenarioId(result.id);
        }
      } else {
        console.warn('스토리 자동 저장 실패:', response.status);
      }
    } catch (error) {
      console.warn('스토리 자동 저장 오류:', error);
    } finally {
      setIsAutoSaving(false);
    }
  };

  // debounced 자동 저장 트리거
  React.useEffect(() => {
    // 이전 타이머 정리
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    // 새로운 타이머 설정 (2초 지연)
    const newTimer = setTimeout(() => {
      if (autoSaveData.title && autoSaveData.oneLineStory) {
        saveToDatabase(autoSaveData);
      }
    }, 2000);

    setAutoSaveTimer(newTimer);

    // cleanup
    return () => {
      if (newTimer) {
        clearTimeout(newTimer);
      }
    };
  }, [autoSaveData]);

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

  // 템플릿 선택 처리
  const handleTemplateSelect = (template: StoryTemplate) => {
    setStoryInput(template.template);
    toast.success(`"${template.name}" 템플릿이 적용되었습니다.`, '템플릿 적용');
  };

  // StoryStepsEditor용 핸들러 함수들
  const handleToggleEditing = (stepId: string) => {
    // TODO: 스텝 편집 상태 토글 로직 구현
    console.log('Toggle editing for step:', stepId);
  };

  const handleUpdateStep = (stepId: string, field: keyof StoryStep, value: string) => {
    setStorySteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, [field]: value } : step
    ));
  };

  // 시나리오 저장 (기획안 저장)
  const handleSaveScenario = async () => {
    try {
      // 현재 스토리 정보를 API에 저장
      const scenarioData = {
        type: 'scenario',
        projectId: 'scenario_' + Date.now(),
        source: 'user_created',
        title: storyInput.title || '생성된 시나리오',
        story: storySteps.length > 0 ? JSON.stringify(storySteps) : storyInput.oneLineStory || '',
        genre: storyInput.genre,
        tone: Array.isArray(storyInput.toneAndManner) ? storyInput.toneAndManner.join(', ') : storyInput.toneAndManner || 'Neutral',
        target: storyInput.target,
        format: storyInput.format,
        tempo: storyInput.tempo,
        developmentMethod: storyInput.developmentMethod,
        developmentIntensity: storyInput.developmentIntensity,
        durationSec: parseInt(storyInput.duration) || 60,
        createdAt: new Date().toISOString()
      };

      const response = await safeFetch('/api/planning/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scenarioData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '기획안 저장에 실패했습니다');
      }

      const result = await response.json();
      toast.success('기획안이 성공적으로 저장되었습니다.', '기획안 저장');
    } catch (error) {
      console.error('Scenario save error:', error);
      toast.error(error instanceof Error ? error.message : '기획안 저장 중 오류가 발생했습니다', '저장 오류');
    }
  };

  // 현재 설정을 템플릿으로 저장
  const handleSaveAsTemplate = async (templateData: { name: string; description: string; storyInput: StoryInput }) => {
    try {
      const response = await safeFetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: templateData.name,
          description: templateData.description,
          category: 'custom',
          template: templateData.storyInput,
          isPublic: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '템플릿 저장에 실패했습니다');
      }

      const result = await response.json();
      toast.success(`"${templateData.name}" 템플릿이 성공적으로 저장되었습니다.`, '템플릿 저장');
    } catch (error) {
      console.error('Template save error:', error);
      const errorMessage = error instanceof Error ? error.message : '템플릿 저장에 실패했습니다.';
      toast.error(errorMessage, '저장 실패');
      throw error; // TemplateSelector에서 에러 처리할 수 있도록
    }
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
  // 이전 단계로 돌아가기
  const handleGoBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3);
    }
  };

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
  // const [storyboardProgress, setStoryboardProgress] = useState<any[]>([]); // 일괄 생성 제거로 미사용

  // 스토리보드 관련 핸들러들 (일괄 생성 제거됨)
  
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
        const res = await safeFetch('/api/planning/export', {
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
            response = await safeFetch('/api/imagen/preview', {
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
      const response = await safeFetch('/api/imagen/preview', {
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

      const response = await safeFetch('/api/ai/generate-inserts', {
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
            {(lastSaved || isAutoSaving) && (
              <div className="hidden sm:flex items-center space-x-2 text-sm" role="status" aria-label="저장 상태">
                <div className={`h-2 w-2 rounded-full ${isAutoSaving ? 'bg-blue-500 animate-pulse' : 'bg-success-500'}`} aria-hidden="true" />
                <span className="text-gray-600">
                  {isAutoSaving ? '자동 저장 중...' : lastSaved ? 
                    `마지막 저장: ${lastSaved.toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}` : ''
                  }
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
          <StoryInputForm
            storyInput={storyInput}
            onInputChange={handleStoryInputChange}
            onSubmit={handleGenerateStorySteps}
            loading={loading}
            error={error}
            errorType={errorType}
            retryCount={retryCount}
            onRetry={handleRetry}
            customTone={customTone}
            setCustomTone={setCustomTone}
            showCustomToneInput={showCustomToneInput}
            setShowCustomToneInput={setShowCustomToneInput}
            customGenre={customGenre}
            setCustomGenre={setCustomGenre}
            showCustomGenreInput={showCustomGenreInput}
            setShowCustomGenreInput={setShowCustomGenreInput}
            onTemplateSelect={handleTemplateSelect}
            onSaveAsTemplate={handleSaveAsTemplate}
          />
        )}
        

        {/* 2단계: 4단계 스토리 검토/수정 */}
        {currentStep === 2 && (
          <StoryStepsEditor
            storySteps={storySteps}
            onToggleEditing={handleToggleEditing}
            onUpdateStep={handleUpdateStep}
            onGenerateShots={handleGenerateShots}
            loading={loading}
            loadingMessage={loadingMessage}
            developmentMethod={storyInput.developmentMethod}
            onGoBack={handleGoBack}
          />
        )}
        {/* 3단계: 12개 숏트 편집 및 스토리보드 생성 */}
        {currentStep === 3 && (
          <div className="space-y-8">
            {/* 스토리보드 진행 상태 - 일괄 생성 제거로 비활성화 */}
            
            {/* 스토리보드 갤러리 섹션 */}
            <div className="card p-4 sm:p-6">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button
                    variant="outline"
                    onClick={handleGoBack}
                    size="lg"
                    className="px-6"
                  >
                    이전 단계
                  </Button>
                  <h2 className="text-2xl font-semibold text-gray-900">스토리보드 갤러리</h2>
                </div>
                <div className="flex gap-2">
                  {/* 일괄 생성 기능 제거 - 개별 생성만 사용 */}
                  <div className="text-sm text-gray-500 flex items-center">
                    각 스토리보드에서 개별적으로 이미지를 생성하세요
                  </div>
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
                  <div className="flex space-x-3">
                    <Button
                      size="lg"
                      variant="outline"
                      className="px-6"
                      onClick={handleSaveScenario}
                    >
                      기획안 저장
                    </Button>
                    <Button
                      size="lg"
                      className="btn-primary px-6"
                      onClick={() => handleExportPlan('pdf')}
                    >
                      기획안 다운로드
                    </Button>
                  </div>
            </div>

            {/* 숏트 그리드 - 3열×4행 */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {shots.map((shot) => (
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
    
    {/* 로딩 오버레이 */}
    <LoadingOverlay 
      visible={loading} 
      message={loadingMessage || 'AI가 처리 중입니다...'} 
    />
    
    </ErrorBoundary>
  );
}
