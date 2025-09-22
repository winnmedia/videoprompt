/**
 * TimeDisplay Component
 * CLAUDE.md 준수: 접근성 WCAG 2.1 AA, 타입 안전성
 */

'use client';

import React from 'react';

export interface TimeDisplayProps {
  seconds: number;
  format?: 'mm:ss' | 'hh:mm:ss' | 'long' | 'short';
  className?: string;
  showIcon?: boolean;
  'data-testid'?: string;
}

export function TimeDisplay({
  seconds,
  format = 'mm:ss',
  className = '',
  showIcon = false,
  'data-testid': testId,
}: TimeDisplayProps) {
  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);

    switch (format) {
      case 'hh:mm:ss':
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      case 'mm:ss':
        const totalMinutes = Math.floor(totalSeconds / 60);
        return `${totalMinutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      case 'long':
        if (hours > 0) {
          return `${hours}시간 ${minutes}분 ${secs}초`;
        } else if (minutes > 0) {
          return `${minutes}분 ${secs}초`;
        } else {
          return `${secs}초`;
        }

      case 'short':
        if (hours > 0) {
          return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
          return `${minutes}m ${secs}s`;
        } else {
          return `${secs}s`;
        }

      default:
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  };

  const formattedTime = formatTime(seconds);
  const accessibleTime = `Duration: ${formattedTime}`;

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-sm ${className}`}
      title={accessibleTime}
      aria-label={accessibleTime}
      data-testid={testId}
    >
      {showIcon && (
        <svg
          className="w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}
      <span>{formattedTime}</span>
    </span>
  );
}

export default TimeDisplay;