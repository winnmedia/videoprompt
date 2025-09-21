/**
 * Videos Library Page
 * 생성된 영상 목록 관리 페이지
 */

'use client';

import React, { useState, useEffect } from 'react';
import { logger } from '@/shared/lib/logger';
import { Button } from '@/shared/ui';
import { getPendingJobs, updateJobStatus, removeJobFromLocal } from '@/shared/hooks/useVideoPolling';

interface VideoJob {
  jobId: string;
  prompt: string;
  createdAt: string;
  status: string;
  videoUrl?: string;
  updatedAt?: string;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');

  // localStorage에서 영상 목록 로드
  useEffect(() => {
    const loadVideos = () => {
      try {
        const jobs = getPendingJobs();
        setVideos(jobs);
      } catch (error) {
        logger.error('Failed to load videos:', error instanceof Error ? error : new Error(String(error)));
      } finally {
        setLoading(false);
      }
    };

    loadVideos();
  }, []);

  // 필터링된 영상 목록
  const filteredVideos = videos.filter(video => {
    if (filter === 'all') return true;
    if (filter === 'completed') return video.status === 'completed';
    if (filter === 'pending') return video.status === 'queued' || video.status === 'processing';
    if (filter === 'failed') return video.status === 'failed';
    return true;
  });

  // 상태별 카운트
  const statusCounts = {
    all: videos.length,
    completed: videos.filter(v => v.status === 'completed').length,
    pending: videos.filter(v => v.status === 'queued' || v.status === 'processing').length,
    failed: videos.filter(v => v.status === 'failed').length,
  };

  // 영상 삭제
  const handleDeleteVideo = (jobId: string) => {
    if (confirm('이 영상을 삭제하시겠습니까?')) {
      removeJobFromLocal(jobId);
      setVideos(prev => prev.filter(v => v.jobId !== jobId));
    }
  };

  // 영상 상태 새로고침
  const handleRefreshStatus = async (jobId: string) => {
    try {
      const response = await fetch(`/api/seedance/status/${jobId}`);
      const data = await response.json();

      if (data.ok) {
        const newStatus = data.status;
        const videoUrl = data.videoUrl;

        // localStorage 업데이트
        updateJobStatus(jobId, newStatus, videoUrl);

        // 상태 업데이트
        setVideos(prev =>
          prev.map(video =>
            video.jobId === jobId
              ? { ...video, status: newStatus, videoUrl, updatedAt: new Date().toISOString() }
              : video
          )
        );
      }
    } catch (error) {
      logger.error('Failed to refresh status:', error instanceof Error ? error : new Error(String(error)));
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-gray-600">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">생성된 영상 목록</h1>
        <p className="text-gray-600">Seedance로 생성한 영상들을 관리하세요</p>
      </div>

      {/* 필터 탭 */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { key: 'all', label: `전체 (${statusCounts.all})` },
            { key: 'completed', label: `완료 (${statusCounts.completed})` },
            { key: 'pending', label: `진행중 (${statusCounts.pending})` },
            { key: 'failed', label: `실패 (${statusCounts.failed})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 영상 목록 */}
      {filteredVideos.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">
            {filter === 'all' ? '생성된 영상이 없습니다' : `${filter} 상태의 영상이 없습니다`}
          </div>
          <p className="text-gray-500 text-sm">
            워크플로우에서 영상을 생성해보세요
          </p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  프롬프트
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  생성일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업 ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVideos.map((video) => (
                <tr key={video.jobId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-md truncate">
                      {video.prompt}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      video.status === 'completed' ? 'bg-green-100 text-green-800' :
                      video.status === 'failed' ? 'bg-red-100 text-red-800' :
                      video.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {video.status === 'queued' && '대기중'}
                      {video.status === 'processing' && '생성중'}
                      {video.status === 'completed' && '완료'}
                      {video.status === 'failed' && '실패'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(video.createdAt).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                    {video.jobId}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    {video.status === 'completed' && video.videoUrl && (
                      <a
                        href={video.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        다운로드
                      </a>
                    )}

                    {(video.status === 'queued' || video.status === 'processing') && (
                      <button
                        onClick={() => handleRefreshStatus(video.jobId)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        새로고침
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteVideo(video.jobId)}
                      className="text-red-600 hover:text-red-800"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 하단 액션 */}
      <div className="mt-6 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          총 {filteredVideos.length}개의 영상
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/workflow'}
          >
            새 영상 생성
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setVideos(getPendingJobs());
            }}
          >
            목록 새로고침
          </Button>
        </div>
      </div>
    </div>
  );
}