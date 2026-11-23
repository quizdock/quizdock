import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { HintMedia, useHintSounding } from './hint-media';

let play: ReturnType<typeof vi.fn<() => Promise<void>>>;

beforeEach(() => {
  play = vi.fn(async () => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => play());
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const out = {
  questionIndex: 2,
  text: 'Regardez',
  penaltyPct: 25,
  revealedAt: 1,
  shown: true,
};
const watching = (startIn: number, shown = true) => ({
  ...out,
  shown,
  video: { url: '/m/hint.mp4', gainDb: 0, durationMs: 5_000 },
  mediaStartAt: Date.now() + startIn,
});

describe('a hint’s video (SPECIFICATIONS-HINTS)', () => {
  it('is played where the hint is shown', async () => {
    const { container } = render(<HintMedia hint={watching(0)} mode="play" audible />);
    const video = container.querySelector('video');
    expect(video?.getAttribute('src')).toBe('/m/hint.mp4');
    await waitFor(() => expect(play).toHaveBeenCalled());
  });

  it('hidden by the host, it waits', async () => {
    const { container } = render(<HintMedia hint={watching(0, false)} mode="play" audible />);
    await act(async () => undefined);
    expect(container.querySelector('video')).not.toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it('takes over the question’s sound from its start to its end', () => {
    expect(renderHook(() => useHintSounding(watching(-1_000), false)).result.current).toBe(true);
    expect(renderHook(() => useHintSounding(watching(-10_000), false)).result.current).toBe(false);
  });

  it('a hint without video or sound plays nothing', () => {
    const { container } = render(<HintMedia hint={out} mode="play" audible />);
    expect(container).toBeEmptyDOMElement();
  });
});
