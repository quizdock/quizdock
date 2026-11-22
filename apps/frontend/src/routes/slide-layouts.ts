import type { MediaPosition, SlideBlock, SlideLeafBlock } from '@quiz-dock/contracts';
import { blockId, leafEmpty } from './slide-blocks';

/**
 * Ready-made slide layouts (SPECIFICATIONS-SLIDE-LAYOUTS): a starting point, nothing
 * stored. A layout lays its blocks out on an empty slide; the media's own (above,
 * below, left, right, behind, alone) only move the media block or set where the media
 * sits, so that they apply to a slide already written too: the media block places it
 * within the content, left and right beside all of it.
 */
export type SlideLayoutId =
  | 'title'
  | 'titleSubtitle'
  | 'titleText'
  | 'titleTextMedia'
  | 'mediaTitle'
  | 'textMedia'
  | 'mediaText'
  | 'behindTitle'
  | 'mediaAlone'
  | 'twoColumns'
  | 'titleTwoColumns'
  | 'threeColumns'
  | 'section'
  | 'quote'
  | 'welcome'
  | 'mediaAbove'
  | 'mediaBelow'
  | 'mediaLeft'
  | 'mediaRight'
  | 'mediaBehind'
  | 'mediaOnly';

/** A sketch's parts, top to bottom: what the layout's preview draws. */
export type SketchPart =
  | 'h1'
  | 'h2'
  | 'text'
  | 'media'
  | { columns: SketchPart[][] }
  | 'behind'
  | 'alone'
  | 'left'
  | 'right';

export interface SlideLayout {
  id: SlideLayoutId;
  /** Only on an empty slide (it lays blocks out), or on any (it places the media). */
  scope: 'empty' | 'any';
  sketch: SketchPart[];
}

const H1: SketchPart = 'h1';
const H2: SketchPart = 'h2';
const T: SketchPart = 'text';
const M: SketchPart = 'media';

export const SLIDE_LAYOUTS: SlideLayout[] = [
  { id: 'title', scope: 'empty', sketch: [H1] },
  { id: 'titleSubtitle', scope: 'empty', sketch: [H1, H2] },
  { id: 'titleText', scope: 'empty', sketch: [H1, T] },
  { id: 'titleTextMedia', scope: 'empty', sketch: [H1, T, M] },
  { id: 'mediaTitle', scope: 'empty', sketch: [M, H1] },
  { id: 'textMedia', scope: 'empty', sketch: [{ columns: [[H2, T], [M]] }] },
  { id: 'mediaText', scope: 'empty', sketch: [{ columns: [[M], [H2, T]] }] },
  { id: 'behindTitle', scope: 'empty', sketch: ['behind', H1] },
  { id: 'mediaAlone', scope: 'empty', sketch: ['alone'] },
  {
    id: 'twoColumns',
    scope: 'empty',
    sketch: [
      {
        columns: [
          [H2, T],
          [H2, T],
        ],
      },
    ],
  },
  { id: 'titleTwoColumns', scope: 'empty', sketch: [H1, { columns: [[T], [T]] }] },
  {
    id: 'threeColumns',
    scope: 'empty',
    sketch: [
      {
        columns: [
          [H2, T],
          [H2, T],
          [H2, T],
        ],
      },
    ],
  },
  { id: 'section', scope: 'empty', sketch: [H2, H1] },
  { id: 'quote', scope: 'empty', sketch: [T, T] },
  { id: 'welcome', scope: 'empty', sketch: [H1, T] },
  { id: 'mediaAbove', scope: 'any', sketch: [M, H1, T] },
  { id: 'mediaBelow', scope: 'any', sketch: [H1, T, M] },
  { id: 'mediaLeft', scope: 'any', sketch: ['left', H1, T] },
  { id: 'mediaRight', scope: 'any', sketch: ['right', H1, T] },
  { id: 'mediaBehind', scope: 'any', sketch: ['behind', H1, T] },
  { id: 'mediaOnly', scope: 'any', sketch: ['alone'] },
];

/** Texts a layout writes in (`welcome`, `quote`), in the editor's language. */
export interface LayoutTexts {
  welcomeTitle: string;
  welcomeText: string;
}

