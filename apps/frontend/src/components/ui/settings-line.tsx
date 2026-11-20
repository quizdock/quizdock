import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';

export interface SettingsLineItem {
  key: string;
  title: string;
  /** What the group is for, at the top of its modal. */
  description: ReactNode;
  /** The current setting, read at a glance on the line. Text only: nothing clickable. */
  value?: ReactNode;
  /** A modal wide enough for a grid (themes), not a few fields. */
  wide?: boolean;
  content: ReactNode;
}

/**
 * Secondary settings on one line of summaries, each one opening its group in a
 * modal: the page does not move, and the line wraps on a narrow screen. A
 * setting applies as it is changed: the modal only closes.
 */
export function SettingsLine({
  items,
  className,
}: {
  items: SettingsLineItem[];
  className?: string;
}) {
  const { t } = useTranslation('common');
  const id = useId();
  const [open, setOpen] = useState<string | null>(null);
  const current = items.find((item) => item.key === open);
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(item.key)}
          className="hover:bg-accent/60 flex max-w-full min-w-0 items-baseline gap-1.5 rounded-full border px-3 py-1 text-left text-sm"
        >
          <span className="shrink-0 font-medium">{item.title}</span>
          {item.value ? (
            <span className="text-muted-foreground min-w-0 truncate text-xs">{item.value}</span>
          ) : null}
        </button>
      ))}
      {current ? (
        <Modal
          onClose={() => setOpen(null)}
          aria-labelledby={`${id}-title`}
          className={cn(
            'max-h-[calc(100dvh-2rem)] open:flex open:flex-col',
            current.wide ? 'max-w-3xl' : 'max-w-lg',
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
            <h2 id={`${id}-title`} className="text-lg font-semibold">
              {current.title}
            </h2>
            <p className="text-muted-foreground text-sm">{current.description}</p>
            {current.content}
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(null)}>
                {t('close')}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
