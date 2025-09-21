/**
 * Template Selection Modal UI
 * FSD Architecture - Features Layer
 */

'use client';

import React, { useState } from 'react';
import { StoryTemplate } from '@/entities/scenario';
import { Button } from '@/shared/ui';
import { useTemplateSelection } from '../hooks/useTemplateSelection';
import { logger } from '@/shared/lib/logger';

interface TemplateSelectionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (template: StoryTemplate) => void;
  onSaveAsTemplate?: (templateData: { name: string; description: string; template: any }) => void;
  currentStoryInput?: any;
}

export function TemplateSelectionModal({
  isVisible,
  onClose,
  onSelect,
  onSaveAsTemplate,
  currentStoryInput
}: TemplateSelectionModalProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  const {
    templates,
    loading,
    error,
    selectTemplate,
    saveAsTemplate,
    clearError
  } = useTemplateSelection({
    onTemplateSelect: onSelect,
    autoLoad: isVisible
  });

  const handleTemplateSelect = (template: StoryTemplate) => {
    selectTemplate(template);
    onClose();
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      return;
    }

    try {
      await saveAsTemplate({
        name: templateName,
        description: templateDescription,
        template: currentStoryInput
      });

      if (onSaveAsTemplate) {
        onSaveAsTemplate({
          name: templateName,
          description: templateDescription,
          template: currentStoryInput
        });
      }

      setShowSaveDialog(false);
      setTemplateName('');
      setTemplateDescription('');
    } catch (err) {
      // 에러는 이미 hook에서 처리됨
      logger.debug('템플릿 저장 실패:', err);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">템플릿 선택</h2>
            <div className="flex items-center gap-2">
              {currentStoryInput && (
                <Button
                  variant="outline"
                  onClick={() => setShowSaveDialog(true)}
                  className="text-sm"
                >
                  현재 설정을 템플릿으로 저장
                </Button>
              )}
              <Button
                variant="outline"
                onClick={onClose}
                className="text-sm"
              >
                ✕
              </Button>
            </div>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {/* 에러 메시지 */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between">
                <p className="text-red-800">{error}</p>
                <Button
                  variant="outline"
                  onClick={clearError}
                  className="text-red-700 border-red-300 hover:bg-red-100"
                >
                  닫기
                </Button>
              </div>
            </div>
          )}

          {/* 로딩 상태 */}
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600">템플릿을 불러오는 중...</p>
            </div>
          )}

          {/* 템플릿 그리드 */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleTemplateSelect(template)}
                >
                  <div className="mb-3">
                    <h3 className="font-medium text-gray-900 mb-1">{template.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                    <div className="flex flex-wrap gap-1">
                      <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        {template.template.genre}
                      </span>
                      <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                        {template.template.target}
                      </span>
                    </div>
                  </div>

                  <div className="text-sm text-gray-700 mb-3">
                    <p className="font-medium mb-1">스토리:</p>
                    <p className="text-gray-600 line-clamp-2">
                      {template.template.oneLineStory}
                    </p>
                  </div>

                  <div className="text-sm text-gray-700">
                    <p className="font-medium mb-1">톤 앤 매너:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.template.toneAndManner.slice(0, 2).map((tone, index) => (
                        <span
                          key={index}
                          className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
                        >
                          {tone}
                        </span>
                      ))}
                      {template.template.toneAndManner.length > 2 && (
                        <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                          +{template.template.toneAndManner.length - 2}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTemplateSelect(template);
                      }}
                      className="w-full text-sm"
                    >
                      이 템플릿 사용하기
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 템플릿이 없는 경우 */}
          {!loading && templates.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">사용 가능한 템플릿이 없습니다.</p>
              <Button onClick={() => setShowSaveDialog(true)}>
                첫 번째 템플릿 만들기
              </Button>
            </div>
          )}
        </div>

        {/* 템플릿 저장 다이얼로그 */}
        {showSaveDialog && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">템플릿 저장</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    템플릿 이름 *
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    placeholder="예: 감성적인 브랜드 스토리"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    설명
                  </label>
                  <textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg h-20 resize-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    placeholder="이 템플릿에 대한 설명을 입력하세요"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSaveDialog(false);
                    setTemplateName('');
                    setTemplateDescription('');
                  }}
                >
                  취소
                </Button>
                <Button
                  onClick={handleSaveTemplate}
                  disabled={!templateName.trim() || loading}
                >
                  {loading ? '저장 중...' : '저장'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}