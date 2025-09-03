import { cn } from '@/shared/lib/utils';
import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn('rounded-lg border bg-white p-4 shadow-soft', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn('mb-2', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement> & { children: ReactNode }) {
  return (
    <h2 className={cn('text-sm font-medium text-gray-500', className)} {...props}>
      {children}
    </h2>
  );
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}


