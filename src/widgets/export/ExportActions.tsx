/**
 * Export Actions 위젯
 * FSD: widgets/export
 */

'use client';

import { useState, useCallback } from 'react';
import {
  ExportButton,
  ExportProgressModal,
  useExport,
  type ExportFormat,
  type ScenarioExportData,
  type PromptExportData
} from '@/features/export';
import { useProject } from '@/app/store/hooks/useProject';
import { useAuth } from '@/app/store/hooks/useAuth';

interface ExportActionsProps {
  mode: 'scenario' | 'prompt';
  className?: string;
  variant?: 'default' | 'compact';
  customData?: ScenarioExportData | PromptExportData;
}

export function ExportActions({
  mode,
  className = '',
  variant = 'default',
  customData
}: ExportActionsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentFormat, setCurrentFormat] = useState<ExportFormat | undefined>();
  const [fileName, setFileName] = useState<string>();

  const { scenario, prompt, id: projectId } = useProject();
  const { user } = useAuth();

  const { exportState, exportScenario, exportPrompts, resetState } = useExport({
    onSuccess: (result) => {
      setFileName(result.fileName);
      console.log('Export successful:', result);
    },
    onError: (error) => {
      console.error('Export failed:', error);
    }
  });

  const prepareScenarioData = useCallback((): ScenarioExportData => {
    if (customData && 'shots' in customData) {
      return customData;
    }

    // Redux store에서 데이터 추출
    const shots = scenario?.shots || [];

    return {
      title: scenario?.title || '시나리오',
      description: scenario?.description,
      shots: shots.map((shot: any, index: number) => ({
        id: shot.id || `shot-${index}`,
        title: shot.title || `샷 ${index + 1}`,
        description: shot.description || '',
        duration: shot.duration,
        location: shot.location,
        characters: shot.characters || [],
        equipment: shot.equipment || [],
        notes: shot.notes
      })),
      metadata: {
        createdAt: scenario?.createdAt || new Date().toISOString(),
        createdBy: user?.username || user?.email,
        projectId: projectId,
        version: scenario?.version || '1.0'
      }
    };
  }, [customData, scenario, user, projectId]);

  const preparePromptData = useCallback((): PromptExportData => {
    if (customData && 'prompts' in customData) {
      return customData;
    }

    // Redux store에서 프롬프트 데이터 추출
    const prompts = prompt?.content ? [
      {
        id: prompt.id || 'main-prompt',
        title: prompt.title || '메인 프롬프트',
        content: prompt.content,
        type: 'user' as const,
        category: prompt.category,
        tags: prompt.tags || [],
        createdAt: prompt.createdAt || new Date().toISOString(),
        updatedAt: prompt.updatedAt
      }
    ] : [];

    return {
      projectName: scenario?.title || prompt?.title || '프로젝트',
      prompts,
      metadata: {
        totalPrompts: prompts.length,
        exportedAt: new Date().toLocaleString('ko-KR'),
        projectId: projectId
      }
    };
  }, [customData, prompt, scenario, projectId]);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setCurrentFormat(format);
    setIsModalOpen(true);
    resetState();

    try {
      if (mode === 'scenario') {
        const scenarioData = prepareScenarioData();
        await exportScenario(scenarioData, format, {
          format,
          includeImages: true,
          pageSize: 'A4'
        });
      } else {
        const promptData = preparePromptData();
        await exportPrompts(promptData);
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  }, [mode, prepareScenarioData, preparePromptData, exportScenario, exportPrompts, resetState]);

  const handleRetry = useCallback(() => {
    if (currentFormat) {
      handleExport(currentFormat);
    }
  }, [currentFormat, handleExport]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setCurrentFormat(undefined);
    setFileName(undefined);
    resetState();
  }, [resetState]);

  // 사용 가능한 형식 결정
  const availableFormats: ExportFormat[] = mode === 'scenario'
    ? ['pdf', 'excel']
    : ['excel'];

  // 데이터 유효성 검사
  const hasData = mode === 'scenario'
    ? (scenario?.shots?.length || 0) > 0 || (customData && 'shots' in customData)
    : (prompt?.content || customData);

  return (
    <>
      <ExportButton
        onExport={handleExport}
        disabled={!hasData}
        variant={variant}
        className={className}
        availableFormats={availableFormats}
      />

      <ExportProgressModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        exportState={exportState}
        format={currentFormat}
        fileName={fileName}
        onRetry={handleRetry}
      />
    </>
  );
}