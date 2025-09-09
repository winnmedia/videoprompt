import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-brand-600 text-white hover:bg-brand-700',
        secondary: 'border-transparent bg-secondary-100 text-secondary-900 hover:bg-secondary-200',
        destructive: 'border-transparent bg-danger-600 text-white hover:bg-danger-700',
        outline: 'text-gray-900',
        success: 'border-transparent bg-success-600 text-white hover:bg-success-700',
        warning: 'border-transparent bg-warning-600 text-white hover:bg-warning-700',
        accent: 'border-transparent bg-accent-600 text-white hover:bg-accent-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}