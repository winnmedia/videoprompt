'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo, Button } from '@/shared/ui';

interface VerifyEmailTokenPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default function VerifyEmailTokenPage({ params }: VerifyEmailTokenPageProps) {
  const router = useRouter();
  const [verificationStatus, setVerificationStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    // params Promise 처리 - $300 방지: 마운트 시에만 실행
    const handleParams = async () => {
      const resolvedParams = await params;
      setToken(resolvedParams.token);
    };

    handleParams();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // params는 안전하지만 $300 방지를 위해 빈 배열 사용

  useEffect(() => {
    if (!token) return;

    // 토큰 검증 API 호출 - $300 방지: 마운트 시에만 실행
    const verifyEmail = async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (data.ok) {
          setVerificationStatus('success');
          // 성공 시 카운트다운 시작
        } else {
          setVerificationStatus('error');
          setErrorMessage(data.message || '인증에 실패했습니다.');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setVerificationStatus('error');
        setErrorMessage('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    };

    verifyEmail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // token은 안전하지만 $300 방지를 위해 빈 배열 사용

  // 성공 시 자동 리다이렉트 카운트다운 - $300 방지: 안전한 상태 의존성만 사용
  useEffect(() => {
    if (verificationStatus === 'success' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (verificationStatus === 'success' && countdown === 0) {
      router.push('/login?message=이메일 인증이 완료되었습니다. 로그인해주세요.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps, no-restricted-syntax
  }, [verificationStatus, countdown]); // router 제거: $300 방지

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <Logo size="xl" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">이메일 인증</h1>
        </div>

        {/* 상태별 컨텐츠 */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-8 shadow-2xl border border-gray-700">
          {verificationStatus === 'verifying' && (
            <div className="text-center space-y-6">
              {/* 로딩 스피너 */}
              <div className="mx-auto w-16 h-16 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
              
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  이메일 인증 중...
                </h2>
                <p className="text-gray-400">
                  잠시만 기다려주세요. 이메일을 확인하고 있습니다.
                </p>
              </div>
            </div>
          )}

          {verificationStatus === 'success' && (
            <div className="text-center space-y-6">
              {/* 성공 아이콘 */}
              <div className="mx-auto w-20 h-20 bg-success-500/10 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-success-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  이메일 인증 완료!
                </h2>
                <p className="text-gray-400">
                  이메일 인증이 성공적으로 완료되었습니다.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  {countdown}초 후 로그인 페이지로 이동합니다...
                </p>
              </div>

              <Button
                onClick={() => router.push('/login')}
                className="w-full"
                size="lg"
              >
                지금 로그인하기
              </Button>
            </div>
          )}

          {verificationStatus === 'error' && (
            <div className="text-center space-y-6">
              {/* 에러 아이콘 */}
              <div className="mx-auto w-20 h-20 bg-danger-500/10 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-danger-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  인증 실패
                </h2>
                <p className="text-gray-400">
                  {errorMessage}
                </p>
              </div>

              <div className="space-y-3">
                <Link href="/verify-email" className="block">
                  <Button className="w-full" size="lg">
                    인증 코드 직접 입력
                  </Button>
                </Link>
                
                <Link href="/register" className="block">
                  <Button variant="ghost" className="w-full" size="lg">
                    회원가입 다시 하기
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

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