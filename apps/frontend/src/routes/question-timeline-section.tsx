import {
  AUDIO_TARGETS,
  type Audio,
  type AudioTarget,
  effectiveTimeLimitS,
  MEDIA_POSITIONS,
  type QuestionMedia,
  WAVEFORM_SIZES,
  type WaveformSize,
} from '@quiz-dock/contracts';
import { useStore } from '@tanstack/react-form';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { FieldMessage } from '@/components/ui/field-message';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { FieldIssue } from '@/lib/question-issues';
import { cn } from '@/lib/utils';
import { Waveform } from '../game/media/waveform';
import { MediaDetailsFields, MediaUpload, type UploadedMedia } from './media-upload';
import { mediaHasSound, type QuestionFormApi, READ_DELAY_DEFAULT_MS } from './question-form-model';
import { PictureStyleFields, REVEAL_DEFAULT_S } from './picture-style-fields';
import { QuestionTimingFields } from './question-timing-section';
import { StepTimeline, type TimelineSelection, useAssetDurationMs } from './step-timeline';
import {
  type AddChoice,
  AddElementModal,
  ElementPanel,
  LayoutModal,
} from './step-timeline-editing';
import { questionTimeline } from './step-timeline-model';

/**
 * The question's timeline, where its media are added and its flow set
 * (SPECIFICATIONS-QUESTION-TIMELINE §4): the + offers what the format allows, an element
 * or the time row opens its drawer. The visual holds an image or a video; a video brings
 * its own sound, so it never goes with an audio.
 */
export function QuestionTimelineSection({
  form,
  mediaTailS,
  issues,
}: {
  form: QuestionFormApi;
  /** The quiz's pause after a media. */
  mediaTailS: number;
  issues: FieldIssue[];
}) {
  const { t } = useTranslation('editor');
  const type = useStore(form.store, (s) => s.values.type);
  const media = useStore(form.store, (s) => s.values.media);
  const timeLimitS = useStore(form.store, (s) => s.values.timeLimitS);
  const listenFirst = useStore(form.store, (s) => s.values.timerAfterMedia);
  const [selected, setSelected] = useState<TimelineSelection | null>(null);
  const [adding, setAdding] = useState(false);
  const [layingOut, setLayingOut] = useState(false);
  const mediaPosition = useStore(form.store, (s) => s.values.mediaPosition);
  const mediaStyle = useStore(form.store, (s) => s.values.mediaStyle);

  const mediaMs = useMediaDurationMs(media);
  const canListenFirst = mediaHasSound(media) && mediaMs !== null;
  const stretchedS =
    canListenFirst && listenFirst
      ? timeLimitS
      : effectiveTimeLimitS(timeLimitS, mediaMs, mediaTailS, READ_DELAY_DEFAULT_MS);
  const withVisual = type !== 'image_choice';
  // The selected element is the visual: its options sit beside its preview.
  const styled = (selected === 'image' || selected === 'video') && media.visual?.kind === selected;
  const { visual, audio } = media;
  const hasVideo = visual?.kind === 'video';

  const setMedia = (next: QuestionMedia) => {
    form.setFieldValue('media', next);
    // Taken away, its drawer goes with it.
    if (selected !== 'time' && !hasElement(next, selected)) setSelected(null);
  };
  const setImage = (id: string | null) =>
    setMedia({ visual: id ? { kind: 'image', assetId: id } : null, audio });
  const setVideo = (id: string | null) =>
    setMedia(
      id
        ? { visual: { kind: 'video', source: 'upload', assetId: id }, audio: null }
        : { visual: null, audio },
    );
  const setAudio = (id: string | null, uploaded?: UploadedMedia) => {
    const track: Audio | null =
      id && uploaded?.durationMs && uploaded.peaks
        ? { assetId: id, origin: 'upload', durationMs: uploaded.durationMs, peaks: uploaded.peaks }
        : null;
    setMedia({ visual: hasVideo ? null : visual, audio: track } as QuestionMedia);
  };
  const clear = () => {
    form.setFieldValue('media', { visual: null, audio: null });
    form.setFieldValue('mediaStyle', {});
    form.setFieldValue('timerAfterMedia', false);
    setSelected(null);
  };

  const refusedVisual = !withVisual
    ? t('timeline.refused.imageChoice')
    : visual
      ? t('timeline.refused.oneVisual')
      : null;
  const choices: AddChoice[] = [
    { kind: 'image', refused: refusedVisual },
    {
      kind: 'video',
      refused: refusedVisual ?? (audio ? t('timeline.refused.videoHasSound') : null),
    },
    {
      kind: 'reveal',
      refused:
        visual?.kind !== 'image'
          ? t('timeline.refused.revealNeedsImage')
          : mediaStyle.revealS
            ? t('timeline.refused.oneReveal')
            : null,
    },
    {
      kind: 'audio',
      refused: audio
        ? t('timeline.refused.oneAudio')
        : hasVideo
          ? t('timeline.refused.videoHasSound')
          : null,
    },
  ];

  return (
    <div id="qf-media" className="flex flex-col gap-1.5">
      <StepTimeline
        model={questionTimeline({
          timeLimitS,
          listenFirst: canListenFirst && listenFirst,
          visual: withVisual ? (visual?.kind ?? null) : null,
          revealS: visual?.kind === 'image' ? (mediaStyle.revealS ?? null) : null,
          audio: audio ? { peaks: audio.peaks } : null,
          mediaMs,
          tailS: mediaTailS,
          readMs: READ_DELAY_DEFAULT_MS,
        })}
        edit={{
          selected,
          // The reveal is the picture's: its panel holds it.
          onSelect: (s) => setSelected(s === 'reveal' ? 'image' : s),
          onAdd: () => setAdding(true),
          onClear: visual || audio ? clear : null,
          layout: {
            open: () => setLayingOut(true),
            refused: !withVisual
              ? t('timeline.refused.imageChoice')
              : visual
                ? null
                : t('timeline.layoutNeedsVisual'),
          },
        }}
      />
      <FieldMessage issues={issues} />
      <LayoutModal
        open={layingOut}
        value={mediaPosition}
        choices={MEDIA_POSITIONS.map((position) => ({
          value: position,
          label: t(`questionForm.mediaPosition.${position}`),
          description: t(`timeline.layoutDescription.${position}`),
        }))}
        onApply={(position) => {
          form.setFieldValue('mediaPosition', position);
          setLayingOut(false);
        }}
        onClose={() => setLayingOut(false)}
      />
      <AddElementModal
        open={adding}
        choices={choices}
        onPick={(kind) => {
          setAdding(false);
          if (kind === 'reveal') {
            form.setFieldValue('mediaStyle', {
              ...mediaStyle,
              revealS: Math.min(REVEAL_DEFAULT_S, timeLimitS),
            });
            setSelected('image');
          } else setSelected(kind);
        }}
        onClose={() => setAdding(false)}
      />
      {selected === 'time' ? (
        <ElementPanel title={t('timeline.questionSettings')} onClose={() => setSelected(null)}>
          <QuestionTimingFields
            form={form}
            stretchedS={stretchedS}
            canListenFirst={canListenFirst}
            mediaMs={mediaMs}
            mediaTailS={mediaTailS}
          />
        </ElementPanel>
      ) : selected === 'image' || selected === 'video' || selected === 'audio' ? (
        <ElementPanel title={t(`timeline.choice.${selected}`)} onClose={() => setSelected(null)}>
          {/* The preview on the left, how it is shown on the right; its texts below, full width. */}
          <div className={cn('grid items-start gap-4', styled && 'md:grid-cols-2')}>
            <div className="flex min-w-0 flex-col gap-3">
              {selected === 'image' ? (
                <MediaUpload
                  value={visual?.kind === 'image' ? visual.assetId : null}
                  onChange={setImage}
                  kind="image"
                  label={t('media.addImage')}
                  withDetails={!styled}
                />
              ) : selected === 'video' ? (
                visual?.kind === 'video' && visual.source !== 'upload' ? (
                  // An embedded video (YouTube / Vimeo) comes with its own phase; it can only be removed here.
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => setVideo(null)}
                  >
                    {t('media.remove')}
                  </Button>
                ) : (
                  <MediaUpload
                    value={visual?.kind === 'video' ? visual.assetId : null}
                    onChange={setVideo}
                    kind="video"
                    label={t('media.addVideo')}
                    withDetails={!styled}
                  />
                )
              ) : (
                <MediaUpload
                  value={audio?.assetId ?? null}
                  onChange={setAudio}
                  kind="audio"
                  label={t('media.addAudio')}
                />
              )}
              {selected === 'audio' && audio ? (
                <PlaybackFields form={form} peaks={audio.peaks} />
              ) : null}
            </div>
            {styled && visual ? (
              <PictureStyleFields
                form={form}
                image={visual.kind === 'image'}
                behind={mediaPosition === 'behind'}
                timeLimitS={timeLimitS}
              />
            ) : null}
          </div>
          {styled && visual && 'assetId' in visual ? (
            <MediaDetailsFields mediaId={visual.assetId} withAlt={visual.kind === 'image'} />
          ) : null}
          {selected === 'video' && hasVideo ? <PlaybackFields form={form} peaks={null} /> : null}
        </ElementPanel>
      ) : null}
    </div>
  );
}

