import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  MEDIA_TAIL_DEFAULT_S,
  effectiveTimeLimitS,
  type QuestionMedia,
  OPTION_TYPES,
  type QuestionCompletenessInput,
  type Scoring,
  questionContentSchema,
  questionIssues,
  scoringsFor,
} from '@quiz-dock/contracts';
import { useStore } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { MediaEditsContext, useMediaEdits } from '@/lib/media-edits';
import { Disclosure } from '@/components/ui/disclosure';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useFormDraft } from '@/lib/use-form-draft';
import { clearDraft, formDraftKey, loadDraft } from '@/lib/draft-store';
import { FormActionBar } from '@/components/form-action-bar';
import { DraftNotice } from '@/components/draft-notice';
import { MarkdownEditor } from '@/components/markdown-editor';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { FieldMessage } from '@/components/ui/field-message';
import {
  type FieldIssue,
  issuesAsErrors,
  issuesAsWarnings,
  focusField,
  issuesFor,
} from '@/lib/question-issues';
import { ApiError, apiErrorText, apiFieldErrors } from '../api/http';
import type { QuizDetailDtoQuestionsItem } from '../api/generated/model';
import { BackgroundField } from './background-field';
import { useContentT } from '../i18n/content-language';
import { useMediaDurationMs } from './question-media-field';
import {
  useQuestionsControllerAdd,
  useQuestionsControllerUpdate,
} from '../api/generated/questions/questions';
import { getQuizzesControllerGetQueryKey } from '../api/generated/quizzes/quizzes';
import { ImageChoiceOptions } from './image-choice-options';
import { Notice } from '@/components/ui/notice';
import {
  type FormValues,
  INCOMPLETE_IN_READY,
  type OptionValue,
  PAIRS,
  type QType,
  READ_DELAY_DEFAULT_MS,
  SINGLE_CORRECT,
  TYPES,
  buildPayload,
  initialValues,
  mediaHasSound,
  newOption,
  rankPlaces,
  useQuestionFormApi,
  withDefaults,
} from './question-form-model';
import { QuestionMediaSection } from './question-media-section';
import { StepTimeline } from './step-timeline';
import { questionTimeline } from './step-timeline-model';
import {
  AcceptedAnswersSection,
  NumericSection,
  SECTION_LEGEND as LEGEND,
  TextOptionsSection,
} from './question-answer-sections';
import { PromptImageNotice } from './prompt-image-notice';
import { LivePreview } from './question-live-preview';
import { QuestionTimingSection } from './question-timing-section';
import { useHotkeys } from 'react-hotkeys-hook';

