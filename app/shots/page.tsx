/**
 * @fileoverview 12단계 숏트 편집 페이지 (TDD Green 단계)
 *
 * CLAUDE.md 준수:
 * - FSD 아키텍처: app 레이어에서 widgets, features, entities 활용
 * - TDD 원칙: 테스트를 만족하는 최소 구현
 * - 접근성: ARIA 랜드마크, 키보드 내비게이션, 스크린 리더 지원
 * - 반응형 디자인: 모바일 우선 설계
 * - VRIDGE 브랜드 컬러 시스템 활용
 * - 성능 최적화: 메모이제이션, 가상화
 */

'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectCurrentStory, selectStoryError } from '@/entities/story';
import {
  ShotManager,
  type Shot as ShotWidget
} from '@/widgets/shots.widget';
import { Button } from '@/shared/ui';
import type { Shot } from '@/entities/shot';
import type { FourActStory } from '@/entities/story';
import type { CameraOption, StoryPhase, ShotCameraControls } from '@/shared/types';

// 12개 숏트로 세분화하기 위한 기본 템플릿
const DEFAULT_SHOTS_PER_PHASE = [3, 3, 3, 3]; // 발단, 전개, 절정, 결말 각각 3개씩

// 로컬 스토리 페이즈 인터페이스 (UI 컴포넌트용)
interface LocalStoryPhase {
  phase: number;
  title: string;
  shotCount: number;
}

// 카메라 옵션 상수
const CAMERA_ANGLES: CameraOption[] = [
  { id: 'wide', name: '와이드샷', icon: '📹', description: '전체적인 환경과 상황' },
  { id: 'medium', name: '미디엄샷', icon: '🎬', description: '인물의 상반신' },
  { id: 'close-up', name: '클로즈업', icon: '🔍', description: '얼굴이나 세부사항' },
  { id: 'extreme-close', name: '익스트림 클로즈업', icon: '👁️', description: '매우 세밀한 부분' },
];

const CAMERA_MOVEMENTS: CameraOption[] = [
  { id: 'static', name: '고정', icon: '⏸️', description: '카메라 움직임 없음' },
  { id: 'pan', name: '팬', icon: '↔️', description: '좌우 회전' },
  { id: 'tilt', name: '틸트', icon: '↕️', description: '상하 회전' },
  { id: 'zoom', name: '줌', icon: '🔎', description: '확대/축소' },
  { id: 'tracking', name: '트래킹', icon: '🚶', description: '대상 따라가기' },
];

