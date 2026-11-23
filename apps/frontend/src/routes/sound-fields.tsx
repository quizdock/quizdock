import {
  AUDIO_TARGETS,
  type AudioTarget,
  WAVEFORM_SIZES,
  type WaveformSize,
} from '@quiz-dock/contracts';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Waveform } from '../game/media/waveform';

/**
 * How a step's sound plays, a question's or a slide's (SPECIFICATIONS-STEP-EDITOR): on
 * which devices; null = the quiz's setting in the lobby.
 */
export function AudioTargetField({
  value,
  onChange,
}: {
  value: AudioTarget | null;
  onChange: (target: AudioTarget | null) => void;
}) {
  const { t } = useTranslation(['editor', 'common']);
  return (
    <Label title={t('questionForm.audioTargetHint')}>
      {t('questionForm.audioTargetLabel')}
      <Select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : (e.target.value as AudioTarget))}
      >
        <option value="">{t('questionForm.audioTargetDefault')}</option>
        {AUDIO_TARGETS.map((target) => (
          <option key={target} value={target}>
            {t(`settings.audioTarget.${target}`)}
          </option>
        ))}
      </Select>
    </Label>
  );
}

/**
 * How thick a sound's waveform is drawn on the screens, previewed at its size when its
 * peaks are known — or, hidden, the one place it still shows (faded, with why).
 */
export function WaveformSizeField({
  value,
  onChange,
  peaks,
}: {
  value: WaveformSize;
  onChange: (size: WaveformSize) => void;
  peaks: number[] | null;
}) {
  const { t } = useTranslation('editor');
  return (
    <div className="flex flex-col gap-1.5">
      <Label title={t('questionForm.waveformSizeHint')}>
        {t('questionForm.waveformSizeLabel')}
        <Select value={value} onChange={(e) => onChange(e.target.value as WaveformSize)}>
          {WAVEFORM_SIZES.map((size) => (
            <option key={size} value={size}>
              {t(`questionForm.waveformSize.${size}`)}
            </option>
          ))}
        </Select>
      </Label>
      {value === 'hidden' ? (
        <p className="text-muted-foreground text-xs">{t('questionForm.waveformHiddenNote')}</p>
      ) : null}
      {peaks ? (
        <Waveform
          peaks={peaks}
          progress={0}
          size={value}
          className={cn('text-base', value === 'hidden' && 'opacity-40')}
          label={t('questionForm.waveformPreview')}
        />
      ) : null}
    </div>
  );
}
