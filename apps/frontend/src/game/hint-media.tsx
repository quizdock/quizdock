import type { QuestionHintPayload } from '@quiz-dock/contracts';
import { useEffect, useState } from 'react';
import { serverNow } from './clock';
import { QuestionMediaStage, type StageMode } from './media/question-media-stage';

/** How long a hint's video or sound plays (ms); 0 when unknown. */
const soundMs = (hint: QuestionHintPayload) =>
  hint.video?.durationMs ?? hint.audio?.durationMs ?? 0;

/**
 * Whether the hint's video or sound is heard now (server clock), for the question's sound
 * to step aside meanwhile (SPECIFICATIONS-HINTS: the hint's sound takes over). Not while
 * the game is paused, nor while the host hides it; of unknown length, until the question ends.
 */
export function useHintSounding(hint: QuestionHintPayload | null, paused: boolean): boolean {
  const start = hint?.mediaStartAt ?? null;
  const length = hint ? soundMs(hint) : 0;
  const [, tick] = useState(0);
  useEffect(() => {
    if (start === null || paused) return;
    // Looked at again as it starts and as it ends.
    const now = serverNow();
    const next = [start - now, start + length - now].filter((d) => d > 0);
    const timers = next.map((d) => window.setTimeout(() => tick((n) => n + 1), d + 20));
    return () => timers.forEach(window.clearTimeout);
  }, [start, length, paused]);
  if (start === null || paused || !hint?.shown) return false;
  const now = serverNow();
  return now >= start && (length === 0 || now < start + length);
}

/**
 * A hint's video or sound, played from its common start (`mediaStartAt`) on a device the
 * question's sound is for; its video seen where it is played. Hidden by the host, it is
 * paused; shown again, it goes on where it stopped (the server moves its start by the time
 * it was hidden), played again from its beginning when the host asks. Placed by that
 * start alone, never by a position kept on the device.
 */
export function HintMedia({
  hint,
  mode,
  audible,
  muted = false,
  boxClassName,
}: {
  hint: QuestionHintPayload;
  mode: StageMode;
  audible: boolean;
  muted?: boolean;
  boxClassName?: string;
}) {
  if (!hint.video && !hint.audio) return null;
  return (
    <QuestionMediaStage
      key={`hint:${hint.questionIndex}`}
      media={{
        visual: hint.video
          ? {
              kind: 'video',
              source: 'upload',
              url: hint.video.url,
              gainDb: hint.video.gainDb,
              ...(hint.video.durationMs ? { durationMs: hint.video.durationMs } : {}),
            }
          : null,
        audio: hint.audio ?? null,
      }}
      mode={hint.shown ? mode : 'pause'}
      audible={audible}
      muted={muted}
      startAt={hint.mediaStartAt ?? null}
      boxClassName={boxClassName}
    />
  );
}
