import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { DraftNotice } from '@/components/draft-notice';
import { FormActionBar } from '@/components/form-action-bar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { MediaEditsContext, useMediaEdits } from '@/lib/media-edits';
import type { FieldIssue } from '@/lib/question-issues';

/**
 * What every step's form does the same, a question's or a slide's (SPECIFICATIONS-STEP-
 * EDITOR): the media's alt and credit saved with the step and counted as changes, the
 * changes told to the page, Cmd+S (Ctrl+S) from any field, and the save the page asks
 * for before switching step. `submit` saves and says whether it did.
 */
export function useStepForm({
  formDirty,
  onDirtyChange,
  submit,
  busy,
  saveRef,
}: {
  /** The form's own values differ from what was loaded. */
  formDirty: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  submit: () => Promise<boolean>;
  busy: boolean;
  /** Filled with the step's save, for the page to save before switching (#195). */
  saveRef?: RefObject<(() => Promise<boolean>) | null>;
}) {
  // Alt texts and credits typed here wait for the Save, and count as changes.
  const mediaEdits = useMediaEdits();
  const dirty = formDirty || mediaEdits.dirty;
  useEffect(() => {
    if (mediaEdits.dirty) onDirtyChange?.(true);
  }, [mediaEdits.dirty, onDirtyChange]);
  // Just saved, nothing changed since: the bar says so.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (dirty) setSaved(false);
  }, [dirty]);

  // Cmd+S (macOS) or Ctrl+S saves the step, from any of its fields, instead of the
  // browser saving the page; not under a dialog, and once at a time.
  const formRef = useRef<HTMLFormElement>(null);
  const latest = useRef({ dirty, busy, submit });
  latest.current = { dirty, busy, submit };
  useHotkeys(
    'mod+s',
    () => {
      if (latest.current.dirty && !latest.current.busy) void latest.current.submit();
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
  );
  useEffect(() => {
    if (!saveRef) return;
    saveRef.current = () => latest.current.submit();
    return () => {
      saveRef.current = null;
    };
  }, [saveRef]);

  return { mediaEdits, dirty, saved, setSaved, formRef };
}

/**
 * The frame of a step's form: the sticky bar (what is edited, its issues, Save), the
 * restored-draft notice, the step's preview, its fields, and the question a published
 * quiz asks before saving a step left unfinished.
 */
export function StepFormFrame({
  step,
  title,
  submitLabel,
  busy,
  error,
  issues,
  onIssue,
  onCancel,
  onSubmit,
  restored,
  onDiscardDraft,
  preview,
  askDraft,
  className,
  children,
}: {
  step: ReturnType<typeof useStepForm>;
  title: string;
  submitLabel: string;
  /** Saving: the bar's button waits. */
  busy: boolean;
  /** The save's refusal, said by the bar (a form that says it elsewhere leaves it out). */
  error?: string | null;
  issues: FieldIssue[];
  onIssue: (field: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  /** A draft of this step was restored from the browser. */
  restored: boolean;
  onDiscardDraft: () => void;
  preview: ReactNode;
  askDraft: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
  };
  className?: string;
  children: ReactNode;
}) {
  return (
    <MediaEditsContext.Provider value={step.mediaEdits.edits}>
      <form
        ref={step.formRef}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {/* Save sits on top, sticky: a long step pushed it out of reach, and nobody should
            have to look for how to keep what they just wrote. */}
        <FormActionBar
          title={title}
          error={error}
          dirty={step.dirty}
          saved={step.saved && !step.dirty}
          busy={busy}
          submitLabel={submitLabel}
          issues={issues}
          onIssue={onIssue}
          onCancel={onCancel}
        />
        {restored ? <DraftNotice onDiscard={onDiscardDraft} /> : null}
        {preview}
        {children}
        <ConfirmDialog {...askDraft} />
      </form>
    </MediaEditsContext.Provider>
  );
}
