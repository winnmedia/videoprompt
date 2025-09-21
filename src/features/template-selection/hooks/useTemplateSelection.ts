/**
 * Template Selection Hook
 * FSD Architecture - Features Layer
 * 템플릿 선택 및 관리 로직
 */

import { useState, useEffect, useCallback } from 'react';
import { safeFetch } from '@/shared/lib/api-retry';
import { logger } from '@/shared/lib/logger';
import { StoryTemplate } from '@/entities/scenario';
import { DEFAULT_TEMPLATES } from '@/entities/scenario';

export interface TemplateSelectionHookReturn {
  // State
  templates: StoryTemplate[];
  loading: boolean;
  error: string | null;

  // Actions
  loadTemplates: () => Promise<void>;
  selectTemplate: (template: StoryTemplate) => void;
  saveAsTemplate: (templateData: { name: string; description: string; template: any }) => Promise<void>;
  clearError: () => void;

  // Event handlers
  onTemplateSelect?: (template: StoryTemplate) => void;
}

interface UseTemplateSelectionOptions {
  onTemplateSelect?: (template: StoryTemplate) => void;
  autoLoad?: boolean;
}

export function useTemplateSelection(options: UseTemplateSelectionOptions = {}): TemplateSelectionHookReturn {
  const { onTemplateSelect, autoLoad = true } = options;

  const [templates, setTemplates] = useState<StoryTemplate[]>(DEFAULT_TEMPLATES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await safeFetch('/api/templates');

      if (response.ok) {
        const data = await response.json();
        const userTemplates = data.templates || [];

        // 기본 템플릿과 사용자 템플릿 결합
        setTemplates([...DEFAULT_TEMPLATES, ...userTemplates]);

        logger.debug('템플릿 로드 성공', {
          defaultCount: DEFAULT_TEMPLATES.length,
          userCount: userTemplates.length,
          totalCount: DEFAULT_TEMPLATES.length + userTemplates.length
        });
      } else {
        throw new Error(`템플릿 로드 실패: ${response.status}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '템플릿 로드 중 알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
      logger.debug('템플릿 로드 실패:', err);

      // 에러 발생 시에도 기본 템플릿은 표시
      setTemplates(DEFAULT_TEMPLATES);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectTemplate = useCallback((template: StoryTemplate) => {
    logger.debug('템플릿 선택됨', {
      templateId: template.id,
      templateName: template.name,
      genre: template.template.genre
    });

    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
  }, [onTemplateSelect]);

  const saveAsTemplate = useCallback(async (templateData: {
    name: string;
    description: string;
    template: any
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await safeFetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: templateData.name,
          description: templateData.description,
          template: templateData.template,
          isPublic: false, // 기본적으로 비공개
        }),
      });

      if (response.ok) {
        const savedTemplate = await response.json();

        // 새로 저장된 템플릿을 목록에 추가
        setTemplates(prev => [...prev, savedTemplate]);

        logger.debug('템플릿 저장 성공', {
          templateId: savedTemplate.id,
          templateName: savedTemplate.name
        });
      } else {
        throw new Error(`템플릿 저장 실패: ${response.status}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '템플릿 저장 중 알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
      logger.debug('템플릿 저장 실패:', err);
      throw err; // 호출자가 에러를 처리할 수 있도록 re-throw
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 자동 로드
  useEffect(() => {
    if (autoLoad) {
      loadTemplates();
    }
  }, []); // $300 방지: 빈 의존성 배열

  return {
    // State
    templates,
    loading,
    error,

    // Actions
    loadTemplates,
    selectTemplate,
    saveAsTemplate,
    clearError,

    // Event handlers
    onTemplateSelect,
  };
}