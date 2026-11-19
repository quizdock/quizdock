import {
  type QuizPace,
  questionDurationS,
  questionPhasesS,
  slideDisplayS,
} from '@quiz-dock/contracts';

/**
 * A quiz's length in auto mode, for the library (SPECIFICATIONS-QUESTION-TIMELINE): the
 * editor's timeline rule (`questionPhasesS`, `slideDisplayS`), with the media's lengths
 * as the library knows them — a video's included, which the editor does not read.
 */
export function quizDurationS(
  questions: {
    timeLimitS: number;
    timerAfterMedia: boolean;
    revealDelayS: number | null;
    visualMedia: { kind: string; durationMs: number | null } | null;
    audioMedia: { durationMs: number | null } | null;
  }[],
  slides: { displayDelayS: number | null }[],
  pace: QuizPace,
): number {
  const questionsS = questions.reduce((total, q) => {
    // A video carries its own sound; else the question's sound, if any.
    const mediaMs =
      q.visualMedia?.kind === 'video'
        ? (q.visualMedia.durationMs ?? null)
        : (q.audioMedia?.durationMs ?? null);
    return (
      total +
      questionDurationS(
        questionPhasesS(
          {
            timeLimitS: q.timeLimitS,
            timerAfterMedia: q.timerAfterMedia,
            mediaMs,
            revealDelayS: q.revealDelayS,
          },
          pace,
        ),
      )
    );
  }, 0);
  const slidesS = slides.reduce((total, s) => total + slideDisplayS(s.displayDelayS, pace), 0);
  return Math.round(questionsS + slidesS);
}
