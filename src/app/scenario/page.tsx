'use client';

import React, { useState } from 'react';
import { extractSceneComponents } from '@/lib/ai-client';
import { Button } from '@/components/ui/Button';
import { useProjectStore } from '@/entities/project';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { Loading, Skeleton } from '@/shared/ui/Loading';
import { FormError } from '@/shared/ui/FormError';
import { StepProgress } from '@/shared/ui/Progress';

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
  const [loadingMessage, setLoadingMessage] = useState('');

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
      } else {
        // API 실패 시 기본 템플릿 사용
        setLoadingMessage('AI API 호출에 실패하여 기본 템플릿을 사용합니다...');
        setTimeout(() => {
          generateDefaultStorySteps();
        }, 1000);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
      console.error('AI API 호출 실패:', errorMessage);
      setError('AI 서비스 연결에 실패했습니다. 기본 템플릿을 사용합니다.');
      // 에러 시 기본 템플릿 사용
      setTimeout(() => {
        generateDefaultStorySteps();
      }, 1000);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  // 전개 방식별 로컬 스토리 생성 로직 (LLM 실패 시 폴백)
  const generateDefaultStorySteps = () => {
    const baseStory = storyInput.oneLineStory || '기본 스토리';
    const method = storyInput.developmentMethod;
    
    // API와 동일한 구조 객체 생성
    let structure: any = {};
    
    const defaultActStructure = (title: string, description: string, emotional_arc: string) => ({
      title,
      description,
      emotional_arc,
      key_elements: ['핵심 요소1', '핵심 요소2', '핵심 요소3']
    });

    switch (method) {
      case '훅-몰입-반전-떡밥':
        structure = {
          act1: defaultActStructure(
            '훅 (강한 시작)',
            `${baseStory}의 가장 흥미로운 순간으로 시작. 시청자의 관심을 즉시 끄는 강렬한 오프닝`,
            '평온 → 강한 관심'
          ),
          act2: defaultActStructure(
            '몰입 (빠른 전개)',
            '핵심 갈등과 캐릭터 동기를 신속하게 제시. 빠른 템포로 스토리 몰입도 극대화',
            '관심 → 몰입'
          ),
          act3: defaultActStructure(
            '반전 (예상 밖 전개)',
            '예상과 다른 방향으로 스토리 전개. 충격적 반전으로 시청자에게 새로운 관점 제시',
            '몰입 → 충격'
          ),
          act4: defaultActStructure(
            '떡밥 (후속 기대)',
            '해결되지 않은 미스터리나 다음 에피소드 힌트. 다음 이야기에 대한 기대감 조성',
            '충격 → 기대'
          )
        };
        break;

      case '클래식 기승전결':
        structure = {
          act1: defaultActStructure(
            '기 (시작)',
            `상황 설정과 캐릭터 소개. ${baseStory}`,
            '평온 → 관심'
          ),
          act2: defaultActStructure(
            '승 (전개)',
            '갈등과 문제의 심화. 갈등이 점진적으로 심화되며 긴장감 조성',
            '관심 → 긴장'
          ),
          act3: defaultActStructure(
            '전 (위기)',
            '절정과 최대 위기 상황. 갈등이 절정에 달하고 해결의 실마리 발견',
            '긴장 → 절정'
          ),
          act4: defaultActStructure(
            '결 (해결)',
            '갈등 해결과 마무리. 모든 갈등이 해결되고 만족스러운 마무리',
            '절정 → 만족'
          )
        };
        break;

      case '귀납법':
        structure = {
          act1: defaultActStructure(
            '사례 1',
            `첫 번째 구체적인 사례 제시. ${baseStory}와 관련된 첫 번째 사례`,
            '관심 → 호기심'
          ),
          act2: defaultActStructure(
            '사례 2',
            '두 번째 사례로 패턴 강화. 첫 번째와 유사하지만 다른 각도의 사례',
            '호기심 → 패턴 인식'
          ),
          act3: defaultActStructure(
            '사례 3',
            '세 번째 사례로 결론 준비. 앞의 사례들과 연결되는 마지막 사례',
            '패턴 인식 → 확신'
          ),
          act4: defaultActStructure(
            '결론',
            '사례들을 종합한 일반적 결론. 제시된 사례들로부터 도출되는 결론',
            '확신 → 만족'
          )
        };
        break;

      case '연역법':
        structure = {
          act1: defaultActStructure(
            '결론 제시',
            `먼저 결론이나 주장을 명확히 제시. ${baseStory}에 대한 명확한 결론`,
            '평온 → 관심'
          ),
          act2: defaultActStructure(
            '근거 1',
            '첫 번째 근거와 논리적 설명. 결론을 뒷받침하는 첫 번째 근거',
            '관심 → 설득'
          ),
          act3: defaultActStructure(
            '근거 2',
            '두 번째 근거와 추가 설명. 결론을 더욱 강화하는 두 번째 근거',
            '설득 → 확신'
          ),
          act4: defaultActStructure(
            '재확인',
            '결론 재강조와 마무리. 제시된 근거들을 종합하여 결론 재확인',
            '확신 → 만족'
          )
        };
        break;

      case '다큐(인터뷰식)':
        structure = {
          act1: defaultActStructure(
            '도입부',
            `주제 소개와 인터뷰 대상자 소개. ${baseStory}에 대한 개요와 주요 인물 소개`,
            '평온 → 관심'
          ),
          act2: defaultActStructure(
            '인터뷰 1',
            '첫 번째 핵심 인터뷰. 주요 인물의 경험과 의견을 통한 스토리 전개',
            '관심 → 몰입'
          ),
          act3: defaultActStructure(
            '인터뷰 2',
            '두 번째 관점의 인터뷰. 다른 관점에서의 의견과 경험 제시',
            '몰입 → 이해'
          ),
          act4: defaultActStructure(
            '마무리',
            '내레이션과 결론. 인터뷰 내용을 종합한 내레이션과 결론',
            '이해 → 여운'
          )
        };
        break;

      case '픽사스토리':
        structure = {
          act1: defaultActStructure(
            '옛날 옛적에',
            `평범한 일상의 소개. ${baseStory}의 주인공이 살던 평범한 일상`,
            '평온 → 안정감'
          ),
          act2: defaultActStructure(
            '매일',
            '반복되는 일상의 패턴. 주인공의 일상적인 행동과 습관',
            '안정감 → 친숙함'
          ),
          act3: defaultActStructure(
            '그러던 어느 날',
            '일상을 바꾸는 사건 발생. 평범한 일상을 뒤바꾸는 특별한 사건',
            '친숙함 → 변화'
          ),
          act4: defaultActStructure(
            '때문에',
            '사건의 결과와 변화. 사건으로 인한 변화와 성장',
            '변화 → 성장'
          )
        };
        break;

      default:
        // 기본 기승전결 구조 (모든 다른 케이스에 대해)
        structure = {
          act1: defaultActStructure(
            '기 (시작)',
            `상황 설정과 캐릭터 소개. ${baseStory}`,
            '평온 → 관심'
          ),
          act2: defaultActStructure(
            '승 (전개)',
            '갈등과 문제의 심화. 갈등이 점진적으로 심화되며 긴장감 조성',
            '관심 → 긴장'
          ),
          act3: defaultActStructure(
            '전 (위기)',
            '절정과 최대 위기 상황. 갈등이 절정에 달하고 해결의 실마리 발견',
            '긴장 → 절정'
          ),
          act4: defaultActStructure(
            '결 (해결)',
            '갈등 해결과 마무리. 모든 갈등이 해결되고 만족스러운 마무리',
            '절정 → 만족'
          )
        };
    }

    // structure를 StoryStep 배열로 변환
    const steps = convertStructureToSteps(structure);
    setStorySteps(steps);
    setCurrentStep(2);
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
      let shotId = 1;

      storySteps.forEach((step) => {
        const shotsPerStep = 3; // 각 단계당 3개 숏트
        for (let i = 0; i < shotsPerStep; i++) {
          const beat = components.timelineBeats?.[Math.min(shotId - 1, components.timelineBeats.length - 1)];
          generatedShots.push({
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
          });
          shotId++;
        }
      });

      setShots(generatedShots);
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

  // 콘티 이미지 생성 (Google 이미지 생성 API 시뮬레이션)
  const generateContiImage = async (shotId: string) => {
    // 실제로는 Google 이미지 생성 API 호출
    const mockImage =
      'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAiIGhlaWdodD0iOTAiIHZpZXdCb3g9IjAgMCAxNjAgOTAiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJiZyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMzMzMzMzM7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6I2NjY2NjYztzdG9wLW9wYWNpdHk6MSIgLz4KICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2JnKSIvPgogIDx0ZXh0IHg9IjgwIiB5PSI0NSIgZmlsbD0iYmxhY2siIGZvbnQtc2l6ZT0iMTIiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkRST1dJTkc8L3RleHQ+Cjwvc3ZnPg==';

    setShots((prev) =>
      prev.map((shot) => (shot.id === shotId ? { ...shot, contiImage: mockImage } : shot)),
    );
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

            {/* 에러 메시지 */}
            <FormError>{error}</FormError>
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

        {/* 3단계: 12개 숏트 편집 */}
        {currentStep === 3 && (
          <div className="card p-4 sm:p-6">
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
                      >
                        콘티 생성
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
                            >
                              재생성
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
                              >
                                콘티 생성
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
        )}
      </main>
    </div>
  );
}
