'use client';

import React, { useState } from 'react';
import { generateVerificationTemplate, generatePasswordResetTemplate, generateWelcomeTemplate } from '@/lib/email/templates';

type EmailType = 'verification' | 'password_reset' | 'welcome';

export default function EmailPreviewPage() {
  const [emailType, setEmailType] = useState<EmailType>('verification');
  const [recipientName, setRecipientName] = useState('홍길동');
  const [recipientEmail, setRecipientEmail] = useState('test@example.com');

  const generateSampleData = () => {
    const baseData = {
      recipientName,
      appName: 'VLANET',
      appUrl: 'https://vridge.kr',
      supportEmail: 'support@vlanet.net',
      year: new Date().getFullYear(),
    };

    switch (emailType) {
      case 'verification':
        return {
          ...baseData,
          verificationLink: 'https://vridge.kr/verify-email/sample-token-123456',
          verificationCode: '123456',
          expiresIn: '24시간',
        };
      case 'password_reset':
        return {
          ...baseData,
          resetLink: 'https://vridge.kr/reset-password/sample-token-123456',
          resetCode: '789012',
          expiresIn: '1시간',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        };
      case 'welcome':
        return {
          ...baseData,
          dashboardLink: 'https://vridge.kr/dashboard',
          gettingStartedLink: 'https://vridge.kr/getting-started',
          features: [
            {
              title: 'AI 시나리오 생성',
              description: '아이디어만 입력하면 완성된 시나리오를 받아보세요',
            },
            {
              title: '프롬프트 최적화',
              description: '영상 생성에 최적화된 프롬프트를 AI가 만들어 드려요',
            },
            {
              title: '빠른 영상 생성',
              description: '몇 분 만에 전문가급 영상을 만들 수 있어요',
            },
          ],
        };
    }
  };

  const generateTemplate = () => {
    const data = generateSampleData();
    
    switch (emailType) {
      case 'verification':
        return generateVerificationTemplate(data as any);
      case 'password_reset':
        return generatePasswordResetTemplate(data as any);
      case 'welcome':
        return generateWelcomeTemplate(data as any);
    }
  };

  const template = generateTemplate();

  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">접근 제한</h1>
          <p className="text-gray-600">이메일 미리보기는 개발 환경에서만 사용할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">이메일 템플릿 미리보기</h1>
              <p className="text-gray-600 mt-1">개발 환경에서 이메일 템플릿을 확인하세요</p>
            </div>
            <a
              href="/"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              홈으로 돌아가기
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">설정</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이메일 유형
                  </label>
                  <select
                    value={emailType}
                    onChange={(e) => setEmailType(e.target.value as EmailType)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                  >
                    <option value="verification">이메일 인증</option>
                    <option value="password_reset">비밀번호 재설정</option>
                    <option value="welcome">환영 메시지</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    받는 사람 이름
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    받는 사람 이메일
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="mt-6 pt-6 border-t">
                <div className="text-sm text-gray-600">
                  <p className="font-medium">제목:</p>
                  <p className="mt-1 break-words">{template.subject}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">HTML 미리보기</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                          printWindow.document.write(template.html);
                          printWindow.document.close();
                        }
                      }}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                    >
                      새 창에서 보기
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="border rounded-lg overflow-hidden" style={{ height: '600px' }}>
                  <iframe
                    srcDoc={template.html}
                    className="w-full h-full border-0"
                    title="Email Preview"
                  />
                </div>
              </div>
            </div>

            {/* Text Version */}
            <div className="bg-white rounded-lg shadow mt-6">
              <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-medium text-gray-900">텍스트 버전</h3>
              </div>
              <div className="p-6">
                <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-4 rounded border overflow-auto max-h-96">
                  {template.text}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}