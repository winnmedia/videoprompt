'use client';

import React from 'react';
import { clsx } from 'clsx';

interface EmailSentMessageProps {
  email?: string;
  title?: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

export function EmailSentMessage({
  email,
  title = '이메일을 확인해주세요',
  description,
  className,
  children,
}: EmailSentMessageProps) {
  const defaultDescription = email
    ? `${email}로 인증 메일을 발송했습니다. 이메일을 확인하고 인증 링크를 클릭해주세요.`
    : '인증 메일을 발송했습니다. 이메일을 확인하고 인증 링크를 클릭해주세요.';

  return (
    <div
      className={clsx(
        'bg-gray-800/50 backdrop-blur-lg rounded-xl p-8 border border-gray-700',
        'text-center space-y-4',
        className
      )}
    >
      {/* 이메일 아이콘 */}
      <div className="mx-auto w-20 h-20 bg-brand-500/10 rounded-full flex items-center justify-center">
        <svg
          className="w-10 h-10 text-brand-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>

      {/* 제목 */}
      <h2 className="text-2xl font-bold text-white">{title}</h2>

      {/* 설명 */}
      <p className="text-gray-400 max-w-md mx-auto">
        {description || defaultDescription}
      </p>

      {/* 이메일 표시 */}
      {email && (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700/50 rounded-lg">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
            />
          </svg>
          <span className="text-white font-medium">{email}</span>
        </div>
      )}

      {/* 추가 콘텐츠 */}
      {children && <div className="mt-6">{children}</div>}

      {/* 안내 메시지 */}
      <div className="mt-8 p-4 bg-gray-700/30 rounded-lg border border-gray-600">
        <p className="text-sm text-gray-400">
          이메일이 도착하지 않았나요?
        </p>
        <ul className="mt-2 text-xs text-gray-500 space-y-1">
          <li>• 스팸 폴더를 확인해주세요</li>
          <li>• 이메일 주소가 올바른지 확인해주세요</li>
          <li>• 몇 분 후에 다시 시도해주세요</li>
        </ul>
      </div>
    </div>
  );
}