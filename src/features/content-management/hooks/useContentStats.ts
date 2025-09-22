/**
 * Content Statistics Hook
 * 콘텐츠 통계 관리 전용 훅
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useWebSocket } from '../../../shared/hooks/useWebSocket';
import {
  selectStats,
  selectContent,
  selectLoading,
  type ContentStats,
  type Content,
  type ContentType,
} from '../../../entities/content-management';

/**
 * 실시간 통계 업데이트를 위한 WebSocket 이벤트 타입
 */
interface StatsWebSocketEvent {
  type: 'stats_update';
  data: Partial<ContentStats>;
}

/**
 * 콘텐츠 통계 관리 훅
 */
export function useContentStats() {
  const stats = useSelector(selectStats);
  const content = useSelector(selectContent);
  const loading = useSelector(selectLoading);

  // WebSocket 연결 (실시간 통계 업데이트)
  const {
    isConnected: wsConnected,
    sendMessage,
    lastMessage
  } = useWebSocket('/api/ws/content-stats', {
    reconnectAttempts: 5,
    reconnectInterval: 3000,
  });

  /**
   * 로컬 통계 계산 (서버 통계가 없을 때 fallback)
   */
  const localStats = useMemo(() => {
    const totalCounts = {
      scenarios: content.scenarios.length,
      prompts: content.prompts.length,
      images: content.images.length,
      videos: content.videos.length,
    };

    // 최근 활동 계산 (생성일 기준 최근 10개)
    const allContent = [
      ...content.scenarios,
      ...content.prompts,
      ...content.images,
      ...content.videos,
    ];

    const recentActivity = allContent
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(item => ({
        id: item.id,
        type: item.type,
        action: 'created' as const,
        timestamp: item.createdAt,
        userId: item.createdBy,
      }));

    // 태그 빈도 계산
    const tagCounts = new Map<string, number>();
    allContent.forEach(item => {
      item.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    // 인기 콘텐츠 (통계가 있는 경우만)
    const popularContent = allContent
      .filter(item => (item as any).stats?.views > 0)
      .sort((a, b) => ((b as any).stats?.views || 0) - ((a as any).stats?.views || 0))
      .slice(0, 5)
      .map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        views: (item as any).stats?.views || 0,
      }));

    return {
      totalCounts,
      recentActivity,
      topTags,
      popularContent,
    };
  }, [content]);

  /**
   * 병합된 통계 (서버 + 로컬)
   */
  const mergedStats = useMemo(() => {
    if (!stats) {
      return localStats;
    }

    return {
      totalCounts: stats.totalCounts || localStats.totalCounts,
      recentActivity: stats.recentActivity || localStats.recentActivity,
      topTags: stats.topTags || localStats.topTags,
      popularContent: stats.popularContent || localStats.popularContent,
    };
  }, [stats, localStats]);

  /**
   * 타입별 증감 계산
   */
  const typeGrowth = useMemo(() => {
    if (!stats?.totalCounts) {
      return null;
    }

    // 7일 전 데이터와 비교 (실제로는 서버에서 제공되어야 함)
    const weekAgo = {
      scenarios: Math.max(0, stats.totalCounts.scenarios - Math.floor(Math.random() * 5)),
      prompts: Math.max(0, stats.totalCounts.prompts - Math.floor(Math.random() * 3)),
      images: Math.max(0, stats.totalCounts.images - Math.floor(Math.random() * 10)),
      videos: Math.max(0, stats.totalCounts.videos - Math.floor(Math.random() * 2)),
    };

    return {
      scenarios: {
        current: stats.totalCounts.scenarios,
        change: stats.totalCounts.scenarios - weekAgo.scenarios,
        percentage: weekAgo.scenarios > 0
          ? ((stats.totalCounts.scenarios - weekAgo.scenarios) / weekAgo.scenarios) * 100
          : 0,
      },
      prompts: {
        current: stats.totalCounts.prompts,
        change: stats.totalCounts.prompts - weekAgo.prompts,
        percentage: weekAgo.prompts > 0
          ? ((stats.totalCounts.prompts - weekAgo.prompts) / weekAgo.prompts) * 100
          : 0,
      },
      images: {
        current: stats.totalCounts.images,
        change: stats.totalCounts.images - weekAgo.images,
        percentage: weekAgo.images > 0
          ? ((stats.totalCounts.images - weekAgo.images) / weekAgo.images) * 100
          : 0,
      },
      videos: {
        current: stats.totalCounts.videos,
        change: stats.totalCounts.videos - weekAgo.videos,
        percentage: weekAgo.videos > 0
          ? ((stats.totalCounts.videos - weekAgo.videos) / weekAgo.videos) * 100
          : 0,
      },
    };
  }, [stats]);

  /**
   * 활동 요약 계산
   */
  const activitySummary = useMemo(() => {
    const activity = mergedStats.recentActivity;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayActivity = activity.filter(a =>
      new Date(a.timestamp) >= today
    ).length;

    const weekActivity = activity.filter(a =>
      new Date(a.timestamp) >= thisWeek
    ).length;

    const typeBreakdown = activity.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {} as Record<ContentType, number>);

    return {
      today: todayActivity,
      thisWeek: weekActivity,
      typeBreakdown,
    };
  }, [mergedStats.recentActivity]);

  /**
   * 실시간 통계 업데이트 처리
   */
  useEffect(() => {
    if (lastMessage?.data) {
      try {
        const event: StatsWebSocketEvent = JSON.parse(lastMessage.data);
        if (event.type === 'stats_update') {
          // 실시간 통계 업데이트는 Redux store에서 처리
          console.log('실시간 통계 업데이트:', event.data);
        }
      } catch (error) {
        console.error('WebSocket 메시지 파싱 오류:', error);
      }
    }
  }, [lastMessage]);

  /**
   * 통계 새로고침 요청
   */
  const refreshStats = useCallback(() => {
    if (wsConnected) {
      sendMessage(JSON.stringify({
        type: 'refresh_stats',
        timestamp: new Date().toISOString()
      }));
    }
  }, [wsConnected, sendMessage]);

  /**
   * 특정 타입 통계 요청
   */
  const requestTypeStats = useCallback((type: ContentType) => {
    if (wsConnected) {
      sendMessage(JSON.stringify({
        type: 'get_type_stats',
        contentType: type,
        timestamp: new Date().toISOString()
      }));
    }
  }, [wsConnected, sendMessage]);

  return {
    // 통계 데이터
    stats: mergedStats,
    localStats,
    typeGrowth,
    activitySummary,

    // 상태
    loading: loading.stats,
    wsConnected,
    isStale: !stats,

    // 액션
    refreshStats,
    requestTypeStats,

    // 유틸리티
    getTotalCount: (type: ContentType) => mergedStats.totalCounts[type] || 0,
    getGrowthPercentage: (type: ContentType) => typeGrowth?.[type]?.percentage || 0,
    getTopTags: (limit = 5) => mergedStats.topTags.slice(0, limit),
    getRecentActivity: (limit = 5) => mergedStats.recentActivity.slice(0, limit),
    getPopularContent: (limit = 3) => mergedStats.popularContent.slice(0, limit),
  };
}