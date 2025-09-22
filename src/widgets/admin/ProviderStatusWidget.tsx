/**
 * Provider Status Widget
 *
 * 외부 제공자 상태를 표시하는 위젯입니다.
 * Seedance, Veo, Imagen, Runway 등의 서비스 상태, 지연 시간, 성공률을 모니터링합니다.
 */

'use client';

import { useMemo } from 'react';
import type { ProviderStatus } from '../../entities/admin';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  healthyCount: number;
  totalCount: number;
  message: string;
}

interface ProviderStatusWidgetProps {
  /** 제공자 상태 목록 */
  providers: ProviderStatus[];
  /** 시스템 전체 건전성 */
  systemHealth: SystemHealth;
}

/**
 * 제공자 상태 위젯
 */
export function ProviderStatusWidget({ providers, systemHealth }: ProviderStatusWidgetProps) {
  // 전체 평균 지연 시간 계산
  const averageLatency = useMemo(() => {
    const healthyProviders = providers.filter(p => p.status === 'healthy');
    if (healthyProviders.length === 0) return 0;

    const totalLatency = healthyProviders.reduce((sum, p) => sum + p.averageLatency, 0);
    return Math.round(totalLatency / healthyProviders.length);
  }, [providers]);

  // 전체 평균 성공률 계산
  const averageSuccessRate = useMemo(() => {
    if (providers.length === 0) return 0;

    const totalSuccessRate = providers.reduce((sum, p) => sum + p.successRate, 0);
    return Math.round(totalSuccessRate / providers.length);
  }, [providers]);

  // 상태별 색상 반환
  const getStatusColor = (status: ProviderStatus['status']) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'down':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // 상태 텍스트 반환
  const getStatusText = (status: ProviderStatus['status']) => {
    switch (status) {
      case 'healthy':
        return '정상';
      case 'degraded':
        return '저하';
      case 'down':
        return '장애';
      default:
        return '알 수 없음';
    }
  };

  // 제공자 이름 표시
  const getProviderDisplayName = (name: ProviderStatus['name']) => {
    switch (name) {
      case 'seedance':
        return 'Seedance';
      case 'veo':
        return 'Google Veo';
      case 'imagen':
        return 'Google Imagen';
      case 'runway':
        return 'Runway ML';
      default:
        return name;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">제공자 상태</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            systemHealth.status === 'healthy'
              ? 'bg-green-500'
              : systemHealth.status === 'degraded'
              ? 'bg-yellow-500'
              : 'bg-red-500'
          }`} />
          <span className="text-sm text-gray-500">
            {systemHealth.healthyCount}/{systemHealth.totalCount} 활성
          </span>
        </div>
      </div>

      {/* 전체 상태 요약 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* 시스템 상태 */}
        <div className={`rounded-lg p-4 ${
          systemHealth.status === 'healthy'
            ? 'bg-green-50'
            : systemHealth.status === 'degraded'
            ? 'bg-yellow-50'
            : 'bg-red-50'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${
                systemHealth.status === 'healthy'
                  ? 'text-green-700'
                  : systemHealth.status === 'degraded'
                  ? 'text-yellow-700'
                  : 'text-red-700'
              }`}>
                시스템 상태
              </p>
              <p className={`text-xl font-bold ${
                systemHealth.status === 'healthy'
                  ? 'text-green-900'
                  : systemHealth.status === 'degraded'
                  ? 'text-yellow-900'
                  : 'text-red-900'
              }`}>
                {systemHealth.status === 'healthy' ? '정상' :
                 systemHealth.status === 'degraded' ? '저하' : '위험'}
              </p>
            </div>
            <div className={`p-2 rounded-full ${
              systemHealth.status === 'healthy'
                ? 'bg-green-100'
                : systemHealth.status === 'degraded'
                ? 'bg-yellow-100'
                : 'bg-red-100'
            }`}>
              <svg className={`w-5 h-5 ${
                systemHealth.status === 'healthy'
                  ? 'text-green-600'
                  : systemHealth.status === 'degraded'
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 평균 지연 시간 */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">평균 지연</p>
              <p className="text-xl font-bold text-blue-900">{averageLatency}ms</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-full">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 평균 성공률 */}
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">평균 성공률</p>
              <p className="text-xl font-bold text-purple-900">{averageSuccessRate}%</p>
            </div>
            <div className="p-2 bg-purple-100 rounded-full">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 개별 제공자 상태 */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">개별 제공자 상태</h4>

        {providers.map((provider) => (
          <div
            key={provider.name}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            data-testid={`provider-${provider.name}`}
          >
            <div className="flex items-center space-x-3">
              {/* 제공자 아이콘/이름 */}
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700">
                    {provider.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {getProviderDisplayName(provider.name)}
                </p>
                <p className="text-xs text-gray-500">
                  마지막 체크: {new Date(provider.lastCheckedAt).toLocaleTimeString('ko-KR')}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* 지연 시간 */}
              <div className="text-right">
                <p className="text-xs text-gray-500">지연시간</p>
                <p className="text-sm font-medium text-gray-900">{provider.averageLatency}ms</p>
              </div>

              {/* 성공률 */}
              <div className="text-right">
                <p className="text-xs text-gray-500">성공률</p>
                <p className="text-sm font-medium text-gray-900">{provider.successRate}%</p>
              </div>

              {/* 상태 배지 */}
              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(provider.status)}`}>
                {getStatusText(provider.status)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 에러 메시지 (장애 상태인 제공자가 있는 경우) */}
      {providers.some(p => p.status === 'down' && p.errorMessage) && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h5 className="text-sm font-medium text-red-800 mb-1">서비스 장애</h5>
              {providers
                .filter(p => p.status === 'down' && p.errorMessage)
                .map(provider => (
                  <p key={provider.name} className="text-sm text-red-700">
                    <span className="font-medium">{getProviderDisplayName(provider.name)}:</span> {provider.errorMessage}
                  </p>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* 성능 경고 */}
      {averageLatency > 2000 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-yellow-800">
              평균 응답 시간이 높습니다 ({averageLatency}ms). 서비스 성능을 확인해보세요.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}