'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useProjectStore } from '@/entities/project';
import { Icon } from '@/shared/ui';
import { useSeedancePolling } from '@/features/seedance/status';

interface WorkflowData {
  story: string;
  scenario: {
    genre: string;
    tone: string;
    target: string;
    structure: string[];
    aiGenerated?: any;
  };
  prompt: {
    // Base Style
    visualStyle: string;
    genre: string;
    mood: string;
    quality: string;
    directorStyle: string;

    // Spatial Context
    weather: string;
    lighting: string;

    // Camera Setting
    primaryLens: string;
    dominantMovement: string;

    // Core Object
    material: string;

    // Timeline
    angle: string;
    move: string;
    pacing: string;
    audioQuality: string;

    aiGenerated?: any;
    finalPrompt?: string;
    negativePrompt?: string;
    keywords?: string[];
  };
  video: {
    duration: number;
    model: string;
  };
}

const WORKFLOW_STEPS = [
  { id: 1, name: '프롬프트 선택', description: '기존 프롬프트 선택 또는 새로 생성' },
  { id: 2, name: '영상 설정', description: '영상 길이 및 모델 선택' },
  { id: 3, name: '영상 생성', description: 'AI가 영상 제작' },
];

// 기존 장르 옵션은 제거하고 INSTRUCTION.md 기반으로 통합

// INSTRUCTION.md 기반 선택지 상수들
const VISUAL_STYLE_OPTIONS = [
  { value: 'Photorealistic', label: 'Photorealistic', description: '사실적인 현실감' },
  { value: 'Hyperrealistic', label: 'Hyperrealistic', description: '초현실적인 사실감' },
  { value: 'Cinematic', label: 'Cinematic', description: '영화적 분위기' },
  { value: 'Anamorphic', label: 'Anamorphic', description: '아나모픽 와이드스크린' },
  { value: 'Vintage Film', label: 'Vintage Film', description: '빈티지 필름 느낌' },
];

const GENRE_OPTIONS = [
  { value: 'Action-Thriller', label: 'Action-Thriller', description: '액션과 스릴러의 조합' },
  { value: 'Sci-Fi Noir', label: 'Sci-Fi Noir', description: 'SF와 느와르의 조합' },
  { value: 'Fantasy Epic', label: 'Fantasy Epic', description: '판타지 서사시' },
  { value: 'Modern Drama', label: 'Modern Drama', description: '현대 드라마' },
  { value: 'Horror', label: 'Horror', description: '공포' },
  { value: 'Comedy', label: 'Comedy', description: '코미디' },
  { value: 'Romance', label: 'Romance', description: '로맨스' },
  { value: 'Documentary', label: 'Documentary', description: '다큐멘터리' },
];

const MOOD_OPTIONS = [
  { value: 'Tense', label: 'Tense', description: '긴장감 있는' },
  { value: 'Moody', label: 'Moody', description: '우울한 분위기' },
  { value: 'Gritty', label: 'Gritty', description: '거칠고 현실적인' },
  { value: 'Serene', label: 'Serene', description: '평온한' },
  { value: 'Energetic', label: 'Energetic', description: '활기찬' },
  { value: 'Nostalgic', label: 'Nostalgic', description: '향수를 불러일으키는' },
];

const QUALITY_OPTIONS = [
  { value: '4K', label: '4K', description: '4K 해상도' },
  { value: '8K', label: '8K', description: '8K 해상도' },
  { value: 'IMAX Quality', label: 'IMAX Quality', description: 'IMAX 품질' },
  { value: 'HD', label: 'HD', description: 'HD 해상도' },
];

const DIRECTOR_STYLE_OPTIONS = [
  {
    value: 'Christopher Nolan style',
    label: 'Christopher Nolan style',
    description: '놀란 감독 스타일',
  },
  { value: 'David Fincher style', label: 'David Fincher style', description: '핀처 감독 스타일' },
  { value: 'Wes Anderson style', label: 'Wes Anderson style', description: '앤더슨 감독 스타일' },
];

const WEATHER_OPTIONS = [
  { value: 'Clear', label: 'Clear', description: '맑음' },
  { value: 'Rain', label: 'Rain', description: '비' },
  { value: 'Heavy Rain', label: 'Heavy Rain', description: '폭우' },
  { value: 'Snow', label: 'Snow', description: '눈' },
  { value: 'Fog', label: 'Fog', description: '안개' },
  { value: 'Overcast', label: 'Overcast', description: '흐림' },
];

