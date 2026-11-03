import { animate, stagger } from 'motion/react';
import { useMotionLevel } from './level';
import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { EASE_OUT, useMotion } from './tokens';

/** A count that beats when it changes (answers coming in). */
export function Pulse({ value, className }: { value: number | string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef(value);
  const level = useMotionLevel();
  const motion = useMotion();
  const reduced = level !== 'full';
  useEffect(() => {
    if (last.current === value || reduced || !ref.current) {
      last.current = value;
      return;
    }
    last.current = value;
    void animate(ref.current, { scale: [1.3, 1] }, { duration: motion.pop, ease: 'easeOut' });
  }, [value, reduced, motion]);
  return (
    <span ref={ref} className={className} style={{ display: 'inline-block' }}>
      {value}
    </span>
  );
}

/** The last standings a list showed, by what it tracks: where each player comes from. */
const shownStandings = new Map<string, Map<string, { rank: number; score: number }>>();

/**
 * A ranked list (`[data-row]` items keyed by player, `[data-score]` inside): each
 * row slides from its previous place to the new one and its score counts up. The
 * list is rebuilt at every step, so the previous standings are remembered here,
 * per `track`, from one showing to the next. A leader set apart (`data-place="top"`)
 * does not slide: it rises into its place when it has just taken it.
 */
export function useStandingsMotion(
  ref: RefObject<HTMLElement | null>,
  rows: { nickname: string; rank: number; score: number }[],
  track = 'standings',
) {
  const level = useMotionLevel();
  const motion = useMotion();
  const reduced = level !== 'full';
  const signature = rows.map((r) => `${r.nickname}:${r.rank}:${r.score}`).join('|');
  useLayoutEffect(() => {
    const before = shownStandings.get(track);
    shownStandings.set(
      track,
      new Map(rows.map((r) => [r.nickname, { rank: r.rank, score: r.score }])),
    );
    const list = ref.current;
    if (!before || !list || reduced) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>('[data-row]'));
    const listed = items.filter((el) => el.dataset.place !== 'top');
    if (items.length < 2) return;
    const pitch = listed.length > 1 ? listed[1].offsetTop - listed[0].offsetTop : 0;
    const last = rows.length;
    // The rows' places by rank: in one column or several, a row moves from its old rank's.
    const places = new Map(
      listed.map((el) => [Number(el.dataset.rank), { x: el.offsetLeft, y: el.offsetTop }]),
    );
    items.forEach((el) => {
      const row = rows.find((r) => r.nickname === el.dataset.row);
      if (!row) return;
      const was = before.get(row.nickname);
      if (el.dataset.place === 'top') {
        if (was?.rank !== row.rank) {
          void animate(
            el,
            { opacity: [0, 1], y: [motion.rise * 2, 0] },
            { duration: motion.move, ease: EASE_OUT },
          );
        }
      } else {
        const from = was && places.get(was.rank);
        if (from) {
          const x = from.x - el.offsetLeft;
          const y = from.y - el.offsetTop;
          if (x || y) {
            void animate(el, { x: [x, 0], y: [y, 0] }, { duration: motion.move, ease: EASE_OUT });
          }
        } else {
          // A newcomer to the list comes from just below it; a former leader, from above.
          const shift = (was ? Math.min(was.rank, last + 1) : last + 1) - row.rank;
          if (shift !== 0 && pitch > 0) {
            void animate(el, { y: [shift * pitch, 0] }, { duration: motion.move, ease: EASE_OUT });
          }
        }
      }
      const score = el.querySelector<HTMLElement>('[data-score]');
      if (score && was && was.score !== row.score) {
        void animate(was.score, row.score, {
          duration: motion.count,
          ease: 'easeOut',
          onUpdate: (v) => (score.textContent = String(Math.round(v))),
        });
      }
    });
    // Only a new showing of the standings moves; a re-render with the same rows does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, track, reduced, motion]);
}

/**
 * A reveal (`[data-fill]` bars, `[data-dim]` rows, `[data-mark]` ticks): the bars
 * fill from zero together, then the wrong answers step back and the tick pops.
 */
export function useRevealMotion(ref: RefObject<HTMLElement | null>, key: string) {
  const level = useMotionLevel();
  const motion = useMotion();
  const reduced = level !== 'full';
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || reduced) return;
    const fills = Array.from(root.querySelectorAll<HTMLElement>('[data-fill]'));
    fills.forEach((el, i) => {
      const width = el.style.width || '0%';
      void animate(
        el,
        { width: ['0%', width] },
        { duration: motion.move, delay: 0.05 * i, ease: EASE_OUT },
      );
    });
    const after = motion.move;
    const dim = root.querySelectorAll<HTMLElement>('[data-dim]');
    if (dim.length)
      void animate(dim, { opacity: [1, 0.5] }, { delay: after, duration: motion.pop });
    const marks = root.querySelectorAll<HTMLElement>('[data-mark]');
    if (marks.length) {
      void animate(
        marks,
        { scale: [0, 1.25, 1], opacity: [0, 1] },
        { delay: after, duration: motion.pop },
      );
    }
  }, [key, reduced, ref, motion]);
}

/**
 * A podium (`[data-podium-step]` blocks with their rank, `[data-podium-who]`
 * above them): the steps rise third, second, first, each winner arriving on top.
 */
export function usePodiumMotion(ref: RefObject<HTMLElement | null>, key: string) {
  const level = useMotionLevel();
  const reduced = level !== 'full';
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || reduced) return;
    const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-podium-step]')).sort(
      (a, b) => Number(b.dataset.podiumStep) - Number(a.dataset.podiumStep),
    );
    steps.forEach((step, i) => {
      const at = 0.45 * i;
      const block = step.querySelector<HTMLElement>('[data-podium-block]');
      if (block) {
        block.style.transformOrigin = 'bottom';
        void animate(block, { scaleY: [0, 1] }, { delay: at, duration: 0.5, ease: EASE_OUT });
      }
      const who = step.querySelectorAll<HTMLElement>('[data-podium-who]');
      if (who.length) {
        void animate(
          who,
          { opacity: [0, 1], y: [-24, 0] },
          {
            delay: stagger(0.05, { startDelay: at + 0.35 }),
            duration: 0.4,
            ease: 'easeOut',
          },
        );
      }
    });
  }, [key, reduced, ref]);
}
