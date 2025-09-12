"use client";
import { useEffect, useState } from 'react';
import { safeFetch } from '@/shared/lib/api-retry';

type ProviderStatus = { name: string; key: string; healthy: boolean; latencyMs: number; failureRate: number };

export function AdminClient() {
  const [filters, setFilters] = useState({ status: 'all', provider: 'all', range: '7d', q: '' });
  const [results, setResults] = useState<{ videos: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: filters.status,
        provider: filters.provider,
        range: filters.range,
        q: filters.q,
      });
      const res = await safeFetch(`/api/admin/search?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      setResults({ videos: json.videos ?? [] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-10 space-y-8">
      <FilterBar value={filters} onChange={setFilters} onSearch={search} />
      <ProviderStatusSection />
      <ResultsTable loading={loading} data={results} />
      <RetryDemo />
    </div>
  );
}

function FilterBar({ value, onChange, onSearch }: { value: { status: string; provider: string; range: string; q: string }; onChange: (v: any) => void; onSearch: () => void }) {
  const { status, provider, range, q } = value;
  return (
    <section aria-labelledby="filters-heading" className="rounded-lg border p-4">
      <h2 id="filters-heading" className="mb-3 text-lg font-semibold">필터</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">검색어</span>
          <input className="rounded border px-3 py-2" value={q} onChange={(e) => onChange({ ...value, q: e.target.value })} placeholder="ID 등" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">상태</span>
          <select className="rounded border px-3 py-2" value={status} onChange={(e) => onChange({ ...value, status: e.target.value })}>
            <option value="all">전체</option>
            <option value="queued">대기중</option>
            <option value="processing">처리중</option>
            <option value="completed">완료</option>
            <option value="failed">실패</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">제공자</span>
          <select className="rounded border px-3 py-2" value={provider} onChange={(e) => onChange({ ...value, provider: e.target.value })}>
            <option value="all">전체</option>
            <option value="seedance">Seedance</option>
            <option value="veo3">Veo3</option>
            <option value="imagen">Imagen</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">기간</span>
          <select className="rounded border px-3 py-2" value={range} onChange={(e) => onChange({ ...value, range: e.target.value })}>
            <option value="7d">최근 7일</option>
            <option value="30d">최근 30일</option>
            <option value="90d">최근 90일</option>
          </select>
        </label>
        <div className="flex items-end">
          <button onClick={onSearch} className="rounded border px-3 py-2 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">검색</button>
        </div>
      </div>
    </section>
  );
}

function ProviderStatusSection() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await safeFetch('/api/admin/providers/health', { cache: 'no-store' });
        const json = await res.json();
        setProviders(json.providers ?? []);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <section aria-labelledby="provider-status-heading" className="rounded-lg border p-4">
      <h2 id="provider-status-heading" className="mb-3 text-lg font-semibold">외부 제공자 상태</h2>
      {loading ? (
        <p className="text-sm text-gray-600">로딩 중…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {providers.map((p) => (
            <div key={p.key} className="rounded border p-3">
              <div className="text-sm text-gray-600">{p.name}</div>
              <div className={`mt-1 text-lg font-semibold ${p.healthy ? 'text-green-700' : 'text-danger-700'}`}>
                {p.healthy ? '정상' : '장애'}
              </div>
              <div className="mt-1 text-xs text-gray-500">지연 {p.latencyMs}ms · 실패율 {p.failureRate}%</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ResultsTable({ loading, data }: { loading: boolean; data: { videos: any[] } | null }) {
  return (
    <section aria-labelledby="results-heading" className="rounded-lg border p-4">
      <h2 id="results-heading" className="mb-3 text-lg font-semibold">검색 결과</h2>
      {loading ? (
        <p className="text-sm text-gray-600">로딩 중…</p>
      ) : !data ? (
        <p className="text-sm text-gray-600">필터를 설정하고 검색을 실행하세요</p>
      ) : data.videos.length === 0 ? (
        <p className="text-sm text-gray-600">결과가 없습니다</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">ID</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">제공자</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">상태</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">버전</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">생성일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.videos.map((v) => (
                <tr key={v.id}>
                  <td className="px-3 py-2 font-mono text-xs">{v.id}</td>
                  <td className="px-3 py-2">{v.provider}</td>
                  <td className="px-3 py-2">{v.status}</td>
                  <td className="px-3 py-2">{v.version}</td>
                  <td className="px-3 py-2">{new Date(v.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RetryDemo() {
  const [videoId, setVideoId] = useState('test-id');
  const [message, setMessage] = useState<string | null>(null);

  const onRetry = async () => {
    setMessage(null);
    try {
      const res = await safeFetch(`/api/admin/video-assets/${encodeURIComponent(videoId)}/retry`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      if (!res.ok) throw new Error('failed');
      setMessage('재시도 요청 완료');
    } catch {
      setMessage('재시도 요청 실패');
    }
  };

  return (
    <section aria-labelledby="retry-demo-heading" className="rounded-lg border p-4">
      <h2 id="retry-demo-heading" className="mb-3 text-lg font-semibold">실패 영상 재시도(데모)</h2>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-40 rounded border px-3 py-2"
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
          aria-label="영상 ID"
        />
        <button onClick={onRetry} className="rounded border px-3 py-2 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">재시도</button>
        {message && <span role="status" className="text-sm text-gray-700">{message}</span>}
      </div>
    </section>
  );
}


