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
      <HintControls question={question} hint={out} enabled onEnabled={vi.fn()} onShown={onShown} />,
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
      />,
    );
    expect(container).toBeEmptyDOMElement();
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
