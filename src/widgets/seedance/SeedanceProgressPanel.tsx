import React from 'react';

interface Props {
  jobIds: string[];
  statuses: Record<string, { status: string; progress?: number; videoUrl?: string }>
  error?: string | null;
}

export function SeedanceProgressPanel({ jobIds, statuses, error }: Props) {
  if (!jobIds || jobIds.length === 0) return null;
  return (
    <div className="mt-4 border rounded-lg p-4 bg-gray-50">
      <div className="text-sm font-medium text-gray-900 mb-2">Seedance 생성 진행상황</div>
      {error && (
        <div className="mb-3 text-sm text-red-600">{error}</div>
      )}
      {jobIds.length > 1 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobIds.map((jid) => (
            <div key={jid} className="border rounded p-3 bg-white">
              <div className="text-xs text-gray-500 mb-1">{jid}</div>
              <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
                <div className="bg-primary-500 h-2" style={{ width: `${Math.min(100, (statuses[jid]?.progress ?? 5))}%` }} />
              </div>
              <div className="mt-2 text-sm text-gray-700">상태: {statuses[jid]?.status || 'processing'}{statuses[jid]?.progress != null ? ` • ${statuses[jid]?.progress}%` : ''}</div>
              <div className="mt-2">
                {statuses[jid]?.videoUrl ? (
                  <>
                    <video src={statuses[jid]?.videoUrl} controls className="w-full rounded border" autoPlay muted />
                    <div className="mt-2 flex items-center gap-2">
                      <a href={statuses[jid]?.videoUrl!} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline">새 탭에서 열기</a>
                      <a href={statuses[jid]?.videoUrl!} download className="text-xs text-secondary-700 hover:underline">다운로드</a>
                    </div>
                  </>
                ) : (
                  <div className="aspect-video w-full bg-gray-100 rounded border grid place-items-center text-sm text-gray-500">영상 준비 중…</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
            <div className="bg-primary-500 h-2" style={{ width: `${Math.min(100, (statuses[jobIds[0]]?.progress ?? 5))}%` }} />
          </div>
          <div className="mt-2 text-sm text-gray-700">상태: {statuses[jobIds[0]]?.status || 'processing'}{statuses[jobIds[0]]?.progress != null ? ` • ${statuses[jobIds[0]]?.progress}%` : ''}</div>
          <div className="mt-2">
            {statuses[jobIds[0]]?.videoUrl ? (
              <>
                <video src={statuses[jobIds[0]]?.videoUrl} controls className="w-full rounded border" autoPlay muted />
                <div className="mt-2 flex items-center gap-2">
                  <a href={statuses[jobIds[0]]?.videoUrl} target="_blank" rel="noreferrer" className="text-sm text-primary-600 hover:underline">새 탭에서 열기</a>
                  <a href={statuses[jobIds[0]]?.videoUrl} download className="text-sm text-secondary-700 hover:underline">다운로드</a>
                </div>
              </>
            ) : (
              <div className="aspect-video w-full bg-gray-100 rounded border grid place-items-center text-sm text-gray-500">
                영상 준비 중…
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


