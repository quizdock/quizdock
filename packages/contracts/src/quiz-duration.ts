import { effectiveTimeLimitS } from './question-media';

/**
 * How long a quiz plays in auto mode (SPECIFICATIONS-QUESTION-TIMELINE): one rule for the
 * editor's timelines and for the server's estimate (the library's list). Each question:
 * its reading — or its media first, when the answers wait for it — its answers, stretched
 * by a longer media plus the quiz's pause, then its right answer shown; each slide its
 * display time. A step the host ends by hand counts {@link OPEN_END_S}.
 */

/** How long a step without an end of its own is counted (s): the host moves on. */
export const OPEN_END_S = 5;

/** The pace a quiz plays at: the instance's reading and auto times, the quiz's pause. */
export interface QuizPace {
  /** The reading window before the answers open (ms). */
  readMs: number;
  /** The quiz's pause after a media (s). */
  tailS: number;
  /** The right answer's and a slide's time in auto mode (s); null = the host moves on. */
  autoAdvanceS: number | null;
}

export interface QuestionPhasesS {
  /** The reading, or the media played first (listen first). */
  readingS: number;
  /** The answer time the author set. */
  answersS: number;
  /** What a longer media adds, with the quiz's pause after it. */
  stretchS: number;
  /** The right answer on screen. */
  shownS: number;
}

export function questionPhasesS(
  q: {
    timeLimitS: number;
    /** The answers wait for the media's end (only when its length is known). */
    timerAfterMedia: boolean;
    /** The sound's or the video's length; null when none or unknown. */
    mediaMs: number | null;
    revealDelayS: number | null;
  },
  pace: QuizPace,
): QuestionPhasesS {
  const shownS = q.revealDelayS ?? pace.autoAdvanceS ?? OPEN_END_S;
  if (q.timerAfterMedia && q.mediaMs !== null) {
    return {
      readingS: Math.ceil(q.mediaMs / 1000),
      answersS: q.timeLimitS,
      stretchS: 0,
      shownS,
    };
  }
  const answers = effectiveTimeLimitS(q.timeLimitS, q.mediaMs, pace.tailS, pace.readMs);
  return {
    readingS: pace.readMs / 1000,
    answersS: q.timeLimitS,
    stretchS: answers - q.timeLimitS,
    shownS,
  };
}

/** A slide's display time in auto mode: its own, else the instance's; by hand, nominal. */
export function slideDisplayS(displayDelayS: number | null, pace: QuizPace): number {
  if (displayDelayS === 0) return OPEN_END_S;
  return displayDelayS ?? pace.autoAdvanceS ?? OPEN_END_S;
}

/** A question's whole length (s). */
export const questionDurationS = (p: QuestionPhasesS) =>
  p.readingS + p.answersS + p.stretchS + p.shownS;
