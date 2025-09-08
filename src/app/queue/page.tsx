'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

interface QueueItem {
  id: string;
  type: 'video' | 'image';
  prompt: string;
  provider: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  priority: number;
  progress?: number;
  estimatedTime?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  resultUrl?: string;
  error?: string;
}

export default function QueuePage() {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  });

  // 큐 데이터 로드
  useEffect(() => {
    loadQueueData();
    // 10초마다 자동 새로고침
    const interval = setInterval(loadQueueData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadQueueData = async () => {
    try {
      const response = await fetch('/api/queue/list', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          setQueueItems(data.data.items);
          setStats(data.data.stats);
        }
      }
    } catch (error) {
      console.error('Queue data load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (itemId: string) => {
    try {
      const response = await fetch(`/api/queue/retry/${itemId}`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        loadQueueData(); // 데이터 새로고침
      }
    } catch (error) {
      console.error('Retry error:', error);
    }
  };

  const handleCancel = async (itemId: string) => {
    if (!confirm('이 작업을 취소하시겠습니까?')) return;
    
    try {
      const response = await fetch(`/api/queue/cancel/${itemId}`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        loadQueueData(); // 데이터 새로고침
      }
    } catch (error) {
      console.error('Cancel error:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'queued':
        return '대기중';
      case 'processing':
        return '처리중';
      case 'completed':
        return '완료';
      case 'failed':
        return '실패';
      default:
        return status;
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ko-KR');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Icon name="spinner" size="xl" className="mx-auto mb-4" />
          <p className="text-gray-600">큐 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">영상 처리 큐 관리</h1>
              <p className="mt-2 text-gray-600">영상 생성 작업의 진행 상황을 모니터링합니다</p>
            </div>
            <Button onClick={loadQueueData} variant="outline">
              <Icon name="refresh-cw" className="mr-2 h-4 w-4" />
              새로고침
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* 통계 카드 */}
        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon name="projects" className="h-8 w-8 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">전체</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.total}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon name="clock" className="h-8 w-8 text-yellow-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">대기중</dt>
                    <dd className="text-lg font-medium text-yellow-600">{stats.queued}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon name="loading" className="h-8 w-8 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">처리중</dt>
                    <dd className="text-lg font-medium text-blue-600">{stats.processing}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon name="check-circle" className="h-8 w-8 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">완료</dt>
                    <dd className="text-lg font-medium text-green-600">{stats.completed}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon name="error" className="h-8 w-8 text-red-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">실패</dt>
                    <dd className="text-lg font-medium text-red-600">{stats.failed}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 큐 아이템 리스트 */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">처리 큐</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              최근 작업부터 표시됩니다. 자동으로 10초마다 업데이트됩니다.
            </p>
          </div>

          {queueItems.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="projects" size="xl" className="mx-auto mb-4 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">처리할 작업이 없습니다</h3>
              <p className="mt-1 text-sm text-gray-500">영상 생성을 시작하면 여기에 표시됩니다.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {queueItems.map((item) => (
                <li key={item.id} className="px-4 py-6 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Icon
                          name={item.type === 'video' ? 'video' : 'image'}
                          className="h-8 w-8 text-gray-400"
                        />
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-gray-900">
                            {item.prompt.length > 100 
                              ? `${item.prompt.slice(0, 100)}...` 
                              : item.prompt
                            }
                          </p>
                          <span
                            className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}
                          >
                            {getStatusText(item.status)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                          <span>제공자: {item.provider}</span>
                          <span>우선순위: {item.priority}</span>
                          <span>생성일: {formatTime(item.createdAt)}</span>
                          {item.estimatedTime && (
                            <span>예상 시간: {formatDuration(item.estimatedTime)}</span>
                          )}
                        </div>
                        
                        {/* 진행률 표시 */}
                        {item.status === 'processing' && item.progress !== undefined && (
                          <div className="mt-2">
                            <div className="flex items-center">
                              <div className="w-32 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${item.progress}%` }}
                                ></div>
                              </div>
                              <span className="ml-2 text-sm text-gray-600">{item.progress}%</span>
                            </div>
                          </div>
                        )}

                        {/* 에러 메시지 */}
                        {item.status === 'failed' && item.error && (
                          <div className="mt-2">
                            <p className="text-sm text-red-600">오류: {item.error}</p>
                          </div>
                        )}

                        {/* 완료된 결과 */}
                        {item.status === 'completed' && item.resultUrl && (
                          <div className="mt-2">
                            <a
                              href={item.resultUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              결과 보기 →
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex space-x-2">
                      {item.status === 'failed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(item.id)}
                        >
                          재시도
                        </Button>
                      )}
                      {(item.status === 'queued' || item.status === 'processing') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancel(item.id)}
                        >
                          취소
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}