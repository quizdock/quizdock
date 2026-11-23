import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type {
  AudioTarget,
  MediaPosition,
  MediaStyle,
  WaveformSize,
  SlideBlock,
  SlideLeafBlock,
  SlideGradient,
  SlideTextTone,
  BackgroundStyle,
} from '@quiz-dock/contracts';
import {
  MEDIA_TAIL_DEFAULT_S,
  type quizVariables,
  slideContentSchema,
  slideIssues,
} from '@quiz-dock/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormDraft } from '@/lib/use-form-draft';
import { clearDraft, formDraftKey, loadDraft } from '@/lib/draft-store';
import { ApiError, apiErrorText, apiFieldErrors } from '../api/http';
import { FieldMessage } from '@/components/ui/field-message';
import {
  type FieldIssue,
  focusField,
  issuesAsErrors,
  issuesAsWarnings,
  issuesFor,
} from '@/lib/question-issues';
import type { QuizDetailDtoSlidesItem } from '../api/generated/model';
import { getQuizzesControllerGetQueryKey } from '../api/generated/quizzes/quizzes';
import { useSlidesControllerAdd, useSlidesControllerUpdate } from '../api/generated/slides/slides';
import { BackgroundField } from './background-field';
import { SlideTimelineSection, type SlideMediaValue } from './slide-timeline-section';
import { StepFormFrame, useStepForm } from './step-form';
import { StepLivePreview } from './step-live-preview';
import { slidePreviewView } from './step-view';
import { mediaUrl } from '@/lib/media-url';
import { slideShowOf } from './quiz-stage-preview';
import {
  AddBlockBar,
  BlockEditor,
  SlideMediaContext,
  SortableBlock,
  blockId,
  complete,
  holdsMedia,
} from './slide-blocks';
import { type SlideLayoutId, applyLayout } from './slide-layouts';
import { SlideLayoutsButton } from './slide-layouts-modal';
import { appConfig } from '../config';

/** The engine's display time of a slide in automatic mode, when the instance says none. */
const AUTO_ADVANCE_DEFAULT_S = 5;

interface FormValues extends SlideMediaValue {
  blocks: SlideBlock[];
  mediaId: string | null;
  gradient: SlideGradient | null;
  textTone: SlideTextTone;
  textOutline: boolean;
  backgroundStyle: BackgroundStyle | null;
}

function initialValues(s?: QuizDetailDtoSlidesItem): FormValues {
  return {
    blocks: (s?.blocks as SlideBlock[] | undefined) ?? [
      { type: 'heading', id: blockId(), text: '', level: 1 },
    ],
    mediaId: s?.mediaId ?? null,
    gradient: (s?.gradient as SlideGradient | null | undefined) ?? null,
    imageMediaId: s?.imageMediaId ?? null,
    videoMediaId: s?.videoMediaId ?? null,
    mediaPosition: (s?.mediaPosition as MediaPosition | undefined) ?? 'behind',
    mediaStyle: (s?.mediaStyle as MediaStyle | null | undefined) ?? {},
    videoLoop: s?.videoLoop ?? true,
    videoSound: s?.videoSound ?? true,
    audioMediaId: s?.audioMediaId ?? null,
    waveformSize: (s?.waveformSize as WaveformSize | undefined) ?? 'hidden',
    audioTarget: (s?.audioTarget as AudioTarget | null | undefined) ?? null,
    textTone: (s?.textTone as SlideTextTone | undefined) ?? 'light',
    textOutline: s?.textOutline ?? true,
    backgroundStyle: (s?.backgroundStyle as BackgroundStyle | null | undefined) ?? null,
    displayDelayS: s?.displayDelayS ?? null,
  };
}

/** How long a removed block can be taken back. */
const UNDO_MS = 10_000;
/** The server's refusal of an empty slide saved in a published quiz. */
const INCOMPLETE_IN_READY = 'slide.incomplete_in_ready_quiz';

/**
 * Slide composer (#7): a stack of blocks (heading, text, the media, columns) that is
 * reordered by drag and drop, over an optional full-cover background, with a
 * faithful 16:9 stage of the result.
 */
