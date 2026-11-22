import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-[1em] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
