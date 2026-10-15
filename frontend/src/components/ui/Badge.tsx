import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/10 text-primary',
        success: 'border-transparent bg-[var(--success-chip-bg)] text-[var(--success-chip-fg)]',
        warning: 'border-transparent bg-[var(--warning-chip-bg)] text-[var(--warning)]',
        danger: 'border-transparent bg-[var(--critical-chip-bg)] text-[var(--critical)]',
        muted: 'border-transparent bg-[var(--surface-muted)] text-[var(--fg-soft)]',
        outline: 'border-[var(--border-strong)] text-[var(--fg-soft)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
