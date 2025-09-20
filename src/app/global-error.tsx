'use client';

import React from 'react';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log error for debugging (avoid console in production)
    if (process.env.NODE_ENV === 'development') {
      console.error('Global error:', error);
    }
  }, [error]);

  return (
    <html lang="ko">
      <head>
        <title>오류 발생 - VLANET</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{
        margin: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#f9fafb',
        color: '#111827'
      }}>
        <div style={{
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <h1 style={{
            marginBottom: '0.5rem',
            fontSize: '2.25rem',
            fontWeight: 'bold',
            color: '#111827'
          }}>
            오류가 발생했습니다
          </h1>
          <p style={{
            marginBottom: '1.5rem',
            color: '#6b7280'
          }}>
            예상치 못한 오류가 발생했습니다.
          </p>
          <button
            onClick={reset}
            style={{
              borderRadius: '0.5rem',
              backgroundColor: '#dc2626',
              padding: '0.5rem 1rem',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#b91c1c';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
            }}
          >
            다시 시도
          </button>
          {process.env.NODE_ENV === 'development' && (
            <details style={{ marginTop: '1rem', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', color: '#6b7280' }}>
                개발자 정보
              </summary>
              <pre style={{
                marginTop: '0.5rem',
                fontSize: '0.75rem',
                color: '#dc2626',
                overflow: 'auto',
                whiteSpace: 'pre-wrap'
              }}>
                {error.message}
              </pre>
            </details>
          )}
        </div>
      </body>
    </html>
  );
}