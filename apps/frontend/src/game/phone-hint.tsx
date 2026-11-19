import { ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A revealed hint on a phone (SPECIFICATIONS-HINTS): a bar attached on top of the answer
 * tiles, its text unfolding upwards over the question; folded and opened again by its
 * owner alone — the projection is the host's.
 */
export function PhoneHint({ text, image }: { text: string; image?: { url: string } }) {
  const { t } = useTranslation('live');
  const [open, setOpen] = useState(true);
  return (
    <div className="border-warning bg-warning/10 flex w-full flex-col overflow-hidden rounded-[0.6em] border">
      {open ? (
        <div role="status" className="flex flex-col gap-[0.4em] px-[0.8em] pt-[0.6em]">
          {image ? (
            <img
              src={image.url}
              alt={text || t('hint.imageAlt')}
              className="max-h-[25dvh] w-auto self-start rounded-[0.4em] object-contain"
            />
          ) : null}
          {text ? <p className="font-medium">{text}</p> : null}
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="text-warning-text flex w-full items-center gap-[0.4em] px-[0.8em] py-[0.4em] text-[0.9em] font-medium"
      >
        <Lightbulb className="size-[1.1em]" aria-hidden />
        {t('hint.label')}
        <span className="ml-auto inline-flex items-center gap-[0.2em]">
          {open ? t('hint.fold') : t('hint.show')}
          {open ? (
            <ChevronDown className="size-[1em]" aria-hidden />
          ) : (
            <ChevronUp className="size-[1em]" aria-hidden />
          )}
        </span>
      </button>
    </div>
  );
}
