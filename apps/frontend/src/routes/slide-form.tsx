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
  WaveformSize,
  SlideBlock,
  SlideGradient,
  SlideTextTone,
  BackgroundStyle,
} from '@quiz-dock/contracts';
import { type quizVariables, slideContentSchema, slideIssues } from '@quiz-dock/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MediaEditsContext, useMediaEdits } from '@/lib/media-edits';
import { Button } from '@/components/ui/button';
import { useFormDraft } from '@/lib/use-form-draft';
import { clearDraft, formDraftKey, loadDraft } from '@/lib/draft-store';
import { FormActionBar } from '@/components/form-action-bar';
import { DraftNotice } from '@/components/draft-notice';
import { ApiError, apiErrorText, apiFieldErrors } from '../api/http';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import { SlideStage } from '../game/slide-stage';
import { LiveTheme } from '../game/theme';
import { useQuizTheme } from '@/lib/quiz-theme';
import { BackgroundField } from './background-field';
import { SlideMediaField, type SlideMediaValue } from './slide-media-field';
import { mediaUrl } from '@/lib/media-url';
import { slideShowOf } from './quiz-stage-preview';
import {
  AddBlockBar,
  BlockEditor,
  SortableBlock,
  VariablesHelp,
  blockId,
  complete,
} from './slide-blocks';
import { DisplayTimeField } from './slide-display-time';

interface FormValues extends SlideMediaValue {
  blocks: SlideBlock[];
  mediaId: string | null;
  gradient: SlideGradient | null;
  textTone: SlideTextTone;
  textOutline: boolean;
  backgroundStyle: BackgroundStyle | null;
  displayDelayS: number | null;
}

