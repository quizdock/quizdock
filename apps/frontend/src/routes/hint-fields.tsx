import { HINT_TEXT_MAX, type QuestionHint } from '@quiz-dock/contracts';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MediaUpload } from './media-upload';
import type { QuestionFormApi } from './question-form-model';

/**
 * A question's hint (SPECIFICATIONS-HINTS): its words, its picture, or both; when it comes
 * after the answers open, and the share of the question's points an answer given after it
 * loses. The room gets it at that time, when the host's hints are on.
 */
export function HintFields({
  form,
  timeLimitS,
}: {
  form: QuestionFormApi;
  /** It comes before the answers close. */
  timeLimitS: number;
}) {
  const { t } = useTranslation('editor');
  return (
    <form.Field name="hint">
      {(field) => {
        const hint = field.state.value;
        if (!hint) return null;
        const set = (patch: Partial<QuestionHint>) => field.handleChange({ ...hint, ...patch });
        const bounded = (raw: string, max: number) =>
          Math.min(max, Math.max(0, Math.round(Number(raw) || 0)));
        return (
          <div className="flex flex-col gap-3">
            <Label>
              {t('timeline.hint.text')}
              <Input
                value={hint.text}
                maxLength={HINT_TEXT_MAX}
                placeholder={t('timeline.hint.textPlaceholder')}
                onChange={(e) => set({ text: e.target.value })}
              />
            </Label>
            <p className="text-muted-foreground -mt-2 text-xs">
              {t('timeline.hint.textHint', { n: hint.text.length, max: HINT_TEXT_MAX })}
            </p>
            {/* A picture of the library, with or without words. */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t('timeline.hint.image')}</span>
              <MediaUpload
                value={hint.imageMediaId ?? null}
                onChange={(id) => set({ imageMediaId: id })}
                kind="image"
                label={t('media.addImage')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Label>
                {t('timeline.hint.afterS')}
                <Input
                  type="number"
                  min={0}
                  max={timeLimitS - 1}
                  value={hint.afterS}
                  onChange={(e) => set({ afterS: bounded(e.target.value, timeLimitS - 1) })}
                />
              </Label>
              <Label>
                {t('timeline.hint.penalty')}
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={hint.penaltyPct}
                  onChange={(e) => set({ penaltyPct: bounded(e.target.value, 100) })}
                />
              </Label>
            </div>
            <p className="text-muted-foreground text-xs">
              {t('timeline.hint.rule', { penalty: hint.penaltyPct })}
            </p>
          </div>
        );
      }}
    </form.Field>
  );
}