export function SlideForm({
  quizId,
  slide,
  quizFields,
  quizStatus = 'draft',
  onMoveToDraft,
  onClose,
  onCreated,
  saveRef,
  onDirtyChange,
  mediaTailS = MEDIA_TAIL_DEFAULT_S,
}: {
  quizId: string;
  slide?: QuizDetailDtoSlidesItem;
  /** A published quiz only takes slides that show something: else back to draft, or keep editing. */
  quizStatus?: string;
  onMoveToDraft?: () => Promise<void>;
  /** The quiz's fields its variables read in the preview; the room's stay as written. */
  quizFields?: Parameters<typeof quizVariables>[0];
  onClose: () => void;
  /** A new slide saved: the parent opens it (without it, the form closes). */
  onCreated?: (id: string) => void;
  /** Where the parent finds this form's save, to save before switching (#195): true once saved. */
  saveRef?: RefObject<(() => Promise<boolean>) | null>;
  onDirtyChange?: (dirty: boolean) => void;
  /** The quiz's pause after a media: a longer media holds the slide. */
  mediaTailS?: number;
}) {
  const { t } = useTranslation(['editor', 'common']);
  const queryClient = useQueryClient();
  const add = useSlidesControllerAdd();
  const update = useSlidesControllerUpdate();
  const [error, setError] = useState<string | null>(null);
  // What blocks the save, by field; what is left to finish shows once saved or tried.
  const [errors, setErrors] = useState<FieldIssue[]>([]);
  const [checked, setChecked] = useState(!!slide);
  const [askDraft, setAskDraft] = useState(false);
  // The last removal, to take back (UI system §1.1: a reversible gesture gets Undo).
  const [undo, setUndo] = useState<SlideBlock[] | null>(null);
  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [undo]);
  // A save makes what was saved the new baseline: the editor stays open, clean (#195).
  const [initial, setInitial] = useState(() => initialValues(slide));
  // Draft kept in localStorage until saved or discarded (survives reload / closed tab).
  const draftKey = formDraftKey(quizId, 'slide', slide?.id ?? null);
  const [restored, setRestored] = useState(() => loadDraft<FormValues>(draftKey));
  const [values, setValues] = useState<FormValues>(restored ?? initial);
  const formDirty = useFormDraft(draftKey, initial, values, onDirtyChange);
  // Back to what was loaded: the draft goes with the changes.
  const discardDraft = () => {
    setRestored(null);
    setValues(initial);
  };
  const patch = (p: Partial<FormValues>) => setValues((v) => ({ ...v, ...p }));
  // The sound's waveform, known once a sound is picked here (the size preview draws it).
  const [audioPeaks, setAudioPeaks] = useState<number[] | null>(null);

  const cancel = () => {
    clearDraft(draftKey);
    onClose();
  };

  const payload = () => ({
    blocks: complete(values.blocks),
    mediaId: values.mediaId,
    gradient: values.gradient,
    // One visual: a picture left beside a video goes.
    imageMediaId: values.videoMediaId ? null : values.imageMediaId,
    videoMediaId: values.videoMediaId,
    mediaPosition: values.mediaPosition,
    mediaStyle: slideStyle(values),
    videoLoop: values.videoLoop,
    videoSound: values.videoSound,
    audioMediaId: values.videoMediaId && values.videoSound ? null : values.audioMediaId,
    waveformSize: values.waveformSize,
    audioTarget: values.audioTarget,
    textTone: values.textTone,
    textOutline: values.textOutline,
    backgroundStyle: values.backgroundStyle,
    displayDelayS: values.displayDelayS,
  });

  const submit = async (): Promise<boolean> => {
    setError(null);
    setErrors([]);
    setChecked(true);
    const data = payload();
    // The server's own schema: what no slide may break is said here, under its field.
    const parsed = slideContentSchema.safeParse(data);
    if (!parsed.success) {
      const found = issuesAsErrors(parsed.error.issues);
      setErrors(found);
      focusField(found[0].field);
      return false;
    }
    if (quizStatus === 'ready' && slideIssues(parsed.data).length > 0) {
      setAskDraft(true);
      return false;
    }
    return save(data);
  };
  // Held from the click until the form closes (the list is refetched in between):
  // a second click would add the slide twice.
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const save = async (data: ReturnType<typeof payload>): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try {
      // The media's alt and credit, edited here, are saved with the slide.
      await step.mediaEdits.flush();
      let createdId: string | null = null;
      if (slide) await update.mutateAsync({ sid: slide.id, data });
      else createdId = (await add.mutateAsync({ id: quizId, data })).data.id;
      await queryClient.invalidateQueries({ queryKey: getQuizzesControllerGetQueryKey(quizId) });
      clearDraft(draftKey);
      if (createdId === null) {
        // Saved, it stays open as a question does; what was typed meanwhile stays a change.
        setInitial(values);
        setRestored(null);
        step.setSaved(true);
      } else if (onCreated) onCreated(createdId);
      else onClose();
      return true;
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.data as { code?: string })?.code === INCOMPLETE_IN_READY
      ) {
        setAskDraft(true);
        return false;
      }
      const found = apiFieldErrors(err).map(
        (e): FieldIssue => ({ field: e.field, text: e.message, tone: 'error' }),
      );
      setErrors(found);
      setError(apiErrorText(err, t('slideForm.invalidError')));
      if (found[0]) focusField(found[0].field);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const moveToDraftAndSave = async () => {
    setAskDraft(false);
    try {
      await onMoveToDraft?.();
    } catch (err) {
      setError(apiErrorText(err));
      return;
    }
    await save(payload());
  };
  // The frame every step's form shares: media edits, changes, Cmd+S, the page's save.
  const step = useStepForm({ formDirty, onDirtyChange, busy: saving, saveRef, submit });
  // Under each section: what blocks the save, then what is left to finish.
  const issues = [...errors, ...(checked ? issuesAsWarnings(slideIssues(payload())) : [])];
  const issuesAt = (field: string) => issuesFor(issues, field);

  // ── blocks ──
  const removeBlock = (id: string) => {
    setUndo(values.blocks);
    patch({ blocks: values.blocks.filter((b) => b.id !== id) });
  };
  // A media block placed while the media is behind or alone: it is wanted in the content.
  const inContent = (p: MediaPosition): MediaPosition =>
    p === 'behind' || p === 'alone' ? 'bottom' : p;
  const addBlock = (b: SlideBlock) =>
    patch({
      blocks: [...values.blocks, b],
      ...(holdsMedia(b) ? { mediaPosition: inContent(values.mediaPosition) } : {}),
    });
  // A block changed to hold the media (a column's): the same.
  const setBlockPlacing = (id: string, next: SlideBlock) =>
    patch({
      blocks: values.blocks.map((b) => (b.id === id ? next : b)),
      ...(holdsMedia(next) && !values.blocks.some(holdsMedia)
        ? { mediaPosition: inContent(values.mediaPosition) }
        : {}),
    });
  // An image block of before made the slide's media: its picture on the timeline, its
  // place kept by the media block (SPECIFICATIONS-SLIDE-LAYOUTS).
  const adopt = (id: string, mediaId: string) => {
    const swap = (l: SlideLeafBlock): SlideLeafBlock =>
      l.id === id ? { type: 'media', id: l.id } : l;
    patch({
      blocks: values.blocks.map((b) =>
        b.type === 'columns' ? { ...b, columns: b.columns.map((c) => c.map(swap)) } : swap(b),
      ),
      imageMediaId: mediaId,
      videoMediaId: null,
      mediaPosition: 'bottom',
    });
  };
  const visual = values.videoMediaId ? 'video' : values.imageMediaId ? 'image' : null;
  const mediaInfo = {
    visual: visual as 'image' | 'video' | null,
    placement:
      values.mediaPosition === 'behind' || values.mediaPosition === 'alone'
        ? values.mediaPosition
        : ('content' as const),
    placed: values.blocks.some(holdsMedia),
    adopt,
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = values.blocks.findIndex((b) => b.id === active.id);
    const to = values.blocks.findIndex((b) => b.id === over.id);
    if (from >= 0 && to >= 0) patch({ blocks: arrayMove(values.blocks, from, to) });
  };

  const stage = {
    ...slideShowOf(values, 0, quizFields),
    // Its media, shown still (#125): the video's first frame, the sound's waveform when known.
    audio:
      values.audioMediaId && audioPeaks && !(values.videoMediaId && values.videoSound)
        ? {
            url: mediaUrl(values.audioMediaId),
            durationMs: 0,
            peaks: audioPeaks,
            gainDb: 0,
            size: values.waveformSize,
          }
        : null,
  };

  return (
    <StepFormFrame
      step={step}
      className="flex flex-col gap-6"
      onSubmit={() => void submit()}
      title={slide ? t('slideForm.titleEdit') : t('slideForm.titleAdd')}
      submitLabel={slide ? t('slideForm.submitUpdate') : t('slideForm.submitAdd')}
      busy={saving}
      // The save's refusal is said next to the button that caused it.
      error={error}
      issues={issues}
      onIssue={focusField}
      onCancel={cancel}
      restored={!!restored}
      onDiscardDraft={discardDraft}
      // The room's projection or phone, pinnable, as for a question (SPECIFICATIONS-STEP-EDITOR).
      preview={
        <StepLivePreview
          canReveal={false}
          deps={[stage]}
          viewOf={({ theme }) => slidePreviewView({ ...stage, questionIndex: 0 }, theme)}
        />
      }
      askDraft={{
        open: askDraft,
        title: t('slideForm.moveToDraft.title'),
        description: t('slideForm.moveToDraft.description'),
        confirmLabel: t('questionForm.moveToDraft.confirmLabel'),
        cancelLabel: t('questionForm.moveToDraft.cancelLabel'),
        onCancel: () => setAskDraft(false),
        onConfirm: () => void moveToDraftAndSave(),
      }}
    >
      <SlideMediaContext.Provider value={mediaInfo}>
        <fieldset id="qf-blocks" className="flex flex-col gap-3">
          <legend className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
            {t('slideForm.blocksLegend')}
          </legend>
          <SlideLayoutsButton blocks={values.blocks} onApply={(laid) => patch(laid)} />
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={values.blocks.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              {values.blocks.map((b) => (
                <SortableBlock key={b.id} id={b.id} onRemove={() => removeBlock(b.id)}>
                  <BlockEditor
                    block={b}
                    onChange={(next) => setBlockPlacing(b.id, next)}
                    onRemoving={() => setUndo(values.blocks)}
                  />
                </SortableBlock>
              ))}
            </SortableContext>
          </DndContext>
          {undo ? (
            <div
              role="status"
              className="bg-foreground text-background flex items-center gap-3 self-center rounded-md px-3 py-1.5 text-sm"
            >
              {t('slideForm.blockRemoved')}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => {
                  patch({ blocks: undo });
                  setUndo(null);
                }}
              >
                {t('slideForm.undo')}
              </button>
            </div>
          ) : null}
          <FieldMessage issues={issuesAt('blocks')} />
          <AddBlockBar onAdd={addBlock} />
        </fieldset>
      </SlideMediaContext.Provider>
      {/* Media refusals point at the video or the sound: both lead here. */}
      <div id="qf-videoMediaId">
        <div id="qf-audioMediaId" className="flex flex-col gap-1.5">
          <SlideTimelineSection
            value={values}
            onChange={(p) => patch(p)}
            peaks={audioPeaks}
            onPeaks={setAudioPeaks}
            defaultS={appConfig.autoAdvanceS ?? AUTO_ADVANCE_DEFAULT_S}
            mediaTailS={mediaTailS}
            place={placeOf(values)}
            // The Layouts' own: the media block moved, or the position set.
            onPlace={(place) => patch(applyLayout(PLACE_LAYOUT[place], values.blocks, NO_TEXTS))}
          />
          <FieldMessage issues={[...issuesAt('audioMediaId'), ...issuesAt('videoMediaId')]} />
        </div>
      </div>

      <div id="qf-gradient" className="flex flex-col gap-1.5">
        <BackgroundField
          value={{
            mediaId: values.mediaId,
            gradient: values.gradient,
            textTone: values.textTone,
            textOutline: values.textOutline,
            style: values.backgroundStyle,
          }}
          onChange={({ style, ...b }) => patch({ ...b, backgroundStyle: style })}
        />
        <FieldMessage issues={[...issuesAt('gradient'), ...issuesAt('mediaId')]} />
      </div>
    </StepFormFrame>
  );
}

