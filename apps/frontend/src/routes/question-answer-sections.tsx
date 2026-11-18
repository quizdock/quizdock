import { DndContext, closestCenter, useSensors, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ACCEPTED_ANSWERS_MAX, OPTIONS_MAX } from '@quiz-dock/contracts';
import { useStore } from '@tanstack/react-form';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, EllipsisVertical, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownEditor } from '@/components/markdown-editor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { COLOR_BG, OPTION_BG_FALLBACK } from '@/lib/option-style';
import { cn } from '@/lib/utils';
import { FieldMessage } from '@/components/ui/field-message';
import { type FieldIssue, issuesFor } from '@/lib/question-issues';
import { ShapeIcon } from '@/components/shape-icon';
import { CorrectToggle } from '@/components/ui/correct-toggle';
import { MenuItem } from '@/components/ui/menu-item';
import { Popover } from '@/components/ui/popover';
import {
  type OptionValue,
  type QType,
  SINGLE_CORRECT,
  newOption,
  swapPlace,
  type QuestionFormApi,
} from './question-form-model';

/** Legend of a primary section of the form; secondary groups fold in a `Disclosure`. */
export const SECTION_LEGEND =
  'text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase';

/** Sortable option row: grip handle on the left, keyboard-sortable too. */
function SortableOption({ id, children }: { id: string; children: ReactNode }) {
  const { t } = useTranslation('editor');
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-md',
        isDragging && 'bg-background relative z-10 shadow-md',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={t('questionForm.dragOption')}
        className="text-muted-foreground hover:text-foreground cursor-grab touch-none rounded p-1 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      {children}
    </div>
  );
}

/** The text answers of a choice, a poll or an ordering: sortable, with their right ones. */
export function TextOptionsSection({
  type,
  options,
  setOptions,
  onCorrect,
  onRemoveAsked,
  sensors,
  issues,
}: {
  type: QType;
  options: OptionValue[];
  setOptions: (next: OptionValue[]) => void;
  onCorrect: (index: number, checked: boolean) => void;
  /** A typed answer to remove: the form asks first. */
  onRemoveAsked: (index: number) => void;
  sensors: ReturnType<typeof useSensors>;
  issues: FieldIssue[];
}) {
  const { t } = useTranslation(['editor', 'common']);
  const LEGEND = SECTION_LEGEND;
  const setCorrect = onCorrect;
  const onOptionDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = options.findIndex((o) => o.key === active.id);
    const to = options.findIndex((o) => o.key === over.id);
    if (from >= 0 && to >= 0) setOptions(arrayMove(options, from, to));
  };

  return (
    <fieldset id="qf-options" className="flex flex-col gap-2">
      <legend className={LEGEND}>{t('questionForm.optionsLegend')}</legend>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onOptionDragEnd}>
        <SortableContext items={options.map((o) => o.key)} strategy={verticalListSortingStrategy}>
          {options.map((opt, i) => (
            <SortableOption key={opt.key} id={opt.key}>
              <span
                aria-hidden
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-md text-lg text-white',
                  COLOR_BG[opt.color] ?? OPTION_BG_FALLBACK,
                )}
              >
                <ShapeIcon shape={opt.shape} />
              </span>
              <MarkdownEditor
                profile="inline"
                aria-label={t('questionForm.optionAriaLabel', {
                  index: i + 1,
                })}
                className="min-w-48 flex-1"
                value={opt.text}
                onChange={(text) =>
                  setOptions(options.map((o, idx) => (idx === i ? { ...o, text } : o)))
                }
                placeholder={t('questionForm.optionPlaceholder', {
                  index: i + 1,
                })}
              />

              {type === 'ordering' ? (
                // Its place in the right order, from 1: taking a place swaps with its holder.
                <Select
                  aria-label={t('questionForm.orderAriaLabel', {
                    index: i + 1,
                  })}
                  className="w-24"
                  value={opt.correctOrderIndex}
                  onChange={(e) => setOptions(swapPlace(options, i, Number(e.target.value)))}
                >
                  {options.map((_, place) => (
                    <option key={place} value={place}>
                      {t('questionForm.place', {
                        count: place + 1,
                        ordinal: true,
                      })}
                    </option>
                  ))}
                </Select>
              ) : type === 'poll' ? null : (
                <CorrectToggle
                  single={SINGLE_CORRECT.includes(type)}
                  checked={opt.isCorrect}
                  label={t('questionForm.correct')}
                  onChange={(checked) => setCorrect(i, checked)}
                />
              )}

              {/* Moving and removing, in reach without a mouse or a hover. */}
              <Popover
                align="end"
                trigger={({ open, toggle }) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground size-8"
                    aria-label={t('questionForm.optionActions', {
                      index: i + 1,
                    })}
                    aria-expanded={open}
                    onClick={toggle}
                  >
                    <EllipsisVertical className="size-4" />
                  </Button>
                )}
              >
                {(close) => (
                  <div className="flex w-44 flex-col gap-0.5">
                    <MenuItem
                      disabled={i === 0}
                      onClick={() => {
                        close();
                        setOptions(arrayMove(options, i, i - 1));
                      }}
                    >
                      <ArrowUp className="size-4" />
                      {t('questions.moveUp')}
                    </MenuItem>
                    <MenuItem
                      disabled={i === options.length - 1}
                      onClick={() => {
                        close();
                        setOptions(arrayMove(options, i, i + 1));
                      }}
                    >
                      <ArrowDown className="size-4" />
                      {t('questions.moveDown')}
                    </MenuItem>
                    {type !== 'true_false' ? (
                      <MenuItem
                        destructive
                        disabled={options.length <= 2}
                        onClick={() => {
                          close();
                          // An empty option goes without asking; a typed one is worth a confirmation.
                          if ((opt.text ?? '').trim()) onRemoveAsked(i);
                          else setOptions(options.filter((_, idx) => idx !== i));
                        }}
                      >
                        <Trash2 className="size-4" />
                        {t('questionForm.removeOptionShort')}
                      </MenuItem>
                    ) : null}
                  </div>
                )}
              </Popover>
            </SortableOption>
          ))}
        </SortableContext>
      </DndContext>
      <FieldMessage issues={issues} />
      {type !== 'true_false' && (
        // At the limit the button stays, and says it.
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={options.length >= OPTIONS_MAX}
          onClick={() => setOptions([...options, newOption(options.length)])}
        >
          <Plus className="size-4" />
          {options.length >= OPTIONS_MAX
            ? t('questionForm.addOptionMax', { max: OPTIONS_MAX })
            : t('questionForm.addOption')}
        </Button>
      )}
    </fieldset>
  );
}

