type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  level: LogLevel;
  message: string;
  traceId?: string;
  meta?: Record<string, unknown>;
}

function baseLog({ level, message, traceId, meta }: LogPayload) {
  const ts = new Date().toISOString();
  const isDev = process.env.NODE_ENV === 'development';
  
  // 개발환경: 사람이 읽기 쉬운 형태
  if (isDev) {
    const logFn = console[level] || console.log;
    logFn(`[${level.toUpperCase()}] ${message}`, meta || '');
    return;
  }
  
  // 프로덕션: JSON 형태 (에러만 출력)
  if (level === 'error') {
    const line = { ts, level, message, ...(traceId ? { traceId } : {}), ...(meta ? { meta } : {}) };
    console.error(JSON.stringify(line));
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>, traceId?: string) =>
    baseLog({ level: 'debug', message, meta, traceId }),
  info: (message: string, meta?: Record<string, unknown>, traceId?: string) =>
    baseLog({ level: 'info', message, meta, traceId }),
  warn: (message: string, meta?: Record<string, unknown>, traceId?: string) =>
    baseLog({ level: 'warn', message, meta, traceId }),
  error: (message: string, meta?: Record<string, unknown>, traceId?: string) =>
    baseLog({ level: 'error', message, meta, traceId }),
  
  // 헬퍼 메서드들
  apiError: (endpoint: string, error: any) => {
    baseLog({
      level: 'error',
      message: `API 호출 실패: ${endpoint}`,
      meta: {
        error: error.message || error,
        stack: error.stack || 'No stack trace'
      }
    });
  },
  
  userAction: (action: string, data?: Record<string, unknown>) => {
    baseLog({
      level: 'info',
      message: `사용자 액션: ${action}`,
      meta: data
    });
  }
};





