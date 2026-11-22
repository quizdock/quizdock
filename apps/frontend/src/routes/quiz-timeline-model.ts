import {
  type QuestionMedia,
  type QuizPace,
  type SlideBlock,
  questionDurationS,
  questionPhasesS,
  slideDisplayS,
} from '@quiz-dock/contracts';
import type { QuizItem } from '@/lib/quiz-items';

/** What a step carries, drawn as icons on its block. */
export type StepMark = 'image' | 'video' | 'audio' | 'hint' | 'explanation';

/** One step of the quiz on its timeline, its length as the auto mode plays it. */
export interface QuizTimelineStep {
  id: string;
  kind: 'question' | 'slide';
  /** A question's type (its icon); none for a slide. */
  type?: string;
  /** Seconds, from its display to the next step (auto mode). */
  totalS: number;
  /** Its phases, in seconds, for the thin band under the block. */
  phases: { kind: 'reading' | 'answers' | 'stretch' | 'shown' | 'display'; s: number }[];
  marks: StepMark[];
}

/**
 * The whole quiz as the auto mode plays it (the quiz timeline), each step by the rule the
 * server's estimate uses too (`questionPhasesS`, `slideDisplayS` in @quiz-dock/contracts).
 */
export function quizTimeline(items: QuizItem[], pace: QuizPace): QuizTimelineStep[] {
  return items.map((item): QuizTimelineStep => {
    if (item.kind === 'slide') {
      const s = item.slide;
      const display = slideDisplayS(s.displayDelayS ?? null, pace);
      return {
        id: item.id,
        kind: 'slide',
        totalS: display,
        phases: [{ kind: 'display', s: display }],
        marks: [
          ...((s.blocks as SlideBlock[])
            .flatMap((b) => (b.type === 'columns' ? b.columns.flat() : [b]))
            .some((b) => b.type === 'image') || s.imageMediaId
            ? (['image'] as const)
            : []),
          ...(s.videoMediaId ? (['video'] as const) : []),
          ...(s.audioMediaId ? (['audio'] as const) : []),
        ],
      };
    }
    const q = item.question;
    const media = (q.media as QuestionMedia | null) ?? { visual: null, audio: null };
    // The sound's length is on the question; a video's is the library's (unknown here).
    const p = questionPhasesS(
      {
        timeLimitS: q.timeLimitS,
        timerAfterMedia: q.timerAfterMedia,
        mediaMs: media.audio?.durationMs ?? null,
        revealDelayS: q.revealDelayS ?? null,
      },
      pace,
    );
    const hint = q.hint as
      | {
          text?: string;
          imageMediaId?: string | null;
          videoMediaId?: string | null;
          audioMediaId?: string | null;
        }
      | null
      | undefined;
    return {
      id: item.id,
      kind: 'question',
      type: q.type,
      totalS: questionDurationS(p),
      phases: [
        { kind: 'reading' as const, s: p.readingS },
        { kind: 'answers' as const, s: p.answersS },
        { kind: 'stretch' as const, s: p.stretchS },
        { kind: 'shown' as const, s: p.shownS },
      ].filter((ph) => ph.s > 0),
      marks: [
        ...(media.visual ? ([media.visual.kind] as const) : []),
        ...(media.audio ? (['audio'] as const) : []),
        ...(hint?.text || hint?.imageMediaId || hint?.videoMediaId || hint?.audioMediaId
          ? (['hint'] as const)
          : []),
        ...(q.type !== 'poll' && q.answerExplanation?.trim() ? (['explanation'] as const) : []),
      ],
    };
  });
}
