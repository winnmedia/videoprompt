'use client';

import React, { useState, useEffect } from 'react';
import { StoryTemplate, StoryInput } from '@/entities/scenario';
import { DEFAULT_TEMPLATES } from '@/entities/scenario/templates';
import { Button } from '@/shared/ui';

interface TemplateSelectorProps {
  onSelect: (template: StoryTemplate) => void;
  onSaveAsTemplate: (templateData: { name: string; description: string; storyInput: StoryInput }) => void;
  currentStoryInput: StoryInput;
  isVisible: boolean;
  onClose: () => void;
}

export function TemplateSelector({
  onSelect,
  onSaveAsTemplate,
  currentStoryInput,
  isVisible,
  onClose
}: TemplateSelectorProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [userTemplates, setUserTemplates] = useState<StoryTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  // 사용자 템플릿 불러오기
  useEffect(() => {
    if (isVisible) {
      loadUserTemplates();
    }
  }, [isVisible]);

  const loadUserTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/templates');
      if (response.ok) {
        const data = await response.json();
        setUserTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('템플릿 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  const handleTemplateSelect = (template: StoryTemplate) => {
    onSelect(template);
    onClose();
  };

  const handleSaveAsTemplate = () => {
    setShowSaveDialog(true);
  };

  const handleCloseSaveDialog = () => {
    setShowSaveDialog(false);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      alert('템플릿 이름을 입력해주세요.');
      return;
    }

    try {
      onSaveAsTemplate({
        name: templateName.trim(),
        description: templateDescription.trim() || `사용자 정의 ${currentStoryInput.genre} 템플릿`,
        storyInput: currentStoryInput
      });
      
      setTemplateName('');
      setTemplateDescription('');
      setShowSaveDialog(false);
      
      // 템플릿 목록 다시 불러오기
      await loadUserTemplates();
      
      onClose();
    } catch (error) {
      console.error('템플릿 저장 실패:', error);
      alert('템플릿 저장에 실패했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">템플릿 선택</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* 기본 템플릿 섹션 */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🎯 기본 템플릿</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {DEFAULT_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer bg-gradient-to-br from-white to-gray-50"
                onClick={() => handleTemplateSelect(template)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 text-sm">{template.name}</h4>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    기본
                  </span>
                </div>
                <p className="text-gray-600 text-xs mb-3 leading-relaxed">{template.description}</p>
                
                {/* 템플릿 미리보기 */}
                <div className="bg-white p-3 rounded-md border text-xs space-y-1">
                  <div><span className="font-medium text-gray-700">장르:</span> <span className="text-blue-600">{template.template.genre}</span></div>
                  <div><span className="font-medium text-gray-700">타겟:</span> <span className="text-blue-600">{template.template.target}</span></div>
                  <div><span className="font-medium text-gray-700">분위기:</span> <span className="text-blue-600">{template.template.toneAndManner.join(', ')}</span></div>
                  <div><span className="font-medium text-gray-700">시간:</span> <span className="text-blue-600">{template.template.duration}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 사용자 템플릿 섹션 */}
        {userTemplates.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">👤 내 템플릿</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {userTemplates.map((template) => (
                <div
                  key={template.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-lg hover:border-green-300 transition-all cursor-pointer bg-gradient-to-br from-white to-green-50"
                  onClick={() => handleTemplateSelect(template)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 text-sm">{template.name}</h4>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      내 템플릿
                    </span>
                  </div>
                  <p className="text-gray-600 text-xs mb-3 leading-relaxed">{template.description}</p>
                  
                  {/* 템플릿 미리보기 */}
                  <div className="bg-white p-3 rounded-md border text-xs space-y-1">
                    <div><span className="font-medium text-gray-700">장르:</span> <span className="text-green-600">{template.template.genre}</span></div>
                    <div><span className="font-medium text-gray-700">타겟:</span> <span className="text-green-600">{template.template.target}</span></div>
                    <div><span className="font-medium text-gray-700">분위기:</span> <span className="text-green-600">{template.template.toneAndManner.join(', ')}</span></div>
                    <div><span className="font-medium text-gray-700">시간:</span> <span className="text-green-600">{template.template.duration}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 로딩 상태 */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">템플릿을 불러오는 중...</span>
          </div>
        )}

        {/* 현재 입력값으로 템플릿 저장 */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">현재 설정을 템플릿으로 저장</h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="text-sm space-y-1">
              <div><span className="font-medium">제목:</span> {currentStoryInput.title || '(빈 값)'}</div>
              <div><span className="font-medium">줄거리:</span> {currentStoryInput.oneLineStory || '(빈 값)'}</div>
              <div><span className="font-medium">장르:</span> {currentStoryInput.genre || '(빈 값)'}</div>
              <div><span className="font-medium">분위기:</span> {currentStoryInput.toneAndManner.join(', ') || '(빈 값)'}</div>
            </div>
          </div>
          <Button
            onClick={handleSaveAsTemplate}
            variant="secondary"
            className="w-full"
          >
            현재 설정을 템플릿으로 저장
          </Button>
        </div>

        {/* 저장 다이얼로그 */}
        {showSaveDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">💾 템플릿 저장</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    템플릿 이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="예: 내 광고 영상 템플릿"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    maxLength={50}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    템플릿 설명 (선택사항)
                  </label>
                  <textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="이 템플릿이 어떤 용도인지 설명해주세요..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    maxLength={200}
                  />
                  <p className="text-xs text-gray-500 mt-1">{templateDescription.length}/200</p>
                </div>

                {/* 현재 설정 미리보기 */}
                <div className="bg-gray-50 p-3 rounded-md border">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">저장될 설정</h4>
                  <div className="text-xs space-y-1 text-gray-600">
                    <div><span className="font-medium">제목:</span> {currentStoryInput.title || '(빈 값)'}</div>
                    <div><span className="font-medium">장르:</span> {currentStoryInput.genre || '(빈 값)'}</div>
                    <div><span className="font-medium">분위기:</span> {currentStoryInput.toneAndManner.join(', ') || '(빈 값)'}</div>
                    <div><span className="font-medium">시간:</span> {currentStoryInput.duration || '(빈 값)'}</div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 justify-end mt-6">
                <Button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setTemplateName('');
                    setTemplateDescription('');
                  }}
                  variant="secondary"
                >
                  취소
                </Button>
                <Button
                  onClick={handleSaveTemplate}
                  variant="primary"
                  disabled={!templateName.trim()}
                >
                  저장
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}