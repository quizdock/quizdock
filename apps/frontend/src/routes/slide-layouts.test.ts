import type { SlideBlock } from '@quiz-dock/contracts';
import { describe, expect, it } from 'vitest';
import { SLIDE_LAYOUTS, applyLayout, blocksEmpty } from './slide-layouts';

const texts = { welcomeTitle: 'Bienvenue dans {title}', welcomeText: 'PIN **{pin}**' };
const kinds = (blocks: SlideBlock[]) =>
  blocks.map((b) => (b.type === 'columns' ? b.columns.map((c) => c.map((l) => l.type)) : b.type));

describe('slide layouts (SPECIFICATIONS-SLIDE-LAYOUTS)', () => {
  it('a new slide’s empty heading is an empty slide; a written one is not', () => {
    expect(blocksEmpty([{ type: 'heading', id: 'h', text: '', level: 1 }])).toBe(true);
    expect(blocksEmpty([{ type: 'heading', id: 'h', text: 'Paris', level: 1 }])).toBe(false);
    // The media block says where the media goes: it is content.
    expect(blocksEmpty([{ type: 'media', id: 'm' }])).toBe(false);
  });

  it('each layout gives its blocks and where its media sits', () => {
    for (const { id } of SLIDE_LAYOUTS) {
      const laid = applyLayout(id, [], texts);
      const media = JSON.stringify(laid.blocks).includes('"media"');
      // Its media block means in the content; behind and alone need none.
      if (media) expect(laid.mediaPosition).toBe('bottom');
    }
    expect(kinds(applyLayout('textMedia', [], texts).blocks)).toEqual([
      [['heading', 'text'], ['media']],
    ]);
    expect(applyLayout('mediaAlone', [], texts).mediaPosition).toBe('alone');
    expect(applyLayout('welcome', [], texts).blocks[0]).toMatchObject({
      type: 'heading',
      text: 'Bienvenue dans {title}',
    });
  });

  it('placing the media keeps every other block, in order', () => {
    const written: SlideBlock[] = [
      { type: 'heading', id: 'h', text: 'Paris', level: 1 },
      { type: 'text', id: 't', md: 'La ville lumière' },
      { type: 'media', id: 'm' },
    ];
    expect(kinds(applyLayout('mediaAbove', written, texts).blocks)).toEqual([
      'media',
      'heading',
      'text',
    ]);
    // Beside all of it: no media block, the others untouched.
    expect(applyLayout('mediaLeft', written, texts)).toEqual({
      blocks: written.slice(0, 2),
      mediaPosition: 'left',
    });
    expect(applyLayout('mediaBehind', written, texts)).toEqual({
      blocks: written,
      mediaPosition: 'behind',
    });
    // From a column to the end: the column stays, without it.
    const inColumn: SlideBlock[] = [
      {
        type: 'columns',
        id: 'c',
        columns: [[{ type: 'text', id: 't', md: 'À gauche' }], [{ type: 'media', id: 'm' }]],
      },
    ];
    expect(kinds(applyLayout('mediaBelow', inColumn, texts).blocks)).toEqual([
      [['text'], []],
      'media',
    ]);
  });
});
