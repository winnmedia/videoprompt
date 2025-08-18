'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TimelineBead, Action, AudioElement, Transition } from '@/types/api';

interface TimelineEditorPageProps {
  params: {
    id: string;
  };
}

export default function TimelineEditorPage({ params }: TimelineEditorPageProps) {
  const [timeline, setTimeline] = useState<TimelineBead[]>([]);
  const [selectedBead, setSelectedBead] = useState<TimelineBead | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  // 샘플 데이터로 초기화
  useEffect(() => {
    const sampleTimeline: TimelineBead[] = [
      {
        id: '1',
        sequence: 1,
        startTime: 0,
        endTime: 2,
        duration: 2,
        sceneId: 'scene-1',
        actions: [
          {
            id: 'action-1',
            type: 'camera',
            name: '줌 인',
            parameters: { zoom: 1.2, duration: 1 },
            startTime: 0,
            duration: 1,
          },
        ],
        audio: [
          {
            id: 'audio-1',
            type: 'music',
            name: '배경음악',
            url: '/audio/background.mp3',
            volume: 0.7,
            startTime: 0,
            duration: 2,
            fadeIn: 0.5,
            fadeOut: 0.5,
          },
        ],
        transitions: [
          {
            id: 'transition-1',
            type: 'fade',
            duration: 0.5,
            easing: 'ease-in-out',
            parameters: {},
          },
        ],
      },
      {
        id: '2',
        sequence: 2,
        startTime: 2,
        endTime: 4,
        duration: 2,
        sceneId: 'scene-2',
        actions: [],
        audio: [],
        transitions: [],
      },
    ];

    setTimeline(sampleTimeline);
    setTotalDuration(4);
  }, []);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleBeadClick = (bead: TimelineBead) => {
    setSelectedBead(bead);
  };

  const handleAddBead = () => {
    const newBead: TimelineBead = {
      id: `bead-${Date.now()}`,
      sequence: timeline.length + 1,
      startTime: totalDuration,
      endTime: totalDuration + 2,
      duration: 2,
      sceneId: `scene-${Date.now()}`,
      actions: [],
      audio: [],
      transitions: [],
    };

    setTimeline([...timeline, newBead]);
    setTotalDuration(totalDuration + 2);
  };

  const handleDeleteBead = (beadId: string) => {
    const updatedTimeline = timeline.filter(bead => bead.id !== beadId);
    setTimeline(updatedTimeline);
    
    // 총 지속시간 재계산
    const newTotalDuration = updatedTimeline.reduce((total, bead) => total + bead.duration, 0);
    setTotalDuration(newTotalDuration);
    
    if (selectedBead?.id === beadId) {
      setSelectedBead(null);
    }
  };

  const handleBeadDurationChange = (beadId: string, newDuration: number) => {
    const updatedTimeline = timeline.map(bead => {
      if (bead.id === beadId) {
        return {
          ...bead,
          duration: newDuration,
          endTime: bead.startTime + newDuration,
        };
      }
      return bead;
    });

    setTimeline(updatedTimeline);
    
    // 총 지속시간 재계산
    const newTotalDuration = updatedTimeline.reduce((total, bead) => total + bead.duration, 0);
    setTotalDuration(newTotalDuration);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Icon name="edit" size="lg" className="text-primary-500" />
              <h1 className="text-2xl font-bold text-gray-900">타임라인 에디터</h1>
              <span className="text-sm text-gray-500">프로젝트 ID: {params.id}</span>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={handleStop}>
                <Icon name="stop" size="sm" className="mr-2" />
                정지
              </Button>
              <Button onClick={handlePlayPause}>
                <Icon name={isPlaying ? "pause" : "play"} size="sm" className="mr-2" />
                {isPlaying ? '일시정지' : '재생'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 타임라인 캔버스 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">타임라인</h2>
                <Button onClick={handleAddBead} size="sm">
                  <Icon name="plus" size="sm" className="mr-2" />
                  구슬 추가
                </Button>
              </div>

              {/* 타임라인 뷰어 */}
              <div className="relative bg-gray-100 rounded-lg p-4 min-h-[200px]">
                {/* 시간 눈금 */}
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
                    <span key={i}>{formatTime(i)}</span>
                  ))}
                </div>

                {/* 타임라인 구슬들 */}
                <div className="relative">
                  {timeline.map((bead, index) => (
                    <div
                      key={bead.id}
                      className={`absolute top-0 h-16 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedBead?.id === bead.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-300 bg-white hover:border-gray-400'
                      }`}
                      style={{
                        left: `${(bead.startTime / totalDuration) * 100}%`,
                        width: `${(bead.duration / totalDuration) * 100}%`,
                      }}
                      onClick={() => handleBeadClick(bead)}
                    >
                      <div className="p-2 h-full flex flex-col justify-between">
                        <div className="text-xs font-medium text-gray-700">
                          구슬 {bead.sequence}
                        </div>
                        <div className="text-xs text-gray-500">
                          {bead.duration}초
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 현재 시간 표시 */}
                <div
                  className="absolute top-0 w-0.5 h-full bg-red-500 z-10"
                  style={{
                    left: `${(currentTime / totalDuration) * 100}%`,
                  }}
                />
              </div>

              {/* 타임라인 정보 */}
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <span className="font-medium text-gray-700">총 지속시간</span>
                  <div className="text-lg font-bold text-primary-600">
                    {formatTime(totalDuration)}
                  </div>
                </div>
                <div className="text-center">
                  <span className="font-medium text-gray-700">구슬 개수</span>
                  <div className="text-lg font-bold text-gray-600">
                    {timeline.length}
                  </div>
                </div>
                <div className="text-center">
                  <span className="font-medium text-gray-700">현재 시간</span>
                  <div className="text-lg font-bold text-red-600">
                    {formatTime(currentTime)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 구슬 편집 패널 */}
          <div className="space-y-6">
            {selectedBead ? (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    구슬 {selectedBead.sequence} 편집
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteBead(selectedBead.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Icon name="delete" size="sm" />
                  </Button>
                </div>

                {/* 구슬 속성 */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      지속시간 (초)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={selectedBead.duration}
                      onChange={(e) => handleBeadDurationChange(selectedBead.id, Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      시작 시간
                    </label>
                    <div className="text-sm text-gray-600">
                      {formatTime(selectedBead.startTime)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      종료 시간
                    </label>
                    <div className="text-sm text-gray-600">
                      {formatTime(selectedBead.endTime)}
                    </div>
                  </div>
                </div>

                {/* 액션 목록 */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">액션</h4>
                  {selectedBead.actions.length > 0 ? (
                    <div className="space-y-2">
                      {selectedBead.actions.map((action) => (
                        <div key={action.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{action.name}</span>
                          <Icon name="edit" size="sm" className="text-gray-400 cursor-pointer" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-4">
                      액션이 없습니다
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full mt-3">
                    <Icon name="plus" size="sm" className="mr-2" />
                    액션 추가
                  </Button>
                </div>

                {/* 오디오 목록 */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">오디오</h4>
                  {selectedBead.audio.length > 0 ? (
                    <div className="space-y-2">
                      {selectedBead.audio.map((audio) => (
                        <div key={audio.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{audio.name}</span>
                          <Icon name="edit" size="sm" className="text-gray-400 cursor-pointer" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-4">
                      오디오가 없습니다
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full mt-3">
                    <Icon name="plus" size="sm" className="mr-2" />
                    오디오 추가
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="text-center py-12 text-gray-500">
                  <Icon name="edit" size="xl" className="mx-auto mb-4 text-gray-300" />
                  <p>편집할 구슬을 클릭하세요</p>
                  <p className="text-sm mt-2">타임라인에서 구슬을 선택하면 편집할 수 있습니다</p>
                </div>
              </div>
            )}

            {/* 도움말 */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                💡 편집 팁
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 구슬을 클릭하여 속성을 편집할 수 있습니다</li>
                <li>• 드래그하여 구슬의 위치를 조정할 수 있습니다</li>
                <li>• 액션과 오디오를 추가하여 장면을 풍부하게 만드세요</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
