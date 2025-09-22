/**
 * Input Component
 *
 * CLAUDE.md 준수사항:
 * - WCAG 2.1 AA 접근성 준수
 * - 검증 상태 지원 (성공, 경고, 오류)
 * - 200ms 이하 애니메이션
 * - 임의값 사용 금지
 * - data-testid 네이밍 규약
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ComponentProps } from 'react';

// Input variants 정의
const inputVariants = cva(
  [
    'block w-full rounded-lg border',
    'transition-all duration-150 ease-out',
    'placeholder-neutral-400',
    'focus:outline-none focus:ring-2 focus:ring-offset-1',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-50',
  ],
  {
    variants: {
      // 크기 variant
      size: {
        sm: 'px-3 py-2 text-sm',
        md: 'px-4 py-2.5 text-base',
        lg: 'px-4 py-3 text-lg',
      },
      // 상태 variant
      status: {
        default: [
          'border-neutral-300 bg-white text-neutral-900',
          'hover:border-neutral-400',
          'focus:border-primary-500 focus:ring-primary-200',
        ],
        success: [
          'border-success-500 bg-white text-neutral-900',
          'focus:border-success-600 focus:ring-success-200',
        ],
        warning: [
          'border-warning-500 bg-white text-neutral-900',
          'focus:border-warning-600 focus:ring-warning-200',
        ],
        error: [
          'border-error-500 bg-white text-neutral-900',
          'focus:border-error-600 focus:ring-error-200',
        ],
      },
    },
    defaultVariants: {
      size: 'md',
      status: 'default',
    },
  }
);

// Label variants
const labelVariants = cva([
  'block text-sm font-medium mb-2',
  'text-neutral-700',
]);

// Helper text variants
const helperTextVariants = cva(
  ['text-xs mt-1'],
  {
    variants: {
      status: {
        default: 'text-neutral-600',
        success: 'text-success-600',
        warning: 'text-warning-600',
        error: 'text-error-600',
      },
    },
    defaultVariants: {
      status: 'default',
    },
  }
);

// Input Props 타입 정의
export interface InputProps
  extends Omit<ComponentProps<'input'>, 'size'>,
    VariantProps<typeof inputVariants> {
  /** 입력 필드 라벨 */
  label?: string;
  /** 도움말 텍스트 */
  helperText?: string;
  /** 오류 메시지 */
  errorMessage?: string;
  /** 성공 메시지 */
  successMessage?: string;
  /** 경고 메시지 */
  warningMessage?: string;
  /** 왼쪽 아이콘 */
  leftIcon?: React.ReactNode;
  /** 오른쪽 아이콘 */
  rightIcon?: React.ReactNode;
  /** 테스트를 위한 data-testid */
  'data-testid'?: string;
}

