import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  MEDIA_TAIL_DEFAULT_S,
  TIME_LIMIT_BY_TYPE,
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
import { useMemo, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Disclosure } from '@/components/ui/disclosure';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useFormDraft } from '@/lib/use-form-draft';
import { clearDraft, formDraftKey, loadDraft } from '@/lib/draft-store';
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
  SINGLE_CORRECT,
  TYPES,
  buildPayload,
  initialValues,
  newOption,
  rankPlaces,
  useQuestionFormApi,
  withDefaults,
} from './question-form-model';
import { QuestionTimelineSection } from './question-timeline-section';
import {
  AcceptedAnswersSection,
  NumericSection,
  SECTION_LEGEND as LEGEND,
  TextOptionsSection,
} from './question-answer-sections';
import { PromptImageNotice } from './prompt-image-notice';
import { LivePreview } from './question-live-preview';
import { StepFormFrame, useStepForm } from './step-form';

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
      await step.mediaEdits.flush();
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
        step.setSaved(true);
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
  // The frame every step's form shares: media edits, changes, Cmd+S, the page's save.
  const step = useStepForm({
    formDirty,
    onDirtyChange,
    busy: add.isPending || update.isPending,
    saveRef,
    submit: async () => {
      await form.handleSubmit();
      return savedOk.current;
    },
  });
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
  // Read on the folded line of the points.
  const pointsMode = useStore(form.store, (s) => s.values.pointsMode);
  const scoring = useStore(form.store, (s) => s.values.scoring);
  const multiSelect = useStore(form.store, (s) => s.values.multiSelect);
  const scorings = scoringsFor(type, multiSelect);
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
    // A time left at its type's default follows the new type's; one the author set stays.
    if (form.getFieldValue('timeLimitS') === TIME_LIMIT_BY_TYPE[type]) {
      form.setFieldValue('timeLimitS', TIME_LIMIT_BY_TYPE[next]);
    }
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
    <StepFormFrame
      step={step}
      className="flex flex-col gap-5"
      onSubmit={() => void form.handleSubmit()}
      title={question ? t('questionForm.titleEdit') : t('questionForm.titleAdd')}
      submitLabel={question ? t('questionForm.submitUpdate') : t('questionForm.submitAdd')}
      busy={add.isPending || update.isPending}
      issues={issues}
      onIssue={focusField}
      onCancel={cancel}
      restored={!!restored}
      onDiscardDraft={discardDraft}
      preview={<LivePreview values={values} position={position} />}
      askDraft={{
        open: askDraft,
        title: t('questionForm.moveToDraft.title'),
        description: t('questionForm.moveToDraft.description'),
        confirmLabel: t('questionForm.moveToDraft.confirmLabel'),
        cancelLabel: t('questionForm.moveToDraft.cancelLabel'),
        onCancel: () => setAskDraft(false),
        onConfirm: () => void moveToDraftAndSave(),
      }}
    >
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
              variables
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

      <QuestionTimelineSection form={form} mediaTailS={mediaTailS} issues={issuesAt('media')} />

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
                    onChange={(e) => field.handleChange(e.target.value as FormValues['pointsMode'])}
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
                      <option value="standard">{t(`questionForm.scoring.${type}.standard`)}</option>
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
    </StepFormFrame>
  );
}
