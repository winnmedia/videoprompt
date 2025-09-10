'use client';
export const dynamic = 'force-dynamic';

import React, { useEffect, useState, Suspense, useMemo } from 'react';
import { useSeedanceCreate } from '@/features/seedance/create';
import { useSeedancePolling } from '@/features/seedance/status';
import { Button } from '@/shared/ui';
import { Icon } from '@/shared/ui';
import { getApiUrl, API_ENDPOINTS } from '@/lib/config/api';
import { ScenePrompt } from '@/types/api';
import {
  createAIServiceManager,
  translateToEnglish,
  extractSceneComponents,
  rewritePromptForImage,
  rewritePromptForSeedance,
  transformPromptForTarget,
} from '@/shared/lib/ai-client';
import { useProjectStore } from '@/entities/project';
import { buildVeo3PromptFromScene } from '@/lib/veo3';
import { buildVeo3PromptFromWizard } from '@/lib/veo3';
import { buildImagenPrompt } from '@/lib/imagenPrompt';
import { buildTimeline } from '@/lib/timeline/build';
import { normalizeNegatives } from '@/lib/policy/negative';
import { parseCameraBeatsForGenre, finalizeCameraSetup } from '@/lib/pel/camera';
import { translateWizardContextToEnglish } from '@/lib/i18n';
import { composeFourScenePack } from '@/lib/composer/scenePack';
import { composeFinalTextMulti, composeFinalTextSingle } from '@/lib/composer/finalText';
import { useRouter } from 'next/navigation';
import { SeedanceProgressPanel } from '@/widgets/seedance';
import { ScenarioWorkflow } from '@/components/ScenarioWorkflow';

