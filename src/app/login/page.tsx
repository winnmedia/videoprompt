'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [idOrEmail, setIdOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const body: any = { password };
      if (idOrEmail.includes('@')) body.email = idOrEmail; else body.username = idOrEmail;
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (res.ok && json?.ok) setMessage('로그인 성공'); else setError(json?.error || '로그인 실패');
    } catch (e: any) {
      setError(e?.message || '네트워크 오류');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">로그인</h1>
      <form onSubmit={onSubmit} className="space-y-4" aria-busy={loading ? 'true' : 'false'} aria-live="polite">
        <div>
          <label className="block text-sm font-medium text-gray-700">이메일 또는 사용자명</label>
          <input value={idOrEmail} onChange={(e) => setIdOrEmail(e.target.value)} required className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">비밀번호</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary-500" />
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-md bg-primary-600 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50">{loading ? '처리 중...' : '로그인'}</button>
        {message && <p className="text-sm text-success-700">{message}</p>}
        {error && <p className="text-sm text-danger-700">{error}</p>}
      </form>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          계정이 없으신가요?{' '}
          <Link href="/register" className="font-medium text-primary-600 hover:text-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}


