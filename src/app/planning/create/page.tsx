'use client';

import React, { useState, useCallback } from 'react';
import { Icon } from '@/shared/ui';

interface PlanningData {
  title: string;
  logline: string;
  tone: string;
  genre: string;
  target: string;
  duration: string;
  format: string;
  tempo: string;
  developmentMethod: string;
  developmentIntensity: string;
}

const PLANNING_STEPS = [
  { id: 1, name: '입력/선택', description: '기본 정보 입력 및 선택' },
  { id: 2, name: '전개 방식', description: '스토리 전개 방식 설정' },
  { id: 3, name: '기획 완성', description: '최종 기획안 확인 및 저장' },
];

const TONE_OPTIONS = [
  { value: 'calm', label: '잔잔한', description: '차분하고 평화로운' },
  { value: 'lively', label: '발랄한', description: '활기차고 재미있는' },
  { value: 'thrilling', label: '소름', description: '긴장감과 스릴' },
  { value: 'cute', label: '귀여운', description: '사랑스럽고 아담한' },
  { value: 'chic', label: '시크한', description: '세련되고 멋진' },
  { value: 'dramatic', label: '드라마틱한', description: '감정적이고 몰입감 있는' },
];

const GENRE_OPTIONS = [
  { value: 'drama', label: '드라마', description: '감정적 스토리텔링' },
  { value: 'horror', label: '공포', description: '무서움과 긴장감' },
  { value: 'sf', label: 'SF', description: '미래적 상상력' },
  { value: 'action', label: '액션', description: '역동적 움직임' },
  { value: 'advertisement', label: '광고', description: '상품/서비스 홍보' },
  { value: 'documentary', label: '다큐', description: '현실적 기록' },
  { value: 'comedy', label: '코미디', description: '유머와 재미' },
  { value: 'romance', label: '로맨스', description: '사랑과 감정' },
];

const DURATION_OPTIONS = [
  { value: '15', label: '15초', description: '짧은 인상' },
  { value: '30', label: '30초', description: '표준 길이' },
  { value: '60', label: '60초', description: '상세 설명' },
  { value: '90', label: '90초', description: '풍부한 내용' },
  { value: '120', label: '2분', description: '긴 형식' },
];

const FORMAT_OPTIONS = [
  { value: 'interview', label: '인터뷰', description: '대화 중심' },
  { value: 'storytelling', label: '스토리텔링', description: '이야기 중심' },
  { value: 'animation', label: '애니메이션', description: '그래픽 중심' },
  { value: 'motion-graphics', label: '모션그래픽', description: '움직이는 그래픽' },
  { value: 'live-action', label: '실사', description: '실제 촬영' },
  { value: 'mixed', label: '혼합', description: '여러 형식 조합' },
];

const TEMPO_OPTIONS = [
  { value: 'fast', label: '빠르게', description: '역동적이고 긴장감 있는' },
  { value: 'normal', label: '보통', description: '균형잡힌 속도' },
  { value: 'slow', label: '느리게', description: '차분하고 여유로운' },
];

const DEVELOPMENT_METHODS = [
  {
    value: 'hook-immersion-reversal',
    label: '훅–몰입–반전–떡밥',
    description: '강한 시작, 몰입, 반전, 다음 편 유도',
  },
  { value: 'traditional', label: '기승전결', description: '전통적인 4단계 구조' },
  { value: 'inductive', label: '귀납', description: '구체적 사례에서 일반적 결론' },
  { value: 'deductive', label: '연역', description: '일반적 원리에서 구체적 적용' },
  {
    value: 'documentary-interview',
    label: '다큐(인터뷰식)',
    description: '인터뷰 중심의 다큐멘터리',
  },
  { value: 'pixar', label: '픽사', description: '감정적 여정과 성장' },
];

const DEVELOPMENT_INTENSITIES = [
  { value: 'minimal', label: '그대로', description: '기본 구조 유지' },
  { value: 'moderate', label: '적당히', description: '적절한 확장' },
  { value: 'rich', label: '풍부하게', description: '풍부한 내용과 세부사항' },
];

const PRESET_OPTIONS = [
  {
    name: '브랜드 30초',
    description: '빠른 훅몰반',
    data: {
      duration: '30',
      tempo: 'fast',
      developmentMethod: 'hook-immersion-reversal',
      developmentIntensity: 'moderate',
      format: 'motion-graphics',
      genre: 'advertisement',
    },
  },
  {
    name: '다큐 90초',
    description: '보통 인터뷰식',
    data: {
      duration: '90',
      tempo: 'normal',
      developmentMethod: 'documentary-interview',
      developmentIntensity: 'rich',
      format: 'interview',
      genre: 'documentary',
    },
  },
  {
    name: '드라마 60초',
    description: '풍부한 기승전결',
    data: {
      duration: '60',
      tempo: 'normal',
      developmentMethod: 'traditional',
      developmentIntensity: 'rich',
      format: 'storytelling',
      genre: 'drama',
    },
  },
  {
    name: '액션 45초',
    description: '빠른 역동적',
    data: {
      duration: '60',
      tempo: 'fast',
      developmentMethod: 'hook-immersion-reversal',
      developmentIntensity: 'moderate',
      format: 'live-action',
      genre: 'action',
    },
  },
];

