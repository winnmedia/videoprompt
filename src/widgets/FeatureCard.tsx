/**
 * FeatureCard Widget - 기능 소개 카드 위젯
 * 제품 기능을 소개하는 재사용 가능한 카드 컴포넌트
 */

import { Card, CardContent, CardHeader, CardTitle } from '../shared/ui/Card';

export interface FeatureCardProps {
  title: string;
  description: string;
  className?: string;
}

export function FeatureCard({
  title,
  description,
  className = '',
}: FeatureCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600">{description}</p>
      </CardContent>
    </Card>
  );
}
