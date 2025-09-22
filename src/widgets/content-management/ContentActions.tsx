/**
 * Content Actions Widget
 * 콘텐츠 배치 작업 UI
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useContentManagement } from '../../features/content-management';

interface ContentActionsProps {
  selectedCount: number;
  isAllSelected: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  contentType: string;
}

/**
 * 배치 작업 타입 정의
 */
const BATCH_ACTIONS = [
  {
    id: 'activate',
    label: '활성화',
    icon: '✅',
    variant: 'success' as const,
    confirmMessage: '선택된 항목들을 활성화하시겠습니까?',
  },
  {
    id: 'archive',
    label: '보관',
    icon: '📦',
    variant: 'warning' as const,
    confirmMessage: '선택된 항목들을 보관하시겠습니까?',
  },
  {
    id: 'delete',
    label: '삭제',
    icon: '🗑️',
    variant: 'danger' as const,
    confirmMessage: '선택된 항목들을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
  },
];

/**
 * 스타일 variants
 */
const BUTTON_VARIANTS = {
  success: 'bg-green-600 hover:bg-green-700 text-white',
  warning: 'bg-yellow-600 hover:bg-yellow-700 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  default: 'bg-gray-600 hover:bg-gray-700 text-white',
};

/**
 * 확인 모달 컴포넌트
 */
function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText,
  cancelText = '취소',
  variant = 'default',
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  variant?: keyof typeof BUTTON_VARIANTS;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* 배경 오버레이 */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onCancel}
        />

        {/* 모달 콘텐츠 */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              variant === 'danger' ? 'bg-red-100' :
              variant === 'warning' ? 'bg-yellow-100' :
              variant === 'success' ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <svg
                className={`w-5 h-5 ${
                  variant === 'danger' ? 'text-red-600' :
                  variant === 'warning' ? 'text-yellow-600' :
                  variant === 'success' ? 'text-green-600' : 'text-gray-600'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {variant === 'danger' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              {title}
            </h3>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            {message}
          </p>

          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${BUTTON_VARIANTS[variant]}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 태그 추가 모달 컴포넌트
 */
function AddTagsModal({
  isOpen,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  onConfirm: (tags: string[]) => void;
  onCancel: () => void;
}) {
  const [tags, setTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');

  const handleAddTag = useCallback(() => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !tags.includes(trimmedValue)) {
      setTags([...tags, trimmedValue]);
      setInputValue('');
    }
  }, [inputValue, tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  }, [tags]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddTag();
    }
  }, [handleAddTag]);

  const handleConfirm = useCallback(() => {
    onConfirm(tags);
    setTags([]);
    setInputValue('');
  }, [tags, onConfirm]);

  const handleCancel = useCallback(() => {
    setTags([]);
    setInputValue('');
    onCancel();
  }, [onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={handleCancel}
        />
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            태그 추가
          </h3>

          <div className="space-y-4">
            {/* 태그 입력 */}
            <div>
              <label htmlFor="tag-input" className="block text-sm font-medium text-gray-700 mb-2">
                추가할 태그
              </label>
              <div className="flex space-x-2">
                <input
                  id="tag-input"
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="태그 이름 입력"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleAddTag}
                  disabled={!inputValue.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  추가
                </button>
              </div>
            </div>

            {/* 추가된 태그 목록 */}
            {tags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  추가할 태그 목록
                </label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-md"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-blue-600 hover:text-blue-800"
                        aria-label={`${tag} 태그 제거`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              disabled={tags.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              태그 추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 콘텐츠 배치 작업 메인 컴포넌트
 */
export function ContentActions({
  selectedCount,
  isAllSelected,
  onSelectAll,
  onClearSelection,
  contentType,
}: ContentActionsProps) {
  const {
    bulkDelete,
    bulkArchive,
    bulkActivate,
    bulkAddTags,
    loading,
  } = useContentManagement();

  // 모달 상태
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: string;
    title: string;
    message: string;
    variant: keyof typeof BUTTON_VARIANTS;
  }>({ isOpen: false, action: '', title: '', message: '', variant: 'default' });

  const [addTagsModal, setAddTagsModal] = useState(false);

  /**
   * 배치 작업 실행 핸들러
   */
  const handleBatchAction = useCallback(async (actionId: string) => {
    try {
      switch (actionId) {
        case 'activate':
          await bulkActivate();
          break;
        case 'archive':
          await bulkArchive();
          break;
        case 'delete':
          await bulkDelete();
          break;
      }
      setConfirmModal({ isOpen: false, action: '', title: '', message: '', variant: 'default' });
    } catch (error) {
      console.error('배치 작업 실패:', error);
      // 에러 토스트 표시 등
    }
  }, [bulkActivate, bulkArchive, bulkDelete]);

  /**
   * 확인 모달 열기
   */
  const openConfirmModal = useCallback((action: typeof BATCH_ACTIONS[number]) => {
    setConfirmModal({
      isOpen: true,
      action: action.id,
      title: `${action.label} 확인`,
      message: action.confirmMessage,
      variant: action.variant,
    });
  }, []);

  /**
   * 태그 추가 핸들러
   */
  const handleAddTags = useCallback(async (tags: string[]) => {
    try {
      await bulkAddTags(tags);
      setAddTagsModal(false);
    } catch (error) {
      console.error('태그 추가 실패:', error);
    }
  }, [bulkAddTags]);

  /**
   * 내보내기 핸들러
   */
  const handleExport = useCallback(() => {
    // CSV/JSON 내보내기 기능 구현
    console.log('내보내기 기능 구현 필요');
  }, []);

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          {/* 선택 정보 */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-blue-900">
                {selectedCount}개 항목 선택됨
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={onSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {isAllSelected ? '선택 해제' : '전체 선택'}
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={onClearSelection}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                선택 초기화
              </button>
            </div>
          </div>

          {/* 배치 작업 버튼 */}
          <div className="flex items-center space-x-2">
            {/* 기본 배치 작업 */}
            {BATCH_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => openConfirmModal(action)}
                disabled={loading.batchAction}
                className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_VARIANTS[action.variant]}`}
              >
                <span className="mr-2">{action.icon}</span>
                {action.label}
              </button>
            ))}

            {/* 추가 작업 드롭다운 */}
            <div className="relative">
              <button
                onClick={() => setAddTagsModal(true)}
                disabled={loading.batchAction}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🏷️ 태그 추가
              </button>
            </div>

            <button
              onClick={handleExport}
              disabled={loading.batchAction}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📤 내보내기
            </button>
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading.batchAction && (
          <div className="mt-3 flex items-center space-x-2 text-sm text-blue-700">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>작업 처리 중...</span>
          </div>
        )}
      </div>

      {/* 확인 모달 */}
      <ConfirmModal
        open={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="확인"
        variant={confirmModal.variant}
        onConfirm={() => handleBatchAction(confirmModal.action)}
        onCancel={() => setConfirmModal({ isOpen: false, action: '', title: '', message: '', variant: 'default' })}
      />

      {/* 태그 추가 모달 */}
      <AddTagsModal
        open={addTagsModal}
        onConfirm={handleAddTags}
        onCancel={() => setAddTagsModal(false)}
      />
    </>
  );
}