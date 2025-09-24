/**
 * LoginPage - 로그인 페이지
 * 사용자 인증을 위한 로그인 페이지
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/shared/ui';
import { useAuth } from '@/features/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginAsGuest, isLoading, error, clearError } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleInputChange =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));

      if (error) {
        clearError();
      }
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await login(formData);
      router.push('/dashboard');
    } catch (error) {
      // 에러는 useAuth에서 처리됨
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* 로고 */}
        <div className="text-center">
          <h1 className="mb-2 text-3xl font-bold text-blue-600">VideoPlanet</h1>
          <h2 className="text-xl text-gray-900">계정에 로그인하기</h2>
        </div>

        {/* 로그인 폼 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">로그인</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="이메일"
                type="email"
                placeholder="이메일을 입력하세요"
                value={formData.email}
                onChange={handleInputChange('email')}
                disabled={isLoading}
                required
              />

              <Input
                label="비밀번호"
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={formData.password}
                onChange={handleInputChange('password')}
                showPasswordToggle
                disabled={isLoading}
                required
              />

              {/* 에러 메시지 */}
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                loading={isLoading}
                disabled={isLoading}
              >
                로그인
              </Button>
            </form>

            {/* 추가 옵션 */}
            <div className="mt-6 space-y-4">
              <div className="text-center">
                <Link
                  href="/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                >
                  비밀번호를 잊으셨나요?
                </Link>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">또는</span>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <Link href="/register">
                  <Button variant="outline" className="w-full">
                    회원가입
                  </Button>
                </Link>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={async () => {
                    try {
                      await loginAsGuest();
                      router.push('/dashboard');
                    } catch (error) {
                      console.error('게스트 로그인 실패:', error);
                    }
                  }}
                  disabled={isLoading}
                >
                  게스트로 체험하기
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 홈으로 돌아가기 */}
        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
          >
            ← 홈페이지로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
