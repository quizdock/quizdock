import type { QuestionHintPayload, QuestionStartPayload } from '@quiz-dock/contracts';
import { Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

/**
 * The host's hand on the current question's hint (SPECIFICATIONS-HINTS): the game's
 * switch, when it comes and what it costs, a reminder when hints are off on a question
 * that has one, and once it is out, its text and whether the projection shows it.
 */
export function HintControls({
  question,
  hint,
  enabled,
  onEnabled,
  onShown,
}: {
  question: QuestionStartPayload | null;
  hint: QuestionHintPayload | null;
  enabled: boolean;
  onEnabled: (enabled: boolean) => void;
  onShown: (shown: boolean) => void;
}) {
  const { t } = useTranslation('live');
  const planned = question?.hint;
  if (!planned) return null;
  const out = hint?.questionIndex === question.questionIndex ? hint : null;
  return (
    <section
      aria-label={t('hint.consoleLabel')}
      className="flex flex-col gap-2 rounded-md border p-3 text-sm"
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 font-medium">
          <Switch checked={enabled} onCheckedChange={onEnabled} aria-label={t('hint.switch')} />
          {t('hint.switch')}
        </label>
        <span className="border-warning bg-warning/10 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
          <Lightbulb className="size-3.5" aria-hidden />
          {out
            ? t('hint.revealed', { penalty: out.penaltyPct })
            : t('hint.planned', { seconds: planned.afterS, penalty: planned.penaltyPct })}
        </span>
      </div>
      {!enabled && !out ? (
        // On late, it comes at once: the host's call.
        <div
          role="note"
          className="border-warning text-warning-text bg-warning/10 flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
        >
          <Lightbulb className="size-3.5 shrink-0" aria-hidden />
          {t('hint.reminder')}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto h-7"
            onClick={() => onEnabled(true)}
          >
            {t('hint.enable')}
          </Button>
        </div>
      ) : null}
      {out ? (
        <div className="flex flex-wrap items-center gap-3">
          {out.image ? (
            <img src={out.image.url} alt="" className="h-12 w-auto rounded object-contain" />
          ) : null}
          <p className="min-w-0 flex-1 font-medium">{out.text}</p>
          <label className="text-muted-foreground flex items-center gap-2 text-xs">
            <Switch
              checked={out.shown}
              onCheckedChange={onShown}
              aria-label={t('hint.onProjection')}
            />
            {t('hint.onProjection')}
          </label>
        </div>
      ) : null}
    </section>
  );
}
