import { useEffect, useRef, useState } from 'react';

export interface SeedanceStatus {
  status: string;
  progress?: number;
  videoUrl?: string;
}

export interface UseSeedancePollingOptions {
  initialIntervalMs?: number;
  maxIntervalMs?: number;
  backoffFactor?: number;
}

/**
 * Seedance 작업 ID 목록에 대한 상태 폴링 훅 (결정론적 백오프 포함)
 * Public API: features/seedance/status
 */
export function useSeedancePolling(
  jobIds: string[],
  options: UseSeedancePollingOptions = {}
) {
  const [statuses, setStatuses] = useState<Record<string, SeedanceStatus>>({});
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<number>(options.initialIntervalMs ?? 2000);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRef = useRef<boolean>(false);

  useEffect(() => {
    cancelRef.current = false;
    setError(null);

    if (!jobIds || jobIds.length === 0) {
      setStatuses({});
      return;
    }

    const maxInterval = options.maxIntervalMs ?? 10000;
    const backoff = options.backoffFactor ?? 1.3;
    intervalRef.current = options.initialIntervalMs ?? 2000;

    const pollOne = async (id: string) => {
      try {
        const res = await fetch(`/api/seedance/status/${encodeURIComponent(id)}`);
        const json = await res.json();
        if (!cancelRef.current) {
          setStatuses(prev => ({
            ...prev,
            [id]: {
              status: json.status,
              progress: json.progress,
              videoUrl: json.videoUrl,
            },
          }));
        }
      } catch (e: any) {
        if (!cancelRef.current) setError(e?.message || 'Seedance 상태 조회 실패');
      }
    };

    const tick = async () => {
      await Promise.all(jobIds.map(pollOne));
      if (cancelRef.current) return;
      timerRef.current = setTimeout(tick, intervalRef.current);
      intervalRef.current = Math.min(maxInterval, Math.floor(intervalRef.current * backoff));
    };

    tick();

    return () => {
      cancelRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(jobIds), options.initialIntervalMs, options.maxIntervalMs, options.backoffFactor]);

  return { statuses, error } as const;
}



