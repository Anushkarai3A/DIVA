import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 text-sm [&>svg+div]:translate-y-[-3px]',
  {
    variants: {
      variant: {
        default: 'bg-[var(--surface)] text-foreground',
        destructive: 'border-[var(--critical-border)] bg-[var(--critical-surface)] text-[var(--critical-strong)] [&>svg]:text-[var(--critical)]',
        warning: 'border-[var(--warning-border)] bg-[var(--warning-surface)] text-[var(--warning-stronger)]',
        success: 'border-[var(--success-border)] bg-[var(--success-surface)] text-[var(--success-strong)]',
        info: 'border-[var(--info-border)] bg-[var(--ai)] text-[var(--info-fg)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

export function Alert({ className, variant, title, children, ...props }: AlertProps) {
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {title ? <div className="mb-1 font-medium">{title}</div> : null}
      <div>{children}</div>
    </div>
  );
}