function initialValues(s?: QuizDetailDtoSlidesItem): FormValues {
  return {
    blocks: (s?.blocks as SlideBlock[] | undefined) ?? [
      { type: 'heading', id: blockId(), text: '', level: 1 },
    ],
    mediaId: s?.mediaId ?? null,
    gradient: (s?.gradient as SlideGradient | null | undefined) ?? null,
    videoMediaId: s?.videoMediaId ?? null,
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
 * Slide composer (#7): a stack of blocks (heading, text, image, columns) that is
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
  onDirtyChange,
}: {
  quizId: string;
  slide?: QuizDetailDtoSlidesItem;
  /** A published quiz only takes slides that show something: else back to draft, or keep editing. */
  quizStatus?: string;
  onMoveToDraft?: () => Promise<void>;
  /** The quiz's fields its variables read in the preview; the room's stay as written. */
  quizFields?: Parameters<typeof quizVariables>[0];
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
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
  // The preview in the quiz's theme, as the room will see it.
  const quizTheme = useQuizTheme();
  const [showStage, setShowStage] = useState(() => {
    try {
      return localStorage.getItem('slide.preview') !== 'hidden';
    } catch {
      return true;
    }
  });
  const toggleStage = () => {
    const next = !showStage;
    setShowStage(next);
    try {
      localStorage.setItem('slide.preview', next ? 'shown' : 'hidden');
    } catch {
      /* storage unavailable: the choice just does not persist */
    }
  };
  const [initial] = useState(() => initialValues(slide));
  // Draft kept in localStorage until saved or discarded (survives reload / closed tab).
  const draftKey = formDraftKey(quizId, 'slide', slide?.id ?? null);
  const [restored, setRestored] = useState(() => loadDraft<FormValues>(draftKey));
  const [values, setValues] = useState<FormValues>(restored ?? initial);
  const formDirty = useFormDraft(draftKey, initial, values, onDirtyChange);
  // Alt texts and credits typed here wait for the Save, and count as changes.
  const mediaEdits = useMediaEdits();
  const dirty = formDirty || mediaEdits.dirty;
  useEffect(() => {
    if (mediaEdits.dirty) onDirtyChange?.(true);
  }, [mediaEdits.dirty, onDirtyChange]);
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
    videoMediaId: values.videoMediaId,
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

  const submit = async () => {
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
      return;
    }
    if (quizStatus === 'ready' && slideIssues(parsed.data).length > 0) {
      setAskDraft(true);
      return;
    }
    await save(data);
  };
  // Held from the click until the form closes (the list is refetched in between):
  // a second click would add the slide twice.
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const save = async (data: ReturnType<typeof payload>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    let closed = false;
    try {
      // The media's alt and credit, edited here, are saved with the slide.
      await mediaEdits.flush();
      if (slide) await update.mutateAsync({ sid: slide.id, data });
      else await add.mutateAsync({ id: quizId, data });
      await queryClient.invalidateQueries({ queryKey: getQuizzesControllerGetQueryKey(quizId) });
      clearDraft(draftKey);
      closed = true;
      onClose();
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.data as { code?: string })?.code === INCOMPLETE_IN_READY
      ) {
        setAskDraft(true);
        return;
      }
      const found = apiFieldErrors(err).map(
        (e): FieldIssue => ({ field: e.field, text: e.message, tone: 'error' }),
      );
      setErrors(found);
      setError(apiErrorText(err, t('slideForm.invalidError')));
      if (found[0]) focusField(found[0].field);
    } finally {
      if (!closed) {
        savingRef.current = false;
        setSaving(false);
      }
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
  // Under each section: what blocks the save, then what is left to finish.
  const issues = [...errors, ...(checked ? issuesAsWarnings(slideIssues(payload())) : [])];
  const issuesAt = (field: string) => issuesFor(issues, field);

  // ── blocks ──
  const setBlock = (id: string, next: SlideBlock) =>
    patch({ blocks: values.blocks.map((b) => (b.id === id ? next : b)) });
  const removeBlock = (id: string) => {
    setUndo(values.blocks);
    patch({ blocks: values.blocks.filter((b) => b.id !== id) });
  };
  const addBlock = (b: SlideBlock) => patch({ blocks: [...values.blocks, b] });
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
    <MediaEditsContext.Provider value={mediaEdits.edits}>
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {/* Enregistrer est en haut, collant, comme pour une question : l'aperçu, les
          blocs et le média poussent le bas de la page hors d'atteinte. La barre dit
          aussi ce qu'on édite — hors tiroir, le formulaire n'a pas de titre. */}
        <FormActionBar
          title={slide ? t('slideForm.titleEdit') : t('slideForm.titleAdd')}
          // Le refus d'enregistrer se lit à côté du bouton qui l'a provoqué, pas en
          // bas de page où plus personne ne regarde.
          error={error}
          issues={issues}
          onIssue={focusField}
          dirty={dirty}
          busy={saving}
          submitLabel={slide ? t('slideForm.submitUpdate') : t('slideForm.submitAdd')}
          onCancel={cancel}
        />

        {restored ? <DraftNotice onDiscard={discardDraft} /> : null}
        {/* What the projected screen will show, at slide proportions — foldable, remembered. */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {t('slideForm.previewLegend')}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              aria-pressed={showStage}
              onClick={toggleStage}
            >
              {showStage ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showStage ? t('slideForm.hidePreview') : t('slideForm.showPreview')}
            </Button>
          </div>
          {showStage ? (
            <LiveTheme theme={quizTheme}>
              <SlideStage className="rounded-xl border" slide={stage} />
            </LiveTheme>
          ) : null}
        </div>

        <fieldset id="qf-blocks" className="flex flex-col gap-3">
          <legend className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
            {t('slideForm.blocksLegend')}
          </legend>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={values.blocks.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              {values.blocks.map((b) => (
                <SortableBlock key={b.id} id={b.id} onRemove={() => removeBlock(b.id)}>
                  <BlockEditor
                    block={b}
                    onChange={(next) => setBlock(b.id, next)}
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
          <VariablesHelp />
        </fieldset>
        {/* Media refusals point at the video or the sound: both lead here. */}
        <div id="qf-videoMediaId">
          <div id="qf-audioMediaId" className="flex flex-col gap-1.5">
            <SlideMediaField
              value={values}
              onChange={(p) => patch(p)}
              peaks={audioPeaks}
              onPeaks={setAudioPeaks}
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

        <DisplayTimeField
          value={values.displayDelayS}
          onChange={(v) => patch({ displayDelayS: v })}
        />
        <ConfirmDialog
          open={askDraft}
          title={t('slideForm.moveToDraft.title')}
          description={t('slideForm.moveToDraft.description')}
          confirmLabel={t('questionForm.moveToDraft.confirmLabel')}
          cancelLabel={t('questionForm.moveToDraft.cancelLabel')}
          onCancel={() => setAskDraft(false)}
          onConfirm={() => void moveToDraftAndSave()}
        />
      </form>
    </MediaEditsContext.Provider>
  );
}
