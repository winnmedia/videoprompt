type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  level: LogLevel;
  message: string;
  traceId?: string;
  meta?: Record<string, unknown>;
}

function baseLog({ level, message, traceId, meta }: LogPayload) {
  const ts = new Date().toISOString();
  const line = { ts, level, message, ...(traceId ? { traceId } : {}), ...(meta ? { meta } : {}) };
  // eslint-disable-next-line no-console
  console[level](JSON.stringify(line));
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
};
