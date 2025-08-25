'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';

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
    developmentIntensity: ''
  });
  
  const [storySteps, setStorySteps] = useState<StoryStep[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 에러 상태 추가
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');

  // 검색 및 필터링 상태

  // 톤앤매너 옵션
  const toneOptions = [
    '드라마틱', '코믹', '로맨틱', '미스터리', '액션', '감성적', '유머러스', '진지한', '판타지', '현실적'
  ];

  // 장르 옵션
  const genreOptions = [
    '액션-스릴러', '로맨틱-코미디', '드라마', '판타지', 'SF', '호러', '다큐멘터리', '애니메이션', '뮤지컬', '웨스턴'
  ];

  // 포맷 옵션
  const formatOptions = [
    '16:9', '9:16', '1:1', '21:9', '4:3'
  ];

  // 템포 옵션
  const tempoOptions = [
    '빠르게', '보통', '느리게'
  ];

  // 전개 방식 옵션
  const developmentOptions = [
    '훅-몰입-반전-떡밥', '클래식 기승전결', '귀납법', '연역법', '다큐(인터뷰식)', '픽사스토리'
  ];

  // 전개 강도 옵션
  const intensityOptions = [
    '그대로', '적당히', '풍부하게'
  ];

  // 1단계: 스토리 입력 처리
  const handleStoryInputChange = (field: keyof StoryInput, value: any) => {
    if (field === 'toneAndManner') {
      setStoryInput(prev => ({
        ...prev,
        toneAndManner: Array.isArray(value) ? value : [value]
      }));
    } else {
      setStoryInput(prev => ({
        ...prev,
        [field]: value
      }));
    }
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
          prompt: storyInput.oneLineStory,
          genre: storyInput.genre,
          tone: storyInput.toneAndManner,
          target: storyInput.target,
          duration: storyInput.duration,
          format: storyInput.format,
          tempo: storyInput.tempo,
          developmentMethod: storyInput.developmentMethod,
          developmentIntensity: storyInput.developmentIntensity
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setStorySteps(data.steps);
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
      console.error('AI API 호출 실패:', error);
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

  // 기본 스토리 템플릿 생성 (API 실패 시 폴백)
  const generateDefaultStorySteps = () => {
    const generatedSteps: StoryStep[] = [
      {
        id: '1',
        title: '기 (시작)',
        summary: '상황 설정과 캐릭터 소개',
        content: storyInput.oneLineStory,
        goal: '시청자의 관심을 끌고 기본 배경을 설정',
        lengthHint: '전체의 20%',
        isEditing: false
      },
      {
        id: '2',
        title: '승 (전개)',
        summary: '갈등과 문제의 심화',
        content: '갈등이 점진적으로 심화되며 긴장감 조성',
        goal: '스토리의 긴장감을 고조시키고 몰입도 증가',
        lengthHint: '전체의 30%',
        isEditing: false
      },
      {
        id: '3',
        title: '전 (위기)',
        summary: '절정과 최대 위기 상황',
        content: '갈등이 절정에 달하고 해결의 실마리 발견',
        goal: '극적인 순간을 연출하고 해결의 동기를 제공',
        lengthHint: '전체의 30%',
        isEditing: false
      },
      {
        id: '4',
        title: '결 (해결)',
        summary: '갈등 해결과 마무리',
        content: '모든 갈등이 해결되고 만족스러운 마무리',
        goal: '스토리를 완성하고 시청자에게 만족감 제공',
        lengthHint: '전체의 20%',
        isEditing: false
      }
    ];
    
    setStorySteps(generatedSteps);
    setCurrentStep(2);
  };

  // 3단계: 12개 숏트 생성
  const generateShots = async () => {
    setLoading(true);
    setError(null);
    setLoadingMessage('숏트를 생성하고 있습니다...');
    
    // 4단계를 12개 숏트로 분해
    setTimeout(() => {
      const generatedShots: Shot[] = [];
      let shotId = 1;
      
      storySteps.forEach((step, stepIndex) => {
        const shotsPerStep = 3; // 각 단계당 3개 숏트
        
        for (let i = 0; i < shotsPerStep; i++) {
          generatedShots.push({
            id: `shot-${shotId}`,
            stepId: step.id,
            title: `${step.title} - 숏트 ${i + 1}`,
            description: `${step.summary}에 대한 구체적인 묘사`,
            shotType: '와이드',
            camera: '정적',
            composition: '중앙 정렬',
            length: storyInput.tempo === '빠르게' ? 4 : storyInput.tempo === '느리게' ? 10 : 6,
            dialogue: '',
            subtitle: '',
            transition: '컷',
            insertShots: []
          });
          shotId++;
        }
      });
      
      setShots(generatedShots);
      setCurrentStep(3);
      setLoading(false);
      setLoadingMessage('');
    }, 2000);
  };

  // 스토리 단계 편집
  const toggleStepEditing = (stepId: string) => {
    setStorySteps(prev => 
      prev.map(step => 
        step.id === stepId ? { ...step, isEditing: !step.isEditing } : step
      )
    );
  };

  const updateStep = (stepId: string, field: keyof StoryStep, value: string) => {
    setStorySteps(prev => 
      prev.map(step => 
        step.id === stepId ? { ...step, [field]: value } : step
      )
    );
  };

  // 콘티 이미지 생성 (Google 이미지 생성 API 시뮬레이션)
  const generateContiImage = async (shotId: string) => {
    // 실제로는 Google 이미지 생성 API 호출
    const mockImage = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAiIGhlaWdodD0iOTAiIHZpZXdCb3g9IjAgMCAxNjAgOTAiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJiZyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMzMzMzMzM7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6I2NjY2NjYztzdG9wLW9wYWNpdHk6MSIgLz4KICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2JnKSIvPgogIDx0ZXh0IHg9IjgwIiB5PSI0NSIgZmlsbD0iYmxhY2siIGZvbnQtc2l6ZT0iMTIiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkRST1dJTkc8L3RleHQ+Cjwvc3ZnPg==';
    
    setShots(prev => 
      prev.map(shot => 
        shot.id === shotId ? { ...shot, contiImage: mockImage } : shot
      )
    );
  };

  // 인서트샷 생성
  const generateInsertShots = async (shotId: string) => {
    const mockInsertShots: InsertShot[] = [
      {
        id: 'insert-1',
        purpose: '정보 보강',
        description: '주요 정보를 강조하는 클로즈업',
        framing: '클로즈업'
      },
      {
        id: 'insert-2',
        purpose: '리듬 조절',
        description: '템포를 조절하는 중간 샷',
        framing: '미디엄 샷'
      },
      {
        id: 'insert-3',
        purpose: '관계 강조',
        description: '캐릭터 간 관계를 보여주는 투샷',
        framing: '투샷'
      }
    ];
    
    setShots(prev => 
      prev.map(shot => 
        shot.id === shotId ? { ...shot, insertShots: mockInsertShots } : shot
      )
    );
  };

  // 숏트 정보 업데이트
  const updateShot = (shotId: string, field: keyof Shot, value: any) => {
    setShots(prev => 
      prev.map(shot => 
        shot.id === shotId ? { ...shot, [field]: value } : shot
      )
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Logo size="lg" />
            <nav className="hidden md:flex items-center space-x-8">
              <a href="/" className="text-gray-700 hover:text-primary-600 font-medium">
                홈
              </a>
              <a href="/planning" className="text-gray-700 hover:text-primary-600 font-medium">
                기획안 관리
              </a>
            </nav>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                저장
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">시나리오 개발</h1>
          <p className="mt-2 text-gray-600">AI가 도와주는 체계적인 시나리오 개발</p>
        </div>

        {/* 진행 단계 표시 */}
        <div className="mb-8">
          <div className="flex items-center space-x-4">
                            <div className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-primary-500' : 'text-gray-500'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= 1 ? 'bg-primary-500 text-white' : 'bg-gray-50 text-gray-500'
                  }`}>
                {currentStep > 1 ? '✓' : '1'}
              </div>
              <span className="font-medium">스토리 입력</span>
              {currentStep > 1 && (
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                  완료
                </span>
              )}
            </div>
            <div className={`w-8 h-1 ${currentStep >= 2 ? 'bg-primary' : 'bg-gray-50'}`}></div>
            <div className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-primary-500' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= 2 ? 'bg-primary-500 text-white' : 'bg-gray-50 text-gray-500'
              }`}>
                {currentStep > 2 ? '✓' : '2'}
              </div>
              <span className="font-medium">4단계 구성</span>
              {currentStep > 2 && (
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                  완료
                </span>
              )}
            </div>
            <div className={`w-8 h-1 ${currentStep >= 3 ? 'bg-primary' : 'bg-gray-50'}`}></div>
            <div className={`flex items-center space-x-2 ${currentStep >= 3 ? 'text-primary-500' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= 3 ? 'bg-primary-500 text-white' : 'bg-gray-50 text-gray-500'
              }`}>
                {currentStep > 3 ? '✓' : '3'}
              </div>
              <span className="font-medium">숏트 분해</span>
              {currentStep === 3 && (
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  진행중
                </span>
              )}
            </div>
          </div>
          
          {/* 전체 진행률 바 */}
          <div className="mt-4">
            <div className="w-full bg-gray-50 rounded-full h-2">
              <div 
                className="bg-primary-500 h-2 rounded-full transition-all duration-500 ease-in-out"
                style={{ width: `${(currentStep - 1) * 50}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* 1단계: 스토리 입력 */}
        {currentStep === 1 && (
          <div className="card p-4 sm:p-6">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">스토리 입력</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 기본 정보 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">제목</label>
                  <input
                    type="text"
                    value={storyInput.title}
                    onChange={(e) => handleStoryInputChange('title', e.target.value)}
                    className="input-primary"
                    placeholder="시나리오 제목을 입력하세요"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">한 줄 스토리</label>
                  <textarea
                    value={storyInput.oneLineStory}
                    onChange={(e) => handleStoryInputChange('oneLineStory', e.target.value)}
                    rows={3}
                    className="input-primary"
                    placeholder="스토리의 핵심을 한 줄로 요약하세요"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">타겟</label>
                  <input
                    type="text"
                    value={storyInput.target}
                    onChange={(e) => handleStoryInputChange('target', e.target.value)}
                    className="input-primary"
                    placeholder="타겟 시청자"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">분량</label>
                  <input
                    type="text"
                    value={storyInput.duration}
                    onChange={(e) => handleStoryInputChange('duration', e.target.value)}
                    className="input-primary"
                    placeholder="예: 30초, 60초, 90초"
                  />
                </div>
              </div>
              
              {/* 스타일 및 전개 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-3">톤앤매너 (다중 선택)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {toneOptions.map((tone) => (
                      <label key={tone} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={storyInput.toneAndManner.includes(tone)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleStoryInputChange('toneAndManner', [...storyInput.toneAndManner, tone]);
                            } else {
                              handleStoryInputChange('toneAndManner', storyInput.toneAndManner.filter(t => t !== tone));
                            }
                          }}
                          className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        />
                        <span className="text-sm text-gray-900">{tone}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">장르</label>
                    <select
                      value={storyInput.genre}
                      onChange={(e) => handleStoryInputChange('genre', e.target.value)}
                      className="input-primary"
                    >
                      <option value="">장르를 선택하세요</option>
                      {genreOptions.map(genre => (
                        <option key={genre} value={genre}>{genre}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">포맷</label>
                    <select
                      value={storyInput.format}
                      onChange={(e) => handleStoryInputChange('format', e.target.value)}
                      className="input-primary"
                    >
                      <option value="">포맷을 선택하세요</option>
                      {formatOptions.map(format => (
                        <option key={format} value={format}>{format}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">템포</label>
                    <div className="space-y-2">
                      {tempoOptions.map((tempo) => (
                        <label key={tempo} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="tempo"
                            value={tempo}
                            checked={storyInput.tempo === tempo}
                            onChange={(e) => handleStoryInputChange('tempo', e.target.value)}
                            className="w-4 h-4 text-primary border-border focus:ring-2 focus:ring-primary focus:ring-offset-2"
                          />
                          <span className="text-sm text-gray-900">{tempo}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">전개 강도</label>
                    <div className="space-y-2">
                      {intensityOptions.map((intensity) => (
                        <label key={intensity} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="intensity"
                            value={intensity}
                            checked={storyInput.developmentIntensity === intensity}
                            onChange={(e) => handleStoryInputChange('developmentIntensity', e.target.value)}
                            className="w-4 h-4 text-primary border-border focus:ring-2 focus:ring-primary focus:ring-offset-2"
                          />
                          <span className="text-sm text-gray-900">{intensity}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">전개 방식</label>
                  <select
                    value={storyInput.developmentMethod}
                    onChange={(e) => handleStoryInputChange('developmentMethod', e.target.value)}
                    className="input-primary"
                  >
                    <option value="">전개 방식을 선택하세요</option>
                    {developmentOptions.map(method => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            {/* 선택된 옵션 미리보기 */}
            {(storyInput.toneAndManner.length > 0 || storyInput.genre || storyInput.tempo || storyInput.developmentMethod || storyInput.developmentIntensity) && (
              <div className="mt-6 p-4 bg-primary-50 border border-primary-200 rounded-lg">
                <h3 className="text-sm font-medium text-primary-800 mb-2">선택된 설정 미리보기</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-primary-700">
                  {storyInput.toneAndManner.length > 0 && (
                    <div><span className="font-medium">톤앤매너:</span> {storyInput.toneAndManner.join(', ')}</div>
                  )}
                  {storyInput.genre && (
                    <div><span className="font-medium">장르:</span> {storyInput.genre}</div>
                  )}
                  {storyInput.tempo && (
                    <div><span className="font-medium">템포:</span> {storyInput.tempo}</div>
                  )}
                  {storyInput.developmentMethod && (
                    <div><span className="font-medium">전개 방식:</span> {storyInput.developmentMethod}</div>
                  )}
                  {storyInput.developmentIntensity && (
                    <div><span className="font-medium">전개 강도:</span> {storyInput.developmentIntensity}</div>
                  )}
                </div>
              </div>
            )}
            
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
              <Button
                onClick={generateStorySteps}
                disabled={loading || !storyInput.title || !storyInput.oneLineStory}
                size="lg"
                className="px-8 w-full sm:w-auto btn-primary"
              >
                {loading ? '생성 중...' : '4단계 스토리 생성'}
              </Button>
            </div>
            
            {/* 로딩 메시지 */}
            {loading && loadingMessage && (
              <div className="mt-4 text-center">
                <div className="inline-flex items-center space-x-2 text-primary">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>{loadingMessage}</span>
                </div>
              </div>
            )}
            
            {/* 에러 메시지 */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* 2단계: 4단계 스토리 검토/수정 */}
        {currentStep === 2 && (
          <div className="card p-4 sm:p-6">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">4단계 스토리 검토/수정</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {storySteps.map((step) => (
                <div key={step.id} className="card-hover p-4">
                  <div className="flex justify-between items-start mb-3">
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
                        <label className="block text-sm font-medium text-gray-900 mb-1">요약</label>
                        <input
                          type="text"
                          value={step.summary}
                          onChange={(e) => updateStep(step.id, 'summary', e.target.value)}
                          className="input-primary text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">본문</label>
                        <textarea
                          value={step.content}
                          onChange={(e) => updateStep(step.id, 'content', e.target.value)}
                          rows={3}
                          className="input-primary text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">목표</label>
                        <input
                          type="text"
                          value={step.goal}
                          onChange={(e) => updateStep(step.id, 'goal', e.target.value)}
                          className="input-primary text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600"><strong>요약:</strong> {step.summary}</p>
                      <p className="text-sm text-gray-600"><strong>본문:</strong> {step.content}</p>
                      <p className="text-sm text-gray-600"><strong>목표:</strong> {step.goal}</p>
                      <p className="text-sm text-gray-500"><strong>길이 힌트:</strong> {step.lengthHint}</p>
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
                className="px-8 btn-primary"
              >
                {loading ? '숏트 생성 중...' : '12개 숏트 생성'}
              </Button>
            </div>
            
            {/* 로딩 메시지 */}
            {loading && loadingMessage && (
              <div className="mt-4 text-center">
                <div className="inline-flex items-center space-x-2 text-primary">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>{loadingMessage}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3단계: 12개 숏트 편집 */}
        {currentStep === 3 && (
          <div className="card p-4 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-text">12개 숏트 편집</h2>
              <Button size="lg" className="px-6 btn-primary">
                기획안 다운로드
              </Button>
            </div>
            
            {/* 숏트 그리드 - 3열×4행 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {shots.map((shot, index) => (
                <div key={shot.id} className="card-hover p-4">
                  {/* 숏트 헤더 */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-text">{shot.title}</h3>
                      <p className="text-sm text-text-light mt-1">{shot.description}</p>
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
                    <div className="bg-gray-50 rounded-lg overflow-hidden border-2 border-dashed border-border min-h-[120px] flex items-center justify-center">
                      {shot.contiImage ? (
                        <div className="relative w-full">
                          <img 
                            src={shot.contiImage} 
                            alt="Conti" 
                            className="w-full h-32 object-cover"
                          />
                          <div className="absolute top-2 right-2 flex space-x-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => generateContiImage(shot.id)}
                              className="text-xs px-2 py-1 bg-white/80 hover:bg-white btn-secondary"
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
                              className="text-xs px-2 py-1 bg-white/80 hover:bg-white btn-secondary"
                            >
                              다운로드
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-text-lighter py-8">
                          <div className="text-2xl mb-2">🎨</div>
                          <p className="text-sm">콘티 이미지를 생성하세요</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 숏 정보 편집 필드 */}
                  <div className="space-y-3 mb-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-text mb-1">샷 타입</label>
                        <select
                          value={shot.shotType}
                          onChange={(e) => updateShot(shot.id, 'shotType', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                        >
                          <option value="와이드">와이드</option>
                          <option value="미디엄">미디엄</option>
                          <option value="클로즈업">클로즈업</option>
                          <option value="익스트림 클로즈업">익스트림 클로즈업</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text mb-1">카메라</label>
                        <select
                          value={shot.camera}
                          onChange={(e) => updateShot(shot.id, 'camera', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
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
                      <label className="block text-xs font-medium text-text mb-1">구도</label>
                      <select
                        value={shot.composition}
                        onChange={(e) => updateShot(shot.id, 'composition', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      >
                        <option value="중앙 정렬">중앙 정렬</option>
                        <option value="3분법">3분법</option>
                        <option value="대각선">대각선</option>
                        <option value="프레임 안 프레임">프레임 안 프레임</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-text mb-1">길이 (초)</label>
                      <input
                        type="number"
                        value={shot.length}
                        onChange={(e) => updateShot(shot.id, 'length', Number(e.target.value))}
                        min="1"
                        max="15"
                        className="w-full px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-text mb-1">대사</label>
                      <textarea
                        value={shot.dialogue}
                        onChange={(e) => updateShot(shot.id, 'dialogue', e.target.value)}
                        rows={2}
                        className="w-full px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                        placeholder="대사를 입력하세요..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-text mb-1">자막</label>
                      <input
                        type="text"
                        value={shot.subtitle}
                        onChange={(e) => updateShot(shot.id, 'subtitle', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                        placeholder="자막을 입력하세요..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-text mb-1">전환</label>
                      <select
                        value={shot.transition}
                        onChange={(e) => updateShot(shot.id, 'transition', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
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
                      <h4 className="font-medium text-sm mb-2 text-text">인서트샷 추천</h4>
                      <div className="space-y-2">
                        {shot.insertShots.map((insert) => (
                                                     <div key={insert.id} className="bg-gray-50 p-2 rounded text-xs">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-text"><strong>{insert.purpose}:</strong> {insert.description}</p>
                                <p className="text-text-light mt-1"><strong>프레이밍:</strong> {insert.framing}</p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generateContiImage(shot.id)}
                                className="text-xs px-2 py-1 btn-secondary"
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
              <Button
                size="lg"
                className="px-8 btn-primary"
              >
                기획안 다운로드
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
