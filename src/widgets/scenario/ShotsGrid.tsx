'use client';

import React from 'react';
import { Shot, InsertShot } from '@/entities/scenario';
import { Button, Icon } from '@/shared/ui';

interface ShotsGridProps {
  shots: Shot[];
  onUpdateShot: (shotId: string, field: keyof Shot, value: any) => void;
  onGenerateContiImage: (shotId: string) => void;
  onGenerateInsertShots: (shotId: string) => void;
  isGeneratingImage: Record<string, boolean>;
}

export function ShotsGrid({
  shots,
  onUpdateShot,
  onGenerateContiImage,
  onGenerateInsertShots,
  isGeneratingImage
}: ShotsGridProps) {
  const handleDownloadImage = (imageUrl: string, shotId: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `conti-${shotId}.png`;
    link.click();
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {shots.map((shot, index) => (
        <div key={shot.id} className="card-hover p-4">
          {/* 콘티 이미지 프레임 */}
          <div className="mb-4">
            <div className="border-border relative flex min-h-40 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-gray-50">
              {shot.contiImage ? (
                <div className="relative w-full">
                  <img
                    src={shot.contiImage}
                    alt={`${shot.title} 콘티`}
                    className="h-40 w-full object-cover"
                  />
                  <div className="absolute right-2 top-2 flex space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onGenerateContiImage(shot.id)}
                      className="bg-white/90 px-2 py-1 text-xs shadow-lg hover:bg-white"
                      disabled={isGeneratingImage[shot.id]}
                    >
                      {isGeneratingImage[shot.id] ? '생성 중...' : '재생성'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadImage(shot.contiImage!, shot.id)}
                      className="bg-white/90 px-2 py-1 text-xs shadow-lg hover:bg-white"
                    >
                      다운로드
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                  <Icon name="image" className="mb-3 h-8 w-8 text-gray-400" />
                  {/* 콘티 생성 버튼을 프레임 정중앙에 배치 */}
                  <Button
                    onClick={() => onGenerateContiImage(shot.id)}
                    size="lg"
                    className="bg-primary text-white px-8 py-4 text-base font-semibold shadow-lg hover:bg-primary/90"
                    disabled={isGeneratingImage[shot.id]}
                  >
                    {isGeneratingImage[shot.id] ? '생성 중...' : '콘티 생성'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* 숏트 제목과 스토리 - 프레임 바로 아래 강조 표시 */}
          <div className="mb-4 border-b border-gray-200 pb-3">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{shot.title}</h3>
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg">
              {shot.description}
            </p>
          </div>

          {/* 숏 정보 편집 필드 */}
          <div className="mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-text mb-1 block text-xs font-medium">샷 타입</label>
                <select
                  value={shot.shotType}
                  onChange={(e) => onUpdateShot(shot.id, 'shotType', e.target.value)}
                  className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-xs text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  <option value="와이드">와이드</option>
                  <option value="미디엄">미디엄</option>
                  <option value="클로즈업">클로즈업</option>
                  <option value="익스트림 클로즈업">익스트림 클로즈업</option>
                </select>
              </div>
              <div>
                <label className="text-text mb-1 block text-xs font-medium">카메라</label>
                <select
                  value={shot.camera}
                  onChange={(e) => onUpdateShot(shot.id, 'camera', e.target.value)}
                  className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-xs text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
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
              <label className="text-text mb-1 block text-xs font-medium">구도</label>
              <select
                value={shot.composition}
                onChange={(e) => onUpdateShot(shot.id, 'composition', e.target.value)}
                className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-xs text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                <option value="중앙 정렬">중앙 정렬</option>
                <option value="3분법">3분법</option>
                <option value="대각선">대각선</option>
                <option value="프레임 안 프레임">프레임 안 프레임</option>
              </select>
            </div>

            <div>
              <label className="text-text mb-1 block text-xs font-medium">길이 (초)</label>
              <input
                type="number"
                value={shot.length}
                onChange={(e) => onUpdateShot(shot.id, 'length', Number(e.target.value))}
                min="1"
                max="15"
                className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-xs text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>

            <div>
              <label className="text-text mb-1 block text-xs font-medium">대사</label>
              <textarea
                value={shot.dialogue}
                onChange={(e) => onUpdateShot(shot.id, 'dialogue', e.target.value)}
                rows={2}
                className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-xs text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="대사를 입력하세요..."
              />
            </div>

            <div>
              <label className="text-text mb-1 block text-xs font-medium">자막</label>
              <input
                type="text"
                value={shot.subtitle}
                onChange={(e) => onUpdateShot(shot.id, 'subtitle', e.target.value)}
                className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-xs text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="자막을 입력하세요..."
              />
            </div>

            <div>
              <label className="text-text mb-1 block text-xs font-medium">전환</label>
              <select
                value={shot.transition}
                onChange={(e) => onUpdateShot(shot.id, 'transition', e.target.value)}
                className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-xs text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
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
              <h4 className="text-text mb-2 text-sm font-medium">인서트샷 추천</h4>
              <div className="space-y-2">
                {shot.insertShots.map((insert) => (
                  <div key={insert.id} className="rounded bg-gray-50 p-2 text-xs">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-text font-medium">
                          <strong>{insert.purpose}:</strong> {insert.description}
                        </p>
                        <p className="text-text-light">프레이밍: {insert.framing}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}