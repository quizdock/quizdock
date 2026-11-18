import { REVEAL_DELAY_S, TIME_LIMIT_S } from '@quiz-dock/contracts';
import { useStore } from '@tanstack/react-form';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { appConfig } from '../config';
import { clampReveal, clampTime, type QuestionFormApi } from './question-form-model';

/**
 * The question's own settings, the drawer of its timeline's time row: its minimum
 * duration, its reveal, listening first; under them, the time the room will really get.
 */
export function QuestionTimingFields({
  form,
  stretchedS,
  canListenFirst,
  mediaMs,
  mediaTailS,
}: {
  form: QuestionFormApi;
  /** The answer time once a longer media stretched it. */
  stretchedS: number;
  canListenFirst: boolean;
  mediaMs: number | null;
  /** The quiz's pause after a media. */
  mediaTailS: number;
}) {
  const { t } = useTranslation(['editor', 'common']);
  const timeLimitS = useStore(form.store, (s) => s.values.timeLimitS);
  const listenFirst = useStore(form.store, (s) => s.values.timerAfterMedia);
  // A time typed out of bounds was brought back to the nearest one: said once, under it.
  const [clamped, setClamped] = useState<'time' | 'reveal' | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <form.Field name="timeLimitS">
          {(field) => (
            <Label>
              {t('timeline.minimumLabel')}
              <Input
                type="number"
                min={TIME_LIMIT_S.min}
                max={TIME_LIMIT_S.max}
                value={field.state.value}
                onChange={(e) => field.handleChange(Number(e.target.value))}
                // Out of bounds, the nearest bound — and a note, not an error.
                onBlur={() => {
                  const next = clampTime(field.state.value);
                  setClamped(next === field.state.value ? null : 'time');
                  field.handleChange(next);
                }}
              />
            </Label>
          )}
        </form.Field>
        <form.Field name="revealDelayS">
          {(field) => (
            <Label title={t('questionForm.revealDelayHint')}>
              {t('questionForm.revealDelayLabel')}
              <Input
                type="number"
                min={REVEAL_DELAY_S.min}
                max={REVEAL_DELAY_S.max}
                placeholder={
                  appConfig.autoAdvanceS
                    ? t('questionForm.revealDelayAutoValue', {
                        seconds: appConfig.autoAdvanceS,
                      })
                    : t('questionForm.revealDelayPlaceholder')
                }
                value={field.state.value ?? ''}
                onChange={(e) =>
                  field.handleChange(e.target.value === '' ? null : Number(e.target.value))
                }
                onBlur={() => {
                  const next = clampReveal(field.state.value);
                  setClamped(next === field.state.value ? null : 'reveal');
                  field.handleChange(next);
                }}
              />
            </Label>
          )}
        </form.Field>
      </div>
      {canListenFirst ? (
        <form.Field name="timerAfterMedia">
          {(field) => (
            <CheckboxField
              title={t('questionForm.listenFirstHint')}
              checked={field.state.value}
              onChange={field.handleChange}
              label={t('questionForm.listenFirstLabel')}
              hint={t('questionForm.listenFirstHint')}
            />
          )}
        </form.Field>
      ) : null}
      {clamped ? (
        <p className="text-muted-foreground text-sm" role="note">
          {clamped === 'time'
            ? t('questionForm.clampedTime', {
                ...TIME_LIMIT_S,
                value: timeLimitS,
              })
            : t('questionForm.clampedReveal', {
                ...REVEAL_DELAY_S,
                value: form.getFieldValue('revealDelayS'),
              })}
        </p>
      ) : null}
      {canListenFirst && listenFirst ? (
        <p className="text-muted-foreground text-sm" role="note">
          {t('questionForm.listenFirstTime', {
            media: Math.ceil((mediaMs ?? 0) / 1000),
            time: timeLimitS,
          })}
        </p>
      ) : stretchedS > timeLimitS ? (
        <p className="text-muted-foreground text-sm" role="note">
          {t('questionForm.stretchedTime', {
            media: Math.ceil((mediaMs ?? 0) / 1000),
            total: stretchedS,
            tail: mediaTailS,
          })}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">{t('timeline.minimumHint')}</p>
      )}
    </div>
  );
}
