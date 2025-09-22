/**
 * 피드백 시스템 실시간 업데이트 훅
 *
 * Supabase Realtime을 사용한 실시간 데이터 동기화
 * 다중 사용자 동시 피드백 지원
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabaseClient } from '@/shared/api/supabase-client';
import { RealtimeChannel, REALTIME_LISTEN_TYPES } from '@supabase/supabase-js';

// ===========================================
// 타입 정의
// ===========================================

export interface FeedbackRealtimeEvent {
  type: 'feedback_added' | 'feedback_updated' | 'feedback_deleted' | 'user_joined' | 'user_left' | 'video_uploaded' | 'activity_logged';
  payload: any;
  timestamp: string;
  user_id?: string;
  guest_id?: string;
  project_id: string;
}

export interface OnlineUser {
  user_id?: string;
  guest_id?: string;
  display_name: string;
  avatar_url?: string;
  last_seen: string;
  is_guest: boolean;
}

export interface UseFeedbackRealtimeOptions {
  projectId: string;
  videoSlotId?: string;
  onFeedbackEvent?: (event: FeedbackRealtimeEvent) => void;
  onUserPresenceChange?: (users: OnlineUser[]) => void;
  onConnectionStateChange?: (connected: boolean) => void;
  enablePresence?: boolean;
  enableActivityLog?: boolean;
}

export interface UseFeedbackRealtimeReturn {
  // 연결 상태
  isConnected: boolean;
  connectionError: string | null;

  // 온라인 사용자
  onlineUsers: OnlineUser[];
  userCount: number;

  // 이벤트 발송
  broadcastEvent: (event: Omit<FeedbackRealtimeEvent, 'timestamp' | 'project_id'>) => void;

  // 사용자 상태 업데이트
  updateUserPresence: (data: Partial<OnlineUser>) => void;

  // 연결 관리
  reconnect: () => void;
  disconnect: () => void;
}

// ===========================================
// 실시간 피드백 훅
// ===========================================

export function useFeedbackRealtime(
  options: UseFeedbackRealtimeOptions
): UseFeedbackRealtimeReturn {
  const {
    projectId,
    videoSlotId,
    onFeedbackEvent,
    onUserPresenceChange,
    onConnectionStateChange,
    enablePresence = true,
    enableActivityLog = true,
  } = options;

  // 상태 관리
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  // 채널 참조
  const channelRef = useRef<RealtimeChannel | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 현재 사용자 정보
  const [currentUser, setCurrentUser] = useState<OnlineUser | null>(null);

  // ===========================================
  // 사용자 정보 초기화
  // ===========================================

  useEffect(() => {
    const initializeUser = async () => {
      try {
        const user = await supabaseClient.getCurrentUser();
        if (user) {
          setCurrentUser({
            user_id: user.id,
            display_name: user.user_metadata?.display_name || user.email || 'User',
            avatar_url: user.user_metadata?.avatar_url,
            last_seen: new Date().toISOString(),
            is_guest: false,
          });
        } else {
          // 게스트 사용자의 경우 localStorage에서 정보 읽기
          const guestData = localStorage.getItem('feedback_guest_session');
          if (guestData) {
            try {
              const parsed = JSON.parse(guestData);
              setCurrentUser({
                guest_id: parsed.guest_id,
                display_name: parsed.guest_name || 'Guest',
                last_seen: new Date().toISOString(),
                is_guest: true,
              });
            } catch {
              // 게스트 세션 파싱 실패
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize user:', error);
      }
    };

    initializeUser();
  }, []);

  // ===========================================
  // 채널 설정
  // ===========================================

  const setupChannels = useCallback(() => {
    if (!currentUser) return;

    try {
      // 메인 피드백 채널
      const channelName = videoSlotId
        ? `feedback:video:${videoSlotId}`
        : `feedback:project:${projectId}`;

      channelRef.current = supabaseClient.raw.channel(channelName);

      // 피드백 이벤트 리스너
      channelRef.current
        .on(
          REALTIME_LISTEN_TYPES.BROADCAST,
          { event: 'feedback_event' },
          (payload) => {
            const event = payload.payload as FeedbackRealtimeEvent;
            onFeedbackEvent?.(event);
          }
        )
        .on(
          REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
          {
            event: '*',
            schema: 'public',
            table: 'timecode_feedbacks',
            filter: `feedback_project_id=eq.${projectId}`,
          },
          (payload) => {
            const event: FeedbackRealtimeEvent = {
              type: payload.eventType === 'INSERT' ? 'feedback_added' :
                    payload.eventType === 'UPDATE' ? 'feedback_updated' : 'feedback_deleted',
              payload: payload.new || payload.old,
              timestamp: new Date().toISOString(),
              project_id: projectId,
            };
            onFeedbackEvent?.(event);
          }
        );

      // 영상 업로드 이벤트 리스너
      channelRef.current.on(
        REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_slots',
          filter: `feedback_project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.new?.processing_status !== payload.old?.processing_status) {
            const event: FeedbackRealtimeEvent = {
              type: 'video_uploaded',
              payload: payload.new,
              timestamp: new Date().toISOString(),
              project_id: projectId,
            };
            onFeedbackEvent?.(event);
          }
        }
      );

      // 활동 로그 이벤트 리스너 (옵션)
      if (enableActivityLog) {
        channelRef.current.on(
          REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
          {
            event: 'INSERT',
            schema: 'public',
            table: 'feedback_activity_logs',
            filter: `feedback_project_id=eq.${projectId}`,
          },
          (payload) => {
            const event: FeedbackRealtimeEvent = {
              type: 'activity_logged',
              payload: payload.new,
              timestamp: new Date().toISOString(),
              project_id: projectId,
            };
            onFeedbackEvent?.(event);
          }
        );
      }

      // 사용자 상태 채널 (옵션)
      if (enablePresence) {
        presenceChannelRef.current = supabaseClient.raw.channel(
          `presence:project:${projectId}`,
          {
            config: { presence: { key: currentUser.user_id || currentUser.guest_id } },
          }
        );

        presenceChannelRef.current
          .on(REALTIME_LISTEN_TYPES.PRESENCE, { event: 'sync' }, () => {
            const presenceState = presenceChannelRef.current?.presenceState();
            if (presenceState) {
              const users = Object.values(presenceState)
                .flat()
                .map((presence: any) => presence as OnlineUser);

              setOnlineUsers(users);
              onUserPresenceChange?.(users);
            }
          })
          .on(REALTIME_LISTEN_TYPES.PRESENCE, { event: 'join' }, ({ newPresences }) => {
            const users = newPresences as OnlineUser[];
            setOnlineUsers(prev => [...prev, ...users]);
            onUserPresenceChange?.(onlineUsers);
          })
          .on(REALTIME_LISTEN_TYPES.PRESENCE, { event: 'leave' }, ({ leftPresences }) => {
            const leftUserIds = leftPresences.map((p: any) => p.user_id || p.guest_id);
            setOnlineUsers(prev =>
              prev.filter(user => !leftUserIds.includes(user.user_id || user.guest_id))
            );
            onUserPresenceChange?.(onlineUsers);
          });

        // 현재 사용자 상태 추가
        presenceChannelRef.current.track(currentUser);
      }

      // 채널 구독
      const subscribePromises = [
        channelRef.current.subscribe((status) => {
          const connected = status === 'SUBSCRIBED';
          setIsConnected(connected);
          onConnectionStateChange?.(connected);

          if (connected) {
            setConnectionError(null);
          }
        }),
      ];

      if (presenceChannelRef.current) {
        subscribePromises.push(
          presenceChannelRef.current.subscribe()
        );
      }

      // 하트비트 설정 (연결 유지)
      heartbeatIntervalRef.current = setInterval(() => {
        if (channelRef.current && isConnected) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'heartbeat',
            payload: {
              user_id: currentUser.user_id,
              guest_id: currentUser.guest_id,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }, 30000); // 30초마다

    } catch (error) {
      console.error('Failed to setup realtime channels:', error);
      setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      setIsConnected(false);
    }
  }, [
    currentUser,
    projectId,
    videoSlotId,
    enablePresence,
    enableActivityLog,
    onFeedbackEvent,
    onUserPresenceChange,
    onConnectionStateChange,
    isConnected,
    onlineUsers,
  ]);

  // ===========================================
  // 채널 정리
  // ===========================================

  const cleanupChannels = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    if (presenceChannelRef.current) {
      presenceChannelRef.current.unsubscribe();
      presenceChannelRef.current = null;
    }

    setIsConnected(false);
    setOnlineUsers([]);
  }, []);

  // ===========================================
  // 이벤트 브로드캐스트
  // ===========================================

  const broadcastEvent = useCallback((
    event: Omit<FeedbackRealtimeEvent, 'timestamp' | 'project_id'>
  ) => {
    if (!channelRef.current || !isConnected) {
      console.warn('Channel not connected, cannot broadcast event');
      return;
    }

    const fullEvent: FeedbackRealtimeEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      project_id: projectId,
      user_id: currentUser?.user_id,
      guest_id: currentUser?.guest_id,
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'feedback_event',
      payload: fullEvent,
    });
  }, [channelRef, isConnected, projectId, currentUser]);

  // ===========================================
  // 사용자 상태 업데이트
  // ===========================================

  const updateUserPresence = useCallback((data: Partial<OnlineUser>) => {
    if (!presenceChannelRef.current || !currentUser) return;

    const updatedUser = {
      ...currentUser,
      ...data,
      last_seen: new Date().toISOString(),
    };

    setCurrentUser(updatedUser);
    presenceChannelRef.current.track(updatedUser);
  }, [presenceChannelRef, currentUser]);

  // ===========================================
  // 연결 관리 함수들
  // ===========================================

  const reconnect = useCallback(() => {
    cleanupChannels();
    setTimeout(() => {
      setupChannels();
    }, 1000);
  }, [cleanupChannels, setupChannels]);

  const disconnect = useCallback(() => {
    cleanupChannels();
  }, [cleanupChannels]);

  // ===========================================
  // 라이프사이클 관리
  // ===========================================

  useEffect(() => {
    if (currentUser) {
      setupChannels();
    }

    return () => {
      cleanupChannels();
    };
  }, [currentUser, setupChannels, cleanupChannels]);

  // 페이지 이탈 시 정리
  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanupChannels();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [cleanupChannels]);

  // 네트워크 상태 변화 감지
  useEffect(() => {
    const handleOnline = () => {
      if (!isConnected) {
        reconnect();
      }
    };

    const handleOffline = () => {
      setIsConnected(false);
      setConnectionError('Network connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConnected, reconnect]);

  return {
    isConnected,
    connectionError,
    onlineUsers,
    userCount: onlineUsers.length,
    broadcastEvent,
    updateUserPresence,
    reconnect,
    disconnect,
  };
}

// ===========================================
// 타이핑 표시 훅
// ===========================================

export function useTypingIndicator(
  realtimeBroadcast: (event: any) => void,
  onTypingChange?: (users: OnlineUser[]) => void
) {
  const [typingUsers, setTypingUsers] = useState<OnlineUser[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startTyping = useCallback((user: OnlineUser) => {
    realtimeBroadcast({
      type: 'user_typing',
      payload: { user, typing: true },
    });

    // 자동으로 타이핑 중지 (5초 후)
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      realtimeBroadcast({
        type: 'user_typing',
        payload: { user, typing: false },
      });
    }, 5000);
  }, [realtimeBroadcast]);

  const stopTyping = useCallback((user: OnlineUser) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    realtimeBroadcast({
      type: 'user_typing',
      payload: { user, typing: false },
    });
  }, [realtimeBroadcast]);

  const handleTypingEvent = useCallback((event: FeedbackRealtimeEvent) => {
    if (event.type === 'user_typing') {
      const { user, typing } = event.payload;

      if (typing) {
        setTypingUsers(prev => {
          const existing = prev.find(u =>
            (u.user_id && u.user_id === user.user_id) ||
            (u.guest_id && u.guest_id === user.guest_id)
          );
          if (existing) return prev;
          return [...prev, user];
        });
      } else {
        setTypingUsers(prev =>
          prev.filter(u =>
            !(
              (u.user_id && u.user_id === user.user_id) ||
              (u.guest_id && u.guest_id === user.guest_id)
            )
          )
        );
      }
    }
  }, []);

  useEffect(() => {
    onTypingChange?.(typingUsers);
  }, [typingUsers, onTypingChange]);

  return {
    typingUsers,
    startTyping,
    stopTyping,
    handleTypingEvent,
  };
}