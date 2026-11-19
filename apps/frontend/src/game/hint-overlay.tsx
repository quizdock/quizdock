import { Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * A revealed hint on the projection (SPECIFICATIONS-HINTS): over the stage, in the
 * middle, readable from the back of the room, with what it costs.
 */
export function HintOverlay({
  text,
  image,
  penaltyPct,
}: {
  text: string;
  /** Its picture, above its words. */
  image?: { url: string };
  penaltyPct: number;
}) {
  const { t } = useTranslation('live');
  return (
    <div
      role="status"
      className="qd-hint border-warning absolute top-1/2 left-1/2 z-30 flex max-w-[80%] -translate-x-1/2 -translate-y-1/2 items-center gap-[0.6em] rounded-[0.6em] border-[0.12em] bg-black/75 px-[1em] py-[0.6em] text-white shadow-2xl"
    >
      <Lightbulb className="size-[1.6em] shrink-0 text-warning" aria-hidden />
      <span className="flex flex-col gap-[0.4em]">
        {image ? (
          <img
            src={image.url}
            alt={text || t('hint.imageAlt')}
            className="max-h-[8em] w-auto self-start rounded-[0.3em] object-contain"
          />
        ) : null}
        {text ? <span className="text-[1.6em] leading-tight font-semibold">{text}</span> : null}
        <span className="text-[0.85em] opacity-80">{t('hint.costs', { penalty: penaltyPct })}</span>
      </span>
    </div>
  );
}
