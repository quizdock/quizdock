import { Lightbulb, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A revealed hint on a phone (SPECIFICATIONS-HINTS): above the answers, folded and
 * opened again by its owner alone — the projection is the host's.
 */
export function PhoneHint({ text }: { text: string }) {
  const { t } = useTranslation('live');
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-warning bg-warning/10 inline-flex w-fit items-center gap-[0.4em] self-start rounded-full border px-[0.8em] py-[0.2em] text-[0.9em]"
      >
        <Lightbulb className="size-[1em]" aria-hidden />
        {t('hint.show')}
      </button>
    );
  }
  return (
    <div
      role="status"
      className="border-warning bg-warning/10 flex items-start gap-[0.5em] rounded-[0.5em] border px-[0.7em] py-[0.5em]"
    >
      <Lightbulb className="mt-[0.15em] size-[1.1em] shrink-0" aria-hidden />
      <span className="flex-1 font-medium">{text}</span>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label={t('hint.fold')}
        className="text-muted-foreground hover:text-foreground -m-1 rounded p-1"
      >
        <X className="size-[1em]" />
      </button>
    </div>
  );
}
