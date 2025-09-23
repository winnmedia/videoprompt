/**
 * Shots Widget - 통합 버전
 */

import React, { useState } from 'react';

export interface Shot {
  id: string;
  title: string;
  description: string;
  duration: number;
  cameraAngle?: string;
  sceneType?: string;
  promptText?: string;
}

export interface ShotListProps {
  shots: Shot[];
  onShotSelect?: (shot: Shot) => void;
  selectedShotId?: string;
  className?: string;
}

export const ShotList: React.FC<ShotListProps> = ({
  shots,
  onShotSelect,
  selectedShotId,
  className = ''
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {shots.map((shot) => (
        <div
          key={shot.id}
          onClick={() => onShotSelect?.(shot)}
          className={`p-4 rounded-lg border cursor-pointer transition-colors ${
            selectedShotId === shot.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-medium text-gray-900">{shot.title}</h3>
            <span className="text-sm text-gray-500">{shot.duration}초</span>
          </div>
          <p className="text-sm text-gray-600 mb-2">{shot.description}</p>
          {(shot.cameraAngle || shot.sceneType) && (
            <div className="flex space-x-2 text-xs">
              {shot.cameraAngle && (
                <span className="bg-gray-100 px-2 py-1 rounded">
                  {shot.cameraAngle}
                </span>
              )}
              {shot.sceneType && (
                <span className="bg-gray-100 px-2 py-1 rounded">
                  {shot.sceneType}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export interface ShotEditorProps {
  shot?: Shot | null;
  onSave?: (shot: Shot) => void;
  className?: string;
}

export const ShotEditor: React.FC<ShotEditorProps> = ({
  shot,
  onSave,
  className = ''
}) => {
  const [editingShot, setEditingShot] = useState<Shot | null>(shot || null);

  React.useEffect(() => {
    setEditingShot(shot || null);
  }, [shot]);

  const handleSave = () => {
    if (editingShot && onSave) {
      onSave(editingShot);
    }
  };

  if (!editingShot) {
    return (
      <div className={`text-center text-gray-500 py-8 ${className}`}>
        샷을 선택해주세요
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          제목
        </label>
        <input
          type="text"
          value={editingShot.title}
          onChange={(e) => setEditingShot({ ...editingShot, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          설명
        </label>
        <textarea
          value={editingShot.description}
          onChange={(e) => setEditingShot({ ...editingShot, description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            지속시간 (초)
          </label>
          <input
            type="number"
            value={editingShot.duration}
            onChange={(e) => setEditingShot({ ...editingShot, duration: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            카메라 앵글
          </label>
          <select
            value={editingShot.cameraAngle || ''}
            onChange={(e) => setEditingShot({ ...editingShot, cameraAngle: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">선택</option>
            <option value="wide">와이드샷</option>
            <option value="medium">미디엄샷</option>
            <option value="close">클로즈업</option>
            <option value="extreme-close">익스트림 클로즈업</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          프롬프트 텍스트
        </label>
        <textarea
          value={editingShot.promptText || ''}
          onChange={(e) => setEditingShot({ ...editingShot, promptText: e.target.value })}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="AI 생성을 위한 프롬프트를 입력하세요"
        />
      </div>

      <button
        onClick={handleSave}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        저장
      </button>
    </div>
  );
};

export interface ShotManagerProps {
  shots: Shot[];
  onShotsChange?: (shots: Shot[]) => void;
  className?: string;
}

export const ShotManager: React.FC<ShotManagerProps> = ({
  shots,
  onShotsChange,
  className = ''
}) => {
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);

  const handleShotSave = (updatedShot: Shot) => {
    const updatedShots = shots.map(shot =>
      shot.id === updatedShot.id ? updatedShot : shot
    );
    onShotsChange?.(updatedShots);
  };

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`}>
      <div>
        <h3 className="text-lg font-semibold mb-4">샷 목록</h3>
        <ShotList
          shots={shots}
          onShotSelect={setSelectedShot}
          selectedShotId={selectedShot?.id}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">샷 편집</h3>
        <ShotEditor
          shot={selectedShot}
          onSave={handleShotSave}
        />
      </div>
    </div>
  );
};