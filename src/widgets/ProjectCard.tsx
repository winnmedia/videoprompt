/**
 * ProjectCard Widget - 프로젝트 카드 위젯
 * 프로젝트 정보를 표시하는 재사용 가능한 카드 컴포넌트
 */

import { Card, CardContent } from '../shared/ui/Card';
import { Button } from '../shared/ui/Button';

export interface ProjectCardProps {
  id: number;
  title: string;
  description: string;
  status: string;
  updatedAt: string;
  onContinue?: (id: number) => void;
  className?: string;
}

export function ProjectCard({
  id,
  title,
  description,
  status,
  updatedAt,
  onContinue,
  className = '',
}: ProjectCardProps) {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case '완료':
        return 'bg-green-100 text-green-800';
      case '진행 중':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className={`transition-shadow hover:shadow-md ${className}`}>
      <CardContent className="p-6">
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusStyle(status)}`}
          >
            {status}
          </span>
        </div>
        <p className="mb-4 text-gray-600">{description}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            마지막 수정: {updatedAt}
          </span>
          <Button variant="outline" size="sm" onClick={() => onContinue?.(id)}>
            계속 작업하기
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