/** The typed answers a text input accepts. */
export function AcceptedAnswersSection({
  form,
  issues,
}: {
  form: QuestionFormApi;
  issues: FieldIssue[];
}) {
  const { t } = useTranslation(['editor', 'common']);
  const LEGEND = SECTION_LEGEND;
  const answers = useStore(form.store, (s) => s.values.acceptedAnswers);
  return (
    <fieldset id="qf-acceptedAnswers" className="flex flex-col gap-2">
      <legend className={LEGEND}>
        {t('questionForm.acceptedAnswersLegend')}{' '}
        <span className="tabular-nums">
          {answers.length}/{ACCEPTED_ANSWERS_MAX}
        </span>
      </legend>
      {answers.map((a, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            aria-label={t('questionForm.answerAriaLabel', {
              index: i + 1,
            })}
            value={a.text}
            onChange={(e) =>
              form.setFieldValue(
                'acceptedAnswers',
                answers.map((x, idx) => (idx === i ? { text: e.target.value } : x)),
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            aria-label={t('questionForm.removeAnswer', { index: i + 1 })}
            onClick={() =>
              form.setFieldValue(
                'acceptedAnswers',
                answers.filter((_, idx) => idx !== i),
              )
            }
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <FieldMessage issues={issues} />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        disabled={answers.length >= ACCEPTED_ANSWERS_MAX}
        onClick={() => form.setFieldValue('acceptedAnswers', [...answers, { text: '' }])}
      >
        <Plus className="size-4" />
        {answers.length >= ACCEPTED_ANSWERS_MAX
          ? t('questionForm.addAnswerMax', { max: ACCEPTED_ANSWERS_MAX })
          : t('questionForm.addAnswer')}
      </Button>
    </fieldset>
  );
}

/** A numeric answer: its target and its tolerance. */
export function NumericSection({ form, issues }: { form: QuestionFormApi; issues: FieldIssue[] }) {
  const { t } = useTranslation(['editor', 'common']);
  const LEGEND = SECTION_LEGEND;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={LEGEND}>{t('questionForm.numericLegend')}</legend>
      <div className="flex flex-wrap gap-4">
        <form.Field name="numericValue">
          {(field) => (
            <div id="qf-numericValue" className="flex flex-col gap-1.5">
              <Label>
                {t('questionForm.numericValueLabel')}
                {/* Any number, decimals included. */}
                <Input
                  type="number"
                  step="any"
                  className="w-32"
                  value={field.state.value ?? ''}
                  onChange={(e) =>
                    field.handleChange(e.target.value === '' ? null : Number(e.target.value))
                  }
                />
              </Label>
              <FieldMessage issues={issuesFor(issues, 'numericValue')} />
            </div>
          )}
        </form.Field>
        <form.Field name="numericTolerance">
          {(field) => (
            <div id="qf-numericTolerance" className="flex flex-col gap-1.5">
              <Label>
                {t('questionForm.numericToleranceLabel')}
                <Input
                  type="number"
                  step="any"
                  min={0}
                  className="w-32"
                  value={field.state.value ?? ''}
                  onChange={(e) =>
                    field.handleChange(e.target.value === '' ? null : Number(e.target.value))
                  }
                  // A tolerance below 0 means none: 0.
                  onBlur={() => {
                    if ((field.state.value ?? 0) < 0) field.handleChange(0);
                  }}
                />
              </Label>
              <FieldMessage issues={issuesFor(issues, 'numericTolerance')} />
            </div>
          )}
        </form.Field>
      </div>
      <p className="text-muted-foreground text-xs">{t('questionForm.decimalsAllowed')}</p>
    </fieldset>
  );
}
