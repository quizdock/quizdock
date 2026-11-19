import { describe, expect, it } from 'vitest';
import type { QuizItem } from '@/lib/quiz-items';
import { quizTimeline } from './quiz-timeline-model';

const question = (id: string, over: Record<string, unknown> = {}) =>
  ({
    kind: 'question',
    id,
    question: {
      id,
      type: 'single_choice',
      prompt: 'Q ?',
      timeLimitS: 20,
      timerAfterMedia: false,
      revealDelayS: null,
      answerExplanation: null,
      media: { visual: null, audio: null },
      hint: null,
      ...over,
    },
  }) as unknown as QuizItem;
const slide = (id: string, displayDelayS: number | null = null) =>
  ({ kind: 'slide', id, slide: { id, displayDelayS, blocks: [] } }) as unknown as QuizItem;

const o = { readMs: 3000, tailS: 1, autoAdvanceS: 5 };

describe('quizTimeline', () => {
  it('each step its auto-mode length: reading, answers, the right answer shown; a slide its display', () => {
    const [s, q] = quizTimeline([slide('s'), question('q')], o);
    expect(s).toMatchObject({ kind: 'slide', totalS: 5, phases: [{ kind: 'display', s: 5 }] });
    expect(q).toMatchObject({
      kind: 'question',
      type: 'single_choice',
      totalS: 3 + 20 + 5,
      phases: [
        { kind: 'reading', s: 3 },
        { kind: 'answers', s: 20 },
        { kind: 'shown', s: 5 },
      ],
      marks: [],
    });
  });

  it('a long sound stretches its question; the marks say what a step carries', () => {
    const [q] = quizTimeline(
      [
        question('q', {
          media: {
            visual: null,
            audio: { assetId: 'a', origin: 'upload', durationMs: 25_000, peaks: [] },
          },
          hint: { text: 'Un hymne', afterS: 5, penaltyPct: 25 },
          answerExplanation: 'Parce que.',
        }),
      ],
      o,
    );
    // 25 s of sound from the display, + 1 s: the answers close at 26 s, then 5 s shown.
    expect(q.totalS).toBe(31);
    expect(q.phases.find((p) => p.kind === 'stretch')?.s).toBe(3);
    expect(q.marks).toEqual(['audio', 'hint', 'explanation']);
  });

  it('follows the order it is given (a reorder in the editor)', () => {
    const ids = quizTimeline([question('b'), slide('a'), question('c')], o).map((s) => s.id);
    expect(ids).toEqual(['b', 'a', 'c']);
  });
});
