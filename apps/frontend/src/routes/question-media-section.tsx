import {
  AUDIO_TARGETS,
  type AudioTarget,
  MEDIA_POSITIONS,
  type MediaPosition,
  WAVEFORM_SIZES,
  type WaveformSize,
} from '@quiz-dock/contracts';
import { useStore } from '@tanstack/react-form';
import { type LucideIcon, PanelBottom, PanelLeft, PanelRight, PanelTop } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { Disclosure } from '@/components/ui/disclosure';
import { FieldMessage } from '@/components/ui/field-message';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import type { FieldIssue } from '@/lib/question-issues';
import { cn } from '@/lib/utils';
import { Waveform } from '../game/media/waveform';
import { mediaHasSound, type QuestionFormApi } from './question-form-model';
import { QuestionMediaField } from './question-media-field';

/** Each place of the picture, drawn as the screen it gives. */
const POSITION_ICON: Record<MediaPosition, LucideIcon> = {
  bottom: PanelBottom,
  top: PanelTop,
  left: PanelLeft,
  right: PanelRight,
};

/**
 * The question's media, folded in one block: the picture's place, listening first, then
 * how its sound plays.
 */
export function QuestionMediaSection({
  form,
  canListenFirst,
  issues,
}: {
  form: QuestionFormApi;
  /** A sound or a video of known length: the timer may wait for its end. */
  canListenFirst: boolean;
  issues: FieldIssue[];
}) {
  const { t } = useTranslation(['editor', 'common']);
  const type = useStore(form.store, (s) => s.values.type);
  const media = useStore(form.store, (s) => s.values.media);
  // Read on the folded line.
  const audioTarget = useStore(form.store, (s) => s.values.audioTarget);
  const waveformSize = useStore(form.store, (s) => s.values.waveformSize);
  return (
    <div id="qf-media" className="flex flex-col gap-1.5">
      <QuestionMediaField
        value={media}
        onChange={(m) => form.setFieldValue('media', m)}
        withVisual={type !== 'image_choice'}
      >
        {media.visual ? (
          // Where the picture sits against the text on the big screen; the answers stay below.
          <form.Field name="mediaPosition">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t('questionForm.mediaPositionLabel')}</span>
                <Segmented
                  label={t('questionForm.mediaPositionLabel')}
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={MEDIA_POSITIONS.map((position) => ({
                    value: position,
                    label: t(`questionForm.mediaPosition.${position}`),
                    icon: POSITION_ICON[position],
                  }))}
                />
                <p className="text-muted-foreground text-xs">
                  {t('questionForm.mediaPositionHint')}
                </p>
              </div>
            )}
          </form.Field>
        ) : null}
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
        {mediaHasSound(media) ? (
          <Disclosure
            title={t('questionForm.playbackLegend')}
            value={[
              audioTarget
                ? t(`settings.audioTarget.${audioTarget}`)
                : t('questionForm.audioTargetDefault'),
              media.audio ? t(`questionForm.waveformSize.${waveformSize}`) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          >
            <form.Field name="audioTarget">
              {(field) => (
                <Label title={t('questionForm.audioTargetHint')}>
                  {t('questionForm.audioTargetLabel')}
                  <Select
                    value={field.state.value ?? ''}
                    onChange={(e) =>
                      field.handleChange(
                        e.target.value === '' ? null : (e.target.value as AudioTarget),
                      )
                    }
                  >
                    <option value="">{t('questionForm.audioTargetDefault')}</option>
                    {AUDIO_TARGETS.map((target) => (
                      <option key={target} value={target}>
                        {t(`settings.audioTarget.${target}`)}
                      </option>
                    ))}
                  </Select>
                </Label>
              )}
            </form.Field>
            {media.audio ? (
              <form.Field name="waveformSize">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label title={t('questionForm.waveformSizeHint')}>
                      {t('questionForm.waveformSizeLabel')}
                      <Select
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value as WaveformSize)}
                      >
                        {WAVEFORM_SIZES.map((size) => (
                          <option key={size} value={size}>
                            {t(`questionForm.waveformSize.${size}`)}
                          </option>
                        ))}
                      </Select>
                    </Label>
                    {/* As the screens will draw it, at their type size — or, hidden,
                        the one place it still shows (faded, with why). */}
                    {field.state.value === 'hidden' ? (
                      <p className="text-muted-foreground text-xs">
                        {t('questionForm.waveformHiddenNote')}
                      </p>
                    ) : null}
                    <Waveform
                      peaks={media.audio?.peaks ?? []}
                      progress={0}
                      size={field.state.value}
                      className={cn('text-base', field.state.value === 'hidden' && 'opacity-40')}
                      label={t('questionForm.waveformPreview')}
                    />
                  </div>
                )}
              </form.Field>
            ) : null}
          </Disclosure>
        ) : null}
      </QuestionMediaField>
      <FieldMessage issues={issues} />
    </div>
  );
}
