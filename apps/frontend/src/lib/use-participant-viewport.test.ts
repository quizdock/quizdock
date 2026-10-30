import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useParticipantViewport } from './use-participant-viewport';

describe('useParticipantViewport', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows keyboard and toolbar resizes, but preserves the layout during pinch zoom', () => {
    const viewport = Object.assign(new EventTarget(), { height: 780, scale: 1 });
    vi.stubGlobal('visualViewport', viewport);
    const { result, rerender, unmount } = renderHook(
      ({ active }) => useParticipantViewport(active),
      {
        initialProps: { active: true },
      },
    );
    expect(result.current).toBe(780);
    act(() => {
      viewport.height = 420;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(420);
    act(() => {
      viewport.scale = 2;
      viewport.height = 210;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(420);
    act(() => {
      viewport.scale = 1;
      viewport.height = 780;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(780);
    rerender({ active: false });
    expect(result.current).toBeUndefined();
    const remove = vi.spyOn(viewport, 'removeEventListener');
    rerender({ active: true });
    unmount();
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('leaves sizing to CSS when VisualViewport is unavailable', () => {
    vi.stubGlobal('visualViewport', undefined);
    const { result } = renderHook(() => useParticipantViewport(true));
    expect(result.current).toBeUndefined();
  });
});
