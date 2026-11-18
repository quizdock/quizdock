import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type {
  SlideBlock,
  SlideColumnsRatio,
  SlideLeafBlock,
  SlideTextAlign,
  SlideTextSize,
} from '@quiz-dock/contracts';
import { SLIDE_VARIABLES } from '@quiz-dock/contracts';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns2,
  Columns3,
  GripVertical,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Plus,
  Text,
  X,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MarkdownEditor } from '@/components/markdown-editor';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
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
  return { type: 'image', id, mediaId: '', size: 'large', align: 'center' };
}

/** A block with nothing in it yet: an empty heading or text, an image without its picture. */
export const leafEmpty = (b: SlideLeafBlock) =>
  b.type === 'heading' ? !b.text.trim() : b.type === 'text' ? !b.md.trim() : !b.mediaId;

/** Empty blocks are left out on save (UI system §1.5, level 2), and flagged until then. */
export function complete(blocks: SlideBlock[]): SlideBlock[] {
  const leafOk = (b: SlideLeafBlock) => !leafEmpty(b);
  return blocks.flatMap((b): SlideBlock[] => {
    if (b.type !== 'columns') return leafOk(b) ? [b] : [];
    const columns = b.columns.map((c) => c.filter(leafOk));
    return columns.some((c) => c.length > 0) ? [{ ...b, columns }] : [];
  });
}

/**
 * The variables a heading or a text may hold, each with what it becomes: the
 * quiz's are shown filled in the preview, the room's once the quiz is played.
 */
export function VariablesHelp() {
  const { t } = useTranslation('editor');
  return (
    <Disclosure title={t('slideForm.variablesLegend')} value={`{${SLIDE_VARIABLES[0]}} …`}>
      <p className="text-muted-foreground text-xs">{t('slideForm.variablesHint')}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {SLIDE_VARIABLES.map((name) => (
          <div key={name} className="contents">
            <dt>
              <code className="bg-muted rounded px-1">{`{${name}}`}</code>
            </dt>
            <dd className="text-muted-foreground">{t(`slideForm.variables.${name}`)}</dd>
          </div>
        ))}
      </dl>
    </Disclosure>
  );
}

/** Buttons to append a block of each kind. */
export function AddBlockBar({ onAdd }: { onAdd: (b: SlideBlock) => void }) {
  const { t } = useTranslation('editor');
  const btn = (label: string, icon: ReactNode, make: () => SlideBlock) => (
    <Button type="button" variant="outline" size="sm" onClick={() => onAdd(make())}>
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
      {btn(t('slideForm.block.image'), <ImageIcon className="size-4" />, () => newLeaf('image'))}
      {btn(t('slideForm.block.columns2'), <Columns2 className="size-4" />, () => ({
        type: 'columns',
        id: blockId(),
        columns: [[newLeaf('text')], [newLeaf('image')]],
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
        'bg-background flex items-start gap-2 rounded-lg border p-2',
        isDragging && 'relative z-10 shadow-md',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={t('slideForm.dragBlock')}
        className="text-muted-foreground hover:text-foreground mt-2 cursor-grab touch-none rounded p-1 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
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
    </div>
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
              {(['heading', 'text', 'image'] as LeafKind[]).map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
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
          </div>
          <Input
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
          </div>
          <MarkdownEditor
            aria-label={t('slideForm.block.text')}
            placeholder={t('slideForm.bodyPlaceholder')}
            value={block.md}
            onChange={(md) => onChange({ ...block, md })}
          />
        </div>
      );
    case 'image':
      return (
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
      );
  }
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