const LIGHTING_OPTIONS = [
  { value: 'Daylight (Midday)', label: 'Daylight (Midday)', description: '대낮 햇빛' },
  { value: 'Golden Hour', label: 'Golden Hour', description: '골든아워' },
  { value: 'Blue Hour', label: 'Blue Hour', description: '블루아워' },
  { value: 'Night', label: 'Night', description: '밤' },
  { value: 'Studio Lighting', label: 'Studio Lighting', description: '스튜디오 조명' },
  { value: 'Flickering Light', label: 'Flickering Light', description: '깜빡이는 조명' },
];

const PRIMARY_LENS_OPTIONS = [
  { value: '16mm Fisheye', label: '16mm Fisheye', description: '16mm 어안렌즈' },
  { value: '24mm Wide-angle', label: '24mm Wide-angle', description: '24mm 광각렌즈' },
  { value: '50mm Standard', label: '50mm Standard', description: '50mm 표준렌즈' },
  { value: '85mm Portrait', label: '85mm Portrait', description: '85mm 인물렌즈' },
  { value: '135mm Telephoto', label: '135mm Telephoto', description: '135mm 망원렌즈' },
];

const DOMINANT_MOVEMENT_OPTIONS = [
  { value: 'Static Shot', label: 'Static Shot', description: '정적 촬영' },
  { value: 'Shaky Handheld', label: 'Shaky Handheld', description: '떨리는 핸드헬드' },
  {
    value: 'Smooth Tracking (Dolly)',
    label: 'Smooth Tracking (Dolly)',
    description: '부드러운 트래킹',
  },
  { value: 'Crane Shot', label: 'Crane Shot', description: '크레인 촬영' },
  { value: 'Zoom', label: 'Zoom', description: '줌' },
];

const MATERIAL_OPTIONS = [
  { value: 'Brushed Metal', label: 'Brushed Metal', description: '브러시 처리된 금속' },
  { value: 'Polished Wood', label: 'Polished Wood', description: '윤기 나는 나무' },
  { value: 'Transparent Glass', label: 'Transparent Glass', description: '투명한 유리' },
  { value: 'Matte Plastic', label: 'Matte Plastic', description: '매트한 플라스틱' },
  { value: 'Rough Fabric', label: 'Rough Fabric', description: '거친 직물' },
  { value: 'Leather', label: 'Leather', description: '가죽' },
];

const ANGLE_OPTIONS = [
  { value: 'Wide Shot (WS)', label: 'Wide Shot (WS)', description: '와이드 샷' },
  { value: 'Medium Shot (MS)', label: 'Medium Shot (MS)', description: '미디엄 샷' },
  { value: 'Close Up (CU)', label: 'Close Up (CU)', description: '클로즈업' },
  {
    value: 'Extreme Close Up (ECU)',
    label: 'Extreme Close Up (ECU)',
    description: '익스트림 클로즈업',
  },
  { value: 'Point of View (POV)', label: 'Point of View (POV)', description: '시점 촬영' },
];

const MOVE_OPTIONS = [
  { value: 'Pan (Left/Right)', label: 'Pan (Left/Right)', description: '팬 (좌우)' },
  { value: 'Tilt (Up/Down)', label: 'Tilt (Up/Down)', description: '틸트 (상하)' },
  { value: 'Dolly (In/Out)', label: 'Dolly (In/Out)', description: '돌리 (진입/후퇴)' },
  { value: 'Tracking (Follow)', label: 'Tracking (Follow)', description: '트래킹 (따라가기)' },
  { value: 'Whip Pan', label: 'Whip Pan', description: '휩 팬' },
];

const PACING_OPTIONS = [
  { value: 'Real-time', label: 'Real-time', description: '실시간' },
  { value: 'Slow-motion (0.5x)', label: 'Slow-motion (0.5x)', description: '슬로모션 (0.5배)' },
  { value: 'Slow-motion (0.2x)', label: 'Slow-motion (0.2x)', description: '슬로모션 (0.2배)' },
  { value: 'Fast-motion (2x)', label: 'Fast-motion (2x)', description: '패스트모션 (2배)' },
  { value: 'Time-lapse', label: 'Time-lapse', description: '타임랩스' },
  { value: 'Freeze-frame', label: 'Freeze-frame', description: '프리즈프레임' },
];

