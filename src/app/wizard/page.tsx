'use client';
export const dynamic = 'force-dynamic';

import React, { useEffect, useState, Suspense } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ScenePrompt } from '@/types/api';
import { createAIServiceManager, translateToEnglish, extractSceneComponents } from '@/lib/ai-client';
import { buildVeo3PromptFromScene } from '@/lib/veo3';
import { buildVeo3PromptFromWizard } from '@/lib/veo3';
import { buildTimeline } from '@/lib/timeline/build';
import { normalizeNegatives } from '@/lib/policy/negative';
import { parseCameraBeatsForGenre, finalizeCameraSetup } from '@/lib/pel/camera';
import { translateWizardContextToEnglish } from '@/lib/i18n';
import { composeFourScenePack } from '@/lib/composer/scenePack';
import { composeFinalTextMulti, composeFinalTextSingle } from '@/lib/composer/finalText';
import { useRouter } from 'next/navigation';

export default function SceneWizardPage() {
  const router = useRouter();
  const [scenario, setScenario] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<ScenePrompt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastEnhancedPrompt, setLastEnhancedPrompt] = useState<string>('');
  const [lastSuggestions, setLastSuggestions] = useState<string[]>([]);
  const [recentPrompts, setRecentPrompts] = useState<Array<{ id: string; savedAt: number; name: string; prompt: ScenePrompt }>>([]);
  const [expandedRecent, setExpandedRecent] = useState<Record<string, boolean>>({});
  const [veo3Preview, setVeo3Preview] = useState<string>('');
  const [negativePromptsText, setNegativePromptsText] = useState<string>('');
  const [enableFullSfx, setEnableFullSfx] = useState<boolean>(false);
  const [enableMoviePack, setEnableMoviePack] = useState<boolean>(false);
  // Seedance 진행/결과 상태 (위저드 내 표시)
  const [seedanceJobIds, setSeedanceJobIds] = useState<string[]>([]);
  const [seedanceStatuses, setSeedanceStatuses] = useState<Record<string, { status: string; progress?: number; videoUrl?: string }>>({});
  const [seedancePollMs, setSeedancePollMs] = useState<number>(2000);
  const [seedanceError, setSeedanceError] = useState<string | null>(null);
  const webhookBase = (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.startsWith('http')) ? process.env.NEXT_PUBLIC_SITE_URL : undefined;

  // 기본 옵션
  const [selectedTheme, setSelectedTheme] = useState('일반');
  const [selectedStyle, setSelectedStyle] = useState('자연스러운');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('16:9');
  const [selectedDuration, setSelectedDuration] = useState(2);
  // 직접 입력 토글/값
  const [useCustomTheme, setUseCustomTheme] = useState(false);
  const [customTheme, setCustomTheme] = useState('');
  const [useCustomStyle, setUseCustomStyle] = useState(false);
  const [customStyle, setCustomStyle] = useState('');
  const [useCustomAspect, setUseCustomAspect] = useState(false);
  const [customAspect, setCustomAspect] = useState('');
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [customDuration, setCustomDuration] = useState('');

  // 고급 옵션
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [targetAudience, setTargetAudience] = useState('전체');
  const [mood, setMood] = useState('밝음');
  const [camera, setCamera] = useState('와이드');
  const [weather, setWeather] = useState('맑음');
  const [useCustomMood, setUseCustomMood] = useState(false);
  const [customMood, setCustomMood] = useState('');
  const [useCustomCamera, setUseCustomCamera] = useState(false);
  const [customCamera, setCustomCamera] = useState('');
  const [useCustomWeather, setUseCustomWeather] = useState(false);
  const [customWeather, setCustomWeather] = useState('');
  const [characters, setCharacters] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);

  const themes = [
    '일반',
    // 장소/배경 확장 세트 (schema의 KidChoice와 정합)
    '집', '부엌', '거실', '복도', '욕실(문 닫힘)',
    '바다(맑은 낮)', '숲(낮)', '도시 밤', '학교 운동장',
    '비 오는 골목', '눈 오는 밤', '우주선 내부(카툰풍)',
    '노을 해변', '사막 일몰', '설산 고원 밤',
    '비 오는 도시 카페', '도서관 오후', '지하철 승강장',
    '해질녘 옥상', '봄 벚꽃길',
  ];
  const styles = ['자연스러운', '드라마틱한', '코믹한', '로맨틱한', '액션', '미스터리', '판타지', 'SF'];
  const aspectRatios = ['16:9', '21:9', '4:3', '1:1', '9:16'];
  const durations = [1, 2, 3, 5, 10];

  const moods = ['밝음', '아늑함', '모험', '신비', '차분'];
  const cameras = ['와이드', '따라가기', 'POV', '탑뷰', '돌리인', '롱테이크', '핸드헬드', '드론 오비탈'];
  const weathers = ['맑음', '비', '눈', '안개'];
  const characterPool = ['엄마', '아빠', '친구', '강아지', '고양이', '로봇'];
  const actionPool = ['걷기', '달리기', '요리', '춤', '숨바꼭질', '문열기/닫기'];

  const toggleInArray = (arr: string[], setArr: (v: string[]) => void, value: string) => {
    setArr(arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]);
  };

  // 홈에서 넘어온 q 파라미터로 시나리오 초기화 (CSR 전용)
  useEffect(() => {
    try {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const q = params?.get('q');
      if (q && !scenario) setScenario(q);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 최근 생성 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem('vp:recentPrompts');
      if (raw) setRecentPrompts(JSON.parse(raw));
    } catch {}
  }, []);

  const pushRecent = (name: string, prompt: ScenePrompt) => {
    try {
      const id = `${Date.now()}`;
      const savedAt = Date.now();
      const next = [{ id, savedAt, name, prompt }, ...recentPrompts].slice(0, 10);
      setRecentPrompts(next);
      localStorage.setItem('vp:recentPrompts', JSON.stringify(next));
    } catch {}
  };

  const handleGenerate = async () => {
    if (!scenario.trim()) {
      setError('시나리오를 입력해주세요.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const aiManager = createAIServiceManager();
      const response = await aiManager.generateScenePrompt({
        prompt: scenario,
        theme: selectedTheme,
        style: selectedStyle,
        aspectRatio: selectedAspectRatio,
        duration: selectedDuration,
        targetAudience,
        mood,
        camera,
        weather,
        characters,
        actions,
      });

      if (response.success && response.data) {
        setLastEnhancedPrompt(response.data.enhancedPrompt || '');
        setLastSuggestions(response.data.suggestions || []);
        // 구조적 디테일 추출(영문)
        const components = await extractSceneComponents({
          scenario: await translateToEnglish(scenario),
          theme: await translateToEnglish(selectedTheme),
          style: await translateToEnglish(selectedStyle),
          aspectRatio: selectedAspectRatio,
          durationSec: selectedDuration,
          mood: await translateToEnglish(mood),
          camera: await translateToEnglish(camera),
          weather: await translateToEnglish(weather),
        });
        const deriveTitleFromScenario = (s: string) => {
          const firstLine = (s || '').split(/\n/)[0] || '';
          const firstSentence = firstLine.split(/[.!?\u3002\uFF01\uFF1F]/)[0] || firstLine;
          const compact = firstSentence.replace(/[,\-–—:;\(\)\[\]\{\}]/g, ' ').replace(/\s+/g, ' ').trim();
          const clipped = compact.length > 60 ? compact.slice(0, 60).trim() + '…' : compact;
          return enableFullSfx ? `${clipped} - Full SFX` : clipped || `Prompt ${Date.now()}`;
        };
        const promptName = deriveTitleFromScenario(scenario);
        // 타임라인(2초 단위) 구성 - 모듈 사용
        const timeline = buildTimeline(selectedDuration, enableFullSfx ? 'full' : 'lite');

        // 카메라 비트→설정 문자열 합성
        const cameraBeats = parseCameraBeatsForGenre(selectedStyle.toLowerCase());
        const cameraSetup = finalizeCameraSetup(cameraBeats);

        const prompt: ScenePrompt = {
          metadata: {
            prompt_name: promptName,
            base_style: selectedStyle,
            aspect_ratio: selectedAspectRatio,
            room_description: selectedTheme,
            camera_setup: cameraSetup,
          },
          key_elements: components.key_elements?.length ? components.key_elements : (response.data.suggestions || []),
          assembled_elements: components.assembled_elements?.length ? components.assembled_elements : [scenario],
          negative_prompts: normalizeNegatives(
            negativePromptsText ? negativePromptsText.split(/\n|,/) : []
          ),
          timeline,
          text: 'none',
          keywords: components.keywords?.length ? components.keywords : (response.data.suggestions || []),
        };
        setGeneratedPrompt(prompt);
        // 최종 프롬프트 미리보기 생성 (한글→영문 변환 포함)
        try {
          const translated = await Promise.all([
            translateToEnglish(scenario),
            translateToEnglish(selectedTheme),
            translateToEnglish(selectedStyle),
            translateToEnglish(targetAudience),
            translateToEnglish(mood),
            translateToEnglish(camera),
            translateToEnglish(weather),
          ]);
          const [scenarioEn, themeEn, styleEn, audienceEn, moodEn, cameraEn, weatherEn] = translated;
          const veo = buildVeo3PromptFromWizard(
            translateWizardContextToEnglish({
              scenario: scenarioEn,
              theme: themeEn,
              style: styleEn,
              aspectRatio: selectedAspectRatio,
              durationSec: selectedDuration,
              targetAudience: audienceEn,
              mood: moodEn,
              camera: cameraEn,
              weather: weatherEn,
              characters: characters, // 사전 매핑으로 영문화
              actions: actions,
              enhancedPrompt: response.data.enhancedPrompt,
              suggestions: response.data.suggestions,
            })
          );
          // 영화팩 모드면 4씬 JSON과 함께 멀티 씬 텍스트를 미리보기로 제공
          if (enableMoviePack) {
            const pack = composeFourScenePack();
            const multi = composeFinalTextMulti(pack);
            setVeo3Preview(`${veo} ${multi}`);
          } else {
            setVeo3Preview(veo);
          }
        } catch {}
        pushRecent(promptName, prompt);
      } else {
        setError(response.error || 'AI 생성에 실패했습니다.');
      }
    } catch (err) {
      setError('오류가 발생했습니다. 다시 시도해주세요.');
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyVeo3 = async () => {
    try {
      const veo3 = buildVeo3PromptFromWizard({
        scenario,
        theme: selectedTheme,
        style: selectedStyle,
        aspectRatio: selectedAspectRatio,
        durationSec: selectedDuration,
        targetAudience,
        mood,
        camera,
        weather,
        characters,
        actions,
        enhancedPrompt: lastEnhancedPrompt,
        suggestions: lastSuggestions,
      });
      const english = await translateToEnglish(veo3);
      await navigator.clipboard.writeText(english);
      alert('Veo3용 프롬프트를 복사했습니다. Veo3에 바로 붙여넣기 하세요.');
    } catch (e) {
      console.error('copy failed', e);
      setError('클립보드 복사에 실패했습니다.');
    }
  };

  const handleSeedanceCreate = async () => {
    try {
      setSeedanceError(null);
      if (enableMoviePack) {
        // 4씬 영화팩: 각 씬을 개별 Seedance 작업으로 생성
        const pack = composeFourScenePack();
        const jobs = await Promise.all(pack.map(async (scene) => {
          const prompt = buildVeo3PromptFromScene(scene);
          const english = await translateToEnglish(prompt);
          try { await navigator.clipboard.writeText(english); } catch {}
          const payload: any = { prompt: english, aspect_ratio: scene.metadata?.aspect_ratio || selectedAspectRatio, duration_seconds: selectedDuration };
          if (webhookBase) payload.webhook_url = `${webhookBase}/api/seedance/webhook`;
          const res = await fetch('/api/seedance/create', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const json = await res.json();
          if (!json.ok) throw new Error(json.error || JSON.stringify(json));
          return json.jobId || json.raw?.jobId || json.raw?.id || '';
        }));
        const validJobs = jobs.filter(Boolean) as string[];
        setSeedanceJobIds(validJobs);
        setSeedanceStatuses({});
        setSeedancePollMs(2000);
        return;
      }

      // 단일 씬
      const veo3 = buildVeo3PromptFromWizard({
        scenario,
        theme: selectedTheme,
        style: selectedStyle,
        aspectRatio: selectedAspectRatio,
        durationSec: selectedDuration,
        targetAudience,
        mood,
        camera,
        weather,
        characters,
        actions,
        enhancedPrompt: lastEnhancedPrompt,
        suggestions: lastSuggestions,
      });
      const english = await translateToEnglish(veo3);
      try { await navigator.clipboard.writeText(english); } catch {}
      const payload: any = { prompt: english, aspect_ratio: selectedAspectRatio, duration_seconds: selectedDuration };
      if (webhookBase) payload.webhook_url = `${webhookBase}/api/seedance/webhook`;
      const res = await fetch('/api/seedance/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || JSON.stringify(json));
      const jobId = json.jobId || json.raw?.jobId || json.raw?.id || `${Date.now()}`;
      setSeedanceJobIds([jobId]);
      setSeedanceStatuses({});
      setSeedancePollMs(2000);
    } catch (e) {
      console.error('seedance create failed', e);
      setSeedanceError(e instanceof Error ? e.message : 'Seedance 생성에 실패했습니다.');
    }
  };

  // Seedance 상태 폴링 (지수 백오프, 최대 10초)
  useEffect(() => {
    if (seedanceJobIds.length === 0) return;
    let cancel = false;
    let t: any;
    const pollOne = async (id: string) => {
      try {
        const res = await fetch(`/api/seedance/status/${encodeURIComponent(id)}`);
        const json = await res.json();
        if (!cancel) setSeedanceStatuses(prev => ({ ...prev, [id]: { status: json.status, progress: json.progress, videoUrl: json.videoUrl } }));
      } catch {}
    };
    const tick = async () => {
      await Promise.all(seedanceJobIds.map(pollOne));
      if (!cancel) {
        t = setTimeout(tick, seedancePollMs);
        setSeedancePollMs(ms => Math.min(10000, Math.floor(ms * 1.3)));
      }
    };
    tick();
    return () => { cancel = true; if (t) clearTimeout(t); };
  }, [seedanceJobIds, seedancePollMs]);

  const handleSave = async () => {
    if (!generatedPrompt) return;
    try {
      console.log('Saving prompt:', generatedPrompt);
      alert('프롬프트가 저장되었습니다!');
    } catch (err) {
      setError('저장에 실패했습니다.');
      console.error('Save error:', err);
    }
  };

  const handleOpenEditor = () => {
    if (!generatedPrompt) return;
    try {
      localStorage.setItem('vp:lastPrompt', JSON.stringify(generatedPrompt));
      const id = `${Date.now()}`;
      router.push(`/editor/${id}?from=wizard`);
    } catch (e) {
      console.error('Failed to open editor:', e);
    }
  };

  const handleOpenRecent = (prompt: ScenePrompt) => {
    try {
      localStorage.setItem('vp:lastPrompt', JSON.stringify(prompt));
      const id = `${Date.now()}`;
      router.push(`/editor/${id}?from=wizard`);
    } catch (e) {
      console.error('Failed to open editor:', e);
    }
  };

  const handleCopyRecentVeo3 = async (prompt: ScenePrompt) => {
    try {
      const veo3 = buildVeo3PromptFromScene(prompt);
      const english = await translateToEnglish(veo3);
      await navigator.clipboard.writeText(english);
      alert('Veo3용 프롬프트를 복사했습니다.');
    } catch {}
  };

  const handleToggleRecentDetails = (id: string) => {
    setExpandedRecent((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDeleteRecent = (id: string) => {
    try {
      const next = recentPrompts.filter((r) => r.id !== id);
      setRecentPrompts(next);
      localStorage.setItem('vp:recentPrompts', JSON.stringify(next));
      // 정리: 확장 상태도 제거
      setExpandedRecent((prev) => {
        const copy = { ...prev } as Record<string, boolean>;
        delete copy[id];
        return copy;
      });
    } catch {}
  };

  const handleSampleFill = () => {
    setScenario('아이와 함께 쿠키를 굽는 따뜻한 주방, 아늑한 조명, 카메라 따라가기');
    setSelectedTheme('부엌');
    setSelectedStyle('자연스러운');
    setSelectedAspectRatio('16:9');
    setSelectedDuration(2);
    setTargetAudience('가족');
    setMood('아늑함');
    setCamera('따라가기');
    setWeather('맑음');
    setCharacters(['엄마', '아이']);
    setActions(['요리']);
  };

  const handleReset = () => {
    setScenario('');
    setGeneratedPrompt(null);
    setError(null);
    setSelectedTheme('일반');
    setSelectedStyle('자연스러운');
    setSelectedAspectRatio('16:9');
    setSelectedDuration(2);
    setTargetAudience('전체');
    setMood('밝음');
    setCamera('와이드');
    setWeather('맑음');
    setCharacters([]);
    setActions([]);
  };

  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">로딩 중…</div>}>
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Icon name="wizard" size="lg" className="text-primary-500" />
              <h1 className="text-2xl font-bold text-gray-900">AI 영상 생성</h1>
              <div className="flex items-center gap-2">
                <input id="movie-pack" type="checkbox" checked={enableMoviePack} onChange={(e)=>setEnableMoviePack(e.target.checked)} />
                <label htmlFor="movie-pack" className="text-sm text-gray-700">영화팩(4씬) 생성</label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleSampleFill} data-testid="sample-fill-btn">
                샘플 자동 채우기
              </Button>
              <Button variant="outline" onClick={handleReset} data-testid="reset-btn">
                초기화
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 입력 섹션 */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">1. 시나리오 입력</h2>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">이 곳에 시나리오를 넣어주세요!</label>
                <div className="flex items-start gap-3">
                  <textarea
                    data-testid="scenario-input"
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                    placeholder="예: 아이가 부엌에서 쿠키를 만드는 장면"
                    className="flex-1 h-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <Button
                    data-testid="generate-btn-side"
                    onClick={handleGenerate}
                    disabled={isGenerating || !scenario.trim()}
                  >
                    {isGenerating ? (
                      <>
                        <Icon name="loading" size="sm" className="mr-2 animate-spin" /> 생성 중…
                      </>
                    ) : (
                      <>생성</>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">구체적일수록 더 좋은 결과를 얻을 수 있어요.</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">2. 기본 옵션</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">테마</label>
                  <select value={useCustomTheme ? '__custom__' : selectedTheme} onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__custom__') setUseCustomTheme(true); else { setSelectedTheme(v); }
                  }} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                    {themes.map((theme) => (<option key={theme} value={theme}>{theme}</option>))}
                    <option value="__custom__">직접 입력…</option>
                  </select>
                  {useCustomTheme && (
                    <div className="mt-2">
                      <input
                        value={customTheme}
                        onChange={(e) => setCustomTheme(e.target.value)}
                        onBlur={() => { const v = customTheme.trim(); if (v) { setSelectedTheme(v); } }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = customTheme.trim(); if (v) { setSelectedTheme(v); } } }}
                        placeholder="직접 입력 후 Enter"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">Enter 또는 포커스 아웃 시 적용</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">스타일</label>
                  <select value={useCustomStyle ? '__custom__' : selectedStyle} onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__custom__') setUseCustomStyle(true); else { setSelectedStyle(v); }
                  }} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                    {styles.map((style) => (<option key={style} value={style}>{style}</option>))}
                    <option value="__custom__">직접 입력…</option>
                  </select>
                  {useCustomStyle && (
                    <div className="mt-2">
                      <input
                        value={customStyle}
                        onChange={(e) => setCustomStyle(e.target.value)}
                        onBlur={() => { const v = customStyle.trim(); if (v) { setSelectedStyle(v); } }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = customStyle.trim(); if (v) { setSelectedStyle(v); } } }}
                        placeholder="직접 입력 후 Enter"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">Enter 또는 포커스 아웃 시 적용</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">화면비</label>
                  <select value={useCustomAspect ? '__custom__' : selectedAspectRatio} onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__custom__') setUseCustomAspect(true); else { setSelectedAspectRatio(v); }
                  }} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                    {aspectRatios.map((ratio) => (<option key={ratio} value={ratio}>{ratio}</option>))}
                    <option value="__custom__">직접 입력…</option>
                  </select>
                  {useCustomAspect && (
                    <div className="mt-2">
                      <input
                        value={customAspect}
                        onChange={(e) => setCustomAspect(e.target.value)}
                        onBlur={() => { const v = customAspect.trim(); if (v) { setSelectedAspectRatio(v); } }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = customAspect.trim(); if (v) { setSelectedAspectRatio(v); } } }}
                        placeholder="예: 16:9, 21:9 (Enter로 적용)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">Enter 또는 포커스 아웃 시 적용</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">지속시간 (초)</label>
                  <select value={useCustomDuration ? '__custom__' : String(selectedDuration)} onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__custom__') setUseCustomDuration(true); else { setSelectedDuration(Number(v)); }
                  }} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                    {durations.map((duration) => (<option key={duration} value={String(duration)}>{duration}초</option>))}
                    <option value="__custom__">직접 입력…</option>
                  </select>
                  {useCustomDuration && (
                    <div className="mt-2">
                      <input
                        value={customDuration}
                        onChange={(e) => setCustomDuration(e.target.value)}
                        onBlur={() => { const n = parseInt(customDuration, 10); if (!isNaN(n) && n > 0) { setSelectedDuration(n); } }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const n = parseInt(customDuration, 10); if (!isNaN(n) && n > 0) { setSelectedDuration(n); } } }}
                        placeholder="숫자(초), Enter로 적용"
                        inputMode="numeric"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">Enter 또는 포커스 아웃 시 적용</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-900">3. 고급 옵션</h2>
                <Button variant="outline" onClick={() => setShowAdvanced(!showAdvanced)}>
                  <Icon name={showAdvanced ? 'minus' as any : 'plus'} size="sm" className="mr-2" />
                  {showAdvanced ? '접기' : '펼치기'}
                </Button>
              </div>

              {showAdvanced && (
                <div className="space-y-6 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">대상</label>
                      <input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">분위기</label>
                      <select value={useCustomMood ? '__custom__' : mood} onChange={e => { const v = e.target.value; if (v==='__custom__') setUseCustomMood(true); else { setMood(v);} }} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                        {moods.map(m => (<option key={m} value={m}>{m}</option>))}
                        <option value="__custom__">직접 입력…</option>
                      </select>
                      {useCustomMood && (
                        <div className="mt-2">
                          <input
                            value={customMood}
                            onChange={(e)=>setCustomMood(e.target.value)}
                            onBlur={()=>{ const v=customMood.trim(); if(v){ setMood(v);} }}
                            onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); const v=customMood.trim(); if(v){ setMood(v);} } }}
                            placeholder="예: 차분한 서정 (Enter로 적용)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                          <p className="text-xs text-gray-400 mt-1">Enter 또는 포커스 아웃 시 적용</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">카메라</label>
                      <select value={useCustomCamera ? '__custom__' : camera} onChange={e => { const v = e.target.value; if (v==='__custom__') setUseCustomCamera(true); else { setCamera(v);} }} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                        {cameras.map(c => (<option key={c} value={c}>{c}</option>))}
                        <option value="__custom__">직접 입력…</option>
                      </select>
                      {useCustomCamera && (
                        <div className="mt-2">
                          <input
                            value={customCamera}
                            onChange={(e)=>setCustomCamera(e.target.value)}
                            onBlur={()=>{ const v=customCamera.trim(); if(v){ setCamera(v);} }}
                            onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); const v=customCamera.trim(); if(v){ setCamera(v);} } }}
                            placeholder="예: 롤링, 틸트-업 (Enter로 적용)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                          <p className="text-xs text-gray-400 mt-1">Enter 또는 포커스 아웃 시 적용</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">날씨</label>
                      <select value={useCustomWeather ? '__custom__' : weather} onChange={e => { const v=e.target.value; if(v==='__custom__') setUseCustomWeather(true); else { setWeather(v);} }} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                        {weathers.map(w => (<option key={w} value={w}>{w}</option>))}
                        <option value="__custom__">직접 입력…</option>
                      </select>
                      {useCustomWeather && (
                        <div className="mt-2">
                          <input
                            value={customWeather}
                            onChange={(e)=>setCustomWeather(e.target.value)}
                            onBlur={()=>{ const v=customWeather.trim(); if(v){ setWeather(v);} }}
                            onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); const v=customWeather.trim(); if(v){ setWeather(v);} } }}
                            placeholder="예: 흐림, 모래바람 (Enter로 적용)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                          <p className="text-xs text-gray-400 mt-1">Enter 또는 포커스 아웃 시 적용</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">캐릭터</label>
                    <div className="flex flex-wrap gap-2">
                      {characterPool.map(ch => (
                        <button key={ch} type="button" onClick={() => toggleInArray(characters, setCharacters, ch)} className={`px-3 py-1 rounded-full text-sm border ${characters.includes(ch) ? 'bg-primary-100 text-primary-700 border-primary-200' : 'bg-white text-gray-700 border-gray-300'}`}>
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">동작</label>
                    <div className="flex flex-wrap gap-2">
                      {actionPool.map(ac => (
                        <button key={ac} type="button" onClick={() => toggleInArray(actions, setActions, ac)} className={`px-3 py-1 rounded-full text-sm border ${actions.includes(ac) ? 'bg-primary-100 text-primary-700 border-primary-200' : 'bg-white text-gray-700 border-gray-300'}`}>
                          {ac}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Negative Prompts (comma or newline separated)</label>
                      <textarea
                        value={negativePromptsText}
                        onChange={(e) => setNegativePromptsText(e.target.value)}
                        placeholder="no blood, no text, no supernatural elements"
                        className="w-full h-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">예: no blood, no text, no supernatural elements</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input id="full-sfx" type="checkbox" checked={enableFullSfx} onChange={(e)=>setEnableFullSfx(e.target.checked)} />
                      <label htmlFor="full-sfx" className="text-sm text-gray-700">Full SFX timeline (리치한 사운드 디테일 사용)</label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 결과 섹션 */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">생성된 장면</h2>

              {generatedPrompt ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="font-medium text-gray-700">테마:</span><span className="ml-2 text-gray-900">{generatedPrompt.metadata.room_description}</span></div>
                    <div><span className="font-medium text-gray-700">스타일:</span><span className="ml-2 text-gray-900">{generatedPrompt.metadata.base_style}</span></div>
                    <div><span className="font-medium text-gray-700">화면비:</span><span className="ml-2 text-gray-900">{generatedPrompt.metadata.aspect_ratio}</span></div>
                    <div><span className="font-medium text-gray-700">지속시간:</span><span className="ml-2 text-gray-900">{selectedDuration}초</span></div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">프롬프트</div>
                      <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">{generatedPrompt.text}</pre>
                    </div>
                    {veo3Preview && (
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-2">최종 프롬프트</div>
                        <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap">{veo3Preview}</pre>
                      </div>
                    )}
                    <div className="flex gap-3 pt-2">
                      <Button onClick={handleCopyVeo3} className="flex-1" data-testid="copy-veo3-btn">
                        <Icon name="copy" size="sm" className="mr-2" />
                        프롬프트 복사
                      </Button>
                      <Button variant="outline" onClick={handleSeedanceCreate} className="flex-1" title="Seedance로 영상 생성">
                        <Icon name="play" size="sm" className="mr-2" />
                        SEEDANCE로 생성
                      </Button>
                    </div>

                    {seedanceJobIds.length > 0 && (
                      <div className="mt-4 border rounded-lg p-4 bg-gray-50">
                        <div className="text-sm font-medium text-gray-900 mb-2">Seedance 생성 진행상황</div>
                        {seedanceError && (
                          <div className="mb-3 text-sm text-red-600">{seedanceError}</div>
                        )}
                        {seedanceJobIds.length > 1 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {seedanceJobIds.map((jid) => (
                              <div key={jid} className="border rounded p-3 bg-white">
                                <div className="text-xs text-gray-500 mb-1">{jid}</div>
                                <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
                                  <div className="bg-primary-500 h-2" style={{ width: `${Math.min(100, (seedanceStatuses[jid]?.progress ?? 5))}%` }} />
                                </div>
                                <div className="mt-2 text-sm text-gray-700">상태: {seedanceStatuses[jid]?.status || 'processing'}{seedanceStatuses[jid]?.progress != null ? ` • ${seedanceStatuses[jid]?.progress}%` : ''}</div>
                                <div className="mt-2">
                                  {seedanceStatuses[jid]?.videoUrl ? (
                                    <>
                                      <video src={seedanceStatuses[jid]?.videoUrl} controls className="w-full rounded border" autoPlay muted />
                                      <div className="mt-2 flex items-center gap-2">
                                        <a href={seedanceStatuses[jid]?.videoUrl!} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline">새 탭에서 열기</a>
                                        <a href={seedanceStatuses[jid]?.videoUrl!} download className="text-xs text-secondary-700 hover:underline">다운로드</a>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="aspect-video w-full bg-gray-100 rounded border grid place-items-center text-sm text-gray-500">영상 준비 중…</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
                              <div className="bg-primary-500 h-2" style={{ width: `${Math.min(100, (seedanceStatuses[seedanceJobIds[0]]?.progress ?? 5))}%` }} />
                            </div>
                            <div className="mt-2 text-sm text-gray-700">상태: {seedanceStatuses[seedanceJobIds[0]]?.status || 'processing'}{seedanceStatuses[seedanceJobIds[0]]?.progress != null ? ` • ${seedanceStatuses[seedanceJobIds[0]]?.progress}%` : ''}</div>
                            <div className="mt-2">
                              {seedanceStatuses[seedanceJobIds[0]]?.videoUrl ? (
                                <>
                                  <video src={seedanceStatuses[seedanceJobIds[0]]?.videoUrl} controls className="w-full rounded border" autoPlay muted />
                                  <div className="mt-2 flex items-center gap-2">
                                    <a href={seedanceStatuses[seedanceJobIds[0]]?.videoUrl} target="_blank" rel="noreferrer" className="text-sm text-primary-600 hover:underline">새 탭에서 열기</a>
                                    <a href={seedanceStatuses[seedanceJobIds[0]]?.videoUrl} download className="text-sm text-secondary-700 hover:underline">다운로드</a>
                                  </div>
                                </>
                              ) : (
                                <div className="aspect-video w-full bg-gray-100 rounded border grid place-items-center text-sm text-gray-500">
                                  영상 준비 중…
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Icon name="wizard" size="xl" className="mx-auto mb-4 text-gray-300" />
                  <p>시나리오를 입력하고 장면 만들기를 눌러주세요.</p>
                  <p className="text-sm mt-2">AI가 자동으로 장면을 생성해드립니다.</p>
                </div>
              )}
            </div>

            {/* 최근 생성 리스트 */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">최근 생성한 프롬프트</h2>
                <span className="text-xs text-gray-400">최대 10개</span>
              </div>
              {recentPrompts.length === 0 ? (
                <div className="text-sm text-gray-500">아직 생성한 프롬프트가 없습니다.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {recentPrompts.map((r) => (
                    <li key={r.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{r.name}</div>
                          <div className="text-xs text-gray-500">{new Date(r.savedAt).toLocaleString()}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleRecentDetails(r.id)}
                            title={expandedRecent[r.id] ? '접기' : '펼치기'}
                            aria-label={expandedRecent[r.id] ? '접기' : '펼치기'}
                            data-testid="recent-item-toggle"
                            className="w-8 h-8 p-0"
                          >
                            <Icon name={expandedRecent[r.id] ? 'minus' : 'plus'} size="sm" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyRecentVeo3(r.prompt)}
                            title="프롬프트 복사"
                            aria-label="프롬프트 복사"
                            data-testid="recent-item-copy"
                            className="w-8 h-8 p-0"
                          >
                            <Icon name="copy" size="sm" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenRecent(r.prompt)}
                            title="에디터로 열기"
                            aria-label="에디터로 열기"
                            data-testid="recent-item-open"
                            className="w-8 h-8 p-0"
                          >
                            <Icon name="edit" size="sm" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRecent(r.id)}
                            title="삭제"
                            aria-label="삭제"
                            data-testid="recent-item-delete"
                            className="w-8 h-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Icon name="delete" size="sm" />
                          </Button>
                        </div>
                      </div>
                      {expandedRecent[r.id] && (
                        <div className="mt-3">
                          <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap">
{JSON.stringify(r.prompt, null, 2)}
                          </pre>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 하단 고정 액션바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-end gap-2" data-testid="actionbar">
          <Button variant="outline" onClick={handleReset}>초기화</Button>
          <Button variant="outline" onClick={handleOpenEditor} disabled={!generatedPrompt}>에디터로 열기</Button>
        </div>
      </div>
    </div>
    </Suspense>
  );
}
