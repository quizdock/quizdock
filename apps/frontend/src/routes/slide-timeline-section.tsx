import {
  type AudioTarget,
  MEDIA_POSITIONS,
  type MediaPosition,
  type MediaStyle,
  type WaveformSize,
} from '@quiz-dock/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { cn } from '@/lib/utils';
import { MediaDetailsFields, MediaUpload } from './media-upload';
import { PictureStyleEditor } from './picture-style-fields';
import { AudioTargetField, WaveformSizeField } from './sound-fields';
import { DisplayTimeFields } from './slide-display-time';
import { StepTimeline, type TimelineSelection, useAssetDurationMs } from './step-timeline';
import {
  type AddChoice,
  AddElementModal,
  ElementPanel,
  LayoutModal,
} from './step-timeline-editing';
import { slideTimeline } from './step-timeline-model';
import { useStepView } from './use-step-view';

export interface SlideMediaValue {
  /** Its picture, placed as a question's; never with a video (SPECIFICATIONS-STEP-EDITOR). */
  imageMediaId: string | null;
  videoMediaId: string | null;
  /** Where its picture or video sits against its blocks; behind them by default. */
  mediaPosition: MediaPosition;
  /** How its picture or video is framed; empty = as its file is (no reveal on a slide). */
  mediaStyle: MediaStyle;
  videoLoop: boolean;
  videoSound: boolean;
  audioMediaId: string | null;
  waveformSize: WaveformSize;
  audioTarget: AudioTarget | null;
  displayDelayS: number | null;
}

/**
 * A slide's timeline (#125, SPECIFICATIONS-STEP-EDITOR), as a question's: a picture or a
 * video, placed against its blocks by the same layouts (behind them by default, as a slide's
 * video always was) and framed by the same options; a video with its sound on excludes the
 * sound, muted it goes with one. The time row opens the display time.
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
  const [layingOut, setLayingOut] = useState(false);
  const [view, setView] = useStepView();
  const { imageMediaId, videoMediaId, videoSound, audioMediaId } = value;
  const visual = imageMediaId ? 'image' : videoMediaId ? 'video' : null;
  const videoTakesSound = !!videoMediaId && videoSound;
  const videoMs = useAssetDurationMs(videoMediaId);
  const audioMs = useAssetDurationMs(audioMediaId);
  const close = () => setSelected(null);

  const choices: AddChoice[] = [
    { kind: 'image', refused: visual ? t('timeline.refused.oneSlideVisual') : null },
    { kind: 'video', refused: visual ? t('timeline.refused.oneSlideVisual') : null },
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
          image: !!imageMediaId,
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
          layout: {
            open: () => setLayingOut(true),
            refused: visual ? null : t('timeline.layoutNeedsVisual'),
          },
          reset:
            visual || audioMediaId || value.displayDelayS !== null
              ? {
                  type: t('timeline.slideKind'),
                  seconds: defaultS,
                  run: () => {
                    onChange({
                      imageMediaId: null,
                      videoMediaId: null,
                      audioMediaId: null,
                      displayDelayS: null,
                      mediaPosition: 'behind',
                      mediaStyle: {},
                    });
                    onPeaks(null);
                    close();
                  },
                }
              : null,
          onClear:
            visual || audioMediaId
              ? () => {
                  onChange({ imageMediaId: null, videoMediaId: null, audioMediaId: null });
                  onPeaks(null);
                  close();
                }
              : null,
        }}
      />
      <LayoutModal
        open={layingOut}
        value={value.mediaPosition}
        choices={MEDIA_POSITIONS.map((position) => ({
          value: position,
          label: t(`questionForm.mediaPosition.${position}`),
          description: t(`timeline.slideLayoutDescription.${position}`),
        }))}
        onApply={(position) => {
          onChange({ mediaPosition: position });
          setLayingOut(false);
        }}
        onClose={() => setLayingOut(false)}
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
      ) : selected === 'image' ? (
        <ElementPanel
          title={t('timeline.choice.image')}
          onClose={close}
          onRemove={
            imageMediaId
              ? () => {
                  onChange({ imageMediaId: null });
                  close();
                }
              : undefined
          }
        >
          {/* The preview on the left, how it is shown on the right; its texts below. */}
          <div className={cn('grid items-start gap-4', imageMediaId && 'md:grid-cols-2')}>
            <MediaUpload
              value={imageMediaId}
              onChange={(id) => {
                onChange({ imageMediaId: id });
                if (!id) close();
              }}
              kind="image"
              label={t('media.addImage')}
              withDetails={!imageMediaId}
              removable={false}
            />
            {imageMediaId ? (
              <PictureStyleEditor
                value={value.mediaStyle}
                onChange={(mediaStyle) => onChange({ mediaStyle })}
                reveal={null}
                behind={value.mediaPosition === 'behind'}
              />
            ) : null}
          </div>
          {imageMediaId ? <MediaDetailsFields mediaId={imageMediaId} withAlt /> : null}
        </ElementPanel>
      ) : selected === 'video' ? (
        <ElementPanel
          title={t('timeline.choice.video')}
          onClose={close}
          onRemove={
            videoMediaId
              ? () => {
                  onChange({ videoMediaId: null });
                  close();
                }
              : undefined
          }
        >
          <MediaUpload
            value={videoMediaId}
            // Picked next to a sound, it comes muted: one sound at a time.
            onChange={(id) => {
              onChange({ videoMediaId: id, ...(id && audioMediaId ? { videoSound: false } : {}) });
              if (!id) close();
            }}
            kind="video"
            label={t('media.addVideo')}
            removable={false}
          />
          {videoMediaId ? (
            <>
              {value.mediaPosition === 'behind' ? (
                <p className="text-muted-foreground text-xs">{t('slideForm.videoCover')}</p>
              ) : null}
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
              {videoTakesSound ? (
                <AudioTargetField
                  value={value.audioTarget}
                  onChange={(audioTarget) => onChange({ audioTarget })}
                />
              ) : null}
              <PictureStyleEditor
                value={value.mediaStyle}
                onChange={(mediaStyle) => onChange({ mediaStyle })}
                reveal={null}
                behind={value.mediaPosition === 'behind'}
              />
            </>
          ) : null}
        </ElementPanel>
      ) : selected === 'audio' ? (
        <ElementPanel
          title={t('timeline.choice.audio')}
          onClose={close}
          onRemove={
            audioMediaId
              ? () => {
                  onChange({ audioMediaId: null });
                  onPeaks(null);
                  close();
                }
              : undefined
          }
        >
          <MediaUpload
            value={audioMediaId}
            onChange={(id, uploaded) => {
              onChange({ audioMediaId: id });
              onPeaks(id ? (uploaded?.peaks ?? null) : null);
              if (!id) close();
            }}
            kind="audio"
            label={t('media.addAudio')}
            removable={false}
          />
          {audioMediaId ? (
            <>
              <AudioTargetField
                value={value.audioTarget}
                onChange={(audioTarget) => onChange({ audioTarget })}
              />
              <WaveformSizeField
                value={value.waveformSize}
                onChange={(waveformSize) => onChange({ waveformSize })}
                peaks={peaks}
              />
            </>
          ) : null}
        </ElementPanel>
      ) : null}
    </div>
  );
}
