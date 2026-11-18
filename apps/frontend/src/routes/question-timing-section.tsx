import { REVEAL_DELAY_S, TIME_LIMIT_S } from '@quiz-dock/contracts';
import { useStore } from '@tanstack/react-form';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Disclosure } from '@/components/ui/disclosure';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { appConfig } from '../config';
import { clampReveal, clampTime, type QuestionFormApi } from './question-form-model';

/** The question's time and its reveal: folded, its summary says the time the room will really get. */
export function QuestionTimingSection({
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
  const revealDelayS = useStore(form.store, (s) => s.values.revealDelayS);
  const listenFirst = useStore(form.store, (s) => s.values.timerAfterMedia);
  // A time typed out of bounds was brought back to the nearest one: said once, under it.
  const [clamped, setClamped] = useState<'time' | 'reveal' | null>(null);
  return (
    <Disclosure
      title={t('questionForm.timingLegend')}
      value={[
        stretchedS > timeLimitS && !(canListenFirst && listenFirst)
          ? t('questionForm.timingSummaryStretched', {
              time: timeLimitS,
              total: stretchedS,
            })
          : t('questionForm.timingSummary', { time: timeLimitS }),
        revealDelayS == null
          ? appConfig.autoAdvanceS
            ? t('questionForm.revealDelaySummaryAuto', {
                seconds: appConfig.autoAdvanceS,
              })
            : t('questionForm.revealDelayAuto')
          : t('questionForm.revealDelaySummary', { seconds: revealDelayS }),
      ].join(' · ')}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <form.Field name="timeLimitS">
          {(field) => (
            <Label>
              {t('questionForm.timeLimitLabel')}
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
      ) : null}
    </Disclosure>
  );
}
