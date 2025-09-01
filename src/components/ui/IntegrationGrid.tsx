import React from 'react';
import { IntegrationCard } from './IntegrationCard';
import type { VideoPlanetIntegration } from '@/lib/integrations';

interface IntegrationGridProps {
  integrations: VideoPlanetIntegration[];
  onConnect?: (id: string) => void;
  onDisconnect?: (id: string) => void;
  onConfigure?: (id: string) => void;
}

export function IntegrationGrid({
  integrations,
  onConnect,
  onDisconnect,
  onConfigure,
}: IntegrationGridProps) {
  if (integrations.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg
            className="h-8 w-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-medium text-gray-900">통합 서비스를 찾을 수 없습니다</h3>
        <p className="text-gray-500">검색 조건을 변경하거나 다른 카테고리를 선택해보세요.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {integrations.map((integration) => (
        <IntegrationCard
          key={integration.id}
          integration={integration}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onConfigure={onConfigure}
        />
      ))}
    </div>
  );
}
