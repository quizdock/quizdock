import { quizDurationS } from './quiz-duration';

const pace = { readMs: 3000, tailS: 1, autoAdvanceS: 5 };
const question = (over: Partial<Parameters<typeof quizDurationS>[0][number]> = {}) => ({
  timeLimitS: 20,
  timerAfterMedia: false,
  revealDelayS: null,
  visualMedia: null,
  audioMedia: null,
  ...over,
});

describe('quizDurationS (the library’s estimate)', () => {
  it('adds each question’s reading, answers and right answer shown, and each slide’s display', () => {
    // (3 + 20 + 5) + (3 + 10 + 8) + 5 + 5 (a slide by hand counts its nominal 5 s).
    expect(
      quizDurationS(
        [question(), question({ timeLimitS: 10, revealDelayS: 8 })],
        [{ displayDelayS: null }, { displayDelayS: 0 }],
        pace,
      ),
    ).toBe(28 + 21 + 10);
  });

  it('a longer media stretches its question, a video’s length included', () => {
    // 25 s of video: the answers close at 26 s (25 + 1 pause), then 5 s shown.
    expect(
      quizDurationS([question({ visualMedia: { kind: 'video', durationMs: 25_000 } })], [], pace),
    ).toBe(31);
    // Listen first: the media, then the full answer time.
    expect(
      quizDurationS(
        [question({ timerAfterMedia: true, audioMedia: { durationMs: 12_000 } })],
        [],
        pace,
      ),
    ).toBe(12 + 20 + 5);
  });
});
