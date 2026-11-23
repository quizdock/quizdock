import { type LiveQuestionMedia, parseMediaRatio, type MediaStyle } from '@quiz-dock/contracts';
import { type CSSProperties, useState } from 'react';
import { serverNow } from '../clock';

/** A box its frame measures itself against (container query units). */
export const SIZE_CONTAINER: CSSProperties = { containerType: 'size' };

/**
 * Where a picture or a video stands in its box (SPECIFICATIONS-QUESTION-PICTURE): with a
 * ratio, the largest frame of it the box allows, centred — the box is a size container;
 * without one, the whole box. How it fills that frame, and where it is cropped.
 */
export function mediaFrame(style: MediaStyle | undefined, cover: boolean) {
  const ratio = cover ? null : parseMediaRatio(style?.ratio);
  return {
    ratio,
    box: ratio ? SIZE_CONTAINER : undefined,
    frame: ratio
      ? ({
          position: 'absolute',
          inset: 0,
          margin: 'auto',
          width: `min(100cqw, calc(100cqh * ${ratio}))`,
          height: `min(100cqh, calc(100cqw / ${ratio}))`,
        } satisfies CSSProperties)
      : undefined,
    fill: cover || style?.fit === 'cover' ? ('cover' as const) : ('contain' as const),
    focus: style?.focus,
  };
}

/** A picture's progressive reveal: when the answers open (server clock) and over how long. */
export interface Reveal {
  startAt: number;
  durationS: number;
  paused: boolean;
}

/**
 * The reveal as a style: blurred until the answers open, sharp `durationS` seconds later.
 * Its delay is read once, as the picture appears: computed again, it would jump.
 * Still (a preview): the blurred start.
 */
export function useRevealStyle(reveal: Reveal | null | undefined, still: boolean) {
  const [delayS] = useState(() => (reveal ? (reveal.startAt - serverNow()) / 1000 : 0));
  if (!reveal) return undefined;
  if (still) {
    return {
      filter: 'blur(var(--qd-reveal-blur))',
      transform: 'scale(1.08)',
    } satisfies CSSProperties;
  }
  return {
    animation: `qd-reveal ${reveal.durationS}s linear ${delayS}s both`,
    animationPlayState: reveal.paused ? 'paused' : 'running',
  } satisfies CSSProperties;
}

/** A question's reveal while it is open, if its picture asks for one. */
export function revealOf(
  question: { media?: LiveQuestionMedia | null; startedAt: number },
  paused: boolean,
): Reveal | null {
  const revealS = question.media?.style?.revealS;
  if (!revealS || question.media?.visual?.kind !== 'image') return null;
  return { startAt: question.startedAt, durationS: revealS, paused };
}
