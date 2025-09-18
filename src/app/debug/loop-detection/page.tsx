/**
 * 무한 루프 감지 테스트 페이지
 * $300 사건 재발 방지를 위한 실시간 모니터링 도구
 */

'use client';

import { useEffect, useState } from 'react';
import { clientLoopDetector, useInfiniteLoopDetection } from '@/shared/lib/client-side-loop-detector';
import { useAuthApiGuard } from '@/shared/hooks/useApiCallGuard';

export default function LoopDetectionDebugPage() {
  const [apiStats, setApiStats] = useState<any>(null);
  const [guardStatus, setGuardStatus] = useState<any>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  const loopDetection = useInfiniteLoopDetection(true);
  const { guardedCall, getStatus } = useAuthApiGuard();

  // 실시간 상태 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && (window as any).detectLoops) {
        const stats = (window as any).detectLoops();
        setApiStats(stats);
      }

      const status = getStatus();
      setGuardStatus(status);
    }, 1000);

    return () => clearInterval(interval);
  }, [getStatus]);

  const startMonitoring = () => {
    if (typeof window !== 'undefined' && (window as any).startLoopMonitoring) {
      (window as any).startLoopMonitoring();
      setIsMonitoring(true);
      addTestResult('✅ 실시간 모니터링 시작됨');
    }
  };

  const addTestResult = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 9)]);
  };

  // 테스트 시나리오들
  const testBurstPattern = async () => {
    addTestResult('🧪 버스트 패턴 테스트 시작 (10초 내 15회 호출)');

    for (let i = 0; i < 15; i++) {
      try {
        await fetch('/api/auth/me');
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // 에러 무시 (401 예상)
      }
    }

    addTestResult('⚠️ 버스트 패턴 완료 - 무한 루프 감지 확인');
  };

  const testGuardedCall = async () => {
    addTestResult('🛡️ 가드된 API 호출 테스트 시작');

    const result = await guardedCall(async () => {
      const response = await fetch('/api/auth/me');
      return response.json();
    });

    if (result.blocked) {
      addTestResult(`🚨 호출 차단됨: ${result.reason}`);
    } else if (result.success) {
      addTestResult('✅ 가드된 호출 성공');
    } else {
      addTestResult(`❌ 가드된 호출 실패: ${result.error}`);
    }
  };

  const testRapidFirePattern = async () => {
    addTestResult('🔥 빠른 연속 호출 테스트 시작');

    const promises = Array.from({ length: 20 }, () =>
      guardedCall(async () => {
        const response = await fetch('/api/auth/me');
        return response.json();
      })
    );

    const results = await Promise.allSettled(promises);
    const blocked = results.filter(r =>
      r.status === 'fulfilled' && r.value.blocked
    ).length;
    const successful = results.filter(r =>
      r.status === 'fulfilled' && r.value.success
    ).length;

    addTestResult(`📊 연속 호출 결과: 성공 ${successful}회, 차단 ${blocked}회`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            무한 루프 감지 시스템 - 디버그 대시보드
          </h1>
          <p className="mt-2 text-gray-600">
            $300 사건 재발 방지를 위한 실시간 API 호출 모니터링 도구
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 실시간 통계 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">📊 실시간 API 통계</h2>

            {apiStats ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>총 호출 수:</span>
                  <span className="font-mono font-bold">{apiStats.totalCalls}</span>
                </div>
                <div className="flex justify-between">
                  <span>최근 1분 호출:</span>
                  <span className="font-mono font-bold">{apiStats.recentCalls}</span>
                </div>
                <div className="flex justify-between">
                  <span>/api/auth/me 호출:</span>
                  <span className={`font-mono font-bold ${
                    apiStats.authMeCalls > 10 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {apiStats.authMeCalls}
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="font-medium mb-2">상위 API 엔드포인트:</h3>
                  <div className="space-y-1">
                    {apiStats.topApis?.slice(0, 5).map((api: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="truncate">{api.url}</span>
                        <span className="font-mono">{api.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">
                데이터를 로드하는 중...
              </div>
            )}
          </div>

          {/* 가드 상태 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">🛡️ API 가드 상태</h2>

            {guardStatus ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>엔드포인트:</span>
                  <span className="font-mono text-sm">{guardStatus.endpoint}</span>
                </div>
                <div className="flex justify-between">
                  <span>최근 호출 수:</span>
                  <span className="font-mono font-bold">{guardStatus.recentCallCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>최대 허용:</span>
                  <span className="font-mono">{guardStatus.maxCallsPerMinute}</span>
                </div>
                <div className="flex justify-between">
                  <span>호출 가능:</span>
                  <span className={`font-bold ${
                    guardStatus.canCall ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {guardStatus.canCall ? '✅ 가능' : '🚨 차단됨'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>진행 중:</span>
                  <span className={guardStatus.isPending ? 'text-yellow-600' : 'text-gray-500'}>
                    {guardStatus.isPending ? '⏳ 진행중' : '✅ 대기'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>마지막 호출:</span>
                  <span className="font-mono text-sm">
                    {guardStatus.lastCallTime ?
                      `${Math.round(guardStatus.timeSinceLastCall / 1000)}초 전` :
                      '없음'
                    }
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">
                가드 상태를 로드하는 중...
              </div>
            )}
          </div>

          {/* 테스트 컨트롤 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">🧪 테스트 시나리오</h2>

            <div className="space-y-3">
              <button
                onClick={startMonitoring}
                disabled={isMonitoring}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isMonitoring ? '✅ 모니터링 활성화됨' : '🔍 실시간 모니터링 시작'}
              </button>

              <button
                onClick={testGuardedCall}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                🛡️ 가드된 API 호출 테스트
              </button>

              <button
                onClick={testBurstPattern}
                className="w-full bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
              >
                💥 버스트 패턴 테스트 (무한 루프 시뮬레이션)
              </button>

              <button
                onClick={testRapidFirePattern}
                className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                🔥 빠른 연속 호출 테스트
              </button>
            </div>
          </div>

          {/* 테스트 결과 로그 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">📝 테스트 결과 로그</h2>

            <div className="h-64 overflow-y-auto bg-gray-50 rounded p-3 font-mono text-sm">
              {testResults.length > 0 ? (
                testResults.map((result, index) => (
                  <div key={index} className="mb-1">
                    {result}
                  </div>
                ))
              ) : (
                <div className="text-gray-500">
                  테스트를 실행하면 결과가 여기에 표시됩니다.
                </div>
              )}
            </div>

            <button
              onClick={() => setTestResults([])}
              className="mt-3 bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
            >
              로그 지우기
            </button>
          </div>
        </div>

        {/* 사용 방법 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">
            🔧 브라우저 콘솔 명령어
          </h2>
          <div className="space-y-2 text-blue-800">
            <p><code className="bg-blue-100 px-2 py-1 rounded">detectLoops()</code> - 현재 루프 감지 상태 확인</p>
            <p><code className="bg-blue-100 px-2 py-1 rounded">startLoopMonitoring()</code> - 실시간 모니터링 시작</p>
          </div>
        </div>
      </div>
    </div>
  );
}