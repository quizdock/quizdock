import {
  AUDIO_TARGETS,
  type AudioTarget,
  WAVEFORM_SIZES,
  type WaveformSize,
} from '@quiz-dock/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Waveform } from '../game/media/waveform';
import { MediaUpload } from './media-upload';
import { DisplayTimeFields } from './slide-display-time';
import { StepTimeline, type TimelineSelection, useAssetDurationMs } from './step-timeline';
import { type AddChoice, AddElementModal, ElementPanel } from './step-timeline-editing';
import { slideTimeline } from './step-timeline-model';
import { useStepView } from './use-step-view';

export interface SlideMediaValue {
  videoMediaId: string | null;
  videoLoop: boolean;
  videoSound: boolean;
  audioMediaId: string | null;
  waveformSize: WaveformSize;
  audioTarget: AudioTarget | null;
  displayDelayS: number | null;
}

/**
 * A slide's timeline (#125, SPECIFICATIONS-QUESTION-TIMELINE §4), as a question's: the
 * video fills the slide behind its content; with its sound on, it excludes the sound,
 * muted it goes with one. The time row opens the display time.
 */
export function SlideTimelineSection({
  value,
  onChange,
  peaks,
  onPeaks,
  defaultS,
  mediaTailS,
}: {
  value: SlideMediaValue;
  onChange: (patch: Partial<SlideMediaValue>) => void;
  /** The sound's waveform when known (a sound picked here). */
  peaks: number[] | null;
  onPeaks: (peaks: number[] | null) => void;
  /** The instance's display time, for a slide that keeps the default. */
  defaultS: number;
  /** The quiz's pause after a media. */
  mediaTailS: number;
}) {
  const { t } = useTranslation('editor');
  const [selected, setSelected] = useState<TimelineSelection | null>(null);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useStepView();
  const { videoMediaId, videoSound, audioMediaId } = value;
  const videoTakesSound = !!videoMediaId && videoSound;
  const videoMs = useAssetDurationMs(videoMediaId);
  const audioMs = useAssetDurationMs(audioMediaId);
  const close = () => setSelected(null);

  const choices: AddChoice[] = [
    { kind: 'video', refused: videoMediaId ? t('timeline.refused.oneVideo') : null },
    {
      kind: 'audio',
      refused: audioMediaId
        ? t('timeline.refused.oneSlideAudio')
        : videoTakesSound
          ? t('timeline.refused.slideVideoSound')
          : null,
    },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <StepTimeline
        model={slideTimeline({
          displayDelayS: value.displayDelayS,
          defaultS,
          video: videoMediaId
            ? { lengthMs: videoMs, loop: value.videoLoop, sound: videoSound }
            : null,
          audio: audioMediaId && !videoTakesSound ? { lengthMs: audioMs, peaks } : null,
          tailS: mediaTailS,
        })}
        edit={{
          selected,
          onSelect: setSelected,
          onAdd: () => setAdding(true),
          view: { value: view, onChange: setView },
          onClear:
            videoMediaId || audioMediaId
              ? () => {
                  onChange({ videoMediaId: null, audioMediaId: null });
                  onPeaks(null);
                  close();
                }
              : null,
        }}
      />
      <AddElementModal
        open={adding}
        choices={choices}
        onPick={(kind) => {
          setAdding(false);
          setSelected(kind);
        }}
        onClose={() => setAdding(false)}
      />
      {selected === 'time' ? (
        <ElementPanel title={t('timeline.slideSettings')} onClose={close}>
          <DisplayTimeFields
            value={value.displayDelayS}
            onChange={(v) => onChange({ displayDelayS: v })}
          />
        </ElementPanel>
      ) : selected === 'video' ? (
        <ElementPanel title={t('timeline.choice.video')} onClose={close}>
          <MediaUpload
            value={videoMediaId}
            // Picked next to a sound, it comes muted: one sound at a time.
            onChange={(id) => {
              onChange({ videoMediaId: id, ...(id && audioMediaId ? { videoSound: false } : {}) });
              if (!id) close();
            }}
            kind="video"
            label={t('media.addVideo')}
          />
          {videoMediaId ? (
            <>
              <p className="text-muted-foreground text-xs">{t('slideForm.videoCover')}</p>
              <CheckboxField
                checked={value.videoLoop}
                onChange={(v) => onChange({ videoLoop: v })}
                label={t('slideForm.videoLoop')}
                hint={t('slideForm.videoLoopHint')}
              />
              <CheckboxField
                checked={videoSound}
                // Its own sound needs the slide's to go; the builder asks before, as for a question.
                disabled={!!audioMediaId && !videoSound}
                onChange={(v) => onChange({ videoSound: v })}
                label={t('slideForm.videoSound')}
                hint={
                  !!audioMediaId && !videoSound
                    ? t('slideForm.audioExcludesVideoSound')
                    : t('slideForm.videoSoundHint')
                }
              />
              {videoTakesSound ? <AudioTargetField value={value} onChange={onChange} /> : null}
            </>
          ) : null}
        </ElementPanel>
      ) : selected === 'audio' ? (
        <ElementPanel title={t('timeline.choice.audio')} onClose={close}>
          <MediaUpload
            value={audioMediaId}
            onChange={(id, uploaded) => {
              onChange({ audioMediaId: id });
              onPeaks(id ? (uploaded?.peaks ?? null) : null);
              if (!id) close();
            }}
            kind="audio"
            label={t('media.addAudio')}
          />
          {audioMediaId ? (
            <>
              <AudioTargetField value={value} onChange={onChange} />
              <Label title={t('questionForm.waveformSizeHint')}>
                {t('questionForm.waveformSizeLabel')}
                <Select
                  value={value.waveformSize}
                  onChange={(e) => onChange({ waveformSize: e.target.value as WaveformSize })}
                >
                  {WAVEFORM_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {t(`questionForm.waveformSize.${size}`)}
                    </option>
                  ))}
                </Select>
              </Label>
              {value.waveformSize === 'hidden' ? (
                <p className="text-muted-foreground text-xs">
                  {t('questionForm.waveformHiddenNote')}
                </p>
              ) : null}
              {peaks ? (
                <Waveform
                  peaks={peaks}
                  progress={0}
                  size={value.waveformSize}
                  className={cn('text-base', value.waveformSize === 'hidden' && 'opacity-40')}
                  label={t('questionForm.waveformPreview')}
                />
              ) : null}
            </>
          ) : null}
        </ElementPanel>
      ) : null}
    </div>
  );
}

/** Which devices play the slide's sound, the video's or its own. */
function AudioTargetField({
  value,
  onChange,
}: {
  value: SlideMediaValue;
  onChange: (patch: Partial<SlideMediaValue>) => void;
}) {
  const { t } = useTranslation(['editor', 'common']);
  return (
    <Label title={t('questionForm.audioTargetHint')}>
      {t('questionForm.audioTargetLabel')}
      <Select
        value={value.audioTarget ?? ''}
        onChange={(e) =>
          onChange({
            audioTarget: e.target.value === '' ? null : (e.target.value as AudioTarget),
          })
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
  );
}
