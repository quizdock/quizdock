import type { MediaPosition, SlideBlock } from '@quiz-dock/contracts';
import { Image as ImageIcon, LayoutTemplate } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import {
  SLIDE_LAYOUTS,
  type SketchPart,
  type SlideLayoutId,
  applyLayout,
  blocksEmpty,
} from './slide-layouts';

/**
 * The slide's ready-made layouts (SPECIFICATIONS-SLIDE-LAYOUTS), each drawn as the slide
 * it gives: those that lay blocks out for an empty slide, then those that place its media,
 * for any slide. One is picked, then applied; nothing else changes.
 */
export function SlideLayoutsButton({
  blocks,
  onApply,
}: {
  blocks: SlideBlock[];
  onApply: (laid: { blocks: SlideBlock[]; mediaPosition: MediaPosition }) => void;
}) {
  const { t } = useTranslation(['editor', 'common']);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<SlideLayoutId | null>(null);
  const empty = blocksEmpty(blocks);
  const close = () => {
    setOpen(false);
    setPicked(null);
  };
  const group = (scope: 'empty' | 'any') => (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {SLIDE_LAYOUTS.filter((l) => l.scope === scope).map((l) => {
        const refused = scope === 'empty' && !empty;
        return (
          <button
            key={l.id}
            type="button"
            aria-pressed={l.id === picked}
            disabled={refused}
            title={refused ? t('slideLayouts.emptyOnly') : undefined}
            onClick={() => setPicked(l.id)}
            className={cn(
              'hover:bg-accent focus-visible:ring-ring flex flex-col items-center gap-1.5 rounded-md border p-2 text-xs focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40',
              l.id === picked && 'border-primary ring-primary ring-1',
            )}
          >
            <SlideSketch parts={l.sketch} />
            {t(`slideLayouts.layout.${l.id}`)}
          </button>
        );
      })}
    </div>
  );
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 self-start text-xs"
        onClick={() => setOpen(true)}
      >
        <LayoutTemplate className="size-3.5" />
        {t('slideLayouts.button')}
      </Button>
      <Modal open={open} onClose={close} aria-label={t('slideLayouts.title')} className="max-w-3xl">
        <div className="flex flex-col gap-3 p-3">
          <h2 className="text-sm font-semibold">{t('slideLayouts.title')}</h2>
          <h3 className="text-muted-foreground text-xs font-medium">
            {t('slideLayouts.groupEmpty')}
            {empty ? null : ` — ${t('slideLayouts.emptyOnly')}`}
          </h3>
          {group('empty')}
          <h3 className="text-muted-foreground text-xs font-medium">
            {t('slideLayouts.groupMedia')}
          </h3>
          {group('any')}
          <p className="text-muted-foreground min-h-[2.5em] text-sm" aria-live="polite">
            {picked ? t(`slideLayouts.description.${picked}`) : null}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={close}>
              {t('common:cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!picked}
              onClick={() => {
                if (!picked) return;
                onApply(
                  applyLayout(picked, blocks, {
                    welcomeTitle: t('slideLayouts.welcomeTitle'),
                    welcomeText: t('slideLayouts.welcomeText'),
                  }),
                );
                close();
              }}
            >
              {t('timeline.layoutApply')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** A small slide: its headings, texts and media as bars and boxes, behind or alone. */
function SlideSketch({ parts }: { parts: SketchPart[] }) {
  const behind = parts.includes('behind');
  const alone = parts.includes('alone');
  const side = parts.includes('left') ? 'left' : parts.includes('right') ? 'right' : null;
  if (side)
    return (
      <div
        aria-hidden
        className={cn(
          'bg-background flex aspect-video w-full gap-1 overflow-hidden rounded-sm border p-1.5',
          side === 'right' && 'flex-row-reverse',
        )}
      >
        <MediaBox className="w-2/5" />
        <span className="flex flex-1 flex-col justify-center gap-1">
          {parts.map((p, i) => (
            <SketchItem key={i} part={p} />
          ))}
        </span>
      </div>
    );
  return (
    <div
      aria-hidden
      className={cn(
        'relative flex aspect-video w-full flex-col justify-center gap-1 overflow-hidden rounded-sm border p-1.5',
        behind ? 'bg-primary/25' : 'bg-background',
      )}
    >
      {alone ? <MediaBox className="absolute inset-1" /> : null}
      {parts.map((p, i) => (
        <SketchItem key={i} part={p} />
      ))}
    </div>
  );
}

function SketchItem({ part }: { part: SketchPart }) {
  if (part === 'behind' || part === 'alone' || part === 'left' || part === 'right') return null;
  if (part === 'h1') return <span className="bg-foreground/70 mx-auto h-1.5 w-3/5 rounded-full" />;
  if (part === 'h2') return <span className="bg-foreground/50 mx-auto h-1 w-2/5 rounded-full" />;
  if (part === 'text')
    return (
      <span className="flex flex-col items-center gap-0.5">
        <span className="bg-foreground/25 h-0.5 w-4/5 rounded-full" />
        <span className="bg-foreground/25 h-0.5 w-3/5 rounded-full" />
      </span>
    );
  if (part === 'media') return <MediaBox className="min-h-0 flex-1" />;
  return (
    <span
      className="grid min-h-0 flex-1 gap-1"
      style={{ gridTemplateColumns: `repeat(${part.columns.length}, minmax(0, 1fr))` }}
    >
      {part.columns.map((col, i) => (
        <span key={i} className="flex min-h-0 flex-col justify-center gap-1">
          {col.map((p, k) => (
            <SketchItem key={k} part={p} />
          ))}
        </span>
      ))}
    </span>
  );
}

function MediaBox({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'bg-primary/20 text-primary flex items-center justify-center rounded-[2px]',
        className,
      )}
    >
      <ImageIcon className="size-3" />
    </span>
  );
}
