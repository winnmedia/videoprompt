/**
 * Planning 유틸리티 함수
 * FSD Architecture - Features Layer
 */

import type { VideoItem } from '@/entities/planning';

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'text-green-600 bg-green-50 border-green-200';
    case 'processing': return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'in-progress': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'queued': return 'text-gray-600 bg-gray-50 border-gray-200';
    case 'failed': return 'text-red-600 bg-red-50 border-red-200';
    case 'draft': return 'text-gray-500 bg-gray-50 border-gray-300';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export const getStatusText = (status: string) => {
  switch (status) {
    case 'completed': return '완료됨';
    case 'processing': return '처리 중';
    case 'in-progress': return '진행 중';
    case 'queued': return '대기 중';
    case 'failed': return '실패';
    case 'draft': return '초안';
    default: return status;
  }
};

export const getProviderIcon = (provider: string) => {
  switch (provider) {
    case 'seedance': return '🎬';
    case 'veo3': return '🎥';
    case 'mock': return '🎭';
    default: return '📹';
  }
};

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  
  return date.toLocaleDateString('ko-KR', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

export const handleDownloadVideo = (video: VideoItem) => {
  if (!video.videoUrl) {
    alert('다운로드할 수 있는 비디오가 없습니다.');
    return;
  }
  
  // 다운로드 링크 생성 및 클릭
  const link = document.createElement('a');
  link.href = video.videoUrl;
  link.download = `${video.title}.mp4`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const calculateProgress = (status: string): number => {
  switch (status) {
    case 'completed': return 100;
    case 'processing': return 75;
    case 'in-progress': return 50;
    case 'queued': return 25;
    case 'failed': return 0;
    default: return 0;
  }
};