/**
 * ActionCard Widget - 액션 카드 위젯
 * 클릭 가능한 액션 카드 UI 컴포넌트
 */

import Link from 'next/link';
import { Card, CardContent } from '../shared/ui/Card';

export interface ActionCardProps {
  icon: string;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function ActionCard({
  icon,
  title,
  description,
  href,
  onClick,
  className = '',
}: ActionCardProps) {
  const cardContent = (
    <Card
      className={`cursor-pointer transition-shadow hover:shadow-md ${className}`}
    >
      <CardContent className="p-6 text-center">
        <div className="mb-3 text-3xl">{icon}</div>
        <h3 className="mb-2 font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{cardContent}</Link>;
  }

  if (onClick) {
    return <div onClick={onClick}>{cardContent}</div>;
  }

  return cardContent;
}