export function QuestionForm({
  quizId,
  quizLanguage,
  question,
  mediaTailS = MEDIA_TAIL_DEFAULT_S,
  quizStatus = 'draft',
  position,
  onMoveToDraft,
  onClose,
  onCreated,
  saveRef,
  onDirtyChange,
}: {
  quizId: string;
  /** The quiz's language (BCP 47): the True and False it starts with are written in it. */
  quizLanguage?: string;
  question?: QuizDetailDtoQuestionsItem;
  /** A published quiz only takes complete questions: an unfinished one sends it back to draft. */
  quizStatus?: string;
  /** Its place among the quiz's questions (0-based), for the preview's band. */
  position?: { index: number; total: number };
  onMoveToDraft?: () => Promise<void>;
  /** The quiz's pause after a media: a longer media stretches the question's time. */
  mediaTailS?: number;
  onClose: () => void;
  /** A new question saved: the parent opens it (without it, the form closes). */
  onCreated?: (questionId: string) => void;
  /** Where the parent finds this form's save, to save before switching (#195): true once saved. */
  saveRef?: RefObject<(() => Promise<boolean>) | null>;
  /** Reports unsaved edits so the parent can guard against losing them. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { t } = useTranslation(['editor', 'common']);
  const contentT = useContentT(quizLanguage, 'editor');
  const queryClient = useQueryClient();
  const add = useQuestionsControllerAdd();
  const update = useQuestionsControllerUpdate();
  const [error, setError] = useState<string | null>(null);
  // What blocks the save, by field (the structure, or the server's refusal).
  const [errors, setErrors] = useState<FieldIssue[]>([]);
  // What is left to finish shows once the question was saved, or a save was tried.
  const [checked, setChecked] = useState(!!question);
  // A published quiz and an unfinished question: back to draft, or keep editing.
  const [askDraft, setAskDraft] = useState(false);
  // A type change took the right answers away: the author is told once.
  const [ticksCleared, setTicksCleared] = useState(false);
  // Computed once: option keys are generated, so a fresh copy per render would reset the form.
  // A save makes what was saved the new baseline: the editor stays open, clean (#195).
  const [initial, setInitial] = useState(() => initialValues(question));
  // "Saved" shows after a save, until the next change.
  const [saved, setSaved] = useState(false);
  // Whether the last submit got saved (a refusal, or the ready-to-draft question, did not).
  const savedOk = useRef(false);
  // Draft kept in localStorage until saved or discarded (survives reload / closed tab).
  const draftKey = formDraftKey(quizId, 'question', question?.id ?? null);
  // A draft saved before the media slots existed has no `media`: it is not restored.
  const [restored, setRestored] = useState(() => {
    const draft = loadDraft<FormValues>(draftKey);
    return draft && 'media' in draft ? withDefaults(draft) : null;
  });

  const form = useQuestionFormApi(restored ?? initial, async (value) => {
    savedOk.current = false;
    setError(null);
    setErrors([]);
    setChecked(true);
    const data = buildPayload(value);
    // The server's own schema: what no question may break is said here, not after a round trip.
    const parsed = questionContentSchema.safeParse(data);
    if (!parsed.success) {
      const found = issuesAsErrors(parsed.error.issues);
      setErrors(found);
      focusField(found[0].field);
      return;
    }
    if (quizStatus === 'ready' && questionIssues(parsed.data).length > 0) {
      setAskDraft(true);
      return;
    }
    await save(data, value);
  });
  const save = async (data: ReturnType<typeof buildPayload>, value: FormValues) => {
    try {
      // The media's alt and credit, edited here, are saved with the question.
      await mediaEdits.flush();
      let createdId: string | null = null;
      if (question) {
        await update.mutateAsync({ qid: question.id, data });
      } else {
        createdId = (await add.mutateAsync({ id: quizId, data })).data.id;
      }
      await queryClient.invalidateQueries({
        queryKey: getQuizzesControllerGetQueryKey(quizId),
      });
      clearDraft(draftKey);
      savedOk.current = true;
      if (createdId === null) {
        // What was typed meanwhile stays a change.
        setInitial(value);
        setRestored(null);
        setSaved(true);
      } else if (onCreated) onCreated(createdId);
      else onClose();
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
      setError(apiErrorText(err, t('questionForm.invalidError')));
      if (found[0]) focusField(found[0].field);
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
    const value = form.state.values;
    await save(buildPayload(value), value);
  };
  const values = useStore(form.store, (s) => s.values);
  // Dirty = values differ from what was loaded (a fresh question is dirty as soon as typed in).
  const formDirty = useFormDraft(draftKey, initial, values, onDirtyChange);
  // Alt texts and credits typed here wait for the Save, and count as changes.
  const mediaEdits = useMediaEdits();
  const dirty = formDirty || mediaEdits.dirty;
  useEffect(() => {
    if (mediaEdits.dirty) onDirtyChange?.(true);
  }, [mediaEdits.dirty, onDirtyChange]);
  useEffect(() => {
    if (dirty) setSaved(false);
  }, [dirty]);
  // Cmd+S (macOS) or Ctrl+S saves the question, from any of its fields, instead of the
  // browser saving the page; not under a dialog, and once at a time.
  const formRef = useRef<HTMLFormElement>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useHotkeys(
    'mod+s',
    () => {
      if (dirtyRef.current && !form.state.isSubmitting) void form.handleSubmit();
    },
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true,
      // A dialog over the form (its own confirms, another one) keeps the keys; the
      // sheet the form sits in on a phone is a dialog too, and does not.
      ignoreEventWhen: () => {
        const formEl = formRef.current;
        return (
          !formEl || [...document.querySelectorAll('dialog[open]')].some((d) => !d.contains(formEl))
        );
      },
    },
    [form],
  );
  useEffect(() => {
    if (!saveRef) return;
    saveRef.current = async () => {
      await form.handleSubmit();
      return savedOk.current;
    };
    return () => {
      saveRef.current = null;
    };
  }, [saveRef, form]);
  // Back to what was loaded: the draft goes with the changes.
  const discardDraft = () => {
    setRestored(null);
    form.reset(initial);
  };

  const type = useStore(form.store, (s) => s.values.type);
  const cancel = () => {
    clearDraft(draftKey);
    onClose();
  };
  const media = useStore(form.store, (s) => s.values.media);
  const timeLimitS = useStore(form.store, (s) => s.values.timeLimitS);
  const mediaMs = useMediaDurationMs(media);
  // What the session will give this question, estimated with the default read delay
  // (the server uses the instance's GAME_READ_DELAY_MS).
  const listenFirst = useStore(form.store, (s) => s.values.timerAfterMedia);
  // Read on the folded line of the points.
  const pointsMode = useStore(form.store, (s) => s.values.pointsMode);
  const scoring = useStore(form.store, (s) => s.values.scoring);
  const multiSelect = useStore(form.store, (s) => s.values.multiSelect);
  const scorings = scoringsFor(type, multiSelect);
  const canListenFirst = mediaHasSound(media) && mediaMs !== null;
  const stretchedS =
    canListenFirst && listenFirst
      ? timeLimitS
      : effectiveTimeLimitS(timeLimitS, mediaMs, mediaTailS, READ_DELAY_DEFAULT_MS);
  const options = useStore(form.store, (s) => s.values.options);
  // Index of the option whose removal awaits confirmation.
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null);
  const answers = useStore(form.store, (s) => s.values.acceptedAnswers);
  // Under each field: what blocks the save, then what is left to finish (the same check as
  // publishing). Errors stand until the next save.
  const issues = useMemo(
    () => [
      ...errors,
      ...(checked
        ? issuesAsWarnings(questionIssues(buildPayload(values) as QuestionCompletenessInput))
        : []),
    ],
    [errors, checked, values],
  );
  const issuesAt = (field: string) => issuesFor(issues, field);

  // Colour and shape are a pair fixed by position (red ▲, blue ◆, yellow ●, green ■):
  // nothing to choose, and removing an option re-flows the ones after it.
  // The places in the right order stay 1 to n, whatever was added or removed.
  const setOptions = (next: OptionValue[]) => {
    const places = rankPlaces(next);
    form.setFieldValue(
      'options',
      next.map((o, i) => ({
        ...o,
        color: PAIRS[i % PAIRS.length].color,
        shape: PAIRS[i % PAIRS.length].shape,
        correctOrderIndex: places[i],
      })),
    );
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // True or false starts with "True" ticked: the most common answer is one click away.
  // Both are written in the quiz's language, as any other answer: editable text.
  const trueFalse = () => [
    newOption(0, contentT('questionForm.trueOption'), true),
    newOption(1, contentT('questionForm.falseOption')),
  ];
  const onTypeChange = (next: QType) => {
    const wasImages = type === 'image_choice';
    // What was ticked is chosen again under the new rules: said, not silently lost.
    setTicksCleared(options.some((o) => o.isCorrect) && next !== 'poll' && next !== type);
    form.setFieldValue('type', next);
    // A typed answer starts with one line to fill.
    if (next === 'text_input' && answers.length === 0) {
      form.setFieldValue('acceptedAnswers', [{ text: '' }]);
    }
    if (next !== 'image_choice') form.setFieldValue('multiSelect', false);
    if (next === 'image_choice') {
      form.setFieldValue('media', {
        visual: null,
        audio: media.audio,
      } as QuestionMedia);
    }
    if (next === 'true_false') setOptions(trueFalse());
    // Text answers make no pictures, and pictures no text: both start afresh.
    else if (next === 'image_choice' || wasImages || options.length < 2) {
      setOptions(OPTION_TYPES.includes(next) ? [newOption(0), newOption(1)] : options);
    } else {
      // The texts stay; what was right under the old rules is chosen again under the new ones.
      setOptions(
        options.map((o, i) => ({
          ...o,
          isCorrect: false,
          correctOrderIndex: i,
        })),
      );
    }
  };

  const setCorrect = (index: number, checked: boolean) => {
    setTicksCleared(false);
    setOptions(
      options.map((o, i) => ({
        ...o,
        isCorrect:
          SINGLE_CORRECT.includes(type) || (type === 'image_choice' && !multiSelect)
            ? i === index
            : i === index
              ? checked
              : o.isCorrect,
      })),
    );
  };

  return (
    <MediaEditsContext.Provider value={mediaEdits.edits}>
      <form
        ref={formRef}
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        {/* Enregistrer est en haut, collant : une question longue (propositions,
          explication, arrière-plan) mettait le bouton hors d'atteinte, et on ne
          devrait jamais avoir à chercher comment garder ce qu'on vient d'écrire. */}
        <FormActionBar
          title={question ? t('questionForm.titleEdit') : t('questionForm.titleAdd')}
          dirty={dirty}
          saved={saved && !dirty}
          busy={add.isPending || update.isPending}
          submitLabel={question ? t('questionForm.submitUpdate') : t('questionForm.submitAdd')}
          issues={issues}
          onIssue={focusField}
          onCancel={cancel}
        />

        {restored ? <DraftNotice onDiscard={discardDraft} /> : null}
        <LivePreview values={values} position={position} />
        <Label>
          {t('questionForm.typeLabel')}
          <Select value={type} onChange={(e) => onTypeChange(e.target.value as QType)}>
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`questionType.${value}`)}
              </option>
            ))}
          </Select>
        </Label>
        {/* What this type does on screen and how it scores — the rules are not obvious. */}
        <p className="text-muted-foreground -mt-3 text-xs leading-snug">
          {t(`questionTypeHelp.${type}`)}
        </p>
        {ticksCleared ? <Notice tone="info">{t('questionForm.ticksCleared')}</Notice> : null}

        <form.Field name="prompt">
          {(field) => (
            <div id="qf-prompt" className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-none">
                {t('questionForm.promptLabel')}
              </span>
              <MarkdownEditor
                aria-label={t('questionForm.promptLabel')}
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('questionForm.promptPlaceholder')}
              />
              <FieldMessage issues={issuesAt('prompt')} />
              {type === 'image_choice' ? null : (
                <PromptImageNotice
                  prompt={field.state.value}
                  media={media}
                  onMove={(rest, next) => {
                    field.handleChange(rest);
                    form.setFieldValue('media', next);
                  }}
                />
              )}
            </div>
          )}
        </form.Field>

        {type === 'image_choice' && (
          <fieldset id="qf-options" className="flex flex-col gap-2">
            <legend className={LEGEND}>{t('questionForm.imagesLegend')}</legend>
            <ImageChoiceOptions
              options={options}
              currentOptions={() => form.getFieldValue('options')}
              multiSelect={multiSelect}
              showErrors={checked}
              sensors={sensors}
              setOptions={setOptions}
              newOption={newOption}
              onCorrect={setCorrect}
              onMultiSelect={(multi) => {
                form.setFieldValue('multiSelect', multi);
                // Back to one right picture: the first one ticked stays.
                if (!multi) {
                  const first = options.findIndex((o) => o.isCorrect);
                  setOptions(options.map((o, i) => ({ ...o, isCorrect: i === first })));
                }
              }}
            />
            {/* Each picture says what it misses; here, what the whole question does. */}
            <FieldMessage issues={issues.filter((i) => i.field === 'options')} />
          </fieldset>
        )}

        {OPTION_TYPES.includes(type) && type !== 'image_choice' && (
          <TextOptionsSection
            type={type}
            options={options}
            setOptions={setOptions}
            onCorrect={setCorrect}
            onRemoveAsked={setPendingRemoval}
            sensors={sensors}
            issues={issuesAt('options')}
          />
        )}
        {type === 'text_input' && (
          <AcceptedAnswersSection form={form} issues={issuesAt('acceptedAnswers')} />
        )}
        {type === 'numeric' && <NumericSection form={form} issues={issues} />}

        <StepTimeline
          model={questionTimeline({
            timeLimitS,
            listenFirst: canListenFirst && listenFirst,
            visual: type === 'image_choice' ? null : (media.visual?.kind ?? null),
            audio: media.audio ? { peaks: media.audio.peaks } : null,
            mediaMs,
            tailS: mediaTailS,
            readMs: READ_DELAY_DEFAULT_MS,
          })}
        />
        <QuestionMediaSection
          form={form}
          canListenFirst={canListenFirst}
          issues={issuesAt('media')}
        />
        <QuestionTimingSection
          form={form}
          stretchedS={stretchedS}
          canListenFirst={canListenFirst}
          mediaMs={mediaMs}
          mediaTailS={mediaTailS}
        />

        {/* Le barème par défaut convient presque toujours : il se lit replié. */}
        {type !== 'poll' && (
          <Disclosure
            title={t('questionForm.pointsLegend')}
            value={[
              t(`questionForm.pointsMode.${pointsMode}`, {
                defaultValue: pointsMode,
              }),
              scorings.length > 0
                ? t(
                    `questionForm.scoring.${type}.${scorings.includes(scoring) ? scoring : 'standard'}`,
                  )
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <form.Field name="pointsMode">
                {(field) => (
                  <Label>
                    {t('questionForm.pointsLabel')}
                    <Select
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(e.target.value as FormValues['pointsMode'])
                      }
                    >
                      <option value="standard">{t('questionForm.pointsMode.standard')}</option>
                      <option value="double">{t('questionForm.pointsMode.double')}</option>
                      <option value="fixed">{t('questionForm.pointsMode.fixed')}</option>
                    </Select>
                  </Label>
                )}
              </form.Field>
              {scorings.length > 0 && (
                <form.Field name="scoring">
                  {(field) => (
                    <Label>
                      {t('questionForm.scoringLabel')}
                      <Select
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value as Scoring)}
                      >
                        <option value="standard">
                          {t(`questionForm.scoring.${type}.standard`)}
                        </option>
                        {scorings.map((v) => (
                          <option key={v} value={v}>
                            {t(`questionForm.scoring.${type}.${v}`)}
                          </option>
                        ))}
                      </Select>
                    </Label>
                  )}
                </form.Field>
              )}
            </div>
            {/* The rule chosen, in words, where the choice is made. */}
            {scorings.length > 0 ? (
              <p className="text-muted-foreground text-xs leading-snug">
                {t(
                  `questionForm.scoringHelp.${type}.${scorings.includes(scoring) ? scoring : 'standard'}`,
                )}
              </p>
            ) : null}
          </Disclosure>
        )}

        {/* Facultative : repliée, comme tout ce qui est secondaire. */}
        {type !== 'poll' && (
          <form.Field name="answerExplanation">
            {(field) => (
              <Disclosure
                title={t('questionForm.answerExplanationLabel')}
                value={
                  field.state.value.trim()
                    ? t('questionForm.explanationWritten')
                    : t('questionForm.explanationEmpty')
                }
              >
                <MarkdownEditor
                  aria-label={t('questionForm.answerExplanationLabel')}
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('questionForm.answerExplanationPlaceholder')}
                />
              </Disclosure>
            )}
          </form.Field>
        )}

        <form.Field name="background">
          {(field) => (
            <div id="qf-backgroundGradient" className="flex flex-col gap-1.5">
              <BackgroundField value={field.state.value} onChange={field.handleChange} />
              <FieldMessage issues={issuesAt('backgroundGradient')} />
            </div>
          )}
        </form.Field>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <ConfirmDialog
          open={askDraft}
          title={t('questionForm.moveToDraft.title')}
          description={t('questionForm.moveToDraft.description')}
          confirmLabel={t('questionForm.moveToDraft.confirmLabel')}
          cancelLabel={t('questionForm.moveToDraft.cancelLabel')}
          onCancel={() => setAskDraft(false)}
          onConfirm={() => void moveToDraftAndSave()}
        />
        <ConfirmDialog
          open={pendingRemoval !== null}
          destructive
          title={t('questionForm.removeOptionConfirm.title')}
          description={t('questionForm.removeOptionConfirm.description', {
            label:
              pendingRemoval !== null
                ? options[pendingRemoval]?.text || `#${pendingRemoval + 1}`
                : '',
          })}
          confirmLabel={t('questionForm.removeOptionConfirm.confirmLabel')}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={() => {
            if (pendingRemoval !== null)
              setOptions(options.filter((_, idx) => idx !== pendingRemoval));
            setPendingRemoval(null);
          }}
        />
      </form>
    </MediaEditsContext.Provider>
  );
}
