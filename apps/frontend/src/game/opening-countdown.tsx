import { m } from 'motion/react';
import { useMotionLevel } from './motion/level';
import { EASE_OUT } from './motion/tokens';

/** The server's existing reading/listening window, never an extra delay. */
export function OpeningCountdown({
  remaining,
  label,
  paused,
}: {
  remaining: number;
  label: string;
  paused: boolean;
}) {
  const level = useMotionLevel();
  const moves = level === 'full' && !paused;
  return (
    <div className="flex w-full flex-col items-center gap-[0.5em] py-[0.5em]">
      <div
        className="text-primary on-backdrop:text-inherit relative grid size-[3.5em] shrink-0 place-items-center"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 size-full -rotate-90"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
        >
          <circle cx="50" cy="50" r="45" opacity="0.16" />
          {/* Each second draws the outline again; still, it stays whole. */}
          <m.circle
            key={`${remaining}:${moves}`}
            cx="50"
            cy="50"
            r="45"
            strokeLinecap="round"
            initial={moves ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: EASE_OUT }}
          />
        </svg>
        <span className="text-[1.75em] leading-none font-bold tabular-nums">{remaining}</span>
      </div>
      <p
        role="timer"
        aria-live="off"
        aria-label={label}
        className="text-center text-[1.1em] leading-snug font-semibold text-balance"
      >
        {label}
        <span className="sr-only"> {remaining}</span>
      </p>
    </div>
  );
}
