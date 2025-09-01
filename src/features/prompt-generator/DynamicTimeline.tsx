import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/ui/Button';
import { Plus, X, Clock, Video, Volume2, Camera, Move } from 'lucide-react';
import {
  type TimelineSegment,
  CAMERA_ANGLES,
  CAMERA_MOVEMENTS,
  PACING_OPTIONS,
  AUDIO_QUALITY,
} from '@/types/video-prompt';
import { generateId } from '@/shared/lib/utils';
import { cn } from '@/shared/lib/utils';

interface DynamicTimelineProps {
  timeline: TimelineSegment[];
  onTimelineChange: (timeline: TimelineSegment[]) => void;
  onNext: () => void;
  onPrevious: () => void;
}

export const DynamicTimeline: React.FC<DynamicTimelineProps> = ({
  timeline,
  onTimelineChange,
  onNext,
  onPrevious,
}) => {
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // 타임라인 세그먼트 추가
  const addSegment = () => {
    const newSequence = timeline.length + 1;
    const newSegment: TimelineSegment = {
      id: generateId(),
      sequence: newSequence,
      timestamp: '',
      action: '',
      audio: '',
      camera_angle: undefined,
      camera_movement: undefined,
      pacing: undefined,
      audio_quality: undefined,
    };

    onTimelineChange([...timeline, newSegment]);
  };

  // 세그먼트 제거
  const removeSegment = (id: string) => {
    const updatedTimeline = timeline.filter((segment) => segment.id !== id);

    // 시퀀스 번호 재정렬
    const reorderedTimeline = updatedTimeline.map((segment, index) => ({
      ...segment,
      sequence: index + 1,
    }));

    onTimelineChange(reorderedTimeline);
  };

  // 세그먼트 업데이트
  const updateSegment = (id: string, field: keyof TimelineSegment, value: any) => {
    const updatedTimeline = timeline.map((segment) =>
      segment.id === id ? { ...segment, [field]: value } : segment,
    );

    onTimelineChange(updatedTimeline);
  };

  // 타임스탬프 자동 계산
  useEffect(() => {
    if (timeline.length === 0) return;

    const updatedTimeline = timeline.map((segment, index) => {
      let startTime: number;
      let endTime: number;

      if (timeline.length === 1) {
        startTime = 0;
        endTime = 8;
      } else if (timeline.length === 2) {
        startTime = index * 4;
        endTime = (index + 1) * 4;
      } else if (timeline.length === 3) {
        if (index === 0) {
          startTime = 0;
          endTime = 3;
        } else if (index === 1) {
          startTime = 3;
          endTime = 5;
        } else {
          startTime = 5;
          endTime = 8;
        }
      } else {
        startTime = index * 2;
        endTime = (index + 1) * 2;
      }

      const timestamp = `${formatTime(startTime)}-${formatTime(endTime)}`;

      return {
        ...segment,
        timestamp,
        sequence: index + 1,
      };
    });

    onTimelineChange(updatedTimeline);
  }, [timeline.length]);

  // 시간 포맷팅 (초를 MM:SS 형식으로)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 폼 검증
  const validateForm = (): boolean => {
    const newErrors: Record<string, string[]> = {};

    timeline.forEach((segment, index) => {
      if (!segment.action.trim()) {
        if (!newErrors.actions) newErrors.actions = [];
        newErrors.actions.push(`세그먼트 ${index + 1}의 액션을 입력해주세요`);
      }

      if (!segment.audio.trim()) {
        if (!newErrors.audio) newErrors.audio = [];
        newErrors.audio.push(`세그먼트 ${index + 1}의 오디오를 입력해주세요`);
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      onNext();
    }
  };

  const isFormValid =
    timeline.length > 0 &&
    timeline.every((segment) => segment.action.trim() && segment.audio.trim());

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold text-gray-900">동적 타임라인 연출</h1>
        <p className="text-lg text-gray-600">
          영상의 시간적 흐름에 따른 연출을 구성하여 8초 영상을 만들어보세요
        </p>

        {/* 타임라인 정보 */}
        <div className="mx-auto max-w-md rounded-lg border border-primary-200 bg-primary-50 p-4">
          <div className="flex items-center justify-center gap-2 text-primary-700">
            <Clock className="h-5 w-5" />
            <span className="font-medium">총 영상 길이: 8초</span>
          </div>
          <div className="mt-2 text-sm text-primary-600">
            {timeline.length === 0 && '세그먼트를 추가하여 시작하세요'}
            {timeline.length === 1 && '각 세그먼트: 8초'}
            {timeline.length === 2 && '각 세그먼트: 4초씩'}
            {timeline.length === 3 && '세그먼트: 3초, 2초, 3초'}
            {timeline.length >= 4 && '각 세그먼트: 2초씩'}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 타임라인 세그먼트들 */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
              <Video className="h-5 w-5 text-primary-600" />
              타임라인 세그먼트
            </h2>
            <Button
              type="button"
              variant="outline"
              onClick={addSegment}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              세그먼트 추가
            </Button>
          </div>

          {timeline.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 py-16 text-center">
              <Video className="mx-auto mb-4 h-16 w-16 text-gray-400" />
              <p className="mb-2 text-lg text-gray-500">아직 타임라인 세그먼트가 없습니다</p>
              <p className="text-gray-400">+ 버튼을 클릭하여 첫 번째 세그먼트를 추가하세요</p>
            </div>
          ) : (
            <div className="space-y-6">
              {timeline.map((segment, index) => (
                <div key={segment.id} className="space-y-6 rounded-lg border border-gray-200 p-6">
                  {/* 세그먼트 헤더 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-800">
                        {segment.sequence}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">세그먼트 {segment.sequence}</h3>
                        <p className="text-sm text-gray-500">{segment.timestamp}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSegment(segment.id)}
                      leftIcon={<X className="h-4 w-4" />}
                    >
                      제거
                    </Button>
                  </div>

                  {/* 세그먼트 내용 */}
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* 왼쪽 컬럼: 액션과 오디오 */}
                    <div className="space-y-4">
                      {/* 액션 설명 */}
                      <div className="space-y-2">
                        <label
                          htmlFor={`segment-action-${segment.id}`}
                          className="block flex items-center gap-2 text-sm font-medium text-gray-700"
                        >
                          <Camera className="h-4 w-4" />
                          액션 설명 *
                        </label>
                        <textarea
                          id={`segment-action-${segment.id}`}
                          data-testid="textarea-action"
                          value={segment.action}
                          onChange={(e) => updateSegment(segment.id, 'action', e.target.value)}
                          placeholder="예: 와이드 샷: 두 팀이 가벼운 비 속에서 접근합니다. 가방이 건네지고 내용물을 확인하기 위해 클릭하여 열립니다."
                          rows={4}
                          className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 transition-colors focus:border-transparent focus:ring-2 focus:ring-primary-500"
                        />
                      </div>

                      {/* 오디오 설명 */}
                      <div className="space-y-2">
                        <label
                          htmlFor={`segment-audio-${segment.id}`}
                          className="block flex items-center gap-2 text-sm font-medium text-gray-700"
                        >
                          <Volume2 className="h-4 w-4" />
                          오디오 설명 *
                        </label>
                        <textarea
                          id={`segment-audio-${segment.id}`}
                          data-testid="textarea-audio"
                          value={segment.audio}
                          onChange={(e) => updateSegment(segment.id, 'audio', e.target.value)}
                          placeholder="예: 금속에 부딪히는 폭우, 낮은 천둥 소리, 멀리서 들리는 도시 사이렌, 지퍼 소리, 금속 걸쇠 클릭"
                          rows={3}
                          className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 transition-colors focus:border-transparent focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>

                    {/* 오른쪽 컬럼: 카메라 설정 */}
                    <div className="space-y-4">
                      {/* 카메라 앵글 */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          카메라 앵글
                        </label>
                        <select
                          value={segment.camera_angle || ''}
                          onChange={(e) =>
                            updateSegment(segment.id, 'camera_angle', e.target.value || undefined)
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 transition-colors focus:border-transparent focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">선택 안함</option>
                          {CAMERA_ANGLES.map((angle) => (
                            <option key={angle} value={angle}>
                              {angle}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 카메라 무빙 */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          카메라 무빙
                        </label>
                        <select
                          value={segment.camera_movement || ''}
                          onChange={(e) =>
                            updateSegment(
                              segment.id,
                              'camera_movement',
                              e.target.value || undefined,
                            )
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 transition-colors focus:border-transparent focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">선택 안함</option>
                          {CAMERA_MOVEMENTS.map((movement) => (
                            <option key={movement} value={movement}>
                              {movement}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 템포 */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">템포</label>
                        <select
                          value={segment.pacing || ''}
                          onChange={(e) =>
                            updateSegment(segment.id, 'pacing', e.target.value || undefined)
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 transition-colors focus:border-transparent focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">선택 안함</option>
                          {PACING_OPTIONS.map((pacing) => (
                            <option key={pacing} value={pacing}>
                              {pacing}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 음향 품질 */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">음향 품질</label>
                        <select
                          value={segment.audio_quality || ''}
                          onChange={(e) =>
                            updateSegment(segment.id, 'audio_quality', e.target.value || undefined)
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 transition-colors focus:border-transparent focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">선택 안함</option>
                          {AUDIO_QUALITY.map((quality) => (
                            <option key={quality} value={quality}>
                              {quality}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 에러 메시지 */}
        {Object.keys(errors).length > 0 && (
          <div className="space-y-2 rounded-lg border border-danger-200 bg-danger-50 p-4">
            {Object.entries(errors).map(([key, errorMessages]) =>
              errorMessages.map((message, index) => (
                <p key={`${key}-${index}`} className="text-sm text-danger-700">
                  {message}
                </p>
              )),
            )}
          </div>
        )}

        {/* 네비게이션 버튼 */}
        <div className="flex justify-between pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onPrevious}
            className="px-8 py-3 text-lg"
          >
            ← 이전 단계
          </Button>

          <Button type="submit" disabled={!isFormValid} className="px-8 py-3 text-lg">
            다음 단계 →
          </Button>
        </div>
      </form>
    </div>
  );
};
