'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/ui';
import { useToast } from '@/shared/lib/hooks';
import { generatePlanningPDFWithProgress } from '@/shared/lib/pdf-generator';
import { StoryboardGallery } from '@/widgets/storyboard';
import { StoryInput, StoryStep, Shot, StoryboardShot } from '@/entities/scenario';
import { safeFetch } from '@/shared/lib/api-retry';

/**
 * 스토리보드 생성 및 관리 섹션
 * FSD Architecture - Widgets Layer
 */

interface ScenarioStoryboardSectionProps {
  shots: Shot[];
  storyInput: StoryInput;
  storySteps: StoryStep[];
  onGoBack: () => void;
  className?: string;
}

export function ScenarioStoryboardSection({
  shots,
  storyInput,
  storySteps,
  onGoBack,
  className
}: ScenarioStoryboardSectionProps) {
  const toast = useToast();
  const [storyboardShots, setStoryboardShots] = useState<StoryboardShot[]>([]);
  const [isGeneratingImage, setIsGeneratingImage] = useState<Record<string, boolean>>({});

  // 기획안 저장
  const handleSaveScenario = async () => {
    try {
      const scenarioData = {
        type: 'scenario',
        projectId: 'scenario_' + Date.now(),
        source: 'user_created',
        title: storyInput.title || '생성된 시나리오',
        story: storySteps.length > 0 ? JSON.stringify(storySteps) : storyInput.oneLineStory || '',
        genre: storyInput.genre,
        tone: Array.isArray(storyInput.toneAndManner)
          ? storyInput.toneAndManner.join(', ')
          : storyInput.toneAndManner || 'Neutral',
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenarioData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '기획안 저장에 실패했습니다');
      }

      toast.success('기획안이 성공적으로 저장되었습니다.', '기획안 저장');
    } catch (error) {
      console.error('Scenario save error:', error);
      toast.error(
        error instanceof Error ? error.message : '기획안 저장 중 오류가 발생했습니다',
        '저장 오류'
      );
    }
  };

  // PDF 기획안 다운로드
  const handleExportPlan = async (format: 'json' | 'pdf' = 'pdf') => {
    try {
      if (format === 'pdf') {
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
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('기획안 다운로드 실패:', e);
      }
      toast.error('기획안 다운로드에 실패했습니다.', '다운로드 실패');
    }
  };

  // 스토리보드 샷 재생성
  const handleRegenerateShot = async (shotId: string) => {
    // TODO: 이미지 생성 로직 구현
    console.log('Regenerate shot:', shotId);
  };

  // 스토리보드 샷 편집
  const handleEditStoryboardShot = (shotId: string, updates: Partial<StoryboardShot>) => {
    setStoryboardShots(prev => prev.map(shot =>
      shot.id === shotId ? { ...shot, ...updates } : shot
    ));
  };

  // 개별 샷 다운로드
  const handleDownloadShot = (shotId: string, imageUrl?: string) => {
    if (!imageUrl) return;

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `storyboard-${shotId}.png`;
    link.click();
  };

  // 전체 샷 다운로드
  const handleDownloadAllShots = async (shots: StoryboardShot[]) => {
    for (const shot of shots) {
      if (shot.imageUrl) {
        handleDownloadShot(shot.id, shot.imageUrl);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  return (
    <div className={`space-y-8 ${className || ''}`}>
      {/* 스토리보드 갤러리 섹션 */}
      <div className="card p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={onGoBack}
              size="lg"
              className="px-6"
            >
              이전 단계
            </Button>
            <h2 className="text-2xl font-semibold text-gray-900">스토리보드 갤러리</h2>
          </div>
          <div className="flex gap-2">
            <div className="text-sm text-gray-500 flex items-center">
              각 스토리보드에서 개별적으로 이미지를 생성하세요
            </div>
            <Button
              variant="outline"
              size="lg"
              onClick={handleSaveScenario}
              disabled={!storyInput.title || !storyInput.oneLineStory}
              className="px-6"
            >
              기획안 저장
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
    </div>
  );
}