/** The Layouts' media placements, by the place the timeline's layout shows. */
const PLACE_LAYOUT: Record<
  'top' | 'bottom' | 'left' | 'right' | 'behind' | 'alone',
  SlideLayoutId
> = {
  top: 'mediaAbove',
  bottom: 'mediaBelow',
  left: 'mediaLeft',
  right: 'mediaRight',
  behind: 'mediaBehind',
  alone: 'mediaOnly',
};
/** Placing the media writes no text. */
const NO_TEXTS = { welcomeTitle: '', welcomeText: '' };

/**
 * Where the media sits now: its position, or in the content by its block — above when
 * the block comes first, else below; a slide of before with neither, below.
 */
function placeOf(v: Pick<FormValues, 'blocks' | 'mediaPosition'>) {
  const p = v.mediaPosition;
  if (p === 'behind' || p === 'alone') return p;
  if (v.blocks.some(holdsMedia))
    return v.blocks[0] && holdsMedia(v.blocks[0]) && v.blocks[0].type === 'media'
      ? 'top'
      : 'bottom';
  return p;
}

/** The style worth sending: none without a visual or when empty; never a reveal on a slide. */
function slideStyle(v: Pick<FormValues, 'imageMediaId' | 'videoMediaId' | 'mediaStyle'>) {
  if (!v.imageMediaId && !v.videoMediaId) return null;
  const framing = { ...v.mediaStyle };
  delete framing.revealS;
  return Object.keys(framing).length > 0 ? framing : null;
}
