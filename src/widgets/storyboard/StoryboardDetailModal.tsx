'use client';

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Shot } from './StoryboardCard';

interface StoryboardDetailModalProps {
  shot: Shot;
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: (shotId: string) => void;
  onEdit: (updates: Partial<Shot>) => void;
  onDownload: (shotId: string, imageUrl?: string) => void;
}

export const StoryboardDetailModal: React.FC<StoryboardDetailModalProps> = ({
  shot,
  isOpen,
  onClose,
  onRegenerate,
  onEdit,
  onDownload,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedShot, setEditedShot] = useState(shot);

  useEffect(() => {
    setEditedShot(shot);
  }, [shot]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveEdit = () => {
    onEdit(editedShot);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedShot(shot);
    setIsEditing(false);
  };

  return (
    <div
      data-testid="storyboard-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* 백드롭 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* 모달 컨텐츠 */}
      <div
        className="relative z-10 w-full max-w-5xl rounded-xl bg-white shadow-2xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            샷 상세 정보
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="flex flex-col lg:flex-row">
          {/* 이미지 영역 */}
          <div className="flex-1 border-b p-6 lg:border-b-0 lg:border-r dark:border-gray-700">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
              {shot.imageUrl ? (
                <img
                  src={shot.imageUrl}
                  alt={`Shot ${shot.index}: ${shot.title}`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                  <svg className="mb-4 h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-lg">이미지가 아직 생성되지 않았습니다</span>
                </div>
              )}
            </div>

            {/* 이미지 액션 버튼 */}
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={() => onRegenerate(shot.id)}
                className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                이미지 재생성
              </button>
              {shot.imageUrl && (
                <button
                  onClick={() => onDownload(shot.id, shot.imageUrl)}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  다운로드
                </button>
              )}
            </div>
          </div>

          {/* 정보 영역 */}
          <div className="flex-1 p-6">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    제목
                  </label>
                  <input
                    type="text"
                    value={editedShot.title}
                    onChange={(e) => setEditedShot({ ...editedShot, title: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    설명
                  </label>
                  <textarea
                    value={editedShot.description || ''}
                    onChange={(e) => setEditedShot({ ...editedShot, description: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    프롬프트
                  </label>
                  <textarea
                    value={editedShot.prompt || ''}
                    onChange={(e) => setEditedShot({ ...editedShot, prompt: e.target.value })}
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      샷 타입
                    </label>
                    <select
                      value={editedShot.shotType || ''}
                      onChange={(e) => setEditedShot({ ...editedShot, shotType: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value="">선택</option>
                      <option value="와이드">와이드</option>
                      <option value="미디엄">미디엄</option>
                      <option value="클로즈업">클로즈업</option>
                      <option value="익스트림 클로즈업">익스트림 클로즈업</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      카메라 움직임
                    </label>
                    <select
                      value={editedShot.camera || ''}
                      onChange={(e) => setEditedShot({ ...editedShot, camera: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value="">선택</option>
                      <option value="정적">정적</option>
                      <option value="팬">팬</option>
                      <option value="틸트">틸트</option>
                      <option value="줌">줌</option>
                      <option value="트래킹">트래킹</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    지속시간 (초)
                  </label>
                  <input
                    type="number"
                    value={editedShot.duration || 0}
                    onChange={(e) => setEditedShot({ ...editedShot, duration: parseInt(e.target.value) })}
                    min="1"
                    max="60"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>

                {/* 편집 액션 버튼 */}
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={handleCancelEdit}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  >
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {shot.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Shot #{shot.index}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    편집
                  </button>
                </div>

                {shot.description && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">설명</h4>
                    <p className="text-gray-600 dark:text-gray-400">{shot.description}</p>
                  </div>
                )}

                {shot.prompt && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">프롬프트</h4>
                    <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                      {shot.prompt}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {shot.shotType && (
                    <div>
                      <h4 className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">샷 타입</h4>
                      <p className="text-gray-600 dark:text-gray-400">{shot.shotType}</p>
                    </div>
                  )}

                  {shot.camera && (
                    <div>
                      <h4 className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">카메라 움직임</h4>
                      <p className="text-gray-600 dark:text-gray-400">{shot.camera}</p>
                    </div>
                  )}

                  {shot.duration && (
                    <div>
                      <h4 className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">지속시간</h4>
                      <p className="text-gray-600 dark:text-gray-400">{shot.duration}초</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};