export default function PlanningCreatePage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [planningData, setPlanningData] = useState<PlanningData>({
    title: '',
    logline: '',
    tone: '',
    genre: '',
    target: '',
    duration: '30',
    format: 'storytelling',
    tempo: 'normal',
    developmentMethod: 'traditional',
    developmentIntensity: 'moderate',
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);

  const goToNextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, PLANNING_STEPS.length));
  }, []);

  const goToPreviousStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const applyPreset = useCallback((preset: any) => {
    setPlanningData((prev) => ({
      ...prev,
      ...preset.data,
    }));
  }, []);

  const handleGeneratePlan = useCallback(async () => {
    if (!planningData.title || !planningData.logline || !planningData.genre) return;

    setIsGenerating(true);
    try {
      // AI 기획안 생성 API 호출
      const response = await fetch('/api/ai/generate-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planningData),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedPlan(data);
        goToNextStep();
      }
    } catch (error) {
      console.error('기획안 생성 실패:', error);
      // 기본 기획안으로 진행
      setGeneratedPlan({
        summary: '기본 기획안',
        structure: ['도입', '전개', '위기', '해결'],
        visualStyle: 'Cinematic',
        targetAudience: planningData.target,
        estimatedCost: '중간',
        timeline: '2-3주',
      });
      goToNextStep();
    } finally {
      setIsGenerating(false);
    }
  }, [planningData, goToNextStep]);

  const getProgress = useCallback(() => {
    switch (currentStep) {
      case 1:
        return planningData.title && planningData.logline && planningData.genre ? 100 : 0;
      case 2:
        return planningData.developmentMethod && planningData.developmentIntensity ? 100 : 0;
      case 3:
        return generatedPlan ? 100 : 0;
      default:
        return 0;
    }
  }, [currentStep, planningData, generatedPlan]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="border-b border-slate-200/50 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">영상 기획</h1>
              <p className="mt-2 text-slate-600">체계적인 영상 기획을 위한 3단계 위저드</p>
            </div>
            <button
              onClick={() => (window.location.href = '/planning')}
              className="px-4 py-2 text-slate-600 transition-colors hover:text-slate-900"
            >
              <Icon name="projects" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Planning Steps */}
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            {PLANNING_STEPS.map((step, index) => (
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
                {index < PLANNING_STEPS.length - 1 && (
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
            {PLANNING_STEPS.map((step) => (
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
          {/* Step 1: 입력/선택 */}
          {currentStep === 1 && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="mb-4 text-2xl font-bold text-slate-900">기본 정보 입력 및 선택</h2>
                <p className="text-slate-600">
                  영상의 기본 정보를 입력하고 주요 설정을 선택해주세요
                </p>
              </div>

              <div className="mx-auto max-w-4xl space-y-6">
                {/* 제목과 로그라인 */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">제목 *</label>
                    <input
                      type="text"
                      value={planningData.title}
                      onChange={(e) =>
                        setPlanningData((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      placeholder="영상 제목을 입력하세요"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      타겟 오디언스
                    </label>
                    <input
                      type="text"
                      value={planningData.target}
                      onChange={(e) =>
                        setPlanningData((prev) => ({
                          ...prev,
                          target: e.target.value,
                        }))
                      }
                      placeholder="예: 20-30대 젊은 층"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    한 줄 스토리 (로그라인) *
                  </label>
                  <textarea
                    value={planningData.logline}
                    onChange={(e) =>
                      setPlanningData((prev) => ({
                        ...prev,
                        logline: e.target.value,
                      }))
                    }
                    placeholder="영상의 핵심 내용을 한 문장으로 설명하세요"
                    rows={3}
                    className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 기본 설정 드롭다운들 */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      톤앤매너 *
                    </label>
                    <select
                      value={planningData.tone}
                      onChange={(e) =>
                        setPlanningData((prev) => ({
                          ...prev,
                          tone: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">톤앤매너 선택</option>
                      {TONE_OPTIONS.map((tone) => (
                        <option key={tone.value} value={tone.value}>
                          {tone.label} - {tone.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">장르 *</label>
                    <select
                      value={planningData.genre}
                      onChange={(e) =>
                        setPlanningData((prev) => ({
                          ...prev,
                          genre: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">장르 선택</option>
                      {GENRE_OPTIONS.map((genre) => (
                        <option key={genre.value} value={genre.value}>
                          {genre.label} - {genre.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">분량</label>
                    <select
                      value={planningData.duration}
                      onChange={(e) =>
                        setPlanningData((prev) => ({
                          ...prev,
                          duration: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      {DURATION_OPTIONS.map((duration) => (
                        <option key={duration.value} value={duration.value}>
                          {duration.label} - {duration.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">포맷</label>
                    <select
                      value={planningData.format}
                      onChange={(e) =>
                        setPlanningData((prev) => ({
                          ...prev,
                          format: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      {FORMAT_OPTIONS.map((format) => (
                        <option key={format.value} value={format.value}>
                          {format.label} - {format.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">템포</label>
                    <select
                      value={planningData.tempo}
                      onChange={(e) =>
                        setPlanningData((prev) => ({
                          ...prev,
                          tempo: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      {TEMPO_OPTIONS.map((tempo) => (
                        <option key={tempo.value} value={tempo.value}>
                          {tempo.label} - {tempo.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 프리셋 버튼들 */}
                <div className="mt-8">
                  <h3 className="mb-4 text-lg font-semibold text-slate-800">🚀 빠른 프리셋</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {PRESET_OPTIONS.map((preset, index) => (
                      <button
                        key={index}
                        onClick={() => applyPreset(preset)}
                        className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 text-left transition-all duration-200 hover:border-blue-300 hover:from-blue-100 hover:to-indigo-100"
                      >
                        <h4 className="mb-1 font-semibold text-blue-800">{preset.name}</h4>
                        <p className="text-sm text-blue-600">{preset.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={goToNextStep}
                  disabled={!planningData.title || !planningData.logline || !planningData.genre}
                  className="rounded-lg bg-blue-600 px-8 py-3 text-lg text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  다음 단계: 전개 방식
                </button>
              </div>
            </div>
          )}

          {/* Step 2: 전개 방식 */}
          {currentStep === 2 && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="mb-4 text-2xl font-bold text-slate-900">스토리 전개 방식 설정</h2>
                <p className="text-slate-600">영상의 구조와 전개 방식을 선택해주세요</p>
              </div>

              <div className="mx-auto max-w-4xl space-y-8">
                {/* 전개 방식 선택 */}
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-slate-800">📖 전개 방식 *</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {DEVELOPMENT_METHODS.map((method) => (
                      <button
                        key={method.value}
                        onClick={() =>
                          setPlanningData((prev) => ({
                            ...prev,
                            developmentMethod: method.value,
                          }))
                        }
                        className={`rounded-xl border-2 p-4 text-left transition-all ${
                          planningData.developmentMethod === method.value
                            ? 'border-blue-500 bg-blue-50 shadow-lg'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                        }`}
                      >
                        <h4 className="mb-2 font-semibold text-slate-900">{method.label}</h4>
                        <p className="text-sm text-slate-600">{method.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 전개 강도 선택 */}
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-slate-800">⚡ 전개 강도 *</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {DEVELOPMENT_INTENSITIES.map((intensity) => (
                      <button
                        key={intensity.value}
                        onClick={() =>
                          setPlanningData((prev) => ({
                            ...prev,
                            developmentIntensity: intensity.value,
                          }))
                        }
                        className={`rounded-xl border-2 p-4 text-center transition-all ${
                          planningData.developmentIntensity === intensity.value
                            ? 'border-blue-500 bg-blue-50 shadow-lg'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                        }`}
                      >
                        <h4 className="mb-2 font-semibold text-slate-900">{intensity.label}</h4>
                        <p className="text-sm text-slate-600">{intensity.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 선택된 설정 요약 */}
                <div className="rounded-xl bg-slate-50 p-6">
                  <h4 className="mb-4 font-semibold text-slate-800">📋 선택된 설정 요약</h4>
                  <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                    <div className="space-y-2">
                      <div>
                        <strong>제목:</strong> {planningData.title}
                      </div>
                      <div>
                        <strong>장르:</strong>{' '}
                        {GENRE_OPTIONS.find((g) => g.value === planningData.genre)?.label}
                      </div>
                      <div>
                        <strong>톤앤매너:</strong>{' '}
                        {TONE_OPTIONS.find((t) => t.value === planningData.tone)?.label}
                      </div>
                      <div>
                        <strong>분량:</strong> {planningData.duration}초
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <strong>포맷:</strong>{' '}
                        {FORMAT_OPTIONS.find((f) => f.value === planningData.format)?.label}
                      </div>
                      <div>
                        <strong>템포:</strong>{' '}
                        {TEMPO_OPTIONS.find((t) => t.value === planningData.tempo)?.label}
                      </div>
                      <div>
                        <strong>전개 방식:</strong>{' '}
                        {
                          DEVELOPMENT_METHODS.find(
                            (d) => d.value === planningData.developmentMethod,
                          )?.label
                        }
                      </div>
                      <div>
                        <strong>전개 강도:</strong>{' '}
                        {
                          DEVELOPMENT_INTENSITIES.find(
                            (d) => d.value === planningData.developmentIntensity,
                          )?.label
                        }
                      </div>
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
                  onClick={handleGeneratePlan}
                  disabled={
                    !planningData.developmentMethod ||
                    !planningData.developmentIntensity ||
                    isGenerating
                  }
                  className="rounded-lg bg-blue-600 px-8 py-3 text-lg text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isGenerating ? (
                    <div className="flex items-center space-x-3">
                      <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-white"></div>
                      <span>기획안 생성 중...</span>
                    </div>
                  ) : (
                    '다음 단계: 기획 완성'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: 기획 완성 */}
          {currentStep === 3 && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="mb-4 text-2xl font-bold text-slate-900">기획안 완성 및 확인</h2>
                <p className="text-slate-600">AI가 생성한 기획안을 확인하고 저장하세요</p>
              </div>

              <div className="mx-auto max-w-4xl space-y-6">
                {/* 생성된 기획안 */}
                {generatedPlan && (
                  <div className="rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-blue-50 p-6">
                    <h3 className="mb-4 text-lg font-bold text-green-800">🎯 AI가 생성한 기획안</h3>

                    <div className="mb-4 rounded-lg bg-white p-4">
                      <h4 className="mb-2 font-semibold text-slate-800">기획 요약</h4>
                      <p className="text-slate-700">{generatedPlan.summary}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <h4 className="mb-3 font-semibold text-slate-800">📋 스토리 구조</h4>
                        <div className="space-y-2">
                          {generatedPlan.structure?.map((step: string, index: number) => (
                            <div key={index} className="flex items-center space-x-3">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                                {index + 1}
                              </span>
                              <span className="text-slate-700">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-3 font-semibold text-slate-800">🎨 시각적 스타일</h4>
                        <div className="space-y-2 text-sm text-slate-700">
                          <div>
                            <strong>스타일:</strong> {generatedPlan.visualStyle}
                          </div>
                          <div>
                            <strong>타겟:</strong> {generatedPlan.targetAudience}
                          </div>
                          <div>
                            <strong>예상 비용:</strong> {generatedPlan.estimatedCost}
                          </div>
                          <div>
                            <strong>제작 기간:</strong> {generatedPlan.timeline}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 최종 설정 요약 */}
                <div className="rounded-xl bg-slate-50 p-6">
                  <h4 className="mb-4 font-semibold text-slate-800">📊 최종 기획 설정</h4>
                  <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-2">
                    <div className="space-y-2">
                      <div>
                        <strong>제목:</strong> {planningData.title}
                      </div>
                      <div>
                        <strong>로그라인:</strong> {planningData.logline}
                      </div>
                      <div>
                        <strong>장르:</strong>{' '}
                        {GENRE_OPTIONS.find((g) => g.value === planningData.genre)?.label}
                      </div>
                      <div>
                        <strong>톤앤매너:</strong>{' '}
                        {TONE_OPTIONS.find((t) => t.value === planningData.tone)?.label}
                      </div>
                      <div>
                        <strong>분량:</strong> {planningData.duration}초
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <strong>포맷:</strong>{' '}
                        {FORMAT_OPTIONS.find((f) => f.value === planningData.format)?.label}
                      </div>
                      <div>
                        <strong>템포:</strong>{' '}
                        {TEMPO_OPTIONS.find((t) => t.value === planningData.tempo)?.label}
                      </div>
                      <div>
                        <strong>전개 방식:</strong>{' '}
                        {
                          DEVELOPMENT_METHODS.find(
                            (d) => d.value === planningData.developmentMethod,
                          )?.label
                        }
                      </div>
                      <div>
                        <strong>전개 강도:</strong>{' '}
                        {
                          DEVELOPMENT_INTENSITIES.find(
                            (d) => d.value === planningData.developmentIntensity,
                          )?.label
                        }
                      </div>
                      <div>
                        <strong>타겟:</strong> {planningData.target}
                      </div>
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
                  onClick={() => (window.location.href = '/planning')}
                  className="rounded-lg bg-green-600 px-8 py-3 text-lg text-white transition-colors hover:bg-green-700"
                >
                  기획안 저장 및 완료
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
