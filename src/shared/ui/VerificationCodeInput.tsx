'use client';

import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

interface VerificationCodeInputProps {
  length?: number;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  testId?: string;
}

export function VerificationCodeInput({
  length = 6,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  className,
  testId,
}: VerificationCodeInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const code = values.join('');
    onChange(code);
    
    if (code.length === length && onComplete) {
      onComplete(code);
    }
  }, [values, length, onChange, onComplete]);

  const handleChange = (index: number, value: string) => {
    // 숫자만 허용
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newValues = [...values];
    newValues[index] = value;
    setValues(newValues);

    // 다음 입력 필드로 자동 포커스
    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace 처리
    if (e.key === 'Backspace' && !values[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    
    // 화살표 키 처리
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, length);
    const pastedValues = pastedData.split('').filter(char => /^\d$/.test(char));
    
    const newValues = [...values];
    pastedValues.forEach((value, index) => {
      if (index < length) {
        newValues[index] = value;
      }
    });
    
    setValues(newValues);
    
    // 마지막 입력된 필드 또는 마지막 필드로 포커스
    const focusIndex = Math.min(pastedValues.length, length - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  return (
    <div className={clsx('flex gap-2 justify-center', className)} data-testid={testId}>
      {values.map((value, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="\d{1}"
          maxLength={1}
          value={value}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          data-testid={testId ? `${testId}-input-${index}` : undefined}
          className={clsx(
            'w-12 h-14 text-center text-xl font-semibold rounded-lg transition-all',
            'bg-gray-700/50 border text-white placeholder-gray-400',
            'focus:outline-none focus:ring-2 focus:border-transparent',
            {
              'border-gray-600 focus:ring-brand-500': !error,
              'border-danger-500 focus:ring-danger-500': error,
              'opacity-50 cursor-not-allowed': disabled,
              'hover:border-gray-500': !disabled && !error,
            }
          )}
          placeholder="0"
        />
      ))}
    </div>
  );
}