export default function SceneWizardPage() {
  const project = useProjectStore();
  const router = useRouter();
  const [scenario, setScenario] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<ScenePrompt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastEnhancedPrompt, setLastEnhancedPrompt] = useState<string>('');
  const [lastSuggestions, setLastSuggestions] = useState<string[]>([]);
  const [recentPrompts, setRecentPrompts] = useState<
    Array<{ id: string; savedAt: number; name: string; prompt: ScenePrompt }>
  >([]);
  const [expandedRecent, setExpandedRecent] = useState<Record<string, boolean>>({});
  const [veo3Preview, setVeo3Preview] = useState<string>('');
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [negativePromptsText, setNegativePromptsText] = useState<string>('');
  const [enableFullSfx, setEnableFullSfx] = useState<boolean>(false);
  const [enableMoviePack, setEnableMoviePack] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<'success' | 'error' | 'info'>('info');
  // Seedance 진행/결과 상태 (위저드 내 표시)
  const [seedanceJobIds, setSeedanceJobIds] = useState<string[]>([]);
  // Seedance 폴링 훅 사용(FSD features)
  const seedanceIdList = useMemo(() => seedanceJobIds, [seedanceJobIds]);
  const { statuses: seedanceStatuses, error: seedanceError } = useSeedancePolling(seedanceIdList);
  const webhookBase =
    process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.startsWith('http')
      ? process.env.NEXT_PUBLIC_SITE_URL
      : undefined;

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
  const [advancedTab, setAdvancedTab] = useState<'cinema' | 'light' | 'sfx' | 'basic'>('cinema');
  const [targetAudience, setTargetAudience] = useState('전체');
  const [customAudience, setCustomAudience] = useState('');
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
  const [recentQuery, setRecentQuery] = useState('');
  const [recentPinnedIds, setRecentPinnedIds] = useState<Record<string, boolean>>({});

  // 확장 파라미터 (시네마틱/테크니컬)
  const [resolution, setResolution] = useState('1080p');
  const [fps, setFps] = useState('24');
  const [genre, setGenre] = useState('action-thriller');
  const [visualTone, setVisualTone] = useState('cinematic, photorealistic');
  const [cameraMovement, setCameraMovement] = useState('dolly-in');
  const [shotType, setShotType] = useState('wide');
  const [speed, setSpeed] = useState('normal');
  const [lighting, setLighting] = useState('low-key moody');
  const [colorPalette, setColorPalette] = useState('teal & orange');
  const [soundAmbience, setSoundAmbience] = useState('rain, city hum, distant sirens');
  const [sfxDensity, setSfxDensity] = useState('lite');
  const [safetyPreset, setSafetyPreset] = useState('standard');
  const [detailStrength, setDetailStrength] = useState('high');
  const [motionSmoothing, setMotionSmoothing] = useState('off');
  const [coherence, setCoherence] = useState('high');
  const [randomness, setRandomness] = useState('medium');
  const [seedValue, setSeedValue] = useState('');
  const [helpExpanded, setHelpExpanded] = useState(false);

  // 시나리오 워크플로우 모드
  const [workflowMode, setWorkflowMode] = useState<'wizard' | 'scenario'>('wizard');

  const themes = [
    '일반',
    // 장소/배경 확장 세트 (schema의 KidChoice와 정합)
    '집',
    '부엌',
    '거실',
    '복도',
    '욕실(문 닫힘)',
    '바다(맑은 낮)',
    '숲(낮)',
    '도시 밤',
    '학교 운동장',
    '비 오는 골목',
    '눈 오는 밤',
    '우주선 내부(카툰풍)',
    '노을 해변',
    '사막 일몰',
    '설산 고원 밤',
    '비 오는 도시 카페',
    '도서관 오후',
    '지하철 승강장',
    '해질녘 옥상',
    '봄 벚꽃길',
  ];
  const styles = ['시네마틱', '포토리얼', '미니멀', '하이컨트라스트', '소프트', '스타일라이즈드'];
  const aspectRatios = ['21:9', '16:9', '9:16', '4:3', '1:1'];
  const durations = [2, 4, 6, 8, 10, 15];
  const [validation, setValidation] = useState<{
    aspectError?: string | null;
    durationError?: string | null;
  }>({});

  const moods = ['긴장', '아늑', '로맨틱', '미스터리', '장엄', '차분'];
  const cameras = [
    '돌리인',
    '돌리아웃',
    '푸시인',
    '풀아웃',
    '트래킹',
    '핸드헬드',
    '스테디캠',
    '드론 오비탈',
    '크레인',
    '짐벌',
    '와이드',
    '미디엄',
    '클로즈업',
    'POV',
    '탑뷰',
    '숄더 넘어',
    '더치',
  ];
  const weathers = ['맑음', '비', '폭우', '안개', '눈', '먼지', '폭풍', '바람'];
  const characterPool = ['엄마', '아빠', '친구', '강아지', '고양이', '로봇'];
  const actionPool = ['걷기', '달리기', '요리', '춤', '숨바꼭질', '문열기/닫기'];

  const toggleInArray = (arr: string[], setArr: (v: string[]) => void, value: string) => {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  // 최근 항목 배지용 유틸
  const getPromptDurationSec = (p?: ScenePrompt | null): number => {
    try {
      const t = (p as any)?.timeline;
      if (!Array.isArray(t) || t.length === 0) return selectedDuration || 2;
      const last = t[t.length - 1];
      const ts = String(last?.timestamp || '00:00-00:02');
      const end = ts.includes('-') ? ts.split('-')[1] : ts;
      const [mm, ss] = end.split(':').map((v: string) => parseInt(v, 10));
      const sec = mm * 60 + ss;
      return isNaN(sec) ? selectedDuration || 2 : sec;
    } catch {
      return selectedDuration || 2;
    }
  };

  // 홈에서 넘어온 q 파라미터로 시나리오 초기화 (CSR 전용)
  useEffect(() => {
    try {
      const params =
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const q = params?.get('q');
      if (q && !scenario) setScenario(q);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 최근 생성 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem('vp:recentPrompts');
      if (raw) {
        const arr = JSON.parse(raw) as any[];
        setRecentPrompts(arr);
        const pins: Record<string, boolean> = {};
        arr.forEach((r: any) => {
          if (r.pinned) pins[r.id] = true;
        });
        setRecentPinnedIds(pins);
      }
    } catch {}
  }, []);

  const pushRecent = (name: string, prompt: ScenePrompt) => {
    try {
      const id = `${Date.now()}`;
      const savedAt = Date.now();
      const next = [{ id, savedAt, name, prompt, pinned: false } as any, ...recentPrompts].slice(
        0,
        10,
      );
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
    clearImagePreviews(); // 이미지 미리보기 초기화

    try {
      const aiManager = createAIServiceManager();
      // 스토어 시나리오 값을 기본으로 병합
      const s = project.scenario || {};
      const response = await aiManager.generateScenePrompt({
        prompt: scenario,
        theme: selectedTheme,
        style: selectedStyle,
        aspectRatio: s.format || selectedAspectRatio,
        duration: s.durationSec || selectedDuration,
        targetAudience: s.target || targetAudience,
        mood: s.tempo || mood,
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
          const compact = firstSentence
            .replace(/[,\-–—:;\(\)\[\]\{\}]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
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
          key_elements: components.key_elements?.length
            ? components.key_elements
            : response.data.suggestions || [],
          assembled_elements: components.assembled_elements?.length
            ? components.assembled_elements
            : [scenario],
          negative_prompts: normalizeNegatives(
            negativePromptsText ? negativePromptsText.split(/\n|,/) : [],
          ),
          timeline,
          text: 'none',
          keywords: components.keywords?.length
            ? components.keywords
            : response.data.suggestions || [],
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
          const [scenarioEn, themeEn, styleEn, audienceEn, moodEn, cameraEn, weatherEn] =
            translated;
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
              ...({
                // 확장 필드(영문 매핑)
                resolution: await translateToEnglish(resolution),
                fps: await translateToEnglish(fps),
                genre: await translateToEnglish(genre),
                visualTone: await translateToEnglish(visualTone),
                cameraMovement: await translateToEnglish(cameraMovement),
                shotType: await translateToEnglish(shotType),
                speed: await translateToEnglish(speed),
                lighting: await translateToEnglish(lighting),
                colorPalette: await translateToEnglish(colorPalette),
                soundAmbience: await translateToEnglish(soundAmbience),
                sfxDensity: await translateToEnglish(sfxDensity),
                safetyPreset: await translateToEnglish(safetyPreset),
                detailStrength: await translateToEnglish(detailStrength),
                motionSmoothing: await translateToEnglish(motionSmoothing),
                coherence: await translateToEnglish(coherence),
                randomness: await translateToEnglish(randomness),
                seed: seedValue ? Number(seedValue) : undefined,
              } as any),
              characters: characters, // 사전 매핑으로 영문화
              actions: actions,
              enhancedPrompt: response.data.enhancedPrompt,
              suggestions: response.data.suggestions,
            }),
          );
          // 영화팩 모드면 4씬 JSON과 함께 멀티 씬 텍스트를 미리보기로 제공
          let previewText = '';
          if (enableMoviePack) {
            const pack = composeFourScenePack();
            const multi = composeFinalTextMulti(pack);
            previewText = `${veo} ${multi}`;
          } else {
            previewText = veo;
          }
          setVeo3Preview(previewText);
          // 최종 프롬프트 기반 이미지 미리보기 자동 요청
          if (previewText && previewText.trim()) {
            requestImagenPreviewFromText(previewText);
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
      const translated = await Promise.all([
        translateToEnglish(scenario),
        translateToEnglish(selectedTheme),
        translateToEnglish(selectedStyle),
        translateToEnglish(targetAudience),
        translateToEnglish(mood),
        translateToEnglish(camera),
        translateToEnglish(weather),
        translateToEnglish(resolution),
        translateToEnglish(fps),
        translateToEnglish(genre),
        translateToEnglish(visualTone),
        translateToEnglish(cameraMovement),
        translateToEnglish(shotType),
        translateToEnglish(speed),
        translateToEnglish(lighting),
        translateToEnglish(colorPalette),
        translateToEnglish(soundAmbience),
        translateToEnglish(sfxDensity),
        translateToEnglish(safetyPreset),
        translateToEnglish(detailStrength),
        translateToEnglish(motionSmoothing),
        translateToEnglish(coherence),
        translateToEnglish(randomness),
      ]);
      const [
        scenarioEn,
        themeEn,
        styleEn,
        audienceEn,
        moodEn,
        cameraEn,
        weatherEn,
        resolutionEn,
        fpsEn,
        genreEn,
        visualToneEn,
        cameraMovementEn,
        shotTypeEn,
        speedEn,
        lightingEn,
        colorPaletteEn,
        soundAmbienceEn,
        sfxDensityEn,
        safetyPresetEn,
        detailStrengthEn,
        motionSmoothingEn,
        coherenceEn,
        randomnessEn,
      ] = translated;

      const veo3 = buildVeo3PromptFromWizard(
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
          characters,
          actions,
          enhancedPrompt: lastEnhancedPrompt,
          suggestions: lastSuggestions,
          // 확장 필드는 느슨한 타입으로 veo3 내부에서 안전 처리
          ...({
            resolution: resolutionEn,
            fps: fpsEn,
            genre: genreEn,
            visualTone: visualToneEn,
            cameraMovement: cameraMovementEn,
            shotType: shotTypeEn,
            speed: speedEn,
            lighting: lightingEn,
            colorPalette: colorPaletteEn,
            soundAmbience: soundAmbienceEn,
            sfxDensity: sfxDensityEn,
            safetyPreset: safetyPresetEn,
            detailStrength: detailStrengthEn,
            motionSmoothing: motionSmoothingEn,
            coherence: coherenceEn,
            randomness: randomnessEn,
            seed: seedValue ? Number(seedValue) : undefined,
          } as any),
        }),
      );
      const english = await translateToEnglish(veo3);
      await navigator.clipboard.writeText(english);
      setStatusKind('success');
      setStatusMsg('프롬프트 복사 완료');
    } catch (e) {
      console.error('copy failed', e);
      setError('클립보드 복사에 실패했습니다.');
    }
  };

  const { createOne, createBatch } = useSeedanceCreate();
  const handleSeedanceCreate = async () => {
    try {
      // 훅 사용으로 에러는 훅이 관리
      if (enableMoviePack) {
        // 4씬 영화팩: 각 씬을 개별 Seedance 작업으로 생성
        const pack = composeFourScenePack();
        const jobs = await Promise.all(
          pack.map(async (scene) => {
            const prompt = buildVeo3PromptFromScene(scene);

            // LLM을 통한 Seedance용 프롬프트 변환
            let optimizedPrompt = prompt;
            try {
              optimizedPrompt = await transformPromptForTarget(prompt, {
                target: 'video',
                aspectRatio: scene.metadata?.aspect_ratio || selectedAspectRatio,
                duration: selectedDuration,
                style: selectedStyle,
              });
            } catch (e) {
              console.warn('LLM 비디오 프롬프트 변환 실패, 원본 사용:', e);
            }

            const english = await translateToEnglish(optimizedPrompt);
            try {
              await navigator.clipboard.writeText(english);
            } catch {}
            const payload: any = {
              prompt: english,
              aspect_ratio: scene.metadata?.aspect_ratio || selectedAspectRatio,
              duration_seconds: selectedDuration,
              webhook_url: webhookBase ? `${webhookBase}/api/seedance/webhook` : undefined,
            };
            return await createOne(payload);
          }),
        );
        const validJobs = jobs.filter(Boolean) as string[];
        setSeedanceJobIds(validJobs);
        // 훅 사용으로 상태/간격 초기화는 훅 재호출로 대체
        return;
      }

      // 단일 씬
      // 최종 프롬프트 미리보기 텍스트를 우선 사용 (한/영 상관없이 마지막에 영어화)
      let finalText =
        veo3Preview && veo3Preview.trim().length > 0
          ? veo3Preview
          : buildVeo3PromptFromWizard({
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
              // 확장 필드도 포함 (느슨한 타입)
              ...({
                resolution,
                fps,
                genre,
                visualTone,
                cameraMovement,
                shotType,
                speed,
                lighting,
                colorPalette,
                soundAmbience,
                sfxDensity,
                safetyPreset,
                detailStrength,
                motionSmoothing,
                coherence,
                randomness,
                seed: seedValue ? Number(seedValue) : undefined,
              } as any),
            });

      // LLM을 통한 Seedance용 프롬프트 변환
      let optimizedPrompt = finalText;
      try {
        optimizedPrompt = await transformPromptForTarget(finalText, {
          target: 'video',
          aspectRatio: selectedAspectRatio,
          duration: selectedDuration,
          style: selectedStyle,
        });
      } catch (e) {
        console.warn('LLM 비디오 프롬프트 변환 실패, 원본 사용:', e);
      }

      const english = await translateToEnglish(optimizedPrompt);
      try {
        await navigator.clipboard.writeText(english);
      } catch {}
      const payload: any = {
        prompt: english,
        aspect_ratio: selectedAspectRatio,
        duration_seconds: selectedDuration,
        webhook_url: webhookBase ? `${webhookBase}/api/seedance/webhook` : undefined,
      };
      const jobId = await createOne(payload);
      if (jobId) {
        setSeedanceJobIds([jobId]);
        setStatusKind('success');
        setStatusMsg('Seedance 영상 생성이 시작되었습니다.');
      }
    } catch (e) {
      console.error('Seedance create failed', e);
      const errorMessage = e instanceof Error ? e.message : 'Seedance 영상 생성 실패';
      setError(errorMessage);
      setStatusKind('error');
      setStatusMsg(errorMessage);

      // 사용자에게 환경변수 설정 안내
      if (errorMessage.includes('model/endpoint') || errorMessage.includes('SEEDANCE_MODEL')) {
        setError(
          `${errorMessage}\n\n해결 방법:\n1. Railway 대시보드에서 환경변수 설정\n2. SEEDANCE_API_KEY 설정\n3. SEEDANCE_MODEL 설정 (ep-... 형식)`,
        );
      }
    }
  };

  // Google Veo 동영상 생성
  const handleVeoCreate = async () => {
    try {
      if (!veo3Preview || !veo3Preview.trim()) {
        setStatusKind('error');
        setStatusMsg('최종 프롬프트 생성 후 동영상을 생성할 수 있습니다.');
        return;
      }

      setStatusKind('info');
      setStatusMsg('Google Veo로 동영상을 생성하고 있습니다...');

      // LLM을 통한 Veo용 프롬프트 변환
      let optimizedPrompt = veo3Preview;
      try {
        optimizedPrompt = await transformPromptForTarget(veo3Preview, {
          target: 'video',
          aspectRatio: selectedAspectRatio,
          duration: selectedDuration,
          style: selectedStyle,
        });
      } catch (e) {
        console.warn('LLM Veo 프롬프트 변환 실패, 원본 사용:', e);
      }

      const english = await translateToEnglish(optimizedPrompt);
      try {
        await navigator.clipboard.writeText(english);
      } catch {}

      // Veo API 호출 (환경별 분기)
      const apiUrl = getApiUrl(API_ENDPOINTS.VEO_CREATE);
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: english,
          aspectRatio: selectedAspectRatio,
          duration: selectedDuration,
          model: 'veo-3.0-generate-preview',
        }),
      });

      const json = await res.json();
      if (!json.ok) {
        // 구체적인 오류 메시지 처리
        if (json.error?.includes('GOOGLE_GEMINI_API_KEY')) {
          throw new Error(
            'Google Gemini API 키가 설정되지 않았습니다. Railway 환경변수를 확인해주세요.',
          );
        } else if (json.error?.includes('VEO_PROVIDER')) {
          throw new Error('Veo 제공자가 비활성화되었습니다. VEO_PROVIDER 환경변수를 확인해주세요.');
        } else {
          throw new Error(json.error || 'VEO_CREATION_FAILED');
        }
      }

      setStatusKind('success');
      setStatusMsg('Google Veo 동영상 생성이 시작되었습니다!');

      // Veo는 즉시 동영상을 반환하거나 operation ID를 반환
      if (json.videoUrl) {
        setVeo3Preview(json.videoUrl);
      } else if (json.operationId) {
        // 상태 확인을 위한 폴링 시작
        console.log('Veo operation started:', json.operationId);
      }
    } catch (e) {
      console.error('Veo create failed', e);
      const errorMessage = e instanceof Error ? e.message : 'Google Veo 동영상 생성 실패';
      setError(errorMessage);
      setStatusKind('error');
      setStatusMsg(errorMessage);

      // 사용자에게 환경변수 설정 안내
      if (errorMessage.includes('API 키') || errorMessage.includes('환경변수')) {
        setError(
          `${errorMessage}\n\n해결 방법:\n1. Railway 대시보드에서 환경변수 설정\n2. GOOGLE_GEMINI_API_KEY 설정\n3. VEO_PROVIDER=google 설정`,
        );
      }
    }
  };

  const handleSave = async () => {
    if (!generatedPrompt) return;
    try {
      console.log('Saving prompt:', generatedPrompt);
      setStatusKind('success');
      setStatusMsg('프롬프트 저장 완료');
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
    setImagePreviews([]);
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

  const handleImagenPreview = async () => {
    try {
      setIsImageLoading(true);
      setError(null);
      setImagePreviews([]); // 기존 이미지 초기화

      if (!veo3Preview || !veo3Preview.trim()) {
        setStatusKind('error');
        setStatusMsg('최종 프롬프트 생성 후 미리보기를 사용할 수 있습니다.');
        return;
      }

      console.log('DEBUG: 이미지 미리보기 시작:', {
        prompt: veo3Preview.slice(0, 100),
        hasPrompt: !!veo3Preview.trim(),
      });

      // LLM을 통한 이미지용 프롬프트 변환
      let optimizedPrompt = veo3Preview;
      try {
        optimizedPrompt = await transformPromptForTarget(veo3Preview, {
          target: 'image',
          aspectRatio: '16:9',
          style: selectedStyle,
          quality: 'high',
        });
        console.log('DEBUG: LLM 프롬프트 변환 성공:', optimizedPrompt.slice(0, 100));
      } catch (e) {
        console.warn('LLM 이미지 프롬프트 변환 실패, 원본 사용:', e);
      }

      // 영어 변환
      let english = optimizedPrompt;
      try {
        english = await translateToEnglish(optimizedPrompt);
        console.log('DEBUG: 영어 변환 성공:', english.slice(0, 100));
      } catch (e) {
        console.warn('영어 변환 실패, 원본 사용:', e);
      }

      // 이미지 생성 API 호출 (환경별 분기)
      const apiUrl = getApiUrl(API_ENDPOINTS.IMAGEN_PREVIEW);
      console.log('DEBUG: API 호출 시작:', { apiUrl, prompt: english.slice(0, 100) });

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: english,
          size: '1280x720',
          n: 1,
          provider: 'imagen', // 기본값으로 Google Imagen 사용
        }),
      });

      console.log('DEBUG: API 응답 상태:', res.status, res.statusText);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('DEBUG: API 에러 응답:', errorText);
        throw new Error(`API 호출 실패: ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      console.log('DEBUG: API 응답 데이터:', {
        ok: json.ok,
        hasImages: !!json.images,
        imageCount: json.images?.length || 0,
        firstImage: json.images?.[0]?.slice(0, 50) || 'none',
      });

      if (!json.ok) {
        throw new Error(json.error || '이미지 생성 실패');
      }

      if (!json.images || !Array.isArray(json.images) || json.images.length === 0) {
        throw new Error('이미지 데이터가 없습니다');
      }

      // 이미지 URL 유효성 검사
      const validImages = json.images.filter(
        (img: any) => img && typeof img === 'string' && img.trim() !== '',
      );
      if (validImages.length === 0) {
        throw new Error('유효한 이미지 URL이 없습니다');
      }

      setImagePreviews(validImages);
      console.log('DEBUG: 이미지 미리보기 설정 완료:', validImages.length);

      setStatusKind('success');
      setStatusMsg('이미지 미리보기가 생성되었습니다.');
    } catch (e) {
      console.error('이미지 미리보기 실패:', e);
      const errorMessage = e instanceof Error ? e.message : '이미지 프리뷰 생성 실패';
      setError(errorMessage);
      setStatusKind('error');
      setStatusMsg(`이미지 미리보기 생성 실패: ${errorMessage}`);

      // 에러 발생 시 이미지 배열 초기화
      setImagePreviews([]);
    } finally {
      setIsImageLoading(false);
    }
  };

  // 생성된 최종 프롬프트 텍스트를 받아 자동 이미지 미리보기 요청
  const requestImagenPreviewFromText = async (finalText: string) => {
    try {
      setIsImageLoading(true);
      setError(null);

      // LLM을 통한 이미지용 프롬프트 변환
      let optimizedPrompt = finalText;
      try {
        optimizedPrompt = await transformPromptForTarget(finalText, {
          target: 'image',
          aspectRatio: '16:9',
          style: selectedStyle,
          quality: 'high',
        });
      } catch (e) {
        console.warn('LLM 이미지 프롬프트 변환 실패, 원본 사용:', e);
      }

      const english = await translateToEnglish(optimizedPrompt);
      const apiUrl = getApiUrl(API_ENDPOINTS.IMAGEN_PREVIEW);
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: english,
          size: '1280x720',
          n: 1,
          provider: 'imagen', // 기본값으로 Google Imagen 사용
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'PREVIEW_FAILED');
      setImagePreviews(Array.isArray(json.images) ? json.images : []);

      setStatusKind('success');
      setStatusMsg('자동 이미지 미리보기가 생성되었습니다.');
    } catch (e) {
      console.error('auto imagen preview failed', e);
      setStatusKind('error');
      setStatusMsg('이미지 미리보기 생성 실패');
    } finally {
      setIsImageLoading(false);
    }
  };

  // 간단 프리셋
  const applyPreset = (p: {
    scenario: string;
    theme: string;
    style: string;
    aspect: string;
    duration: number;
    mood: string;
    camera: string;
    weather: string;
  }) => {
    setScenario(p.scenario);
    setSelectedTheme(p.theme);
    setSelectedStyle(p.style);
    setSelectedAspectRatio(p.aspect);
    setSelectedDuration(p.duration);
    setMood(p.mood);
    setCamera(p.camera);
    setWeather(p.weather);
    setCharacters([]);
    setActions([]);
    setGeneratedPrompt(null);
    setError(null);
  };

  const handlePresetRooftop = () =>
    applyPreset({
      scenario:
        '비 내리는 도시 야경의 옥상. 두 그룹의 거래가 틀어지고 스나이퍼 등장, 혼란과 총성, 헬리콥터 서치라이트.',
      theme: '해질녘 옥상',
      style: '시네마틱',
      aspect: '21:9',
      duration: 8,
      mood: '긴장',
      camera: '핸드헬드',
      weather: '비',
    });

  const handlePresetGarage = () =>
    applyPreset({
      scenario: '저조도의 지하 주차장. 인물이 조용히 차에 탑승해 미니멀한 움직임으로 탈출을 시도.',
      theme: '도시 밤',
      style: '미니멀',
      aspect: '21:9',
      duration: 8,
      mood: '차분',
      camera: '트래킹',
      weather: '비',
    });

  const handlePresetTunnel = () =>
    applyPreset({
      scenario: '좁은 지하 터널. 1인칭 POV 슈퍼카 추격, 사이드 미러로 추격 차량의 총성이 보임.',
      theme: '도시 밤',
      style: '포토리얼',
      aspect: '21:9',
      duration: 8,
      mood: '긴장',
      camera: 'POV',
      weather: '비',
    });

  const clearAll = () => {
    setGeneratedPrompt(null);
    setVeo3Preview('');
    setImagePreviews([]); // 이미지 미리보기도 초기화
    setSeedanceJobIds([]);
    setCharacters([]);
    setActions([]);
  };

  // 이미지 미리보기 초기화 함수
  const clearImagePreviews = () => {
    setImagePreviews([]);
    setError(null);
    setStatusMsg(null);
    setStatusKind('info');
  };

  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">로딩 중…</div>}>
      <div className="min-h-screen bg-gray-50" aria-busy={isGenerating} aria-live="polite">
        {/* 헤더 */}
        <div className="border-b bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center space-x-4">
                <Icon name="wizard" size="lg" className="text-primary-500" />
                <h1 className="text-2xl font-bold text-gray-900">AI 영상 생성</h1>
                <div className="flex items-center gap-2">
                  <input
                    id="movie-pack"
                    name="movie-pack"
                    type="checkbox"
                    checked={enableMoviePack}
                    onChange={(e) => setEnableMoviePack(e.target.checked)}
                  />
                  <label htmlFor="movie-pack" className="text-sm text-gray-700">
                    영화팩(4씬) 생성
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push('/planning')}
                  className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  <Icon name="projects" size="sm" className="mr-2" />
                  콘텐츠 보관함
                </Button>
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

        <div className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:px-8">
          {statusMsg && (
            <div
              className={`mb-4 rounded-md p-3 text-sm ${statusKind === 'success' ? 'border border-green-100 bg-green-50 text-green-800' : statusKind === 'error' ? 'border border-danger-100 bg-danger-50 text-danger-800' : 'border border-gray-100 bg-gray-50 text-gray-800'}`}
              onAnimationEnd={() => {}}
            >
              <div className="flex items-center justify-between">
                <span>{statusMsg}</span>
                <button
                  className="text-xs opacity-70 hover:opacity-100"
                  onClick={() => setStatusMsg(null)}
                >
                  닫기
                </button>
              </div>
            </div>
          )}

          {/* 모드 선택 탭 */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setWorkflowMode('wizard')}
                  className={`border-b-2 px-1 py-2 text-sm font-medium ${
                    workflowMode === 'wizard'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <Icon name="gear" className="mr-2" />
                  고급 위저드 모드
                </button>
                <button
                  onClick={() => setWorkflowMode('scenario')}
                  className={`border-b-2 px-1 py-2 text-sm font-medium ${
                    workflowMode === 'scenario'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <Icon name="lightning" className="mr-2" />
                  시나리오 개발 모드
                </button>
              </nav>
            </div>
          </div>

          {/* 모드별 콘텐츠 */}
          {workflowMode === 'scenario' ? (
            <ScenarioWorkflow onVideoCreated={(jobId) => setSeedanceJobIds([jobId])} />
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* 입력 섹션 */}
              <div className="space-y-6">
                <div className="rounded-lg border bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">1. 시나리오 입력</h2>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
                      <Icon name="info" size="sm" className="mt-0.5" />
                      <div>
                        <div className="font-medium">용어 도움말</div>
                        <ul className="ml-4 mt-1 list-disc space-y-1">
                          <li>
                            <b>화면비</b>: 화면의 가로:세로 비율(예: 21:9는 영화 와이드 화면).
                          </li>
                          <li>
                            <b>지속시간</b>: 영상 길이(초). 타임라인은 2초 단위로 나뉩니다.
                          </li>
                          <li>
                            <b>카메라</b>: 카메라 이동/샷 타입(예: 돌리인, 트래킹, POV 등).
                          </li>
                          <li>
                            <b>Lighting/Color</b>: 조명 스타일과 색감 팔레트로 영상 분위기를
                            좌우합니다.
                          </li>
                          <li>
                            <b>SFX Density</b>: 사운드 효과의 밀도(lite/full). Full일수록 사운드
                            디테일이 풍부.
                          </li>
                          <li>
                            <b>Coherence/Randomness</b>: 장면 일관성과 무작위성. 일관성이 높을수록
                            안정적.
                          </li>
                        </ul>
                        <button
                          type="button"
                          className="mt-2 text-blue-700 hover:underline"
                          onClick={() => setHelpExpanded((v) => !v)}
                        >
                          {helpExpanded ? '자세히 접기' : '자세히 보기'}
                        </button>
                        {helpExpanded && (
                          <div className="mt-2 space-y-1 text-blue-900/90">
                            <div>
                              <b>Resolution</b>: 최종 출력 해상도(예: 1080p, 4K). 높을수록 디테일이
                              늘지만 비용/시간이 증가.
                            </div>
                            <div>
                              <b>FPS</b>: 초당 프레임(24/30/60). 24fps는 영화 톤, 60fps는 더
                              부드러운 모션.
                            </div>
                            <div>
                              <b>Genre</b>: 전반적 장르/톤(예: action-thriller, noir).
                            </div>
                            <div>
                              <b>Visual Tone</b>: 시각적 질감/설명(예: cinematic, photorealistic,
                              high-contrast).
                            </div>
                            <div>
                              <b>Camera Movement</b>: 카메라 이동(예: dolly-in, tracking, handheld).
                            </div>
                            <div>
                              <b>Shot Type</b>: 구도/프레이밍(예: wide, medium, close-up, POV,
                              top-down).
                            </div>
                            <div>
                              <b>Speed</b>: 장면 체감 속도(slow/normal/fast).
                            </div>
                            <div>
                              <b>Lighting</b>: 조명 스타일(low-key, high-key, natural 등).
                            </div>
                            <div>
                              <b>Color Palette</b>: 색감(예: teal & orange, noir desaturated).
                            </div>
                            <div>
                              <b>Sound Ambience</b>: 배경 사운드 요소(예: rain, city hum).
                            </div>
                            <div>
                              <b>Detail Strength</b>: 묘사 강도(low~ultra).
                            </div>
                            <div>
                              <b>Motion Smoothing</b>: 모션 보정 강도(off/low/medium/high).
                            </div>
                            <div>
                              <b>Coherence</b>: 장면 내부 일관성 수준(low~very-high).
                            </div>
                            <div>
                              <b>Randomness</b>: 무작위성(낮을수록 안정, 높을수록 변주).
                            </div>
                            <div>
                              <b>Safety Preset</b>: 안전 필터 강도(standard/safe/strict).
                            </div>
                            <div>
                              <b>Seed</b>: 동일 조건 재현을 위한 숫자(고정 시 유사 결과).
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="mr-1 text-xs text-gray-500">프리셋:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePresetRooftop}
                        title="Rooftop Action (8s, 21:9)"
                      >
                        Rooftop
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePresetGarage}
                        title="Garage Minimal (8s, 21:9)"
                      >
                        Garage
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePresetTunnel}
                        title="Tunnel POV (8s, 21:9)"
                      >
                        Tunnel
                      </Button>
                      <div className="ml-auto flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleImagenPreview}
                          disabled={isImageLoading || !generatedPrompt}
                          title="최종 프롬프트 기반 16:9 이미지 미리보기 1장 생성 (Google Imagen)"
                        >
                          {isImageLoading ? (
                            <>
                              <Icon name="loading" size="sm" className="mr-1" /> 생성 중…
                            </>
                          ) : (
                            '이미지 미리보기 (Imagen)'
                          )}
                        </Button>
                      </div>
                    </div>
                    <label className="block text-sm font-medium text-gray-700">
                      이 곳에 시나리오를 넣어주세요!
                    </label>
                    <div className="flex items-start gap-3">
                      <textarea
                        data-testid="scenario-input"
                        value={scenario}
                        onChange={(e) => setScenario(e.target.value)}
                        placeholder="예: 아이가 부엌에서 쿠키를 만드는 장면"
                        className="h-32 flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                          <>
                            <Icon name="wizard" size="sm" className="mr-2" />
                            생성
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      구체적일수록 더 좋은 결과를 얻을 수 있어요.
                    </p>

                    {/* 이미지 미리보기 버튼 추가 */}
                    <div className="mt-3 flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleImagenPreview}
                        disabled={isImageLoading || !generatedPrompt}
                        title="생성된 프롬프트로 이미지 미리보기 생성"
                      >
                        {isImageLoading ? (
                          <>
                            <Icon name="loading" size="sm" className="mr-1 animate-spin" /> 이미지
                            생성 중…
                          </>
                        ) : (
                          <>
                            <Icon name="image" size="sm" className="mr-2" />
                            이미지 미리보기
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">2. 기본 옵션</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">테마</label>
                      <select
                        value={useCustomTheme ? '__custom__' : selectedTheme}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__custom__') setUseCustomTheme(true);
                          else {
                            setSelectedTheme(v);
                          }
                        }}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {themes.map((theme) => (
                          <option key={theme} value={theme}>
                            {theme}
                          </option>
                        ))}
                        <option value="__custom__">직접 입력…</option>
                      </select>
                      {useCustomTheme && (
                        <div className="mt-2">
                          <input
                            value={customTheme}
                            onChange={(e) => setCustomTheme(e.target.value)}
                            onBlur={() => {
                              const v = customTheme.trim();
                              if (v) {
                                setSelectedTheme(v);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const v = customTheme.trim();
                                if (v) {
                                  setSelectedTheme(v);
                                }
                              }
                            }}
                            placeholder="직접 입력 후 Enter"
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <p className="mt-1 text-xs text-gray-400">
                            Enter 또는 포커스 아웃 시 적용
                          </p>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">스타일</label>
                      <select
                        value={useCustomStyle ? '__custom__' : selectedStyle}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__custom__') setUseCustomStyle(true);
                          else {
                            setSelectedStyle(v);
                          }
                        }}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {styles.map((style) => (
                          <option key={style} value={style}>
                            {style}
                          </option>
                        ))}
                        <option value="__custom__">직접 입력…</option>
                      </select>
                      {useCustomStyle && (
                        <div className="mt-2">
                          <input
                            value={customStyle}
                            onChange={(e) => setCustomStyle(e.target.value)}
                            onBlur={() => {
                              const v = customStyle.trim();
                              if (v) {
                                setSelectedStyle(v);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const v = customStyle.trim();
                                if (v) {
                                  setSelectedStyle(v);
                                }
                              }
                            }}
                            placeholder="직접 입력 후 Enter"
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <p className="mt-1 text-xs text-gray-400">
                            Enter 또는 포커스 아웃 시 적용
                          </p>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">화면비</label>
                      <select
                        value={useCustomAspect ? '__custom__' : selectedAspectRatio}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__custom__') setUseCustomAspect(true);
                          else {
                            setSelectedAspectRatio(v);
                            setValidation((s) => ({ ...s, aspectError: null }));
                          }
                        }}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {aspectRatios.map((ratio) => (
                          <option key={ratio} value={ratio}>
                            {ratio}
                          </option>
                        ))}
                        <option value="__custom__">직접 입력…</option>
                      </select>
                      {useCustomAspect && (
                        <div className="mt-2">
                          <input
                            value={customAspect}
                            onChange={(e) => setCustomAspect(e.target.value)}
                            onBlur={() => {
                              const v = customAspect.trim();
                              if (v) {
                                const ok = /^\d{1,2}:\d{1,2}$/.test(v);
                                setValidation((s) => ({
                                  ...s,
                                  aspectError: ok ? null : '형식 예: 21:9, 16:9',
                                }));
                                if (ok) setSelectedAspectRatio(v);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const v = customAspect.trim();
                                if (v) {
                                  const ok = /^\d{1,2}:\d{1,2}$/.test(v);
                                  setValidation((s) => ({
                                    ...s,
                                    aspectError: ok ? null : '형식 예: 21:9, 16:9',
                                  }));
                                  if (ok) setSelectedAspectRatio(v);
                                }
                              }
                            }}
                            placeholder="예: 16:9, 21:9 (Enter로 적용)"
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <p className="mt-1 text-xs text-gray-400">
                            Enter 또는 포커스 아웃 시 적용
                          </p>
                          {validation.aspectError && (
                            <p className="mt-1 text-xs text-danger-600">{validation.aspectError}</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        지속시간 (초)
                      </label>
                      <select
                        value={useCustomDuration ? '__custom__' : String(selectedDuration)}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__custom__') setUseCustomDuration(true);
                          else {
                            setSelectedDuration(Number(v));
                            setValidation((s) => ({ ...s, durationError: null }));
                          }
                        }}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {durations.map((duration) => (
                          <option key={duration} value={String(duration)}>
                            {duration}초
                          </option>
                        ))}
                        <option value="__custom__">직접 입력…</option>
                      </select>
                      {useCustomDuration && (
                        <div className="mt-2">
                          <input
                            value={customDuration}
                            onChange={(e) => setCustomDuration(e.target.value)}
                            onBlur={() => {
                              const n = parseInt(customDuration, 10);
                              const ok = !isNaN(n) && n > 0 && n <= 30;
                              setValidation((s) => ({
                                ...s,
                                durationError: ok ? null : '1~30초 범위의 숫자',
                              }));
                              if (ok) {
                                setSelectedDuration(n);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const n = parseInt(customDuration, 10);
                                const ok = !isNaN(n) && n > 0 && n <= 30;
                                setValidation((s) => ({
                                  ...s,
                                  durationError: ok ? null : '1~30초 범위의 숫자',
                                }));
                                if (ok) {
                                  setSelectedDuration(n);
                                }
                              }
                            }}
                            placeholder="숫자(초), Enter로 적용"
                            inputMode="numeric"
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <p className="mt-1 text-xs text-gray-400">
                            Enter 또는 포커스 아웃 시 적용
                          </p>
                          {validation.durationError && (
                            <p className="mt-1 text-xs text-danger-600">{validation.durationError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-6 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">3. 고급 옵션</h2>
                    <Button variant="outline" onClick={() => setShowAdvanced(!showAdvanced)}>
                      <Icon
                        name={showAdvanced ? ('minus' as any) : 'plus'}
                        size="sm"
                        className="mr-2"
                      />
                      {showAdvanced ? '접기' : '펼치기'}
                    </Button>
                  </div>

                  {showAdvanced && (
                    <div className="mt-4 space-y-6">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <Button
                          variant={advancedTab === 'cinema' ? 'primary' : 'ghost'}
                          size="sm"
                          onClick={() => setAdvancedTab('cinema')}
                        >
                          시네마토그래피
                        </Button>
                        <Button
                          variant={advancedTab === 'light' ? 'primary' : 'ghost'}
                          size="sm"
                          onClick={() => setAdvancedTab('light')}
                        >
                          조명·컬러·사운드
                        </Button>
                        <Button
                          variant={advancedTab === 'sfx' ? 'primary' : 'ghost'}
                          size="sm"
                          onClick={() => setAdvancedTab('sfx')}
                        >
                          SFX·품질·안전
                        </Button>
                        <Button
                          variant={advancedTab === 'basic' ? 'primary' : 'ghost'}
                          size="sm"
                          onClick={() => setAdvancedTab('basic')}
                        >
                          기본+
                        </Button>
                      </div>
                      {/* 탭: 시네마토그래피 */}
                      {advancedTab === 'cinema' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label
                              className="mb-2 block text-sm font-medium text-gray-700"
                              title="장면의 정서 톤 (예: 긴장, 아늑, 장엄)"
                            >
                              분위기
                            </label>
                            <select
                              value={useCustomMood ? '__custom__' : mood}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '__custom__') setUseCustomMood(true);
                                else {
                                  setMood(v);
                                }
                              }}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              {moods.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                              <option value="__custom__">직접 입력…</option>
                            </select>
                            {useCustomMood && (
                              <div className="mt-2">
                                <input
                                  value={customMood}
                                  onChange={(e) => setCustomMood(e.target.value)}
                                  onBlur={() => {
                                    const v = customMood.trim();
                                    if (v) {
                                      setMood(v);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const v = customMood.trim();
                                      if (v) {
                                        setMood(v);
                                      }
                                    }
                                  }}
                                  placeholder="예: 차분한 서정 (Enter로 적용)"
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                                <p className="mt-1 text-xs text-gray-400">
                                  Enter 또는 포커스 아웃 시 적용
                                </p>
                              </div>
                            )}
                          </div>
                          <div>
                            <label
                              className="mb-2 block text-sm font-medium text-gray-700"
                              title="카메라 이동/샷 타입 (예: 돌리인, 트래킹, POV)"
                            >
                              카메라
                            </label>
                            <select
                              value={useCustomCamera ? '__custom__' : camera}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '__custom__') setUseCustomCamera(true);
                                else {
                                  setCamera(v);
                                }
                              }}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              {cameras.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                              <option value="__custom__">직접 입력…</option>
                            </select>
                            {useCustomCamera && (
                              <div className="mt-2">
                                <input
                                  value={customCamera}
                                  onChange={(e) => setCustomCamera(e.target.value)}
                                  onBlur={() => {
                                    const v = customCamera.trim();
                                    if (v) {
                                      setCamera(v);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const v = customCamera.trim();
                                      if (v) {
                                        setCamera(v);
                                      }
                                    }
                                  }}
                                  placeholder="예: 롤링, 틸트-업 (Enter로 적용)"
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                                <p className="mt-1 text-xs text-gray-400">
                                  Enter 또는 포커스 아웃 시 적용
                                </p>
                              </div>
                            )}
                          </div>
                          <div>
                            <label
                              className="mb-2 block text-sm font-medium text-gray-700"
                              title="카메라 이동"
                            >
                              Camera Movement
                            </label>
                            <select
                              value={cameraMovement}
                              onChange={(e) => setCameraMovement(e.target.value)}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              {[
                                'dolly-in',
                                'dolly-out',
                                'push-in',
                                'pull-out',
                                'tracking',
                                'handheld',
                                'crane',
                                'gimbal',
                                'orbit',
                              ].map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label
                              className="mb-2 block text-sm font-medium text-gray-700"
                              title="샷 타입"
                            >
                              Shot Type
                            </label>
                            <select
                              value={shotType}
                              onChange={(e) => setShotType(e.target.value)}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              {[
                                'wide',
                                'medium',
                                'close-up',
                                'over-shoulder',
                                'top-down',
                                'POV',
                                'dutch-angle',
                              ].map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label
                              className="mb-2 block text-sm font-medium text-gray-700"
                              title="속도감"
                            >
                              Speed
                            </label>
                            <select
                              value={speed}
                              onChange={(e) => setSpeed(e.target.value)}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              {['slow', 'normal', 'fast'].map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* 탭: 조명/컬러/사운드 */}
                      {advancedTab === 'light' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label
                              className="mb-2 block text-sm font-medium text-gray-700"
                              title="조명 스타일"
                            >
                              Lighting
                            </label>
                            <select
                              value={lighting}
                              onChange={(e) => setLighting(e.target.value)}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              {[
                                'low-key moody',
                                'high-key soft',
                                'natural window light',
                                'neon contrast',
                                'golden hour',
                              ].map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label
                              className="mb-2 block text-sm font-medium text-gray-700"
                              title="컬러 팔레트"
                            >
                              Color Palette
                            </label>
                            <select
                              value={colorPalette}
                              onChange={(e) => setColorPalette(e.target.value)}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              {[
                                'teal & orange',
                                'monochrome cool',
                                'warm amber',
                                'neutral filmic',
                                'noir desaturated',
                              ].map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label
                              className="mb-2 block text-sm font-medium text-gray-700"
                              title="환경 사운드"
                            >
                              Sound Ambience
                            </label>
                            <input
                              value={soundAmbience}
                              onChange={(e) => setSoundAmbience(e.target.value)}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                          <div>
                            <label
                              className="mb-2 block text-sm font-medium text-gray-700"
                              title="기상/환경 효과"
                            >
                              날씨
                            </label>
                            <select
                              value={useCustomWeather ? '__custom__' : weather}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '__custom__') setUseCustomWeather(true);
                                else {
                                  setWeather(v);
                                }
                              }}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              {weathers.map((w) => (
                                <option key={w} value={w}>
                                  {w}
                                </option>
                              ))}
                              <option value="__custom__">직접 입력…</option>
                            </select>
                            {useCustomWeather && (
                              <div className="mt-2">
                                <input
                                  value={customWeather}
                                  onChange={(e) => setCustomWeather(e.target.value)}
                                  onBlur={() => {
                                    const v = customWeather.trim();
                                    if (v) {
                                      setWeather(v);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const v = customWeather.trim();
                                      if (v) {
                                        setWeather(v);
                                      }
                                    }
                                  }}
                                  placeholder="예: 흐림, 모래바람 (Enter로 적용)"
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                                <p className="mt-1 text-xs text-gray-400">
                                  Enter 또는 포커스 아웃 시 적용
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 탭: SFX/품질/안전 */}
                      {advancedTab === 'sfx' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label
                                className="mb-2 block text-sm font-medium text-gray-700"
                                title="효과 밀도"
                              >
                                SFX Density
                              </label>
                              <select
                                value={sfxDensity}
                                onChange={(e) => setSfxDensity(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              >
                                {['lite', 'full'].map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label
                                className="mb-2 block text-sm font-medium text-gray-700"
                                title="세부 묘사 강도"
                              >
                                Detail Strength
                              </label>
                              <select
                                value={detailStrength}
                                onChange={(e) => setDetailStrength(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              >
                                {['low', 'medium', 'high', 'ultra'].map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label
                                className="mb-2 block text-sm font-medium text-gray-700"
                                title="모션 보정"
                              >
                                Motion Smoothing
                              </label>
                              <select
                                value={motionSmoothing}
                                onChange={(e) => setMotionSmoothing(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              >
                                {['off', 'low', 'medium', 'high'].map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label
                                className="mb-2 block text-sm font-medium text-gray-700"
                                title="장면 일관성"
                              >
                                Coherence
                              </label>
                              <select
                                value={coherence}
                                onChange={(e) => setCoherence(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              >
                                {['low', 'medium', 'high', 'very-high'].map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label
                                className="mb-2 block text-sm font-medium text-gray-700"
                                title="무작위성"
                              >
                                Randomness
                              </label>
                              <select
                                value={randomness}
                                onChange={(e) => setRandomness(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              >
                                {['low', 'medium', 'high'].map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label
                                className="mb-2 block text-sm font-medium text-gray-700"
                                title="안전 프리셋"
                              >
                                Safety Preset
                              </label>
                              <select
                                value={safetyPreset}
                                onChange={(e) => setSafetyPreset(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              >
                                {['standard', 'safe', 'strict'].map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label
                                className="mb-2 block text-sm font-medium text-gray-700"
                                title="재현을 위한 시드 값"
                              >
                                Seed
                              </label>
                              <input
                                value={seedValue}
                                onChange={(e) => setSeedValue(e.target.value)}
                                placeholder="숫자"
                                inputMode="numeric"
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label
                                className="mb-2 block text-sm font-medium text-gray-700"
                                title="제외하고 싶은 요소를 영어로 입력 (쉼표/줄바꿈)"
                              >
                                Negative Prompts (comma or newline separated)
                              </label>
                              <textarea
                                value={negativePromptsText}
                                onChange={(e) => setNegativePromptsText(e.target.value)}
                                placeholder="no blood, no text, no supernatural elements"
                                className="h-20 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <p className="mt-1 text-xs text-gray-400">
                                예: no blood, no text, no supernatural elements
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                id="full-sfx"
                                type="checkbox"
                                checked={enableFullSfx}
                                onChange={(e) => setEnableFullSfx(e.target.checked)}
                              />
                              <label
                                htmlFor="full-sfx"
                                className="text-sm text-gray-700"
                                title="타임라인에 풍부한 사운드 디테일을 포함"
                              >
                                Full SFX timeline (리치한 사운드 디테일 사용)
                              </label>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 탭: 기본+ */}
                      {advancedTab === 'basic' && (
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label
                                className="mb-2 block text-sm font-medium text-gray-700"
                                title="콘텐츠의 주요 시청자/타겟층"
                              >
                                대상
                              </label>
                              <div className="flex gap-2">
                                <select
                                  className="w-40 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  value={targetAudience}
                                  onChange={(e) => setTargetAudience(e.target.value)}
                                  aria-label="타겟 오디언스 선택"
                                >
                                  {['전체', '아동', '청소년', '성인', '전문가'].map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  value={customAudience}
                                  onChange={(e) => setCustomAudience(e.target.value)}
                                  onBlur={() => {
                                    if (customAudience.trim()) setTargetAudience(customAudience.trim());
                                  }}
                                  placeholder="직접 입력"
                                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  aria-label="타겟 직접 입력"
                                />
                              </div>
                            </div>
                            <div>
                              <label
                                className="mb-2 block text-sm font-medium text-gray-700"
                                title="장르/톤"
                              >
                                Genre
                              </label>
                              <select
                                value={genre}
                                onChange={(e) => setGenre(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              >
                                {[
                                  'action-thriller',
                                  'noir',
                                  'drama',
                                  'sci-fi',
                                  'documentary',
                                  'music-video',
                                ].map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label
                                className="mb-2 block text-sm font-medium text-gray-700"
                                title="비주얼 톤 설명"
                              >
                                Visual Tone
                              </label>
                              <input
                                value={visualTone}
                                onChange={(e) => setVisualTone(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>
                            <div>
                              <label
                                className="mb-2 block text-sm font-medium text-gray-700"
                                title="해상도"
                              >
                                Resolution
                              </label>
                              <select
                                value={resolution}
                                onChange={(e) => setResolution(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              >
                                {['720p', '1080p', '1440p', '4K'].map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label
                                className="mb-2 block text-sm font-medium text-gray-700"
                                title="프레임레이트"
                              >
                                FPS
                              </label>
                              <select
                                value={fps}
                                onChange={(e) => setFps(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              >
                                {['24', '25', '30', '48', '60'].map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label
                              className="mb-2 block text-sm font-medium text-gray-700"
                              title="장면에 등장하는 인물/개체 선택"
                            >
                              캐릭터
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {characterPool.map((ch) => (
                                <button
                                  key={ch}
                                  type="button"
                                  onClick={() => toggleInArray(characters, setCharacters, ch)}
                                  className={`rounded-full border px-3 py-1 text-sm ${characters.includes(ch) ? 'border-primary-200 bg-primary-100 text-primary-700' : 'border-gray-300 bg-white text-gray-700'}`}
                                >
                                  {ch}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label
                              className="mb-2 block text-sm font-medium text-gray-700"
                              title="캐릭터의 주요 액션 선택"
                            >
                              동작
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {actionPool.map((ac) => (
                                <button
                                  key={ac}
                                  type="button"
                                  onClick={() => toggleInArray(actions, setActions, ac)}
                                  className={`rounded-full border px-3 py-1 text-sm ${actions.includes(ac) ? 'border-primary-200 bg-primary-100 text-primary-700' : 'border-gray-300 bg-white text-gray-700'}`}
                                >
                                  {ac}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 결과 섹션 */}
              <div className="space-y-6">
                <div className="rounded-lg border bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">생성된 장면</h2>

                  {generatedPrompt ? (
                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 text-sm font-medium text-gray-700">
                          이미지 미리보기 (16:9)
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          <div className="relative aspect-video w-full max-w-xl overflow-hidden rounded border bg-gray-100">
                            {imagePreviews.length > 0 && imagePreviews[0] && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imagePreviews[0]}
                                alt="preview-0"
                                className="absolute inset-0 h-full w-full object-contain"
                                onError={(e) => {
                                  console.error('이미지 로드 실패:', imagePreviews[0]);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            {isImageLoading && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                                <div className="flex flex-col items-center gap-2">
                                  <Icon name="spinner" className="text-blue-600" />
                                  <span className="text-sm text-blue-700">
                                    작가가 글을 쓰는 중...
                                  </span>
                                </div>
                              </div>
                            )}
                            {!isImageLoading && imagePreviews.length === 0 && (
                              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                                <div className="flex flex-col items-center gap-2 p-4 text-center">
                                  <Icon name="image" className="text-gray-400" size="lg" />
                                  <span className="text-sm text-gray-500">
                                    이미지 미리보기를 생성해주세요
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    "이미지 미리보기" 버튼을 클릭하세요
                                  </span>
                                </div>
                              </div>
                            )}
                            {!isImageLoading && imagePreviews.length > 0 && !imagePreviews[0] && (
                              <div className="absolute inset-0 flex items-center justify-center bg-danger-50">
                                <div className="flex flex-col items-center gap-2 p-4 text-center">
                                  <Icon name="error" className="text-danger-400" size="lg" />
                                  <span className="text-sm text-danger-500">이미지 생성 실패</span>
                                  <span className="text-xs text-danger-400">다시 시도해주세요</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">테마:</span>
                          <span className="ml-2 text-gray-900">
                            {generatedPrompt.metadata.room_description}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">스타일:</span>
                          <span className="ml-2 text-gray-900">
                            {generatedPrompt.metadata.base_style}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">화면비:</span>
                          <span className="ml-2 text-gray-900">
                            {generatedPrompt.metadata.aspect_ratio}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">지속시간:</span>
                          <span className="ml-2 text-gray-900">{selectedDuration}초</span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <div className="mb-2 text-sm font-medium text-gray-700">프롬프트</div>
                          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs">
                            {generatedPrompt.text}
                          </pre>
                        </div>
                        {veo3Preview && (
                          <div>
                            <div className="mb-2 text-sm font-medium text-gray-700">
                              최종 프롬프트
                            </div>
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs">
                              {veo3Preview}
                            </pre>
                          </div>
                        )}
                        {/* 상태 메시지 표시 */}
                        {(statusMsg || statusKind !== 'info') && (
                          <div
                            className={`mt-3 rounded-lg p-3 text-sm ${
                              statusKind === 'success'
                                ? 'border border-green-200 bg-green-50 text-green-800'
                                : statusKind === 'error'
                                  ? 'border border-danger-200 bg-danger-50 text-danger-800'
                                  : 'border border-blue-200 bg-blue-50 text-blue-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon
                                name={
                                  statusKind === 'success'
                                    ? 'check'
                                    : statusKind === 'error'
                                      ? 'error'
                                      : 'info'
                                }
                                size="sm"
                                className={
                                  statusKind === 'success'
                                    ? 'text-green-600'
                                    : statusKind === 'error'
                                      ? 'text-danger-600'
                                      : 'text-blue-600'
                                }
                              />
                              {statusMsg}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-3 pt-2">
                          <Button
                            onClick={handleCopyVeo3}
                            className="flex-1"
                            data-testid="copy-veo3-btn"
                          >
                            <Icon name="copy" size="sm" className="mr-2" />
                            프롬프트 복사
                          </Button>

                          {/* Veo3 동영상 생성 버튼 */}
                          <Button
                            variant="outline"
                            onClick={handleVeoCreate}
                            className="flex-1"
                            title="Google Veo 3로 동영상 생성"
                          >
                            <Icon name="play" size="sm" className="mr-2" />
                            Veo3 생성
                          </Button>

                          {/* Seedance 영상 생성 버튼 */}
                          <Button
                            variant="outline"
                            onClick={handleSeedanceCreate}
                            className="flex-1"
                            title="Seedance로 영상 생성"
                          >
                            <Icon name="play" size="sm" className="mr-2" />
                            Seedance 영상 생성
                          </Button>
                        </div>

                        {seedanceJobIds.length > 0 && (
                          <SeedanceProgressPanel
                            jobIds={seedanceJobIds}
                            statuses={seedanceStatuses}
                            error={seedanceError}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-500">
                      <Icon name="wizard" size="xl" className="mx-auto mb-4 text-gray-300" />
                      <p>시나리오를 입력하고 장면 만들기를 눌러주세요.</p>
                      <p className="mt-2 text-sm">AI가 자동으로 장면을 생성해드립니다.</p>
                    </div>
                  )}
                </div>

                {/* 최근 생성 리스트 */}
                <div className="rounded-lg border bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">최근 생성한 프롬프트</h2>
                    <div className="flex items-center gap-2">
                      <input
                        value={recentQuery}
                        onChange={(e) => setRecentQuery(e.target.value)}
                        placeholder="검색"
                        className="rounded border px-2 py-1 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const next = recentPrompts.filter((r: any) => !r.pinned);
                          setRecentPrompts(next);
                          localStorage.setItem('vp:recentPrompts', JSON.stringify(next));
                        }}
                        title="핀 제외 모두 삭제"
                        className="text-danger-600 hover:text-danger-700"
                      >
                        모두 삭제
                      </Button>
                      <span className="text-xs text-gray-400">최대 10개</span>
                    </div>
                  </div>
                  {recentPrompts.length === 0 ? (
                    <div className="text-sm text-gray-500">아직 생성한 프롬프트가 없습니다.</div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {recentPrompts
                        .filter(
                          (r) =>
                            !recentQuery.trim() ||
                            r.name.toLowerCase().includes(recentQuery.toLowerCase()),
                        )
                        .sort(
                          (a: any, b: any) =>
                            (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.savedAt - a.savedAt,
                        )
                        .map((r: any) => (
                          <li key={r.id} className="py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900">
                                  <span>{r.name}</span>
                                  <span className="rounded border bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
                                    {r.prompt?.metadata?.aspect_ratio || selectedAspectRatio}
                                  </span>
                                  <span className="rounded border bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700">
                                    {getPromptDurationSec(r.prompt)}s
                                  </span>
                                  {r.prompt?.metadata?.base_style && (
                                    <span className="rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                                      {r.prompt.metadata.base_style}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(r.savedAt).toLocaleString()}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const next = recentPrompts.map((it: any) =>
                                      it.id === r.id ? { ...it, pinned: !it.pinned } : it,
                                    );
                                    setRecentPrompts(next);
                                    localStorage.setItem('vp:recentPrompts', JSON.stringify(next));
                                  }}
                                  title={r.pinned ? '핀 해제' : '핀 고정'}
                                  aria-label={r.pinned ? '핀 해제' : '핀 고정'}
                                  className={`h-8 w-8 p-0 ${r.pinned ? 'text-amber-600' : ''}`}
                                >
                                  <Icon name={r.pinned ? 'minus' : 'plus'} size="sm" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleRecentDetails(r.id)}
                                  title={expandedRecent[r.id] ? '접기' : '펼치기'}
                                  aria-label={expandedRecent[r.id] ? '접기' : '펼치기'}
                                  data-testid="recent-item-toggle"
                                  className="h-8 w-8 p-0"
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
                                  className="h-8 w-8 p-0"
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
                                  className="h-8 w-8 p-0"
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
                                  className="h-8 w-8 p-0 text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                                >
                                  <Icon name="delete" size="sm" />
                                </Button>
                              </div>
                            </div>
                            {expandedRecent[r.id] && (
                              <div className="mt-3">
                                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs">
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
          )}
        </div>

        {/* 하단 고정 액션바 */}
        <div className="fixed bottom-0 left-0 right-0 border-t bg-white shadow-sm">
          <div
            className="mx-auto flex max-w-7xl items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:px-8"
            data-testid="actionbar"
          >
            <Button variant="outline" onClick={handleReset}>
              초기화
            </Button>
            <Button
              variant="outline"
              onClick={handleOpenEditor}
              disabled={!generatedPrompt}
              data-testid="actionbar-open-editor"
            >
              에디터로 열기
            </Button>
          </div>
        </div>
      </div>
    </Suspense>
  );
}
