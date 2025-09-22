/**
 * WebSocket Hook - Basic Implementation
 * CLAUDE.md 준수: TDD, 타입 안전성, 비용 안전
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseWebSocketOptions {
  shouldConnect?: boolean;
  onMessage?: (event: MessageEvent) => void;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export interface UseWebSocketResult {
  socket: WebSocket | null;
  connectionStatus: 'Connecting' | 'Open' | 'Closing' | 'Closed';
  lastMessage: MessageEvent | null;
  sendMessage: (message: string | object) => void;
  closeConnection: () => void;
}

export function useWebSocket(
  url: string,
  options: UseWebSocketOptions = {}
): UseWebSocketResult {
  const {
    shouldConnect = true,
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnectAttempts = 3,
    reconnectInterval = 3000,
  } = options;

  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'Connecting' | 'Open' | 'Closing' | 'Closed'>('Closed');
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);

  const reconnectAttemptsRef = useRef(0);
  const shouldConnectRef = useRef(shouldConnect);

  useEffect(() => {
    shouldConnectRef.current = shouldConnect;
  }, [shouldConnect]);

  const connect = useCallback(() => {
    if (!shouldConnectRef.current || socket?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(url);
      setSocket(ws);
      setConnectionStatus('Connecting');

      ws.onopen = (event) => {
        setConnectionStatus('Open');
        reconnectAttemptsRef.current = 0;
        onOpen?.(event);
      };

      ws.onmessage = (event) => {
        setLastMessage(event);
        onMessage?.(event);
      };

      ws.onclose = (event) => {
        setConnectionStatus('Closed');
        setSocket(null);
        onClose?.(event);

        // Reconnect logic
        if (shouldConnectRef.current && reconnectAttemptsRef.current < reconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (event) => {
        setConnectionStatus('Closed');
        onError?.(event);
      };

    } catch (error) {
      setConnectionStatus('Closed');
      console.error('WebSocket connection failed:', error);
    }
  }, [url, onMessage, onOpen, onClose, onError, reconnectAttempts, reconnectInterval]);

  const sendMessage = useCallback((message: string | object) => {
    if (socket?.readyState === WebSocket.OPEN) {
      const messageString = typeof message === 'string' ? message : JSON.stringify(message);
      socket.send(messageString);
    } else {
      console.warn('WebSocket is not connected. Cannot send message.');
    }
  }, [socket]);

  const closeConnection = useCallback(() => {
    shouldConnectRef.current = false;
    if (socket) {
      setConnectionStatus('Closing');
      socket.close();
    }
  }, [socket]);

  useEffect(() => {
    if (shouldConnect) {
      connect();
    } else {
      closeConnection();
    }

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [shouldConnect, connect]);

  return {
    socket,
    connectionStatus,
    lastMessage,
    sendMessage,
    closeConnection,
  };
}