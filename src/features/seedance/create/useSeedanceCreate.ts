import { useCallback, useState } from 'react';

export interface SeedanceCreatePayload {
  prompt: string;
  aspect_ratio?: string;
  duration_seconds?: number;
  webhook_url?: string;
  seed?: number;
  quality?: 'standard' | 'pro';
  model?: string; // e.g., 'seedance-1.0-pro'
}

/**
 * Seedance 작업 생성 훅
 * - Public API: features/seedance/create
 * - 단일/배치 생성 지원
 */
export function useSeedanceCreate() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOne = useCallback(async (payload: SeedanceCreatePayload): Promise<string> => {
    setError(null);
    const res = await fetch('/api/seedance/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json?.ok) throw new Error(json?.error || 'seedance create failed');
    const jobId = json.jobId || json.raw?.jobId || json.raw?.id || json?.data?.task_id || '';
    if (!jobId) throw new Error('missing jobId from seedance response');
    return jobId;
  }, []);

  const createBatch = useCallback(async (payloads: SeedanceCreatePayload[]): Promise<string[]> => {
    setIsCreating(true);
    setError(null);
    try {
      const results = await Promise.all(payloads.map(p => createOne(p)));
      return results.filter(Boolean);
    } catch (e: any) {
      setError(e?.message || 'Seedance 생성 실패');
      throw e;
    } finally {
      setIsCreating(false);
    }
  }, [createOne]);

  return { isCreating, error, createOne, createBatch } as const;
}


