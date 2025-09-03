import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

export function StatCard({ title, value, sub }: { title: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {sub ? <div className="mt-1 text-sm text-gray-500">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}