const AUDIO_QUALITY_OPTIONS = [
  { value: 'Clear', label: 'Clear', description: '명확한' },
  { value: 'Muffled', label: 'Muffled', description: '둔탁한' },
  { value: 'Echoing', label: 'Echoing', description: '메아리치는' },
  { value: 'Distant', label: 'Distant', description: '먼' },
  { value: 'Crisp', label: 'Crisp', description: '선명한' },
];

const TONE_OPTIONS = [
  { value: 'serious', label: '진지한', description: '무게감 있고 신뢰할 수 있는' },
  { value: 'light', label: '가벼운', description: '편안하고 부담 없는' },
  { value: 'inspirational', label: '영감을 주는', description: '동기부여와 희망을 전하는' },
  { value: 'professional', label: '전문적인', description: '전문적이고 신뢰할 수 있는' },
];

const MODEL_OPTIONS = [
  { value: 'seedance', label: 'Seedance', description: '고품질 영상' },
  { value: 'veo3', label: 'Google Veo3', description: '빠른 생성' },
];

export default function WorkflowPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const project = useProjectStore();
  const [recentPrompts, setRecentPrompts] = useState<Array<{ id: string; savedAt: number; name: string; metadata?: any; finalPrompt?: string }>>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<any>(null);
  const [workflowData, setWorkflowData] = useState<WorkflowData>({
    story: '',
    scenario: {
      genre: '',
      tone: '',
      target: '',
      structure: ['도입', '전개', '위기', '해결'], // 기본 구조로 초기화
    },
    prompt: {
      // Base Style
      visualStyle: '',
      genre: '',
      mood: '',
      quality: '',
      directorStyle: '',

      // Spatial Context
      weather: '',
      lighting: '',

      // Camera Setting
      primaryLens: '',
      dominantMovement: '',

      // Core Object
      material: '',

      // Timeline
      angle: '',
      move: '',
      pacing: '',
      audioQuality: '',
    },
    video: {
      duration: 10,
      model: 'seedance',
    },
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [videoJobIds, setVideoJobIds] = useState<string[]>([]);
  const [videoProvider, setVideoProvider] = useState<'seedance' | 'veo3' | 'mock' | null>(null);
  
  // Seedance 작업 상태 폴링
  const { statuses: seedanceStatuses, error: seedanceError } = useSeedancePolling(
    videoProvider === 'seedance' ? videoJobIds : []
  );

  // Step3 기본값 자동 설정: 필수 프롬프트 값이 비어있으면 합리적 기본값을 채워 버튼 활성화
  useEffect(() => {
    if (currentStep === 3) {
      setWorkflowData((prev) => {
        const next = { ...prev } as WorkflowData;
        if (!next.prompt.visualStyle) next.prompt.visualStyle = 'Cinematic';
        if (!next.prompt.mood) next.prompt.mood = 'Tense';
        if (!next.prompt.quality) next.prompt.quality = 'HD';
        if (!next.prompt.directorStyle) next.prompt.directorStyle = 'Christopher Nolan style';
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // 프롬프트 목록 로드
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/planning/prompt', { cache: 'no-store' });
        const json = res.ok ? await res.json() : { ok: false };
        if (json?.ok && Array.isArray(json.data) && json.data.length > 0) {
          const prompts = json.data.map((p: any) => ({
            id: p.id,
            savedAt: new Date(p.updatedAt).getTime(),
            name: p.metadata?.title || `프롬프트 V${p.version}`,
            metadata: p.metadata,
            finalPrompt: p.metadata?.finalPrompt,
            timeline: p.timeline,
            negative: p.negative,
          }));
          setRecentPrompts(prompts.slice(0, 10)); // 최대 10개까지 표시
        }
      } catch (error) {
        console.error('프롬프트 로드 실패:', error);
      }
    })();
  }, []);

  const goToNextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, WORKFLOW_STEPS.length));
  }, []);

  const goToPreviousStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleGenerateScenario = useCallback(async () => {
    if (!workflowData.story.trim() || !workflowData.scenario.genre || !workflowData.scenario.tone)
      return;

    setIsGenerating(true);
    try {
      // AI 시나리오 생성 API 호출
      const response = await fetch('/api/ai/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: workflowData.story,
          genre: workflowData.scenario.genre,
          tone: workflowData.scenario.tone,
          target: workflowData.scenario.target,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setWorkflowData((prev) => ({
          ...prev,
          scenario: {
            ...prev.scenario,
            structure: data.structure || ['도입', '전개', '위기', '해결'],
            aiGenerated: data,
          },
        }));
        // 전역 상태 반영
        project.setScenario({
          story: workflowData.story,
          genre: workflowData.scenario.genre,
          tone: workflowData.scenario.tone,
          target: workflowData.scenario.target,
          structure: data.structure || ['도입', '전개', '위기', '해결'],
        });
        goToNextStep();
      }
    } catch (error) {
      console.error('시나리오 생성 실패:', error);
      // 기본 구조로 진행
      setWorkflowData((prev) => ({
        ...prev,
        scenario: {
          ...prev.scenario,
          structure: ['도입', '전개', '위기', '해결'],
          aiGenerated: null,
        },
      }));
      project.setScenario({
        story: workflowData.story,
        genre: workflowData.scenario.genre,
        tone: workflowData.scenario.tone,
        target: workflowData.scenario.target,
        structure: ['도입', '전개', '위기', '해결'],
      });
      goToNextStep();
    } finally {
      setIsGenerating(false);
    }
  }, [workflowData, goToNextStep]);

  const handleGeneratePrompt = useCallback(async () => {
    if (!workflowData.story.trim() || !workflowData.scenario.genre) return;

    setIsGenerating(true);
    try {
      // AI 프롬프트 생성 API 호출
      const response = await fetch('/api/ai/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: workflowData.story,
          scenario: {
            genre: workflowData.scenario.genre,
            tone: workflowData.scenario.tone,
            structure: workflowData.scenario.structure,
          },
          visual_preferences: {
            style: [workflowData.prompt.visualStyle],
            mood: [workflowData.prompt.mood],
            quality: [workflowData.prompt.quality],
            directorStyle: [workflowData.prompt.directorStyle],
            weather: [workflowData.prompt.weather],
            lighting: [workflowData.prompt.lighting],
            primaryLens: [workflowData.prompt.primaryLens],
            dominantMovement: [workflowData.prompt.dominantMovement],
            material: [workflowData.prompt.material],
            angle: [workflowData.prompt.angle],
            move: [workflowData.prompt.move],
            pacing: [workflowData.prompt.pacing],
            audioQuality: [workflowData.prompt.audioQuality],
          },
          target_audience: workflowData.scenario.target,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setWorkflowData((prev) => ({
          ...prev,
          prompt: {
            ...prev.prompt,
            aiGenerated: data,
            finalPrompt: data.final_prompt,
            negativePrompt: data.negative_prompt,
            keywords: data.keywords,
          },
        }));
        project.setPrompt({
          finalPrompt: data.final_prompt,
          negativePrompt: data.negative_prompt,
          keywords: data.keywords,
          visualStyle: workflowData.prompt.visualStyle,
          mood: workflowData.prompt.mood,
          quality: workflowData.prompt.quality,
          directorStyle: workflowData.prompt.directorStyle,
        });
        // 프롬프트 저장(MVP): scenarioId가 있으면 저장
        try {
          const saveRes = await fetch('/api/planning/prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scenarioId: (project as any).scenarioId || '00000000-0000-0000-0000-000000000000',
              metadata: data.base_style || {},
              timeline: data.timeline || [],
              negative: data.negative_prompt ? [data.negative_prompt] : [],
            }),
          });
          if (saveRes.ok) {
            const sv = await saveRes.json();
            if (sv?.ok && sv?.data?.id) {
              (project as any).setPromptId(sv.data.id);
            }
          }
        } catch (e) {
          console.error('프롬프트 저장 실패(무시):', e);
        }
        goToNextStep();
      }
    } catch (error) {
      console.error('프롬프트 생성 실패:', error);
      // 기본 프롬프트로 진행
      setWorkflowData((prev) => ({
        ...prev,
        prompt: {
          ...prev.prompt,
          aiGenerated: null,
          finalPrompt: `${workflowData.story} - ${workflowData.prompt.visualStyle} style, ${workflowData.prompt.mood} mood, ${workflowData.prompt.quality} quality, ${workflowData.prompt.directorStyle} direction`,
          negativePrompt: 'blurry, low quality, distorted',
          keywords: [workflowData.story.split(' ')[0], workflowData.scenario.genre, 'cinematic'],
        },
      }));
      project.setPrompt({
        finalPrompt: `${workflowData.story} - ${workflowData.prompt.visualStyle} style, ${workflowData.prompt.mood} mood, ${workflowData.prompt.quality} quality, ${workflowData.prompt.directorStyle} direction`,
        negativePrompt: 'blurry, low quality, distorted',
        keywords: [workflowData.story.split(' ')[0], workflowData.scenario.genre, 'cinematic'],
      });
      goToNextStep();
    } finally {
      setIsGenerating(false);
    }
  }, [workflowData, goToNextStep]);

  const handleGenerateVideo = useCallback(async () => {
    if (!selectedPrompt?.finalPrompt) return;

    setIsGenerating(true);
    setVideoJobIds([]);
    setVideoProvider(null);
    
    try {
      // 선택된 프롬프트 사용
      const prompt = `${selectedPrompt.finalPrompt} - ${workflowData.video.duration}초 영상`;

      const response = await fetch('/api/video/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          provider: workflowData.video.model,
          duration: workflowData.video.duration,
          aspectRatio: '16:9',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // 제공자별로 상태 추적 설정
        setVideoProvider(data.provider);
        
        if (data.provider === 'seedance' && data.jobId) {
          setVideoJobIds([data.jobId]);
        } else if (data.provider === 'veo3' && data.operationId) {
          // Veo3의 경우 operationId로 상태 추적 (추후 구현)
          // Veo3 operation started successfully
        } else if (data.provider === 'mock' && data.videoUrl) {
          // Mock 영상은 즉시 완료
          setGeneratedVideo(data.videoUrl);
          setIsGenerating(false);
        }

        project.setVideo({
          provider: (data.provider as any) || undefined,
          jobId: data.jobId,
          operationId: data.operationId,
          videoUrl: data.videoUrl,
          status: data.status,
        });

        // 영속 저장
        try {
          const res = await fetch('/api/planning/videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              promptId: (project as any).promptId || '00000000-0000-0000-0000-000000000000',
              provider: data.provider || 'mock',
              status: data.status || (data.videoUrl ? 'completed' : 'processing'),
              url: data.videoUrl || null,
              version: 1,
            }),
          });
          if (res.ok) {
            const js = await res.json();
            if (js?.ok && js?.data?.id) (project as any).setVideoAssetId(js.data.id);
          }
        } catch (e) {
          console.error('영상 메타 저장 실패(무시):', e);
        }
      } else {
        throw new Error('영상 생성 API 호출 실패');
      }
    } catch (error) {
      console.error('영상 생성 실패:', error);
      setIsGenerating(false);
    }
  }, [workflowData, project, selectedPrompt]);

  // Seedance 상태 변화 감지 및 완료된 영상 처리
  useEffect(() => {
    if (videoProvider === 'seedance' && videoJobIds.length > 0) {
      const firstJobId = videoJobIds[0];
      const status = seedanceStatuses[firstJobId];
      
      if (status) {
        if (status.status === 'completed' && status.videoUrl) {
          setGeneratedVideo(status.videoUrl);
          setIsGenerating(false);
          
          // 프로젝트 스토어 업데이트
          project.setVideo({
            provider: 'seedance',
            jobId: firstJobId,
            videoUrl: status.videoUrl,
            status: 'succeeded',
          });
          
          // 버전 추가
          project.addVersion({
            id: crypto.randomUUID(),
            label: 'v1',
            src: status.videoUrl,
            uploadedAt: new Date().toISOString(),
          });
        } else if (status.status === 'failed') {
          console.error('Seedance 영상 생성 실패');
          setIsGenerating(false);
        }
      }
    }
  }, [seedanceStatuses, videoJobIds, videoProvider, project]);

  // 초기 프로젝트 ID 생성
  useEffect(() => {
    if (!project.id) project.init();
  }, [project]);

  const getProgress = useCallback(() => {
    switch (currentStep) {
      case 1:
        return workflowData.story ? 100 : 0;
      case 2:
        return workflowData.scenario.structure.length > 0 ? 100 : 0;
      case 3:
        return workflowData.prompt.visualStyle ? 100 : 0;
      case 4:
        return generatedVideo ? 100 : 0;
      default:
        return 0;
    }
  }, [currentStep, workflowData, generatedVideo]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50" aria-busy={isGenerating ? 'true' : 'false'} aria-live="polite">
      {/* Header */}
      <div className="border-b border-slate-200/50 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div>
              <h1 data-testid="workflow-title" className="text-3xl font-bold text-slate-900">
                AI 영상 제작 워크플로우
              </h1>
              <p className="mt-2 text-slate-600">스토리부터 영상까지 체계적으로</p>
            </div>
            <button
              onClick={() => (window.location.href = '/')}
              className="px-4 py-2 text-slate-600 transition-colors hover:text-slate-900"
              aria-label="홈으로 이동"
              title="홈으로 이동"
            >
              <Icon name="projects" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>


      {/* Workflow Steps */}
      <div className="mx-auto max-w-4xl px-6 py-8 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            {WORKFLOW_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${
                    currentStep >= step.id
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-white text-slate-500'
                  }`}
                >
                  {currentStep > step.id ? (
                    <Icon name="check" className="h-6 w-6" />
                  ) : (
                    <span className="font-semibold">{step.id}</span>
                  )}
                </div>
                {index < WORKFLOW_STEPS.length - 1 && (
                  <div
                    className={`mx-4 h-1 w-16 ${
                      currentStep > step.id ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-center space-x-16 text-sm text-slate-600">
            {WORKFLOW_STEPS.map((step) => (
              <span key={step.id} className="text-center">
                {step.name}
              </span>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="mx-auto mt-6 max-w-md">
            <div className="mb-2 flex justify-between text-xs text-slate-500">
              <span>진행률</span>
              <span>{getProgress()}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${getProgress()}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          {/* Step 1: Prompt Selection */}
          {currentStep === 1 && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="mb-4 text-2xl font-bold text-slate-900">
                  영상 생성을 위한 프롬프트를 선택해주세요
                </h2>
                <p className="mb-6 text-slate-600">
                  기존에 생성된 프롬프트를 선택하거나 새로운 프롬프트를 생성하세요
                </p>
              </div>

              {recentPrompts.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800">생성된 프롬프트 목록</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {recentPrompts.map((prompt) => (
                      <div
                        key={prompt.id}
                        className={`cursor-pointer rounded-lg border p-4 transition-all ${
                          selectedPrompt?.id === prompt.id
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-20'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                        }`}
                        onClick={() => setSelectedPrompt(prompt)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{prompt.name}</h4>
                            <p className="mt-1 text-sm text-gray-500">
                              {new Date(prompt.savedAt).toLocaleDateString()}
                            </p>
                            {prompt.finalPrompt && (
                              <p className="mt-2 text-xs text-gray-600 line-clamp-2">
                                {prompt.finalPrompt}
                              </p>
                            )}
                          </div>
                          <div className="ml-4">
                            <div
                              className={`h-4 w-4 rounded-full border-2 ${
                                selectedPrompt?.id === prompt.id
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                  <div className="mb-4 text-gray-600">
                    <Icon name="projects" className="mx-auto h-12 w-12" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    아직 생성된 프롬프트가 없습니다
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    먼저 프롬프트를 생성해주세요
                  </p>
                </div>
              )}

              <div className="border-t border-gray-200 pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    새로운 프롬프트가 필요하신가요?
                  </p>
                  <div className="flex justify-center gap-4">
                    <a
                      href="/scenario"
                      className="rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
                    >
                      AI 영상 기획하기
                    </a>
                    <a
                      href="/prompt-generator"
                      className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      프롬프트 생성기
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={goToNextStep}
                  disabled={!selectedPrompt}
                  className="rounded-lg bg-green-600 px-8 py-3 text-lg text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  선택한 프롬프트로 영상 생성하기
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Video Settings */}
          {currentStep === 2 && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="mb-4 text-2xl font-bold text-slate-900">영상 생성 설정</h2>
                <p className="mb-6 text-slate-600">
                  선택한 프롬프트로 생성할 영상의 설정을 조정해주세요
                </p>
              </div>

              {/* Selected Prompt Preview */}
              {selectedPrompt && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
                  <h3 className="mb-2 font-semibold text-blue-800">선택된 프롬프트</h3>
                  <div className="space-y-2">
                    <div className="font-medium text-blue-900">{selectedPrompt.name}</div>
                    {selectedPrompt.finalPrompt && (
                      <div className="text-sm text-blue-700 bg-white rounded p-3">
                        {selectedPrompt.finalPrompt}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Video Settings */}
              <div className="mx-auto max-w-2xl space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      영상 길이
                    </label>
                    <select
                      value={workflowData.video.duration}
                      onChange={(e) =>
                        setWorkflowData((prev) => ({
                          ...prev,
                          video: { ...prev.video, duration: parseInt(e.target.value) },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={5}>5초 (빠른 생성)</option>
                      <option value={10}>10초 (균형)</option>
                      <option value={15}>15초 (고품질)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      AI 모델
                    </label>
                    <select
                      value={workflowData.video.model}
                      onChange={(e) =>
                        setWorkflowData((prev) => ({
                          ...prev,
                          video: { ...prev.video, model: e.target.value },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      {MODEL_OPTIONS.map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label} - {model.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Settings Summary */}
                <div className="rounded-lg bg-slate-50 p-4">
                  <h4 className="mb-2 font-medium text-slate-800">설정 요약</h4>
                  <div className="space-y-1 text-sm text-slate-600">
                    <div>
                      <strong>프롬프트:</strong> {selectedPrompt?.name || '선택 안됨'}
                    </div>
                    <div>
                      <strong>영상 길이:</strong> {workflowData.video.duration}초
                    </div>
                    <div>
                      <strong>AI 모델:</strong>{' '}
                      {MODEL_OPTIONS.find((m) => m.value === workflowData.video.model)?.label}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={goToPreviousStep}
                  className="px-6 py-3 text-slate-600 transition-colors hover:text-slate-800"
                >
                  이전 단계
                </button>
                <button
                  onClick={goToNextStep}
                  disabled={!selectedPrompt}
                  className="rounded-lg bg-blue-600 px-8 py-3 text-lg text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  다음 단계: 영상 생성
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Video Generation */}
          {currentStep === 3 && (
            <div className="space-y-8 text-center">
              <div>
                <h2 className="mb-4 text-2xl font-bold text-slate-900">영상을 생성합니다</h2>
                <p className="mb-6 text-slate-600">선택한 프롬프트와 설정으로 AI가 영상을 제작합니다</p>

                {/* Final Settings Summary */}
                <div className="mx-auto max-w-2xl rounded-lg bg-blue-50 p-6">
                  <h4 className="mb-4 font-medium text-blue-800">최종 설정 요약</h4>
                  <div className="space-y-2 text-sm text-blue-700">
                    <div>
                      <strong>선택된 프롬프트:</strong> {selectedPrompt?.name || '선택 안됨'}
                    </div>
                    {selectedPrompt?.finalPrompt && (
                      <div>
                        <strong>프롬프트 내용:</strong>
                        <div className="mt-1 rounded bg-white p-2 text-xs text-slate-700">
                          {selectedPrompt.finalPrompt}
                        </div>
                      </div>
                    )}
                    <div>
                      <strong>영상 길이:</strong> {workflowData.video.duration}초
                    </div>
                    <div>
                      <strong>AI 모델:</strong>{' '}
                      {MODEL_OPTIONS.find((m) => m.value === workflowData.video.model)?.label}
                    </div>
                  </div>
                </div>
              </div>

              {/* Video Generation Button */}
              <div className="mt-8">
                <div className="flex justify-center space-x-4 mb-6">
                  <button
                    onClick={goToPreviousStep}
                    className="px-6 py-3 text-slate-600 transition-colors hover:text-slate-800"
                  >
                    이전 단계
                  </button>
                </div>

                <div className="text-center">
                  <button
                    onClick={handleGenerateVideo}
                    disabled={isGenerating || !selectedPrompt}
                    className="transform rounded-lg bg-gradient-to-r from-green-600 to-blue-600 px-12 py-4 text-xl font-semibold text-white transition-all hover:scale-105 hover:from-green-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isGenerating ? (
                      <div className="flex items-center space-x-3">
                        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-white"></div>
                        <span>영상 생성 중...</span>
                      </div>
                    ) : (
                      '영상 생성 시작'
                    )}
                  </button>

                  {/* Real-time Status Display */}
                  {isGenerating && (
                    <div className="mt-6 rounded-lg bg-blue-50 p-4">
                      <div className="text-center">
                        <h4 className="mb-2 font-semibold text-blue-800">
                          {videoProvider === 'seedance' ? 'Seedance' : 
                           videoProvider === 'veo3' ? 'Google Veo3' : 
                           videoProvider === 'mock' ? 'Mock Generator' : 'AI'} 영상 생성 중
                        </h4>
                        
                        {videoProvider === 'seedance' && videoJobIds.length > 0 && (
                          <div className="mt-3">
                            {videoJobIds.map(jobId => {
                              const status = seedanceStatuses[jobId];
                              return (
                                <div key={jobId} className="mb-2">
                                  <div className="text-sm text-blue-700">
                                    작업 ID: <code className="bg-blue-100 px-2 py-1 rounded">{jobId}</code>
                                  </div>
                                  {status && (
                                    <div className="mt-2 space-y-1">
                                      <div className="text-sm">
                                        상태: <span className="font-medium">{
                                          status.status === 'processing' ? '처리 중' :
                                          status.status === 'completed' ? '완료' :
                                          status.status === 'failed' ? '실패' :
                                          status.status === 'queued' ? '대기 중' : status.status
                                        }</span>
                                      </div>
                                      {status.progress !== undefined && (
                                        <div>
                                          <div className="flex justify-between text-sm text-blue-600">
                                            <span>진행률</span>
                                            <span>{Math.round(status.progress * 100)}%</span>
                                          </div>
                                          <div className="mt-1 w-full bg-blue-200 rounded-full h-2">
                                            <div 
                                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                              style={{ width: `${status.progress * 100}%` }}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {seedanceError && (
                          <div className="mt-3 text-sm text-danger-600">
                            오류: {seedanceError}
                          </div>
                        )}
                        
                        <div className="mt-4 text-xs text-blue-600">
                          영상 생성에는 보통 1-3분이 소요됩니다. 페이지를 새로고침하지 마세요.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Generated Video Display */}
              {generatedVideo && (
                <div className="mt-8 rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-blue-50 p-6">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <Icon name="check" className="h-8 w-8 text-green-600" />
                  </div>
                  <h4 className="mb-4 text-lg font-semibold text-green-800 text-center">영상 생성 완료!</h4>

                  <div className="mx-auto mb-4 max-w-2xl rounded-lg bg-slate-900 p-4">
                    <video src={generatedVideo} controls className="w-full rounded">
                      브라우저가 비디오를 지원하지 않습니다.
                    </video>
                  </div>

                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={() => window.open(generatedVideo, '_blank')}
                      className="rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
                    >
                      새 탭에서 보기
                    </button>
                    <button
                      onClick={() => (window.location.href = '/planning')}
                      className="rounded-lg bg-green-600 px-6 py-3 text-white transition-colors hover:bg-green-700"
                    >
                      기획안에 저장
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          // 영상 저장 후 받은 videoAssetId 사용, 없으면 현재 버전 id 사용
                          const vid = (project as any).videoAssetId || project.versions[0]?.id;
                          if (!vid) return alert('videoId를 찾을 수 없습니다');
                          const res = await fetch('/api/shares', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              targetType: 'video',
                              targetId: vid,
                              role: 'commenter',
                              expiresIn: 7 * 24 * 3600,
                            }),
                          });
                          const js = await res.json();
                          if (js?.ok && js?.data?.token) {
                            const shareUrl = `${window.location.origin}/feedback?videoId=${encodeURIComponent(vid)}&token=${js.data.token}`;
                            await navigator.clipboard.writeText(shareUrl);
                            alert('피드백 링크가 클립보드에 복사되었습니다');
                          } else {
                            alert('공유 링크 발급 실패');
                          }
                        } catch (e) {
                          console.error(e);
                          alert('공유 링크 발급 중 오류');
                        }
                      }}
                      className="rounded-lg bg-purple-600 px-6 py-3 text-white transition-colors hover:bg-purple-700"
                    >
                      피드백 공유 링크 복사
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
