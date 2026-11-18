import { describe, expect, it } from 'vitest';
import { slideMediaHoldMs, slideTimedMs } from '../src/slide-media';

const audio = (durationMs: number) => ({
  url: '/a.mp3',
  durationMs,
  peaks: [],
  gainDb: 0,
  size: 'M' as const,
});
const video = (durationMs: number, loop: boolean) => ({
  url: '/v.mp4',
  durationMs,
  loop,
  sound: true,
  gainDb: 0,
});

describe('slide media timing', () => {
  it('a sound or a video played once holds the slide, a looped video does not', () => {
    expect(slideTimedMs({ audio: audio(8000) })).toBe(8000);
    expect(slideTimedMs({ video: video(12_000, false) })).toBe(12_000);
    expect(slideTimedMs({ video: video(12_000, true) })).toBeNull();
    expect(slideTimedMs({})).toBeNull();
  });

  it('the hold is the timed media plus the quiz pause after them', () => {
    expect(slideMediaHoldMs({ audio: audio(8000) }, 1)).toBe(9000);
    expect(slideMediaHoldMs({ video: video(12_000, false), audio: audio(8000) }, 2)).toBe(14_000);
    expect(slideMediaHoldMs({ video: video(12_000, true) }, 1)).toBeNull();
  });
});
