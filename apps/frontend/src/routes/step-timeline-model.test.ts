import { describe, expect, it } from 'vitest';
import { questionTimeline, slideTimeline } from './step-timeline-model';

const question = {
  timeLimitS: 20,
  listenFirst: false,
  visual: null,
  audio: null,
  mediaMs: null,
  tailS: 1,
  readMs: 3000,
} as const;

describe('questionTimeline', () => {
  it('a question without media: reading, then its answers', () => {
    const t = questionTimeline(question);
    expect(t.totalS).toBe(23);
    expect(t.actualS).toBe(20);
    expect(t.phases).toEqual([
      { kind: 'reading', from: 0, to: 3 },
      { kind: 'answers', from: 3, to: 23 },
    ]);
    expect(t.elements).toEqual([]);
  });

  it('a 30 s sound stretches 20 s of answers to 28 s, then the quiz pause', () => {
    const t = questionTimeline({ ...question, audio: { peaks: [0.5] }, mediaMs: 30_000 });
    expect(t.actualS).toBe(28);
    expect(t.totalS).toBe(31);
    expect(t.phases).toEqual([
      { kind: 'reading', from: 0, to: 3 },
      { kind: 'answers', from: 3, to: 23 },
      { kind: 'stretch', from: 23, to: 30 },
      { kind: 'tail', from: 30, to: 31 },
    ]);
    expect(t.elements).toEqual([
      expect.objectContaining({ kind: 'audio', from: 0, visualTo: null, audioTo: 30 }),
    ]);
  });

  it('a picture and a sound share no row: neither sits over the other', () => {
    const t = questionTimeline({
      ...question,
      visual: 'image',
      audio: { peaks: [] },
      mediaMs: 10_000,
    });
    expect(t.elements.map((e) => [e.kind, e.visualTo, e.audioTo, e.lowered])).toEqual([
      ['image', 23, null, false],
      ['audio', null, 10, false],
    ]);
  });

  it('a video is one element over both rows', () => {
    const t = questionTimeline({ ...question, visual: 'video', mediaMs: 12_000 });
    expect(t.elements).toEqual([
      expect.objectContaining({ kind: 'video', visualTo: 12, audioTo: 12, lengthS: 12 }),
    ]);
  });

  it('listen first: the media plays, then the full answer time', () => {
    const t = questionTimeline({
      ...question,
      visual: 'video',
      mediaMs: 14_500,
      listenFirst: true,
    });
    expect(t.phases).toEqual([
      { kind: 'listen', from: 0, to: 15 },
      { kind: 'answers', from: 15, to: 35 },
    ]);
    expect(t.totalS).toBe(35);
  });

  it('listen first waits for a known length: unknown, the reading comes back', () => {
    const t = questionTimeline({ ...question, visual: 'video', listenFirst: true });
    expect(t.phases[0]).toEqual({ kind: 'reading', from: 0, to: 3 });
  });
});

const slide = {
  displayDelayS: null,
  defaultS: 5,
  video: null,
  audio: null,
  tailS: 1,
} as const;

describe('slideTimeline', () => {
  it('the default display time, nothing to wait for', () => {
    const t = slideTimeline(slide);
    expect(t.totalS).toBe(5);
    expect(t.phases).toEqual([{ kind: 'display', from: 0, to: 5 }]);
  });

  it('a sound longer than the display holds the slide, plus the quiz pause', () => {
    const t = slideTimeline({ ...slide, audio: { lengthMs: 8000, peaks: null } });
    expect(t.totalS).toBe(9);
    expect(t.actualS).toBe(9);
    expect(t.phases).toEqual([
      { kind: 'display', from: 0, to: 5 },
      { kind: 'stretch', from: 5, to: 8 },
      { kind: 'tail', from: 8, to: 9 },
    ]);
  });

  it('a looped video is a decor: it fills the slide and holds nothing', () => {
    const t = slideTimeline({
      ...slide,
      displayDelayS: 10,
      video: { lengthMs: 30_000, loop: true, sound: false },
    });
    expect(t.totalS).toBe(10);
    expect(t.elements.map((e) => [e.kind, e.visualTo, e.audioTo, e.lowered])).toEqual([
      ['video', 10, null, false],
    ]);
  });

  it('by hand: no end of its own, drawn over its media', () => {
    const t = slideTimeline({
      ...slide,
      displayDelayS: 0,
      video: { lengthMs: 12_000, loop: false, sound: true },
    });
    expect(t.actualS).toBeNull();
    expect(t.phases).toEqual([{ kind: 'manual', from: 0, to: 13 }]);
    expect(t.elements[0]).toEqual(
      expect.objectContaining({ kind: 'video', visualTo: 12, audioTo: 12 }),
    );
  });
});
