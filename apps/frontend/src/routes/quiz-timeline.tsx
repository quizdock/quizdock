import {
  AlignLeft,
  Image as ImageIcon,
  Lightbulb,
  type LucideIcon,
  Music,
  Video,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/components/ui/tooltip';
import { QuestionTypeIcon } from '@/lib/question-type-icon';
import { cn } from '@/lib/utils';
import type { QuizTimelineStep, StepMark } from './quiz-timeline-model';

const MARK_ICON: Record<StepMark, LucideIcon> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  hint: Lightbulb,
  explanation: AlignLeft,
};

/** Where a mark sits on its block: what helps the players on top, the media below. */
const MEDIA_MARKS = new Set<StepMark>(['image', 'video', 'audio']);

/** A question type's colour (index.css), on its icon and, faint, over its block. */
const typeColor = (type: string) => `var(--question-${type.replaceAll('_', '-')})`;

const mix = (color: string, percent: number) =>
  `color-mix(in oklab, ${color} ${percent}%, var(--card))`;
const TIME = 'var(--timeline-time)';

/** How each phase is shaded in the band under a block, as on a step's own timeline. */
const PHASE_FILL: Record<QuizTimelineStep['phases'][number]['kind'], string> = {
  reading: mix(TIME, 25),
  answers: mix(TIME, 60),
  stretch: `repeating-linear-gradient(135deg, ${mix(TIME, 60)} 0 3px, transparent 3px 6px)`,
  shown: mix(TIME, 38),
  display: mix('var(--timeline-slide)', 80),
};

/** `m min ss s`, or `ss s` under a minute. */
function clock(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m ? `${m} min ${String(r).padStart(2, '0')} s` : `${r} s`;
}

/**
 * The whole quiz as the auto mode plays it (SPECIFICATIONS-QUESTION-TIMELINE): one block
 * per step, its width its length (or all alike), its phases in a thin band; slides by
 * their colour, questions by their number (ringed), their type's colour and icon, the
 * hint and explanation marks on top, the media below. The step open in the editor
 * is ringed; a block opens its step.
 */
export function QuizTimeline({
  steps,
  labels,
  selected,
  onOpen,
  scale,
  onScale,
}: {
  steps: QuizTimelineStep[];
  /** Each step's number (questions) and its name, in the same order. */
  labels: { number: number | null; name: string }[];
  selected: string | null;
  onOpen: (id: string) => void;
  scale: 'time' | 'equal';
  onScale: (scale: 'time' | 'equal') => void;
}) {
  const { t } = useTranslation('editor');
  if (steps.length === 0) return null;
  const total = steps.reduce((a, s) => a + s.totalS, 0);
  const questions = steps.filter((s) => s.kind === 'question').length;
  const marks: number[] = [];
  for (let s = 0; s <= total; s += 60) marks.push(s);
  return (
    <section
      aria-label={t('quizTimeline.legend')}
      className="bg-card flex flex-col gap-2 rounded-xl border p-3"
    >
      <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
        <span className="text-muted-foreground mr-1 font-semibold tracking-wider uppercase">
          {t('quizTimeline.legend')}
        </span>
        <span className="rounded-full border px-2 py-px">
          {t('quizTimeline.total', { time: clock(total) })}
        </span>
        <span className="rounded-full border px-2 py-px">
          {t('quizTimeline.count', { questions, slides: steps.length - questions })}
        </span>
        <span
          role="group"
          aria-label={t('quizTimeline.scale')}
          className="ml-auto inline-flex gap-0.5 rounded-md border p-0.5"
        >
          {(['time', 'equal'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={scale === v}
              onClick={() => onScale(v)}
              className={cn(
                'text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded px-2 py-0.5 focus-visible:ring-2 focus-visible:outline-none',
                scale === v && 'bg-accent text-foreground',
              )}
            >
              {t(`quizTimeline.scaleValue.${v}`)}
            </button>
          ))}
        </span>
      </div>
      {scale === 'time' ? (
        <div className="text-muted-foreground relative h-3.5 text-[10px]" aria-hidden>
          {marks.map((s) => (
            <span
              key={s}
              className={cn('absolute', s > 0 && '-translate-x-1/2')}
              style={{ left: `${(s / total) * 100}%` }}
            >
              {t('quizTimeline.minute', { n: s / 60 })}
            </span>
          ))}
        </div>
      ) : null}
      <ol className="flex h-12 gap-0.5">
        {steps.map((step, i) => {
          const { number, name } = labels[i];
          const tip =
            step.kind === 'slide'
              ? t('quizTimeline.slideTip', { name, time: clock(step.totalS) })
              : t('quizTimeline.questionTip', { n: number, name, time: clock(step.totalS) });
          return (
            <li
              key={step.id}
              className="min-w-[1.25rem]"
              style={{ flex: scale === 'time' ? step.totalS : 1 }}
            >
              <Tooltip label={tip} className="size-full">
                <button
                  type="button"
                  aria-label={tip}
                  aria-current={selected === step.id ? 'step' : undefined}
                  onClick={() => onOpen(step.id)}
                  className={cn(
                    'focus-visible:ring-ring relative flex size-full flex-col overflow-hidden rounded-md border-[1.5px] border-transparent text-left hover:brightness-110 focus-visible:ring-2 focus-visible:outline-none',
                    selected === step.id && 'border-primary ring-primary/40 ring-2',
                  )}
                  style={{
                    background:
                      step.kind === 'slide'
                        ? mix('var(--timeline-slide)', 55)
                        : mix(step.type ? typeColor(step.type) : 'var(--primary)', 22),
                  }}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden px-1 text-[11px] font-semibold whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0">
                    {step.kind === 'question' ? (
                      <>
                        <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-black/75 px-1 text-[10px] leading-none text-white">
                          {number}
                        </span>
                        {step.type ? (
                          <QuestionTypeIcon
                            type={step.type}
                            style={{ color: typeColor(step.type) }}
                            aria-hidden
                          />
                        ) : null}
                        {(['top', 'bottom'] as const).map((at) => {
                          const here = step.marks.filter(
                            (m) => MEDIA_MARKS.has(m) === (at === 'bottom'),
                          );
                          return here.length ? (
                            <span
                              key={at}
                              className={cn(
                                'absolute right-1 flex gap-0.5 opacity-80 [&_svg]:size-2.5',
                                at === 'top' ? 'top-0.5' : 'bottom-2.5',
                              )}
                            >
                              {here.map((m) => {
                                const Mark = MARK_ICON[m];
                                return <Mark key={m} aria-hidden />;
                              })}
                            </span>
                          ) : null;
                        })}
                      </>
                    ) : null}
                  </span>
                  <span className="flex h-2 w-full" aria-hidden>
                    {step.phases.map((p, j) => (
                      <span key={j} style={{ flex: p.s, background: PHASE_FILL[p.kind] }} />
                    ))}
                  </span>
                </button>
              </Tooltip>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
