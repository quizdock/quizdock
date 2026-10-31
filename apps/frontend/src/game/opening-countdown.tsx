import { m } from 'motion/react';
import { useMotionLevel } from './motion/level';
import { EASE_OUT, useMotion } from './motion/tokens';

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
  const pace = useMotion();
  const moves = level === 'full' && !paused;
  return (
    <div className="flex w-full items-center justify-center gap-[1em] py-[0.5em]">
      <div
        className="text-primary on-backdrop:text-inherit relative grid size-[5.5em] shrink-0 place-items-center"
        aria-hidden="true"
      >
        <m.span
          key={`halo:${remaining}:${moves}`}
          className="absolute inset-[0.65em] rounded-full border"
          style={{ borderColor: 'currentColor' }}
          initial={false}
          animate={moves ? { scale: [0.8, 1.3], opacity: [0.3, 0] } : { opacity: 0 }}
          transition={{ duration: pace.move, ease: EASE_OUT }}
        />
        <m.svg
          key={`ring:${remaining}:${moves}`}
          viewBox="0 0 100 100"
          className="absolute inset-0 size-full"
          initial={moves ? { rotate: -35 } : false}
          animate={{ rotate: 0 }}
          transition={{ duration: pace.move, ease: EASE_OUT }}
          fill="none"
          stroke="currentColor"
        >
          <circle cx="50" cy="50" r="43" strokeWidth="1" opacity="0.16" />
          <circle
            cx="50"
            cy="50"
            r="43"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="36 99"
            transform="rotate(-90 50 50)"
            opacity="0.8"
          />
          {[0, 90, 180, 270].map((angle) => (
            <path
              key={angle}
              d="M50 1V6"
              transform={`rotate(${angle} 50 50)`}
              strokeWidth="2"
              opacity="0.45"
            />
          ))}
        </m.svg>
        <m.span
          key={`number:${remaining}:${moves}`}
          className="inline-block text-[2.75em] leading-none font-bold tabular-nums"
          initial={moves ? { opacity: 0, scale: 0.72, y: pace.rise / 3 } : false}
          animate={{ opacity: 1, scale: moves ? [0.72, 1.08, 1] : 1, y: 0 }}
          transition={{ duration: pace.pop, ease: EASE_OUT }}
        >
          {remaining}
        </m.span>
      </div>
      <p
        role="timer"
        aria-live="off"
        aria-label={label}
        className="max-w-[12em] text-start text-[1.1em] leading-snug font-semibold text-balance"
      >
        {label}
        <span className="sr-only"> {remaining}</span>
      </p>
    </div>
  );
}