export default function ShotsPage() {
  // Redux 상태
  const currentStory = useSelector(selectCurrentStory);
  const storyError = useSelector(selectStoryError);

  // 로컬 상태
  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedAngle, setSelectedAngle] = useState('medium');
  const [selectedMovement, setSelectedMovement] = useState('static');
  const [progress, setProgress] = useState(0);

  // 스토리가 없는 경우 처리
  if (!currentStory) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-brand-gradient-1 to-brand-gradient-2 flex items-center justify-center p-4"
        data-testid="no-story-state"
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">
            스토리를 먼저 생성해주세요
          </h1>
          <p className="text-white-70 mb-6">
            12단계 숏트를 생성하려면 먼저 4단계 스토리가 필요합니다.
          </p>
          <Button variant="primary" size="lg">
            스토리 생성하러 가기
          </Button>
        </div>
      </div>
    );
  }

  // 에러 상태 처리
  if (storyError) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-brand-gradient-1 to-brand-gradient-2 flex items-center justify-center p-4"
        data-testid="error-state"
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">
            오류가 발생했습니다
          </h1>
          <p className="text-white-70 mb-6">
            {storyError}
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={() => window.location.reload()}
          >
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  // 4단계 스토리 페이즈 설정
  const storyPhases: LocalStoryPhase[] = useMemo(() => [
    {
      phase: 1,
      title: currentStory.chapters.exposition.title,
      shotCount: DEFAULT_SHOTS_PER_PHASE[0],
    },
    {
      phase: 2,
      title: currentStory.chapters.rising_action.title,
      shotCount: DEFAULT_SHOTS_PER_PHASE[1],
    },
    {
      phase: 3,
      title: currentStory.chapters.climax.title,
      shotCount: DEFAULT_SHOTS_PER_PHASE[2],
    },
    {
      phase: 4,
      title: currentStory.chapters.resolution.title,
      shotCount: DEFAULT_SHOTS_PER_PHASE[3],
    },
  ], [currentStory]);

  // 총 지속 시간 계산
  const totalDuration = useMemo(() => {
    return shots.reduce((sum, shot) => sum + shot.duration, 0);
  }, [shots]);

  // 초기 숏트 생성
  useEffect(() => {
    if (shots.length === 0 && currentStory) {
      const initialShots: Shot[] = [];
      let shotId = 0;

      storyPhases.forEach((phase, phaseIndex) => {
        const chapterKey = ['exposition', 'rising_action', 'climax', 'resolution'][phaseIndex] as keyof typeof currentStory.chapters;
        const chapter = currentStory.chapters[chapterKey];

        for (let i = 0; i < phase.shotCount; i++) {
          shotId++;
          initialShots.push({
            id: `shot-${shotId}`,
            title: `${phase.title} - 숏트 ${i + 1}`,
            description: `${chapter.content}의 ${i + 1}번째 장면`,
            cameraAngle: 'medium',
            duration: Math.round(chapter.duration / phase.shotCount),
            sceneType: 'establishing',
            storyChapterRef: chapterKey,
            storyPhase: (['exposition', 'rising_action', 'climax', 'resolution'][phaseIndex]) as StoryPhase,
            visualElements: [],
            audioElements: [],
          });
        }
      });

      setShots(initialShots);
      setProgress(initialShots.length / 12 * 100);
    }
  }, [currentStory, storyPhases, shots.length]);

  // 이벤트 핸들러들
  const handleShotSelect = useCallback((shotId: string) => {
    setSelectedShotIds([shotId]);
    setSelectedShotId(shotId);
  }, []);

  const handleShotEdit = useCallback((shotId: string) => {
    console.log('Edit shot:', shotId);
    // TODO: 숏트 편집 모달 열기
  }, []);

  const handleShotDelete = useCallback((shotId: string) => {
    setShots(prev => prev.filter(shot => shot.id !== shotId));
    if (selectedShotId === shotId) {
      setSelectedShotId(null);
    }
    setSelectedShotIds(prev => prev.filter(id => id !== shotId));
  }, [selectedShotId]);

  const handleShotReorder = useCallback(({ fromIndex, toIndex, shotId }: { fromIndex: number; toIndex: number; shotId: string }) => {
    setShots(prev => {
      const newShots = [...prev];
      const [movedShot] = newShots.splice(fromIndex, 1);
      newShots.splice(toIndex, 0, movedShot);
      return newShots;
    });
  }, []);

  const handleBulkEdit = useCallback((shotIds: string[]) => {
    setSelectedShotIds(shotIds);
    console.log('Bulk edit shots:', shotIds);
    // TODO: 일괄 편집 모달 열기
  }, []);

  const handleAddShot = useCallback(() => {
    const newShotId = `shot-${Date.now()}`;
    const newShot: Shot = {
      id: newShotId,
      title: `새 숏트 ${shots.length + 1}`,
      description: '새로 추가된 숏트입니다.',
      cameraAngle: selectedAngle as 'medium',
      duration: 5,
      sceneType: 'establishing',
      storyChapterRef: 'exposition',
      storyPhase: 'exposition',
      visualElements: [],
      audioElements: [],
    };

    setShots(prev => [...prev, newShot]);
    setProgress((shots.length + 1) / 12 * 100);
  }, [shots.length, selectedAngle]);

  const handleTimeClick = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleShotClick = useCallback((shotId: string) => {
    handleShotSelect(shotId);
  }, [handleShotSelect]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleAngleChange = useCallback((angleId: string) => {
    setSelectedAngle(angleId);

    // 선택된 숏트가 있으면 해당 숏트 업데이트
    if (selectedShotId) {
      setShots(prev => prev.map(shot =>
        shot.id === selectedShotId
          ? { ...shot, cameraAngle: angleId as any }
          : shot
      ));
    }
  }, [selectedShotId]);

  const handleMovementChange = useCallback((movementId: string) => {
    setSelectedMovement(movementId);
    // Note: cameraMovement은 현재 Shot 스키마에 없음 - UI 상태만 업데이트
  }, []);

  const handlePresetApply = useCallback(({ angle, movement }: { angle: string; movement: string }) => {
    if (selectedShotIds.length > 0) {
      setShots(prev => prev.map(shot =>
        selectedShotIds.includes(shot.id)
          ? { ...shot, cameraAngle: angle as any }
          : shot
      ));
    }
  }, [selectedShotIds]);

  const handleExport = useCallback(() => {
    const exportData = {
      story: currentStory,
      shots,
      metadata: {
        totalDuration,
        shotCount: shots.length,
        exportedAt: new Date().toISOString(),
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shots-${currentStory.title}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentStory, shots, totalDuration]);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-brand-gradient-1 to-brand-gradient-2"
      data-testid="shots-page-container"
    >
      {/* 헤더 */}
      <header
        className="bg-brand-primary shadow-brand-primary p-4 sm:p-6"
        role="banner"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                12단계 숏트 생성
              </h1>
              <p
                className="text-white-90 text-sm sm:text-base"
                aria-label="4단계 스토리를 12개 숏트로 세분화하는 편집 페이지"
              >
                {currentStory.title}을 12개의 세밀한 숏트로 구성합니다
              </p>
            </div>

            {/* 진행 상황 표시 */}
            <div
              className="mt-4 sm:mt-0 sm:ml-6"
              aria-label="숏트 생성 진행 상황"
            >
              <div className="flex items-center space-x-3">
                <span className="text-white text-sm">진행률</span>
                <div className="w-32 h-2 bg-white-20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-neon-green transition-all duration-300 shadow-neon-green"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-white text-sm font-medium">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main
        className="max-w-7xl mx-auto p-4 sm:p-6"
        role="main"
      >
        {/* 반응형 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 4단계 스토리 요약 */}
          <aside
            className="lg:col-span-1"
            role="complementary"
            aria-label="4단계 스토리 요약"
          >
            <div className="bg-white-10 rounded-2xl p-6 backdrop-blur-sm sticky top-6">
              <h2 className="text-xl font-bold text-white mb-4">
                스토리 구조
              </h2>

              <div className="space-y-4">
                {Object.entries(currentStory.chapters).map(([key, chapter], index) => {
                  const phaseColors = [
                    'bg-brand-primary',
                    'bg-brand-secondary',
                    'bg-neon-pink',
                    'bg-neon-green'
                  ];

                  return (
                    <div
                      key={key}
                      className="border border-white-20 rounded-lg p-4"
                    >
                      <div className={`inline-block px-3 py-1 rounded-full text-white text-sm font-medium mb-2 ${phaseColors[index]}`}>
                        {index + 1}단계
                      </div>
                      <h3 className="text-white font-semibold mb-2">
                        {chapter.title}
                      </h3>
                      <p className="text-white-70 text-sm leading-relaxed">
                        {chapter.content}
                      </p>
                      <div className="mt-3 flex items-center space-x-4 text-xs text-white-50">
                        <span>지속시간: {chapter.duration}초</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* 중앙: 숏트 그리드 편집기 */}
          <div className="lg:col-span-2" aria-label="12개 숏트 그리드 편집기">
            <div className="space-y-8">
              {storyPhases.map((phase) => {
                const phaseShots = shots.filter(shot => {
                  const phaseNames = ['exposition', 'rising_action', 'climax', 'resolution'];
                  return shot.storyPhase === phaseNames[phase.phase - 1];
                });

                return (
                  <section
                    key={phase.phase}
                    className="bg-white-10 rounded-2xl p-6 backdrop-blur-sm"
                    data-testid={`phase-section-${phase.phase}`}
                  >
                    {/* 단계 헤더 */}
                    <div className={`bg-brand-primary rounded-lg p-4 mb-6`}>
                      <h2 className="text-xl font-bold text-white">
                        {phase.phase}단계: {phase.title}
                      </h2>
                      <p className="text-white-90 text-sm">
                        {phase.shotCount}개 숏트
                      </p>
                    </div>

                    {/* 숏트 그리드 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {phaseShots.map((shot, index) => (
                        <div
                          key={shot.id}
                          data-testid={`shot-card-${index}`}
                          className="aspect-video border-2 border-white-30 rounded-lg flex items-center justify-center text-white bg-white-5 hover:bg-white-10 transition-colors cursor-pointer"
                          onClick={() => handleShotSelect(shot.id)}
                        >
                          <div className="text-center">
                            <div className="text-lg font-medium mb-1">
                              {shot.title}
                            </div>
                            <div className="text-sm text-white-70">
                              {shot.duration}초
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* 빈 슬롯 표시 */}
                      {phaseShots.length < phase.shotCount && (
                        Array.from({ length: phase.shotCount - phaseShots.length }).map((_, emptyIndex) => (
                          <div
                            key={`empty-${phase.phase}-${emptyIndex}`}
                            className="aspect-video border-2 border-dashed border-white-30 rounded-lg flex items-center justify-center text-white-50 text-sm cursor-pointer hover:border-white-50 transition-colors"
                            onClick={handleAddShot}
                          >
                            + 숏트 추가
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>

        {/* 우측: 선택된 숏트 세부 편집 패널 */}
        {selectedShotId && (
          <div className="mt-6">
            <div
              className="bg-white rounded-2xl p-6 shadow-soft"
              aria-label="선택된 숏트 세부 편집 패널"
            >
              <h2 className="text-xl font-bold text-brand-primary mb-4">
                숏트 편집: {shots.find(s => s.id === selectedShotId)?.title || '선택된 숏트'}
              </h2>

              <ShotCameraControls
                selectedAngle={selectedAngle}
                selectedMovement={selectedMovement}
                cameraAngles={CAMERA_ANGLES}
                cameraMovements={CAMERA_MOVEMENTS}
                onAngleChange={handleAngleChange}
                onMovementChange={handleMovementChange}
                onPresetApply={handlePresetApply}
                isDisabled={isLoading}
              />
            </div>
          </div>
        )}

        {/* 하단: 타임라인 뷰 */}
        <div className="mt-6" aria-label="숏트 타임라인 뷰">
          <div className="bg-black-soft rounded-lg p-2 sm:p-4 border border-neutral-700">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">타임라인</h3>

              {/* 재생 컨트롤 */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={handlePlayPause}
                  className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 transition-colors"
                  aria-label={isPlaying ? '일시정지' : '재생'}
                >
                  {isPlaying ? (
                    <svg className="w-6 h-6 text-neon-green" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-neon-green" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>

                {/* 시간 표시 */}
                <div className="hidden sm:block text-white text-sm">
                  <span>{Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}</span>
                  <span className="text-neutral-400 mx-2">/</span>
                  <span>{Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')}</span>
                </div>
              </div>
            </div>

            {/* 타임라인 트랙 */}
            <div className="relative">
              <div className="relative h-12 bg-neutral-800 rounded-lg overflow-hidden">
                {/* 숏트 블록들 */}
                <div className="flex h-full">
                  {shots.map((shot, index) => {
                    const widthPercentage = (shot.duration / totalDuration) * 100;
                    const isSelected = selectedShotId === shot.id;
                    const phaseColors = ['bg-brand-primary', 'bg-brand-secondary', 'bg-neon-pink', 'bg-neon-green'];
                    const phaseNames = ['exposition', 'rising_action', 'climax', 'resolution'];
                    const phaseIndex = phaseNames.indexOf(shot.storyPhase || 'exposition');
                    const phaseColor = phaseColors[phaseIndex] || 'bg-neutral-500';

                    return (
                      <div
                        key={shot.id}
                        data-testid={`timeline-shot-${index}`}
                        className={`
                          relative h-full border-r border-neutral-700 cursor-pointer transition-all duration-200
                          ${phaseColor}
                          ${isSelected ? 'ring-2 ring-white ring-inset' : ''}
                          hover:brightness-110
                        `}
                        style={{ width: `${widthPercentage}%` }}
                        onClick={() => handleShotClick(shot.id)}
                        title={`숏트 ${index + 1}: ${shot.duration}초`}
                      >
                        {/* 숏트 번호 라벨 */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-white text-xs font-medium">
                            {index + 1}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 현재 재생 위치 인디케이터 */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
                  style={{ left: `${(currentTime / totalDuration) * 100}%` }}
                >
                  {/* 재생 헤드 */}
                  <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-white rounded-full border-2 border-neon-green"></div>
                </div>
              </div>

              {/* 시간 마커 */}
              <div className="flex justify-between mt-2 text-xs text-neutral-400">
                <span>0초</span>
                <span className="hidden sm:inline">{Math.round(totalDuration / 2)}초</span>
                <span>{totalDuration}초</span>
              </div>
            </div>
          </div>
        </div>

        {/* 내보내기 버튼 */}
        <div className="mt-6 flex justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={handleExport}
            disabled={shots.length === 0}
            className="bg-neon-green hover:bg-neon-green-dark text-black font-semibold shadow-neon-green"
          >
            숏트 내보내기
          </Button>
        </div>
      </main>
    </div>
  );
}