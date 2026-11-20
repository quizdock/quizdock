import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { HintControls } from './hint-controls';
import { HintOverlay } from './hint-overlay';
import { PhoneHint } from './phone-hint';

afterEach(cleanup);

const question = {
  questionIndex: 2,
  hint: { afterS: 10, penaltyPct: 25 },
} as never;
const out = {
  questionIndex: 2,
  text: 'Elle a été choisie en 1923',
  penaltyPct: 25,
  revealedAt: 1,
  shown: true,
};

describe('the hint in play (SPECIFICATIONS-HINTS)', () => {
  it('console: when it comes, a reminder while hints are off, and its switch', () => {
    const onEnabled = vi.fn();
    render(
      <HintControls
        question={question}
        hint={null}
        enabled={false}
        onEnabled={onEnabled}
        onShown={vi.fn()}
        onReplay={vi.fn()}
      />,
    );
    expect(screen.getByText('Indice à 10 s · −25 %')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('les indices sont coupés');
    fireEvent.click(screen.getByRole('button', { name: 'Activer' }));
    expect(onEnabled).toHaveBeenCalledWith(true);
  });

  it('console: once out, its text and whether the projection shows it', () => {
    const onShown = vi.fn();
    render(
      <HintControls
        question={question}
        hint={out}
        enabled
        onEnabled={vi.fn()}
        onShown={onShown}
        onReplay={vi.fn()}
      />,
    );
    expect(screen.getByText('Elle a été choisie en 1923')).toBeInTheDocument();
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'Sur la projection' }));
    expect(onShown).toHaveBeenCalledWith(false);
  });

  it('console: nothing for a question without a hint', () => {
    const { container } = render(
      <HintControls
        question={{ questionIndex: 1 } as never}
        hint={null}
        enabled
        onEnabled={vi.fn()}
        onShown={vi.fn()}
        onReplay={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('a picture alone, or with words: on the projection and the phone', () => {
    const image = { url: '/m/anitkabir.webp' };
    render(<HintOverlay text="" image={image} penaltyPct={25} />);
    expect(screen.getByRole('img', { name: 'L’image de l’indice' })).toHaveAttribute(
      'src',
      image.url,
    );
    cleanup();
    render(<PhoneHint text="Choisie en 1923" image={image} />);
    expect(screen.getByRole('img', { name: 'Choisie en 1923' })).toBeInTheDocument();
    expect(screen.getByText('Choisie en 1923')).toBeInTheDocument();
  });

  it('projection: the hint and what it costs', () => {
    render(<HintOverlay text="Elle a été choisie en 1923" penaltyPct={25} />);
    expect(screen.getByRole('status')).toHaveTextContent('perdent 25 %');
  });

  it('phone: a bar on top of the tiles, its text folded and unfolded by its owner', () => {
    render(<PhoneHint text="Elle a été choisie en 1923" />);
    const bar = screen.getByRole('button', { name: /Indice/ });
    expect(bar).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(bar);
    expect(screen.queryByText('Elle a été choisie en 1923')).toBeNull();
    expect(bar).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(bar);
    expect(screen.getByText('Elle a été choisie en 1923')).toBeInTheDocument();
  });
});

describe('a picture revealed progressively, on a phone in the room', () => {
  it('blurred as on the projection, and never opened sharp meanwhile', async () => {
    const { QuestionMedia } = await import('./live-components');
    const media = {
      visual: { kind: 'image' as const, url: '/m/x.webp', alt: 'Ankara' },
      audio: null,
      style: { revealS: 10 },
    };
    const { rerender } = render(
      <QuestionMedia
        media={media}
        zoomable
        reveal={{ startAt: Date.now() + 3000, durationS: 10, paused: false }}
      />,
    );
    const img = screen.getByRole('img', { name: 'Ankara' });
    expect(img.style.animation).toContain('qd-reveal');
    expect(screen.queryByRole('button')).toBeNull();
    // No reveal: the usual picture, opened over the screen on a tap.
    rerender(<QuestionMedia media={{ ...media, style: undefined }} zoomable />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

describe('the hint’s sound takes over the question’s, while it plays', () => {
  it('from its start to its end, never while the game is paused', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { useHintSounding } = await import('./hint-media');
    const hint = (startIn: number, durationMs = 5_000) => ({
      ...out,
      audio: { url: '/m/hint.m4a', durationMs, peaks: [], gainDb: 0 },
      mediaStartAt: Date.now() + startIn,
    });
    expect(renderHook(() => useHintSounding(hint(-1_000), false)).result.current).toBe(true);
    expect(renderHook(() => useHintSounding(hint(2_000), false)).result.current).toBe(false);
    expect(renderHook(() => useHintSounding(hint(-10_000), false)).result.current).toBe(false);
    expect(renderHook(() => useHintSounding(hint(-1_000), true)).result.current).toBe(false);
    expect(renderHook(() => useHintSounding(null, false)).result.current).toBe(false);
  });
});

describe('a hint hidden by the host', () => {
  it('gives the floor back to the question’s sound', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { useHintSounding } = await import('./hint-media');
    const hidden = {
      ...out,
      shown: false,
      audio: { url: '/m/hint.m4a', durationMs: 5_000, peaks: [], gainDb: 0 },
      mediaStartAt: Date.now() - 1_000,
    };
    expect(renderHook(() => useHintSounding(hidden, false)).result.current).toBe(false);
  });
});
