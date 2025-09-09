'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Logo, Button } from '@/shared/ui';
import { FormError } from '@/shared/ui/FormError';
import { VerificationCodeInput } from '@/shared/ui/VerificationCodeInput';
import { ResendEmailButton } from '@/shared/ui/ResendEmailButton';
import { EmailSentMessage } from '@/shared/ui/EmailSentMessage';

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'input' | 'sent'>('input');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // URL 파라미터에서 이메일 확인
  useEffect(() => {
    const emailParam = searchParams?.get('email');
    const sentParam = searchParams?.get('sent');
    
    if (emailParam) {
      setUserEmail(decodeURIComponent(emailParam));
    }
    
    if (sentParam === 'true') {
      setMode('sent');
    }
  }, [searchParams]);

  const handleCodeComplete = async (verificationCode: string) => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: verificationCode,
          email: userEmail || email,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        // 인증 성공 - 로그인 페이지로 이동
        router.push('/login?message=이메일 인증이 완료되었습니다. 로그인해주세요.');
      } else {
        setError(data.message || '잘못된 인증 코드입니다.');
        setCode(''); // 코드 초기화
      }
    } catch (error) {
      console.error('Verification error:', error);
      setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail || email }),
      });

      const data = await response.json();

      if (data.ok) {
        setMode('sent');
        setError('');
      } else {
        throw new Error(data.message || '이메일 전송에 실패했습니다.');
      }
    } catch (error) {
      console.error('Resend error:', error);
      throw error;
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await handleResendEmail();
      setUserEmail(email);
    } catch (error: any) {
      setError(error.message || '이메일 전송에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'sent') {
    return (
      <EmailSentMessage
        email={userEmail}
        title="인증 메일을 발송했습니다"
        description="이메일을 확인하고 인증 링크를 클릭하거나, 아래에서 인증 코드를 입력해주세요."
      >
        <div className="space-y-4">
          <ResendEmailButton
            onResend={handleResendEmail}
            className="w-full"
            variant="ghost"
          />
          
          <Button
            onClick={() => setMode('input')}
            variant="secondary"
            className="w-full"
            size="lg"
          >
            인증 코드 직접 입력
          </Button>
        </div>
      </EmailSentMessage>
    );
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-8 shadow-2xl border border-gray-700">
      {userEmail ? (
        // 인증 코드 입력 모드
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-white mb-2">
              인증 코드 입력
            </h2>
            <p className="text-gray-400">
              {userEmail}로 발송된 6자리 인증 코드를 입력해주세요
            </p>
          </div>

          <VerificationCodeInput
            onChange={setCode}
            onComplete={handleCodeComplete}
            disabled={loading}
            error={!!error}
          />

          {/* 에러 메시지 */}
          <FormError>{error}</FormError>

          {/* 재전송 버튼 */}
          <div className="pt-4 border-t border-gray-700">
            <p className="text-center text-sm text-gray-400 mb-4">
              인증 코드를 받지 못하셨나요?
            </p>
            <ResendEmailButton
              onResend={handleResendEmail}
              className="w-full"
              variant="secondary"
            />
          </div>

          {/* 이메일 변경 */}
          <div className="text-center">
            <button
              onClick={() => {
                setUserEmail('');
                setEmail('');
                setMode('input');
              }}
              className="text-sm text-brand-400 hover:text-brand-300"
            >
              다른 이메일로 인증하기
            </button>
          </div>
        </div>
      ) : (
        // 이메일 입력 모드
        <form onSubmit={handleEmailSubmit} className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-white mb-2">
              이메일 인증
            </h2>
            <p className="text-gray-400">
              회원가입 시 입력한 이메일 주소를 입력해주세요
            </p>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              이메일 주소
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>

          {/* 에러 메시지 */}
          <FormError>{error}</FormError>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading}
          >
            {loading ? '전송 중...' : '인증 메일 받기'}
          </Button>
        </form>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <Logo size="xl" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">이메일 인증</h1>
          <p className="text-gray-400 mt-2">계정을 활성화하려면 이메일을 인증해주세요</p>
        </div>

        {/* 인증 폼 */}
        <Suspense fallback={
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-8 shadow-2xl border border-gray-700 animate-pulse">
            <div className="h-32"></div>
          </div>
        }>
          <VerifyEmailForm />
        </Suspense>

        {/* 하단 링크 */}
        <div className="mt-8 text-center space-y-2">
          <Link href="/login" className="text-gray-400 hover:text-white text-sm block">
            로그인 페이지로
          </Link>
          <Link href="/" className="text-gray-400 hover:text-white text-sm block">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}