/**
 * Input 컴포넌트
 *
 * @example
 * ```tsx
 * // 기본 사용법
 * <Input label="이메일" placeholder="이메일을 입력하세요" />
 *
 * // 오류 상태
 * <Input
 *   label="비밀번호"
 *   status="error"
 *   errorMessage="비밀번호는 8자 이상이어야 합니다"
 * />
 *
 * // 아이콘과 함께
 * <Input
 *   label="검색"
 *   leftIcon={<SearchIcon />}
 *   placeholder="검색어를 입력하세요"
 * />
 * ```
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      size,
      status: statusProp,
      label,
      helperText,
      errorMessage,
      successMessage,
      warningMessage,
      leftIcon,
      rightIcon,
      disabled,
      required,
      id,
      'data-testid': dataTestId,
      ...props
    },
    ref
  ) => {
    // 상태 결정 (오류 > 경고 > 성공 > 기본 순서)
    const status = errorMessage
      ? 'error'
      : warningMessage
      ? 'warning'
      : successMessage
      ? 'success'
      : statusProp || 'default';

    // 표시할 메시지 결정
    const displayMessage = errorMessage || warningMessage || successMessage || helperText;

    // 고유 ID 생성
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const helperTextId = `${inputId}-helper`;

    return (
      <div className="w-full">
        {/* 라벨 */}
        {label && (
          <label htmlFor={inputId} className={labelVariants()}>
            {label}
            {required && (
              <span className="text-error-500 ml-1" aria-label="필수 입력">
                *
              </span>
            )}
          </label>
        )}

        {/* 입력 필드 컨테이너 */}
        <div className="relative">
          {/* 왼쪽 아이콘 */}
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-neutral-400" aria-hidden="true">
                {leftIcon}
              </span>
            </div>
          )}

          {/* 입력 필드 */}
          <input
            ref={ref}
            id={inputId}
            className={inputVariants({
              size,
              status,
              className: [
                leftIcon && 'pl-10',
                rightIcon && 'pr-10',
                className,
              ].filter(Boolean).join(' '),
            })}
            disabled={disabled}
            required={required}
            aria-invalid={status === 'error'}
            aria-describedby={displayMessage ? helperTextId : undefined}
            data-testid={dataTestId || 'ui-input'}
            {...props}
          />

          {/* 오른쪽 아이콘 */}
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span
                className={
                  status === 'error'
                    ? 'text-error-500'
                    : status === 'warning'
                    ? 'text-warning-500'
                    : status === 'success'
                    ? 'text-success-500'
                    : 'text-neutral-400'
                }
                aria-hidden="true"
              >
                {rightIcon}
              </span>
            </div>
          )}

          {/* 상태 아이콘 (기본 제공) */}
          {!rightIcon && (status === 'error' || status === 'warning' || status === 'success') && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              {status === 'error' && (
                <svg
                  className="w-5 h-5 text-error-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
              {status === 'warning' && (
                <svg
                  className="w-5 h-5 text-warning-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              )}
              {status === 'success' && (
                <svg
                  className="w-5 h-5 text-success-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
            </div>
          )}
        </div>

        {/* 도움말/오류 메시지 */}
        {displayMessage && (
          <p
            id={helperTextId}
            className={helperTextVariants({ status })}
            role={status === 'error' ? 'alert' : undefined}
          >
            {displayMessage}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Textarea 컴포넌트
export interface TextareaProps
  extends Omit<ComponentProps<'textarea'>, 'size'>,
    Pick<InputProps, 'size' | 'status' | 'label' | 'helperText' | 'errorMessage' | 'successMessage' | 'warningMessage'> {
  /** 최소 행 수 */
  rows?: number;
  /** 자동 리사이즈 */
  autoResize?: boolean;
  /** 테스트를 위한 data-testid */
  'data-testid'?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      size,
      status: statusProp,
      label,
      helperText,
      errorMessage,
      successMessage,
      warningMessage,
      disabled,
      required,
      id,
      rows = 3,
      autoResize = false,
      'data-testid': dataTestId,
      onChange,
      ...props
    },
    ref
  ) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // 상태 결정
    const status = errorMessage
      ? 'error'
      : warningMessage
      ? 'warning'
      : successMessage
      ? 'success'
      : statusProp || 'default';

    const displayMessage = errorMessage || warningMessage || successMessage || helperText;
    const inputId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const helperTextId = `${inputId}-helper`;

    // 자동 리사이즈 처리
    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoResize) {
        const textarea = event.target;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
      onChange?.(event);
    };

    return (
      <div className="w-full">
        {/* 라벨 */}
        {label && (
          <label htmlFor={inputId} className={labelVariants()}>
            {label}
            {required && (
              <span className="text-error-500 ml-1" aria-label="필수 입력">
                *
              </span>
            )}
          </label>
        )}

        {/* 텍스트 영역 */}
        <textarea
          ref={ref || textareaRef}
          id={inputId}
          className={inputVariants({ size, status, className })}
          disabled={disabled}
          required={required}
          rows={rows}
          aria-invalid={status === 'error'}
          aria-describedby={displayMessage ? helperTextId : undefined}
          data-testid={dataTestId || 'ui-textarea'}
          onChange={handleChange}
          style={autoResize ? { resize: 'none', overflow: 'hidden' } : undefined}
          {...props}
        />

        {/* 도움말/오류 메시지 */}
        {displayMessage && (
          <p
            id={helperTextId}
            className={helperTextVariants({ status })}
            role={status === 'error' ? 'alert' : undefined}
          >
            {displayMessage}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// Select 컴포넌트
export interface SelectProps
  extends Omit<ComponentProps<'select'>, 'size'>,
    Pick<InputProps, 'size' | 'status' | 'label' | 'helperText' | 'errorMessage' | 'successMessage' | 'warningMessage'> {
  /** 테스트를 위한 data-testid */
  'data-testid'?: string;
  /** 자식 option 요소들 */
  children: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      size,
      status: statusProp,
      label,
      helperText,
      errorMessage,
      successMessage,
      warningMessage,
      disabled,
      required,
      id,
      'data-testid': dataTestId,
      children,
      ...props
    },
    ref
  ) => {
    // 상태 결정
    const status = errorMessage
      ? 'error'
      : warningMessage
      ? 'warning'
      : successMessage
      ? 'success'
      : statusProp || 'default';

    const displayMessage = errorMessage || warningMessage || successMessage || helperText;
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
    const helperTextId = `${selectId}-helper`;

    return (
      <div className="w-full">
        {/* 라벨 */}
        {label && (
          <label htmlFor={selectId} className={labelVariants()}>
            {label}
            {required && (
              <span className="text-error-500 ml-1" aria-label="필수 선택">
                *
              </span>
            )}
          </label>
        )}

        {/* 셀렉트 박스 */}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={inputVariants({
              size,
              status,
              className: [
                'pr-10 appearance-none bg-white',
                className,
              ].filter(Boolean).join(' '),
            })}
            disabled={disabled}
            required={required}
            aria-invalid={status === 'error'}
            aria-describedby={displayMessage ? helperTextId : undefined}
            data-testid={dataTestId || 'ui-select'}
            {...props}
          >
            {children}
          </select>

          {/* 화살표 아이콘 */}
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg
              className="w-5 h-5 text-neutral-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {/* 도움말/오류 메시지 */}
        {displayMessage && (
          <p
            id={helperTextId}
            className={helperTextVariants({ status })}
            role={status === 'error' ? 'alert' : undefined}
          >
            {displayMessage}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';