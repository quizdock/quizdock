import { Node } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { Markdown as MarkdownExt } from '@tiptap/markdown';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Eraser, Italic, List, ListOrdered } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Textarea } from '@/components/ui/textarea';
import { VariablePicker } from '@/components/variable-picker';
import { cn } from '@/lib/utils';
import type { MarkdownProfile } from './markdown';

/**
 * No-code editor for Markdown fields (#8): WYSIWYG by default, with a toggle
 * to edit the Markdown source. The value in and out is always Markdown, so
 * storage, API and rendering (`Markdown` component) stay unchanged.
 *
 * The allowed formatting mirrors the rendering profile of `Markdown`:
 * `block` = bold, italic, lists, inline/block code, block images; `inline` = bold,
 * italic, inline code in a single paragraph. No links: content is displayed live, on a
 * projected screen or a phone mid-answer, where a link is unusable at best. The bar
 * keeps to bold, italic and lists: code, rarer, is typed in the Markdown source.
 */
export interface MarkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  profile?: MarkdownProfile;
  placeholder?: string;
  'aria-label'?: string;
  className?: string;
  /** Offers the variables (`{title}`, `{pin}`…) from its bar, written where the caret is. */
  variables?: boolean;
  /** Settings of the field's own put in its bar (a slide text's alignment and size). */
  tools?: ReactNode;
  /** The text's alignment, as it will show (a slide's text); left by default. */
  align?: 'left' | 'center' | 'right';
}

/** Single-paragraph document for the inline profile (no Enter, no blocks). */
const InlineDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'paragraph',
  // Same serialiser as the stock Document node; without it getMarkdown() is empty.
  renderMarkdown: (node, h) => (node.content ? h.renderChildren(node.content, '\n\n') : ''),
});

export function extensionsFor(profile: MarkdownProfile) {
  const common = {
    heading: false,
    blockquote: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    trailingNode: false,
    link: false,
  } as const;
  const kit =
    profile === 'inline'
      ? StarterKit.configure({
          ...common,
          document: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          listKeymap: false,
          codeBlock: false,
          hardBreak: false,
        })
      : StarterKit.configure(common);
  // Images are not added from the editor (a question's goes in its Media section, a
  // slide's in an image block); one already in a text still shows and round-trips.
  return profile === 'inline'
    ? [InlineDocument, kit, MarkdownExt]
    : [kit, Image.configure({ inline: false, allowBase64: false }), MarkdownExt];
}

