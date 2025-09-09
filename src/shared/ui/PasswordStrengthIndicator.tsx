'use client';

import React from 'react';
import { clsx } from 'clsx';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: PasswordRequirement[] = [
  {
    label: '최소 8자 이상',
    test: (password: string) => password.length >= 8,
  },
  {
    label: '대문자 포함',
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    label: '소문자 포함',
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    label: '숫자 포함',
    test: (password: string) => /[0-9]/.test(password),
  },
  {
    label: '특수문자 포함',
    test: (password: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  },
];

const calculateStrength = (password: string): number => {
  if (!password) return 0;
  
  let strength = 0;
  
  // Check each requirement
  requirements.forEach((req) => {
    if (req.test(password)) {
      strength++;
    }
  });

  // Map to 1-4 scale
  if (strength <= 2) return 1; // Weak
  if (strength === 3) return 2; // Fair
  if (strength === 4) return 3; // Good
  return 4; // Strong
};

const getStrengthLabel = (strength: number): string => {
  switch (strength) {
    case 1:
      return '약함';
    case 2:
      return '보통';
    case 3:
      return '좋음';
    case 4:
      return '강함';
    default:
      return '';
  }
};

const getStrengthColor = (strength: number): string => {
  switch (strength) {
    case 1:
      return 'bg-danger-500';
    case 2:
      return 'bg-warning-500';
    case 3:
      return 'bg-success-500';
    case 4:
      return 'bg-success-600';
    default:
      return 'bg-gray-600';
  }
};

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  showRequirements = false,
}) => {
  if (!password) return null;

  const strength = calculateStrength(password);
  const strengthLabel = getStrengthLabel(strength);
  const strengthColor = getStrengthColor(strength);

  return (
    <div className="space-y-2">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">비밀번호 강도</span>
          <span className={clsx(
            'text-xs font-medium',
            {
              'text-danger-400': strength === 1,
              'text-warning-400': strength === 2,
              'text-success-400': strength >= 3,
            }
          )}>
            {strengthLabel}
          </span>
        </div>
        <div
          className="h-2 bg-gray-700 rounded-full overflow-hidden"
          role="progressbar"
          aria-label="비밀번호 강도"
          aria-valuenow={strength}
          aria-valuemin={0}
          aria-valuemax={4}
        >
          <div
            data-testid="strength-indicator"
            className={clsx(
              'h-full transition-all duration-300',
              strengthColor
            )}
            style={{ width: `${(strength / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="space-y-1 mt-3">
          <p className="text-xs text-gray-400 mb-2">비밀번호 요구사항:</p>
          {requirements.map((req, index) => {
            const isMet = req.test(password);
            return (
              <div
                key={index}
                className={clsx(
                  'flex items-center gap-2 text-xs',
                  isMet ? 'text-success-400' : 'text-gray-500'
                )}
              >
                <span className={clsx(
                  'w-4 h-4 flex items-center justify-center rounded-full text-xs',
                  isMet ? 'bg-success-500/20 text-success-400' : 'bg-gray-700 text-gray-500'
                )}>
                  {isMet ? '✓' : '✗'}
                </span>
                <span>{req.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};