const heading = (level: 1 | 2, text = '', align?: 'left'): SlideLeafBlock => ({
  type: 'heading',
  id: blockId(),
  text,
  level,
  ...(align ? { align } : {}),
});
const text = (md = '', size?: 'small' | 'large', align?: 'left' | 'right'): SlideLeafBlock => ({
  type: 'text',
  id: blockId(),
  md,
  ...(size ? { size } : {}),
  ...(align ? { align } : {}),
});
const media = (): SlideLeafBlock => ({ type: 'media', id: blockId() });
const columns = (cols: SlideLeafBlock[][]): SlideBlock => ({
  type: 'columns',
  id: blockId(),
  columns: cols,
});

/** Whether a slide's blocks hold nothing yet: a layout may lay its own out. */
export function blocksEmpty(blocks: SlideBlock[]): boolean {
  return blocks.every((b) =>
    b.type === 'columns' ? b.columns.every((c) => c.every(leafEmpty)) : leafEmpty(b),
  );
}

/** The media block taken out of the blocks, wherever it was (a column's left as it is). */
function withoutMedia(blocks: SlideBlock[]): SlideBlock[] {
  return blocks.flatMap((b): SlideBlock[] => {
    if (b.type === 'media') return [];
    if (b.type !== 'columns') return [b];
    return [{ ...b, columns: b.columns.map((c) => c.filter((l) => l.type !== 'media')) }];
  });
}

/**
 * What a layout makes of a slide: its blocks and where its media sits. The ones that
 * lay blocks out replace an empty slide's; the media's own keep every block, in order.
 */
export function applyLayout(
  id: SlideLayoutId,
  blocks: SlideBlock[],
  texts: LayoutTexts,
): { blocks: SlideBlock[]; mediaPosition: MediaPosition } {
  switch (id) {
    case 'title':
      return { blocks: [heading(1)], mediaPosition: 'behind' };
    case 'titleSubtitle':
      return { blocks: [heading(1), heading(2)], mediaPosition: 'behind' };
    case 'titleText':
      return { blocks: [heading(1), text()], mediaPosition: 'behind' };
    case 'titleTextMedia':
      return { blocks: [heading(1), text(), media()], mediaPosition: 'bottom' };
    case 'mediaTitle':
      return { blocks: [media(), heading(1)], mediaPosition: 'bottom' };
    case 'textMedia':
      return {
        blocks: [columns([[heading(2, '', 'left'), text('', undefined, 'left')], [media()]])],
        mediaPosition: 'bottom',
      };
    case 'mediaText':
      return {
        blocks: [columns([[media()], [heading(2, '', 'left'), text('', undefined, 'left')]])],
        mediaPosition: 'bottom',
      };
    case 'behindTitle':
      return { blocks: [heading(1)], mediaPosition: 'behind' };
    case 'mediaAlone':
      return { blocks: [], mediaPosition: 'alone' };
    case 'twoColumns':
      return {
        blocks: [
          columns([
            [heading(2), text()],
            [heading(2), text()],
          ]),
        ],
        mediaPosition: 'behind',
      };
    case 'titleTwoColumns':
      return { blocks: [heading(1), columns([[text()], [text()]])], mediaPosition: 'behind' };
    case 'threeColumns':
      return {
        blocks: [
          columns([
            [heading(2), text()],
            [heading(2), text()],
            [heading(2), text()],
          ]),
        ],
        mediaPosition: 'behind',
      };
    case 'section':
      return { blocks: [heading(2), heading(1)], mediaPosition: 'behind' };
    case 'quote':
      return { blocks: [text('', 'large'), text('', 'small', 'right')], mediaPosition: 'behind' };
    case 'welcome':
      return {
        blocks: [heading(1, texts.welcomeTitle), text(texts.welcomeText)],
        mediaPosition: 'behind',
      };
    case 'mediaAbove':
      return { blocks: [media(), ...withoutMedia(blocks)], mediaPosition: 'bottom' };
    case 'mediaBelow':
      return { blocks: [...withoutMedia(blocks), media()], mediaPosition: 'bottom' };
    // Beside the whole content: no media block, the blocks untouched.
    case 'mediaLeft':
      return { blocks: withoutMedia(blocks), mediaPosition: 'left' };
    case 'mediaRight':
      return { blocks: withoutMedia(blocks), mediaPosition: 'right' };
    case 'mediaBehind':
      return { blocks, mediaPosition: 'behind' };
    case 'mediaOnly':
      return { blocks, mediaPosition: 'alone' };
  }
}