export function MarkdownEditor({
  value,
  onChange,
  profile = 'block',
  placeholder,
  'aria-label': ariaLabel,
  className,
  variables,
  tools,
  align,
}: MarkdownEditorProps) {
  const { t } = useTranslation('common');
  const [source, setSource] = useState(false);
  const sourceRef = useRef<HTMLTextAreaElement>(null);

  const editor = useEditor({
    extensions: extensionsFor(profile),
    content: value,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        // The frame (border, resize handle) is on the wrapper; the surface just fills it.
        class: 'min-h-full w-full px-3 py-2 text-[1em] focus-visible:outline-none',
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getMarkdown()),
  });

  // External value change (form reset, source edit): push it into the editor
  // without emitting an update, unless it already matches.
  useEffect(() => {
    if (!editor || editor.getMarkdown() === value) return;
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  }, [editor, value]);

  // Writes a text where the caret is, in either mode (a variable picked from the bar).
  const insert = (text: string) => {
    const area = sourceRef.current;
    if (!source || !area) {
      editor?.chain().focus().insertContent(text).run();
      return;
    }
    const caret = area.selectionStart + text.length;
    onChange(area.value.slice(0, area.selectionStart) + text + area.value.slice(area.selectionEnd));
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(caret, caret);
    });
  };

  // The formatting buttons, in visual mode only (the source is typed as it is).
  const marks = editor && !source ? editor : null;

  const isEmpty = useEditorState({ editor, selector: ({ editor: e }) => e?.isEmpty ?? true });

  return (
    <div data-markdown-editor className={cn('group relative flex flex-col gap-1', className)}>
      {/* A text field's bar is always there, above it: its formatting, its own settings,
          its variables. An option's (inline) stays out of the way until the field has
          focus, floating over its top edge instead of pushing it down: a bar that took
          space on focus and gave it back on blur moved everything under the pointer — a
          click on "correct" right after typing an option landed elsewhere. */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-1',
          profile === 'inline' &&
            !source &&
            'bg-background absolute right-0 bottom-full z-10 mb-1 hidden rounded-md border px-1 py-0.5 shadow-sm group-focus-within:flex',
        )}
      >
        {marks ? <Toolbar editor={editor} profile={profile} /> : null}
        {tools ? (
          <>
            {marks ? <ToolSeparator /> : null}
            {tools}
          </>
        ) : null}
        {variables ? (
          <>
            {marks || tools ? <ToolSeparator /> : null}
            <VariablePicker onPick={insert} />
          </>
        ) : null}
        {/* Last and apart: it undoes all the formatting of the selection, marks and lists. */}
        {marks ? (
          <>
            <ToolSeparator />
            <ClearFormatting editor={marks} />
          </>
        ) : null}
        <button
          type="button"
          className="text-muted-foreground ml-auto text-xs underline-offset-2 hover:underline"
          aria-pressed={source}
          onClick={() => setSource((s) => !s)}
        >
          {source ? t('markdownEditor.visual') : t('markdownEditor.source')}
        </button>
      </div>
      {source ? (
        <Textarea
          ref={sourceRef}
          aria-label={ariaLabel}
          rows={profile === 'inline' ? 1 : 4}
          className={cn('font-mono resize-y', profile === 'inline' ? 'min-h-9' : 'min-h-24')}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div
          className={cn(
            'border-input bg-background focus-within:ring-ring relative rounded-md border shadow-sm focus-within:ring-1',
            align && ALIGN_CLASS[align],
            // Block fields are resizable vertically, like a textarea.
            profile === 'inline' ? 'min-h-9' : 'min-h-24 resize-y overflow-auto',
          )}
        >
          {isEmpty && placeholder ? (
            <span className="text-muted-foreground pointer-events-none absolute inset-x-3 top-2 text-[1em]">
              {placeholder}
            </span>
          ) : null}
          <EditorContent editor={editor} />
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor, profile }: { editor: Editor; profile: MarkdownProfile }) {
  const { t } = useTranslation('common');
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <>
      <ToolButton
        label={t('markdownEditor.bold')}
        active={active.bold}
        onClick={() => chain().toggleBold().run()}
      >
        <Bold className="size-4" />
      </ToolButton>
      <ToolButton
        label={t('markdownEditor.italic')}
        active={active.italic}
        onClick={() => chain().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </ToolButton>
      {profile === 'block' ? (
        <>
          <ToolSeparator />
          <ToolButton
            label={t('markdownEditor.bulletList')}
            active={active.bulletList}
            onClick={() => chain().toggleBulletList().run()}
          >
            <List className="size-4" />
          </ToolButton>
          <ToolButton
            label={t('markdownEditor.orderedList')}
            active={active.orderedList}
            onClick={() => chain().toggleOrderedList().run()}
          >
            <ListOrdered className="size-4" />
          </ToolButton>
        </>
      ) : null}
    </>
  );
}

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  /** A toggle's state; none for an action (clearing). */
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection
      onClick={onClick}
      className={cn(
        'hover:bg-muted inline-flex size-7 items-center justify-center rounded-md',
        active && 'bg-muted text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function ClearFormatting({ editor }: { editor: Editor }) {
  const { t } = useTranslation('common');
  return (
    <ToolButton
      label={t('markdownEditor.clear')}
      onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
    >
      <Eraser className="size-4" />
    </ToolButton>
  );
}

const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

/** Between two groups of the bar: the text's marks, its blocks, the field's settings, the variables. */
function ToolSeparator() {
  return <span aria-hidden className="bg-border mx-1 h-4 w-px shrink-0" />;
}
