import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Button } from './Button';
import { Icon } from './Icon';
import type { VideoPlanetIntegration } from '@/lib/integrations';

interface IntegrationCardProps {
  integration: VideoPlanetIntegration;
  onConnect?: (id: string) => void;
  onDisconnect?: (id: string) => void;
  onConfigure?: (id: string) => void;
}

export function IntegrationCard({ 
  integration, 
  onConnect, 
  onDisconnect, 
  onConfigure 
}: IntegrationCardProps) {
  const getStatusColor = (status: VideoPlanetIntegration['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'disconnected':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: VideoPlanetIntegration['status']) => {
    switch (status) {
      case 'connected':
        return '연결됨';
      case 'pending':
        return '연결 중';
      case 'disconnected':
        return '연결 안됨';
      default:
        return '알 수 없음';
    }
  };

  const getActionButton = () => {
    switch (integration.status) {
      case 'connected':
        return (
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onConfigure?.(integration.id)}
            >
              <Icon name="gear" size="sm" className="mr-2" />
              설정
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onDisconnect?.(integration.id)}
              className="text-red-600 hover:text-red-700"
            >
              <Icon name="delete" size="sm" className="mr-2" />
              연결 해제
            </Button>
          </div>
        );
      case 'pending':
        return (
          <Button 
            variant="outline" 
            size="sm"
            disabled
            className="opacity-50"
          >
            <Icon name="clock" size="sm" className="mr-2" />
            연결 중...
          </Button>
        );
      case 'disconnected':
        return (
          <Button 
            size="sm"
            onClick={() => onConnect?.(integration.id)}
          >
            <Icon name="plus" size="sm" className="mr-2" />
            연결하기
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-300 group h-full border-2 hover:border-primary-200">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300 group-hover:scale-110"
              style={{ backgroundColor: `${integration.color}20` }}
            >
              <integration.icon
                size={24}
                className="transition-transform duration-300"
                style={{ color: integration.color }}
              />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                {integration.name}
              </CardTitle>
              <Badge 
                variant="outline" 
                className={`mt-1 ${getStatusColor(integration.status)}`}
              >
                {getStatusText(integration.status)}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          {integration.description}
        </p>
        
        {/* Features */}
        <div className="mb-4">
          <h4 className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
            주요 기능
          </h4>
          <div className="flex flex-wrap gap-1">
            {integration.features.slice(0, 3).map((feature, index) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700"
              >
                {feature}
              </Badge>
            ))}
            {integration.features.length > 3 && (
              <Badge 
                variant="secondary" 
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700"
              >
                +{integration.features.length - 3}
              </Badge>
            )}
          </div>
        </div>

        {/* Last Sync Info */}
        {integration.lastSync && integration.status === 'connected' && (
          <div className="mb-4 text-xs text-gray-500">
            마지막 동기화: {new Date(integration.lastSync).toLocaleDateString('ko-KR')}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end">
          {getActionButton()}
        </div>
      </CardContent>
    </Card>
  );
}
