import type {
  SlideBlock,
  SlideColumnsRatio,
  SlideLeafBlock,
  SlideTextAlign,
  SlideTextSize,
} from '@quiz-dock/contracts';
import { QUIZ_VARIABLES, ROOM_VARIABLES, type SlideVariable } from '@quiz-dock/contracts';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns2,
  Columns3,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Plus,
  Text,
  X,
} from 'lucide-react';
import { createContext, type ReactNode, useContext, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { MenuItem } from '@/components/ui/menu-item';
import { Popover } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MarkdownEditor } from '@/components/markdown-editor';
import { Select } from '@/components/ui/select';
import { SortableRow } from '@/components/sortable-row';
import { columnsTemplate } from '../game/live-components';
import { MediaUpload } from './media-upload';
import { Segmented } from '@/components/ui/segmented';

let blockSeq = 0;
export const blockId = () => `b-${Date.now().toString(36)}-${++blockSeq}`;

type LeafKind = SlideLeafBlock['type'];

export function newLeaf(kind: LeafKind, level: 1 | 2 = 1): SlideLeafBlock {
  const id = blockId();
  if (kind === 'heading') return { type: 'heading', id, text: '', level };
  if (kind === 'text') return { type: 'text', id, md: '' };
  if (kind === 'media') return { type: 'media', id };
  return { type: 'image', id, mediaId: '', size: 'large', align: 'center' };
}

/**
 * A block with nothing in it yet: an empty heading or text, an image without its picture.
 * The media block never is: it says where the media goes, set or not yet.
 */
export const leafEmpty = (b: SlideLeafBlock) =>
  b.type === 'heading'
    ? !b.text.trim()
    : b.type === 'text'
      ? !b.md.trim()
      : b.type === 'image'
        ? !b.mediaId
        : false;

/** Whether a block is, or holds, the media block. */
export const holdsMedia = (b: SlideBlock) =>
  b.type === 'media' ||
  (b.type === 'columns' && b.columns.some((c) => c.some((l) => l.type === 'media')));

/**
 * The slide's media as its blocks see it (SPECIFICATIONS-SLIDE-LAYOUTS): set on the
 * timeline, placed by the media block, which there is one of at most. An image block
 * of before becomes the slide's media on demand (`adopt`), when it has none.
 */
export interface SlideMediaInfo {
  visual: 'image' | 'video' | null;
  placement: 'content' | 'behind' | 'alone';
  /** A media block is there already: no second one. */
  placed: boolean;
  adopt: (blockId: string, mediaId: string) => void;
}
export const SlideMediaContext = createContext<SlideMediaInfo>({
  visual: null,
  placement: 'behind',
  placed: false,
  adopt: () => undefined,
});

/** Empty blocks are left out on save (UI system §1.5, level 2), and flagged until then. */
export function complete(blocks: SlideBlock[]): SlideBlock[] {
  const leafOk = (b: SlideLeafBlock) => !leafEmpty(b);
  return blocks.flatMap((b): SlideBlock[] => {
    if (b.type !== 'columns') return leafOk(b) ? [b] : [];
    const columns = b.columns.map((c) => c.filter(leafOk));
    return columns.some((c) => c.length > 0) ? [{ ...b, columns }] : [];
  });
}

/** The variables in the picker: the quiz's, then the room's. */
const VARIABLE_GROUPS: { group: 'quiz' | 'room'; names: readonly SlideVariable[] }[] = [
  { group: 'quiz', names: QUIZ_VARIABLES },
  { group: 'room', names: ROOM_VARIABLES },
];

/** What the quiz's variables read in this editor (`{title}`…); the room's are not known. */
export const SlideVariablesContext = createContext<
  Partial<Record<SlideVariable, string | number | null | undefined>>
>({});

/**
 * The variables a heading or a text may hold, offered from its own bar: each with what
 * it becomes, the one picked written where the caret is. The quiz's are shown filled in
 * the preview, the room's once the quiz is played.
 */
