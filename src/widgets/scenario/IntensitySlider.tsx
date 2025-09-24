'use client';

/**
 * 전개 강도 슬라이더 위젯
 * 시나리오의 감정적 강도를 시각적으로 조절
 */

import { useState, useRef, useCallback } from 'react';
import type { IntensityLevel } from '../../entities/scenario';
import { INTENSITY_LABELS, INTENSITY_DESCRIPTIONS } from '../../entities/scenario';

interface IntensitySliderProps {
  value: IntensityLevel;
  onChange: (value: IntensityLevel) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-describedby'?: string;
}

const INTENSITY_VALUES: IntensityLevel[] = ['low', 'medium', 'high'];
const INTENSITY_POSITIONS = [0, 50, 100]; // 슬라이더 위치 (%)

export function IntensitySlider({
  value,
  onChange,
  disabled = false,
  className = '',
  id,
  'aria-describedby': ariaDescribedBy,
}: IntensitySliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  // 현재 값의 인덱스
  const currentIndex = INTENSITY_VALUES.indexOf(value);
  const currentPosition = INTENSITY_POSITIONS[currentIndex];

  // 마우스/터치 위치에서 가장 가까운 강도 계산
  const getIntensityFromPosition = useCallback((clientX: number): IntensityLevel => {
    if (!sliderRef.current) return value;

    const rect = sliderRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));

    // 가장 가까운 위치 찾기
    let closestIndex = 0;
    let minDistance = Math.abs(percentage - INTENSITY_POSITIONS[0]);

    for (let i = 1; i < INTENSITY_POSITIONS.length; i++) {
      const distance = Math.abs(percentage - INTENSITY_POSITIONS[i]);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    return INTENSITY_VALUES[closestIndex];
  }, [value]);

  // 마우스 이벤트 핸들러
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (disabled) return;

    event.preventDefault();
    setIsDragging(true);

    const newValue = getIntensityFromPosition(event.clientX);
    if (newValue !== value) {
      onChange(newValue);
    }

    // 전역 마우스 이벤트 리스너
    const handleMouseMove = (e: MouseEvent) => {
      const newValue = getIntensityFromPosition(e.clientX);
      if (newValue !== value) {
        onChange(newValue);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [disabled, getIntensityFromPosition, onChange, value]);

  // 터치 이벤트 핸들러
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (disabled) return;

    event.preventDefault();
    setIsDragging(true);

    const touch = event.touches[0];
    const newValue = getIntensityFromPosition(touch.clientX);
    if (newValue !== value) {
      onChange(newValue);
    }

    // 전역 터치 이벤트 리스너
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const newValue = getIntensityFromPosition(touch.clientX);
      if (newValue !== value) {
        onChange(newValue);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  }, [disabled, getIntensityFromPosition, onChange, value]);

  // 키보드 이벤트 핸들러
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;

    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        newIndex = Math.max(0, currentIndex - 1);
        break;

      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        newIndex = Math.min(INTENSITY_VALUES.length - 1, currentIndex + 1);
        break;

      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;

      case 'End':
        event.preventDefault();
        newIndex = INTENSITY_VALUES.length - 1;
        break;

      default:
        return;
    }

    if (newIndex !== currentIndex) {
      onChange(INTENSITY_VALUES[newIndex]);
    }
  }, [disabled, currentIndex, onChange]);

  // 강도별 색상
  const getIntensityColor = (intensity: IntensityLevel): string => {
    switch (intensity) {
      case 'low':
        return 'bg-green-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'high':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // 그라데이션 생성
  const gradientBackground = `linear-gradient(
    to right,
    #10b981 0%,
    #10b981 33%,
    #eab308 33%,
    #eab308 66%,
    #ef4444 66%,
    #ef4444 100%
  )`;

  const sliderId = id || `intensity-slider-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 라벨 */}
      <div>
        <label
          htmlFor={sliderId}
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          전개 강도 선택
        </label>
        <div className="text-sm text-gray-600">
          현재 선택: <span className="font-semibold">{INTENSITY_LABELS[value]}</span>
        </div>
      </div>

      {/* 슬라이더 컨테이너 */}
      <div className="relative">
        {/* 슬라이더 트랙 */}
        <div
          ref={sliderRef}
          className={`
            relative h-6 rounded-full cursor-pointer
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          style={{ background: gradientBackground }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          role="presentation"
        >
          {/* 강도 마커들 */}
          {INTENSITY_POSITIONS.map((position, index) => (
            <div
              key={INTENSITY_VALUES[index]}
              className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full border-2 border-gray-300"
              style={{ left: `${position}%` }}
              aria-hidden="true"
            />
          ))}

          {/* 활성 핸들 */}
          <div
            className={`
              absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2
              w-6 h-6 rounded-full border-3 border-white shadow-lg cursor-grab
              transition-transform duration-150
              ${isDragging ? 'scale-110 cursor-grabbing' : 'hover:scale-105'}
              ${disabled ? 'cursor-not-allowed' : ''}
              ${getIntensityColor(value)}
            `}
            style={{ left: `${currentPosition}%` }}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-valuemin={0}
            aria-valuemax={2}
            aria-valuenow={currentIndex}
            aria-valuetext={INTENSITY_LABELS[value]}
            aria-describedby={ariaDescribedBy}
            id={sliderId}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* 강도 라벨들 */}
        <div className="flex justify-between mt-2">
          {INTENSITY_VALUES.map((intensity, index) => (
            <button
              key={intensity}
              type="button"
              onClick={() => !disabled && onChange(intensity)}
              disabled={disabled}
              className={`
                text-xs px-2 py-1 rounded transition-colors
                ${intensity === value
                  ? 'bg-blue-100 text-blue-800 font-semibold'
                  : 'text-gray-600 hover:text-gray-800'
                }
                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
              `}
              aria-label={`강도를 ${INTENSITY_LABELS[intensity]}로 설정`}
            >
              {INTENSITY_LABELS[intensity]}
            </button>
          ))}
        </div>
      </div>

      {/* 설명 */}
      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
        <strong>선택한 강도:</strong> {INTENSITY_DESCRIPTIONS[value]}
      </div>

      {/* 키보드 사용법 안내 (스크린 리더용) */}
      <div className="sr-only">
        화살표 키로 강도를 조절할 수 있습니다.
        왼쪽/아래쪽 화살표로 강도를 낮추고, 오른쪽/위쪽 화살표로 강도를 높입니다.
        Home 키로 최소 강도, End 키로 최대 강도로 이동합니다.
      </div>
    </div>
  );
}