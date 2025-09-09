import React from 'react';

interface Props {
  jobIds: string[];
  statuses: Record<string, { status: string; progress?: number; videoUrl?: string }>;
  error?: string | null;
}

export function SeedanceProgressPanel({ jobIds, statuses, error }: Props) {
  if (!jobIds || jobIds.length === 0) return null;
  return (
    <div className="mt-4 rounded-lg border bg-gray-50 p-4">
      <div className="mb-2 text-sm font-medium text-gray-900">Seedance 생성 진행상황</div>
      {error && <div className="mb-3 text-sm text-danger-600">{error}</div>}
      {jobIds.length > 1 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {jobIds.map((jid) => (
            <div key={jid} className="rounded border bg-white p-3">
              <div className="mb-1 text-xs text-gray-500">{jid}</div>
              <div className="h-2 w-full overflow-hidden rounded bg-gray-200">
                <div
                  className="h-2 bg-primary-500"
                  style={{ width: `${Math.min(100, statuses[jid]?.progress ?? 5)}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-gray-700">
                상태: {statuses[jid]?.status || 'processing'}
                {statuses[jid]?.progress != null ? ` • ${statuses[jid]?.progress}%` : ''}
              </div>
              <div className="mt-2">
                {statuses[jid]?.videoUrl ? (
                  <>
                    <video
                      src={statuses[jid]?.videoUrl}
                      controls
                      className="w-full rounded border"
                      autoPlay
                      muted
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <a
                        href={statuses[jid]?.videoUrl || ''}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary-600 hover:underline"
                      >
                        새 탭에서 열기
                      </a>
                      <a
                        href={statuses[jid]?.videoUrl || ''}
                        download
                        className="text-xs text-secondary-700 hover:underline"
                      >
                        다운로드
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="grid aspect-video w-full place-items-center rounded border bg-gray-100 text-sm text-gray-500">
                    영상 준비 중…
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="h-2 w-full overflow-hidden rounded bg-gray-200">
            <div
              className="h-2 bg-primary-500"
              style={{ width: `${Math.min(100, statuses[jobIds[0]]?.progress ?? 5)}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-gray-700">
            상태: {statuses[jobIds[0]]?.status || 'processing'}
            {statuses[jobIds[0]]?.progress != null ? ` • ${statuses[jobIds[0]]?.progress}%` : ''}
          </div>
          <div className="mt-2">
            {statuses[jobIds[0]]?.videoUrl ? (
              <>
                <video
                  src={statuses[jobIds[0]]?.videoUrl}
                  controls
                  className="w-full rounded border"
                  autoPlay
                  muted
                />
                <div className="mt-2 flex items-center gap-2">
                  <a
                    href={statuses[jobIds[0]]?.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary-600 hover:underline"
                  >
                    새 탭에서 열기
                  </a>
                  <a
                    href={statuses[jobIds[0]]?.videoUrl}
                    download
                    className="text-sm text-secondary-700 hover:underline"
                  >
                    다운로드
                  </a>
                </div>
              </>
            ) : (
              <div className="grid aspect-video w-full place-items-center rounded border bg-gray-100 text-sm text-gray-500">
                영상 준비 중…
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
