/**
 * Video Polling Hook
 * 단순한 interval 기반 폴링으로 Seedance 영상 생성 상태 확인
 */

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/shared/lib/logger';

export interface VideoPollingResult {
  status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  progress?: number;
  error?: string;
  isPolling: boolean;
}

interface UseVideoPollingProps {
  jobId?: string;
  onComplete?: (videoUrl: string) => void;
  onError?: (error: string) => void;
  pollingInterval?: number; // ms
  maxPollingTime?: number; // ms
}

export const useVideoPolling = ({
  jobId,
  onComplete,
  onError,
  pollingInterval = 5000, // 5초
  maxPollingTime = 300000, // 5분
}: UseVideoPollingProps): VideoPollingResult => {
  const [result, setResult] = useState<VideoPollingResult>({
    status: 'idle',
    isPolling: false,
  });

  const pollStatus = useCallback(async (currentJobId: string) => {
    try {
      const response = await fetch(`/api/seedance/status/${currentJobId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.ok) {
        const newStatus = data.status as VideoPollingResult['status'];

        setResult(prev => ({
          ...prev,
          status: newStatus,
          videoUrl: data.videoUrl,
          progress: data.progress,
        }));

        // 완료 상태 처리
        if (newStatus === 'completed' && data.videoUrl) {
          onComplete?.(data.videoUrl);
          return 'completed';
        }

        // 실패 상태 처리
        if (newStatus === 'failed') {
          const error = data.error || '영상 생성이 실패했습니다.';
          setResult(prev => ({ ...prev, error }));
          onError?.(error);
          return 'failed';
        }

        return newStatus;
      } else {
        throw new Error(data.error || 'API 호출 실패');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      logger.debug('Video polling error:', errorMessage);

      setResult(prev => ({
        ...prev,
        status: 'failed',
        error: errorMessage,
        isPolling: false,
      }));

      onError?.(errorMessage);
      return 'failed';
    }
  }, [onComplete, onError]);

  useEffect(() => {
    if (!jobId) {
      setResult({ status: 'idle', isPolling: false });
      return;
    }

    // 폴링 시작
    setResult(prev => ({ ...prev, status: 'queued', isPolling: true }));

    const startTime = Date.now();
    let intervalId: NodeJS.Timeout;

    const startPolling = async () => {
      // 첫 번째 폴링 즉시 실행
      const status = await pollStatus(jobId);

      if (status === 'completed' || status === 'failed') {
        setResult(prev => ({ ...prev, isPolling: false }));
        return;
      }

      // 주기적 폴링 시작
      intervalId = setInterval(async () => {
        // 최대 폴링 시간 초과 확인
        if (Date.now() - startTime > maxPollingTime) {
          clearInterval(intervalId);
          setResult(prev => ({
            ...prev,
            status: 'failed',
            error: '영상 생성 시간이 초과되었습니다. 다시 시도해주세요.',
            isPolling: false,
          }));
          onError?.('영상 생성 시간이 초과되었습니다.');
          return;
        }

        const currentStatus = await pollStatus(jobId);

        if (currentStatus === 'completed' || currentStatus === 'failed') {
          clearInterval(intervalId);
          setResult(prev => ({ ...prev, isPolling: false }));
        }
      }, pollingInterval);
    };

    startPolling();

    // 클린업
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      setResult(prev => ({ ...prev, isPolling: false }));
    };
  }, [jobId, pollingInterval, maxPollingTime, pollStatus]);

  return result;
};

// localStorage 기반 작업 관리 유틸리티
export const saveJobToLocal = (jobId: string, prompt: string): void => {
  try {
    const jobs = JSON.parse(localStorage.getItem('videoJobs') || '[]');
    const newJob = {
      jobId,
      prompt,
      createdAt: new Date().toISOString(),
      status: 'queued',
    };

    jobs.push(newJob);
    localStorage.setItem('videoJobs', JSON.stringify(jobs));
  } catch (error) {
    logger.error('Failed to save job to localStorage:', error instanceof Error ? error : new Error(String(error)));
  }
};

export const getPendingJobs = (): Array<{
  jobId: string;
  prompt: string;
  createdAt: string;
  status: string;
}> => {
  try {
    return JSON.parse(localStorage.getItem('videoJobs') || '[]');
  } catch (error) {
    logger.error('Failed to get pending jobs from localStorage:', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
};

export const updateJobStatus = (jobId: string, status: string, videoUrl?: string): void => {
  try {
    const jobs = JSON.parse(localStorage.getItem('videoJobs') || '[]');
    const jobIndex = jobs.findIndex((job: any) => job.jobId === jobId);

    if (jobIndex >= 0) {
      jobs[jobIndex].status = status;
      jobs[jobIndex].updatedAt = new Date().toISOString();
      if (videoUrl) {
        jobs[jobIndex].videoUrl = videoUrl;
      }
      localStorage.setItem('videoJobs', JSON.stringify(jobs));
    }
  } catch (error) {
    logger.error('Failed to update job status in localStorage:', error instanceof Error ? error : new Error(String(error)));
  }
};

export const removeJobFromLocal = (jobId: string): void => {
  try {
    const jobs = JSON.parse(localStorage.getItem('videoJobs') || '[]');
    const filteredJobs = jobs.filter((job: any) => job.jobId !== jobId);
    localStorage.setItem('videoJobs', JSON.stringify(filteredJobs));
  } catch (error) {
    logger.error('Failed to remove job from localStorage:', error instanceof Error ? error : new Error(String(error)));
  }
};