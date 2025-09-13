type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  level: LogLevel;
  message: string;
  traceId?: string;
  meta?: Record<string, unknown>;
}

// 민감정보 필터링 함수
function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') return data;

  const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'authorization', 'cookie'];
  const result = { ...data };

  for (const key in result) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      result[key] = '[REDACTED]';
    } else if (typeof result[key] === 'object') {
      result[key] = sanitizeData(result[key]);
    }
  }

  return result;
}

function baseLog({ level, message, traceId, meta }: LogPayload) {
  const ts = new Date().toISOString();
  const isDev = process.env.NODE_ENV === 'development';

  // 민감정보 필터링
  const sanitizedMeta = meta ? sanitizeData(meta) : undefined;

  // 개발환경: 사람이 읽기 쉬운 형태
  if (isDev) {
    const logFn = console[level] || console.log;
    logFn(`[${level.toUpperCase()}] ${message}`, sanitizedMeta || '');
    return;
  }

  // 프로덕션: JSON 형태 (에러와 중요 정보만)
  if (level === 'error' || level === 'warn') {
    const line = {
      ts,
      level,
      message,
      ...(traceId ? { traceId } : {}),
      ...(sanitizedMeta ? { meta: sanitizedMeta } : {})
    };
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





