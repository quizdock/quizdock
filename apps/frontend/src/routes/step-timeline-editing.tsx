import {
  AlignLeft,
  Image as ImageIcon,
  type LucideIcon,
  Music,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import type { TimelineElement } from './step-timeline-model';

/** The kinds of element a step can be given. */
export type AddableKind = TimelineElement['kind'];

/** One kind the + offers, and why the format refuses it here, if it does. */
export interface AddChoice {
  kind: AddableKind;
  /** Why it cannot be added; null when it can. */
  refused: string | null;
}

export const KIND_ICON: Record<AddableKind, LucideIcon> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  reveal: Sparkles,
  explanation: AlignLeft,
};

/** Each kind in its channel's colour: a video sits on both. */
const KIND_COLOR: Record<AddableKind, string> = {
  image: 'var(--timeline-visual)',
  video: 'var(--timeline-visual)',
  audio: 'var(--timeline-audio)',
  reveal: 'var(--timeline-visual)',
  explanation: 'var(--timeline-visual)',
};

/**
 * The + of the timeline: the kinds of element, those the format refuses left in sight,
 * disabled, with the reason in place of their description.
 */
export function AddElementModal({
  open,
  choices,
  onPick,
  onClose,
}: {
  open: boolean;
  choices: AddChoice[];
  onPick: (kind: AddableKind) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('editor');
  return (
    <Modal open={open} onClose={onClose} aria-label={t('timeline.add')} className="max-w-sm">
      <div className="flex flex-col gap-2 p-3">
        <h2 className="text-sm font-semibold">{t('timeline.add')}</h2>
        {choices.map(({ kind, refused }) => {
          const Icon = KIND_ICON[kind];
          return (
            <button
              key={kind}
              type="button"
              disabled={refused !== null}
              onClick={() => onPick(kind)}
              className="hover:bg-accent focus-visible:ring-ring grid grid-cols-[1.5rem_1fr] items-center gap-x-2 rounded-md border p-2 text-left focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
            >
              <Icon
                className="row-span-2 size-[18px]"
                style={{ color: KIND_COLOR[kind] }}
                aria-hidden
              />
              <span className="text-sm font-medium">{t(`timeline.choice.${kind}`)}</span>
              <span className="text-muted-foreground text-xs">
                {refused ?? t(`timeline.choice.${kind}Hint`)}
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/**
 * The selected element's properties, with its preview, or the step's own settings: a
 * panel right under the timeline, which stays in sight, and inside the form (its fields
 * save with it). Escape or its cross closes it.
 */
export function ElementPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation('common');
  const panel = useRef<HTMLDivElement>(null);
  // Opened, it comes into sight and the focus moves in: the keyboard goes on from there.
  useEffect(() => {
    panel.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    panel.current
      ?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])')
      ?.focus({ preventScroll: true });
  }, [title]);
  return (
    <div
      ref={panel}
      role="region"
      aria-label={title}
      className="bg-card flex flex-col gap-3 rounded-md border p-3"
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || e.defaultPrevented) return;
        e.preventDefault();
        onClose();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <button
          type="button"
          data-close
          aria-label={t('close')}
          className="text-muted-foreground hover:text-foreground rounded p-1"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

/** One ready-made layout: where the picture or the video sits against the text. */
export interface LayoutChoice<T extends string> {
  value: T;
  label: string;
  /** What it gives on the screens, shown once picked. */
  description: string;
}

type Layout = 'top' | 'bottom' | 'left' | 'right' | 'behind' | 'alone';

/**
 * The layouts a step offers, each drawn as the screen it gives. One is picked, its
 * description says what it gives, the button applies it. They only set what the step
 * already holds (a question's `mediaPosition`).
 */
export function LayoutModal<T extends Layout>({
  open,
  value,
  choices,
  onApply,
  onClose,
}: {
  open: boolean;
  value: T;
  choices: LayoutChoice<T>[];
  onApply: (value: T) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(['editor', 'common']);
  const [picked, setPicked] = useState(value);
  // Each opening starts from the step's own layout.
  useEffect(() => {
    if (open) setPicked(value);
  }, [open, value]);
  const description = choices.find((c) => c.value === picked)?.description;
  return (
    <Modal open={open} onClose={onClose} aria-label={t('timeline.layout')} className="max-w-lg">
      <div className="flex flex-col gap-3 p-3">
        <h2 className="text-sm font-semibold">{t('timeline.layout')}</h2>
        <div className="grid grid-cols-3 gap-2">
          {choices.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={c.value === picked}
              onClick={() => setPicked(c.value)}
              className={cn(
                'hover:bg-accent focus-visible:ring-ring flex flex-col items-center gap-1.5 rounded-md border p-2 text-xs focus-visible:ring-2 focus-visible:outline-none',
                c.value === picked && 'border-primary ring-primary ring-1',
              )}
            >
              <LayoutSketch layout={c.value} />
              {c.label}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground min-h-[2.5em] text-sm" aria-live="polite">
          {description}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button type="button" size="sm" onClick={() => onApply(picked)}>
            {t('timeline.layoutApply')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** A small screen: the media's box against the text's lines, the answers below. */
function LayoutSketch({ layout }: { layout: Layout }) {
  const lines = (
    <span className="flex flex-1 flex-col items-center justify-center gap-1">
      <span className="bg-muted-foreground/50 h-1 w-4/5 rounded-full" />
      <span className="bg-muted-foreground/50 h-1 w-3/5 rounded-full" />
    </span>
  );
  const media = <span className="bg-timeline-visual/60 min-h-0 flex-1 rounded-sm" />;
  const row = layout === 'left' || layout === 'right';
  return (
    <span className="bg-background flex aspect-video w-full flex-col gap-1 rounded border p-1.5">
      {layout === 'behind' ? (
        <span className="bg-timeline-visual/60 flex min-h-0 flex-[3] rounded-sm">
          <span className="flex flex-1 flex-col items-center justify-center gap-1">
            <span className="bg-foreground/80 h-1 w-3/5 rounded-full" />
            <span className="bg-foreground/80 h-1 w-2/5 rounded-full" />
          </span>
        </span>
      ) : layout === 'alone' ? (
        <span className="flex min-h-0 flex-[3]">{media}</span>
      ) : (
        <span className={cn('flex min-h-0 flex-[3] gap-1.5', row ? 'flex-row' : 'flex-col')}>
          {layout === 'top' || layout === 'left' ? (
            <>
              {media}
              {lines}
            </>
          ) : (
            <>
              {lines}
              {media}
            </>
          )}
        </span>
      )}
      <span className="grid flex-1 grid-cols-4 gap-0.5">
        {['bg-answer-green', 'bg-answer-red', 'bg-answer-blue', 'bg-answer-yellow'].map((c) => (
          <span key={c} className={cn('rounded-sm', c)} />
        ))}
      </span>
    </span>
  );
}