function hasElement(media: QuestionMedia, kind: TimelineSelection | null): boolean {
  if (kind === 'image' || kind === 'video') return media.visual?.kind === kind;
  if (kind === 'audio') return !!media.audio;
  return false;
}

/** How the sound plays: on which devices, and an audio's waveform, previewed at its size. */
function PlaybackFields({ form, peaks }: { form: QuestionFormApi; peaks: number[] | null }) {
  const { t } = useTranslation(['editor', 'common']);
  return (
    <>
      <form.Field name="audioTarget">
        {(field) => (
          <Label title={t('questionForm.audioTargetHint')}>
            {t('questionForm.audioTargetLabel')}
            <Select
              value={field.state.value ?? ''}
              onChange={(e) =>
                field.handleChange(e.target.value === '' ? null : (e.target.value as AudioTarget))
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
      {peaks ? (
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
                peaks={peaks}
                progress={0}
                size={field.state.value}
                className={cn('text-base', field.state.value === 'hidden' && 'opacity-40')}
                label={t('questionForm.waveformPreview')}
              />
            </div>
          )}
        </form.Field>
      ) : null}
    </>
  );
}

/** How long the question's media plays (ms): a sound says it itself, a video is asked of the library. */
function useMediaDurationMs(media: QuestionMedia): number | null {
  const videoId =
    media.visual?.kind === 'video' && media.visual.source === 'upload'
      ? media.visual.assetId
      : null;
  const videoMs = useAssetDurationMs(videoId);
  return media.audio ? media.audio.durationMs : videoMs;
}