function VariablePicker({ onPick }: { onPick: (variable: string) => void }) {
  const { t } = useTranslation('editor');
  const values = useContext(SlideVariablesContext);
  return (
    <Popover
      className="w-80 p-2"
      trigger={({ open, toggle }) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 font-mono text-xs"
          aria-label={t('slideForm.variablesInsert')}
          title={t('slideForm.variablesInsert')}
          aria-expanded={open}
          onClick={toggle}
        >
          {'{…}'}
        </Button>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground px-2 pb-1 text-xs">{t('slideForm.variablesHint')}</p>
          <div className="max-h-72 overflow-y-auto">
            {VARIABLE_GROUPS.map(({ group, names }) => (
              <div key={group} role="group" aria-label={t(`slideForm.variablesGroup.${group}`)}>
                <p className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-semibold">
                  {t(`slideForm.variablesGroup.${group}`)}
                </p>
                {names.map((name) => (
                  <MenuItem
                    key={name}
                    onClick={() => {
                      close();
                      onPick(`{${name}}`);
                    }}
                  >
                    <code className="bg-muted shrink-0 rounded px-1">{`{${name}}`}</code>
                    {/* What it reads here; the room's, known only once played, are described. */}
                    {values[name] != null && String(values[name]) !== '' ? (
                      <span className="truncate">{String(values[name])}</span>
                    ) : (
                      <span className="text-muted-foreground truncate">
                        {t(`slideForm.variables.${name}`)}
                      </span>
                    )}
                  </MenuItem>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}

/** Buttons to append a block of each kind. */
export function AddBlockBar({ onAdd }: { onAdd: (b: SlideBlock) => void }) {
  const { t } = useTranslation('editor');
  const { placed } = useContext(SlideMediaContext);
  const btn = (label: string, icon: ReactNode, make: () => SlideBlock, refused?: string) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!!refused}
      title={refused}
      onClick={() => onAdd(make())}
    >
      {icon}
      {label}
    </Button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Plus className="text-muted-foreground size-4" />
      {btn(t('slideForm.block.heading'), <Heading1 className="size-4" />, () => newLeaf('heading'))}
      {btn(t('slideForm.block.subheading'), <Heading2 className="size-4" />, () =>
        newLeaf('heading', 2),
      )}
      {btn(t('slideForm.block.text'), <Text className="size-4" />, () => newLeaf('text'))}
      {btn(
        t('slideForm.block.media'),
        <ImageIcon className="size-4" />,
        () => newLeaf('media'),
        placed ? t('slideForm.media.onlyOne') : undefined,
      )}
      {btn(t('slideForm.block.columns2'), <Columns2 className="size-4" />, () => ({
        type: 'columns',
        id: blockId(),
        columns: [[newLeaf('text')], [newLeaf(placed ? 'text' : 'media')]],
      }))}
      {btn(t('slideForm.block.columns3'), <Columns3 className="size-4" />, () => ({
        type: 'columns',
        id: blockId(),
        columns: [[newLeaf('text')], [newLeaf('text')], [newLeaf('text')]],
      }))}
    </div>
  );
}

/** Sortable wrapper: grip handle, remove button, the block editor in between. */
export function SortableBlock({
  id,
  onRemove,
  children,
}: {
  id: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation('editor');
  return (
    <SortableRow
      as="div"
      id={id}
      handleLabel={t('slideForm.dragBlock')}
      handleClassName="mt-2"
      className="bg-background flex items-start gap-2 rounded-lg border p-2"
    >
      {(handle) => (
        <>
          {handle}
          <div className="min-w-0 flex-1">{children}</div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-1 size-7"
            aria-label={t('slideForm.removeBlock')}
            onClick={onRemove}
          >
            <X className="size-4" />
          </Button>
        </>
      )}
    </SortableRow>
  );
}

/** One block's fields; a `columns` block nests leaf editors per column. */
export function BlockEditor({
  block,
  onChange,
  onRemoving,
}: {
  block: SlideBlock;
  onChange: (next: SlideBlock) => void;
  /** Called before a block inside a column goes, so the removal can be undone. */
  onRemoving: () => void;
}) {
  const { t } = useTranslation('editor');
  const { placed } = useContext(SlideMediaContext);
  if (block.type !== 'columns') return <LeafEditor block={block} onChange={onChange} />;
  const setCol = (i: number, col: SlideLeafBlock[]) =>
    onChange({ ...block, columns: block.columns.map((c, idx) => (idx === i ? col : c)) });
  return (
    <div className="flex flex-col gap-2">
      {block.columns.length === 2 ? (
        <Segmented
          size="sm"
          className="w-fit"
          label={t('slideForm.ratio')}
          value={block.ratio ?? '1-1'}
          onChange={(ratio) => onChange({ ...block, ratio })}
          options={(['1-1', '1-2', '2-1'] as SlideColumnsRatio[]).map((r) => ({
            value: r,
            label: r.replace('-', ' : '),
          }))}
        />
      ) : null}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: columnsTemplate(block.columns.length, block.ratio) }}
      >
        {block.columns.map((col, i) => (
          <div key={i} className="bg-muted/40 flex min-w-0 flex-col gap-2 rounded-md p-2">
            {col.map((leaf) => (
              <div key={leaf.id} className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <LeafEditor
                    block={leaf}
                    onChange={(next) =>
                      setCol(
                        i,
                        col.map((l) => (l.id === leaf.id ? next : l)),
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label={t('slideForm.removeBlock')}
                  onClick={() => {
                    onRemoving();
                    setCol(
                      i,
                      col.filter((l) => l.id !== leaf.id),
                    );
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-1">
              {(['heading', 'text', 'media'] as LeafKind[]).map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={kind === 'media' && placed}
                  title={kind === 'media' && placed ? t('slideForm.media.onlyOne') : undefined}
                  onClick={() => setCol(i, [...col, newLeaf(kind, kind === 'heading' ? 2 : 1)])}
                >
                  <Plus className="size-3" />
                  {t(`slideForm.block.${kind === 'heading' ? 'subheading' : kind}`)}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeafEditor({
  block,
  onChange,
}: {
  block: SlideLeafBlock;
  onChange: (next: SlideLeafBlock) => void;
}) {
  const { t } = useTranslation('editor');
  // An empty block is not an error: it is left out of the slide, and says so.
  return (
    <div className="flex flex-col gap-1">
      <LeafFields block={block} onChange={onChange} />
      {leafEmpty(block) ? (
        <p className="text-muted-foreground text-xs">{t('slideForm.emptySkipped')}</p>
      ) : null}
    </div>
  );
}

function LeafFields({
  block,
  onChange,
}: {
  block: SlideLeafBlock;
  onChange: (next: SlideLeafBlock) => void;
}) {
  const { t } = useTranslation('editor');
  const headingRef = useRef<HTMLInputElement>(null);
  const insertRef = useRef<((text: string) => void) | null>(null);
  switch (block.type) {
    case 'heading':
      return (
        <div className="flex flex-col gap-1.5">
          {/* Block settings on one thin line above the field: level, then alignment. */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium">
              {t('slideForm.block.heading')}
            </span>
            <Select
              aria-label={t('slideForm.headingLevel')}
              className="h-7 w-16 shrink-0 px-2 py-0"
              value={String(block.level)}
              onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 1 | 2 })}
            >
              <option value="1">H1</option>
              <option value="2">H2</option>
            </Select>
            <AlignPicker value={block.align} onChange={(align) => onChange({ ...block, align })} />
            <VariablePicker
              onPick={(v) => {
                const input = headingRef.current;
                const at = input?.selectionStart ?? block.text.length;
                const end = input?.selectionEnd ?? at;
                onChange({ ...block, text: block.text.slice(0, at) + v + block.text.slice(end) });
                requestAnimationFrame(() => {
                  input?.focus();
                  input?.setSelectionRange(at + v.length, at + v.length);
                });
              }}
            />
          </div>
          <Input
            ref={headingRef}
            aria-label={t('slideForm.block.heading')}
            placeholder={t('slideForm.headingPlaceholder')}
            className={block.level === 1 ? 'text-lg font-bold' : 'font-semibold'}
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
          />
        </div>
      );
    case 'text':
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium">
              {t('slideForm.block.text')}
            </span>
            <AlignPicker value={block.align} onChange={(align) => onChange({ ...block, align })} />
            <SizePicker value={block.size} onChange={(size) => onChange({ ...block, size })} />
            {/* Not at the far end: the text's own bar floats there while it is written in. */}
            <VariablePicker onPick={(v) => insertRef.current?.(v)} />
          </div>
          <MarkdownEditor
            insertRef={insertRef}
            aria-label={t('slideForm.block.text')}
            placeholder={t('slideForm.bodyPlaceholder')}
            value={block.md}
            onChange={(md) => onChange({ ...block, md })}
          />
        </div>
      );
    case 'media':
      return <MediaBlockFields />;
    case 'image':
      return (
        <div className="flex flex-col gap-2">
          <ImageBlockNotice block={block} />
          <div className="flex flex-wrap items-center gap-3">
            <MediaUpload
              value={block.mediaId || null}
              onChange={(id) => onChange({ ...block, mediaId: id ?? '' })}
            />
            <Label className="flex-row items-center gap-2">
              {t('slideForm.imageSize')}
              <Select
                className="w-32"
                value={block.size}
                onChange={(e) => onChange({ ...block, size: e.target.value as typeof block.size })}
              >
                <option value="small">{t('slideForm.size.small')}</option>
                <option value="medium">{t('slideForm.size.medium')}</option>
                <option value="large">{t('slideForm.size.large')}</option>
                <option value="full">{t('slideForm.size.full')}</option>
              </Select>
            </Label>
            <AlignPicker
              label={t('slideForm.imageAlign')}
              value={block.align}
              onChange={(align) => onChange({ ...block, align })}
            />
          </div>
        </div>
      );
  }
}

/** The media block: where the slide's media sits; the media itself is the timeline's. */
function MediaBlockFields() {
  const { t } = useTranslation('editor');
  const { visual, placement } = useContext(SlideMediaContext);
  const state = placement !== 'content' ? placement : visual ? `${visual}` : 'none';
  return (
    <div className="flex items-start gap-2">
      <ImageIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <span className="text-muted-foreground text-xs font-medium">
          {t('slideForm.block.media')}
        </span>
        <p className="text-sm">{t(`slideForm.media.state.${state}`)}</p>
      </div>
    </div>
  );
}

/**
 * An image block of before: kept, shown and edited as it was. A slide's picture is now its
 * media, set on its timeline: this one can become it, when the slide has none.
 */
function ImageBlockNotice({ block }: { block: Extract<SlideLeafBlock, { type: 'image' }> }) {
  const { t } = useTranslation('editor');
  const { visual, adopt } = useContext(SlideMediaContext);
  return (
    <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-xs">
      <span className="text-muted-foreground min-w-0 flex-1">
        {t('slideForm.media.imageBlock')}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        disabled={!block.mediaId || !!visual}
        title={visual ? t('slideForm.media.adoptRefused') : undefined}
        onClick={() => adopt(block.id, block.mediaId)}
      >
        {t('slideForm.media.adopt')}
      </Button>
    </div>
  );
}

/** Left / centre / right for a text-like block; centre is the default. */
function AlignPicker({
  value,
  label,
  onChange,
}: {
  value: SlideTextAlign | undefined;
  /** Its name for a screen reader; a text's alignment by default. */
  label?: string;
  onChange: (align: SlideTextAlign) => void;
}) {
  const { t } = useTranslation('editor');
  const current = value ?? 'center';
  const items: { align: SlideTextAlign; icon: typeof AlignLeft }[] = [
    { align: 'left', icon: AlignLeft },
    { align: 'center', icon: AlignCenter },
    { align: 'right', icon: AlignRight },
  ];
  return (
    <Segmented
      size="sm"
      className="shrink-0"
      label={label ?? t('slideForm.textAlign')}
      value={current}
      onChange={onChange}
      options={items.map(({ align, icon }) => ({
        value: align,
        label: t(`slideForm.align.${align}`),
        icon,
      }))}
    />
  );
}

/** Small / medium / large text (20 / 30 / 40 px on the stage); medium is the default. */
function SizePicker({
  value,
  onChange,
}: {
  value: SlideTextSize | undefined;
  onChange: (size: SlideTextSize) => void;
}) {
  const { t } = useTranslation('editor');
  const current = value ?? 'medium';
  return (
    <Segmented
      size="sm"
      className="shrink-0"
      label={t('slideForm.textSize')}
      value={current}
      onChange={onChange}
      options={(['small', 'medium', 'large'] as SlideTextSize[]).map((size) => ({
        value: size,
        label: t(`slideForm.size.${size}`),
        short: t(`slideForm.sizeShort.${size}`),
      }))}
    />
  );
}
