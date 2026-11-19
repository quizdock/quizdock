import { effectiveTimeLimitS, slideMediaHoldMs } from '@quiz-dock/contracts';

/**
 * What a question or a slide plays, and when, as the editor's timeline draws it
 * (SPECIFICATIONS-QUESTION-TIMELINE): seconds from the step's display, computed with
 * the room's own rules (`effectiveTimeLimitS`, `slideMediaHoldMs`), never a second set.
 */

/** A segment of the time row. */
export interface TimelinePhase {
  kind:
    | 'reading'
    | 'listen'
    | 'answers'
    | 'display'
    | 'manual'
    | 'stretch'
    | 'tail'
    | 'answer'
    | 'answerManual';
  from: number;
  to: number;
}

/** One element, drawn once over the channels it has. */
export interface TimelineElement {
  kind: 'image' | 'video' | 'audio' | 'reveal' | 'explanation' | 'hint';
  from: number;
  /** Where it ends on the visual row; null when it shows nothing. */
  visualTo: number | null;
  /** Where it ends on the audio row; null when it plays no sound. */
  audioTo: number | null;
  /** Its own length, when known (null for a picture, or a media not described yet). */
  lengthS: number | null;
  loop?: boolean;
  peaks?: number[] | null;
  /** It collides with an earlier element and sits over it, a little lower. */
  lowered: boolean;
}

export interface StepTimeline {
  /** The whole step, in seconds, from its display. */
  totalS: number;
  /** The duration the author set: a minimum (the answers', or the slide's display). */
  minimumS: number;
  /** That duration once the media stretched it; null when the host moves on by hand. */
  actualS: number | null;
  phases: TimelinePhase[];
  elements: TimelineElement[];
  /** The answers' opening and closing (s): plain lines across the rows. */
  milestones: number[];
  /** The step ends when the host moves on: its last segment has no end of its own. */
  openEnded: boolean;
}

/** How wide a segment without an end of its own is drawn (s): the host moves on. */
export const OPEN_END_S = 5;

const seconds = (ms: number) => Math.ceil(ms / 1000);

/** A later element that shares a row with an earlier one, at the same time, sits over it. */
function lower(elements: Omit<TimelineElement, 'lowered'>[]): TimelineElement[] {
  const overlaps = (a: Omit<TimelineElement, 'lowered'>, b: Omit<TimelineElement, 'lowered'>) =>
    (a.visualTo !== null &&
      b.visualTo !== null &&
      Math.min(a.visualTo, b.visualTo) > Math.max(a.from, b.from)) ||
    (a.audioTo !== null &&
      b.audioTo !== null &&
      Math.min(a.audioTo, b.audioTo) > Math.max(a.from, b.from));
  return elements.map((e, i) => ({
    ...e,
    lowered: elements.slice(0, i).some((o) => overlaps(o, e)),
  }));
}

export function questionTimeline(q: {
  timeLimitS: number;
  /** The answers wait for the media's end. */
  listenFirst: boolean;
  visual: 'image' | 'video' | null;
  /** The picture's progressive reveal (s), from the answers' opening; null without one. */
  revealS?: number | null;
  audio: { peaks: number[] } | null;
  /** The video's or the sound's length; null while unknown. */
  mediaMs: number | null;
  /** The quiz's pause after a media. */
  tailS: number;
  /** The reading window before the answers open. */
  readMs: number;
  /**
   * How long the right answer shows, in auto mode (s); null = the host moves on by hand.
   * Absent, the timeline stops at the answers' end.
   */
  answerShownS?: number | null;
  /** An explanation goes with the right answer. */
  explanation?: boolean;
  /** A text hint, `afterS` after the answers open (SPECIFICATIONS-HINTS). */
  hint?: { afterS: number } | null;
}): StepTimeline {
  const sounding = q.visual === 'video' || !!q.audio;
  const mediaS = q.mediaMs === null ? null : q.mediaMs / 1000;
  const readS = q.readMs / 1000;
  const phases: TimelinePhase[] = [];
  let open: number;
  let answers: number;
  if (q.listenFirst && sounding && mediaS !== null) {
    open = seconds(q.mediaMs!);
    answers = q.timeLimitS;
    phases.push({ kind: 'listen', from: 0, to: open });
  } else {
    open = readS;
    answers = effectiveTimeLimitS(q.timeLimitS, sounding ? q.mediaMs : null, q.tailS, q.readMs);
    phases.push({ kind: 'reading', from: 0, to: open });
  }
  // The answers close here; the media stop with them.
  const closed = open + answers;
  phases.push({ kind: 'answers', from: open, to: open + q.timeLimitS });
  if (answers > q.timeLimitS) {
    const mediaEnd = Math.min(closed, Math.max(open + q.timeLimitS, mediaS ?? 0));
    phases.push({ kind: 'stretch', from: open + q.timeLimitS, to: mediaEnd });
    if (closed > mediaEnd) phases.push({ kind: 'tail', from: mediaEnd, to: closed });
  }
  const shown = q.answerShownS === undefined ? 0 : (q.answerShownS ?? OPEN_END_S);
  const total = closed + shown;
  if (q.answerShownS !== undefined) {
    phases.push({
      kind: q.answerShownS === null ? 'answerManual' : 'answer',
      from: closed,
      to: total,
    });
  }
  const end = (len: number | null) => (len === null ? closed : Math.min(len, closed));
  const elements: Omit<TimelineElement, 'lowered'>[] = [];
  if (q.visual === 'image') {
    elements.push({ kind: 'image', from: 0, visualTo: closed, audioTo: null, lengthS: null });
  }
  if (q.visual === 'image' && q.revealS) {
    // Over the picture, from the answers' opening: sharp at the latest when they close.
    const to = Math.min(open + q.revealS, open + q.timeLimitS);
    elements.push({ kind: 'reveal', from: open, visualTo: to, audioTo: null, lengthS: to - open });
  }
  if (q.visual === 'video') {
    elements.push({
      kind: 'video',
      from: 0,
      visualTo: end(mediaS),
      audioTo: end(mediaS),
      lengthS: mediaS,
    });
  }
  if (q.audio) {
    elements.push({
      kind: 'audio',
      from: 0,
      visualTo: null,
      audioTo: end(mediaS),
      lengthS: mediaS,
      peaks: q.audio.peaks,
    });
  }
  if (q.hint) {
    // Shown from its time until the answers close; it comes later, over what is there.
    const from = Math.min(open + q.hint.afterS, closed);
    elements.push({ kind: 'hint', from, visualTo: closed, audioTo: null, lengthS: null });
  }
  if (q.explanation && shown > 0) {
    elements.push({
      kind: 'explanation',
      from: closed,
      visualTo: total,
      audioTo: null,
      lengthS: q.answerShownS ?? null,
    });
  }
  return {
    totalS: total,
    minimumS: q.timeLimitS,
    actualS: answers,
    phases,
    elements: lower(elements),
    milestones: [open, closed],
    openEnded: q.answerShownS === null,
  };
}

export function slideTimeline(s: {
  /** null = the instance's default, 0 = the host moves on by hand, n = n seconds. */
  displayDelayS: number | null;
  defaultS: number;
  video: { lengthMs: number | null; loop: boolean; sound: boolean } | null;
  audio: { lengthMs: number | null; peaks: number[] | null } | null;
  tailS: number;
}): StepTimeline {
  const holdMs = slideMediaHoldMs(
    {
      video: s.video
        ? {
            url: '',
            loop: s.video.loop,
            sound: s.video.sound,
            gainDb: 0,
            durationMs: s.video.lengthMs ?? undefined,
          }
        : null,
      audio:
        s.audio && s.audio.lengthMs
          ? { url: '', durationMs: s.audio.lengthMs, peaks: [], gainDb: 0 }
          : null,
    },
    s.tailS,
  );
  const holdS = holdMs === null ? 0 : seconds(holdMs);
  const timedS = holdMs === null ? 0 : holdMs / 1000 - s.tailS;
  const manual = s.displayDelayS === 0;
  const displayS = manual ? s.defaultS : (s.displayDelayS ?? s.defaultS);
  const total = Math.max(displayS, holdS);
  const phases: TimelinePhase[] = manual
    ? [{ kind: 'manual', from: 0, to: total }]
    : [{ kind: 'display', from: 0, to: displayS }];
  if (!manual && holdS > displayS) {
    const tailFrom = Math.max(displayS, timedS);
    if (tailFrom > displayS) phases.push({ kind: 'stretch', from: displayS, to: tailFrom });
    phases.push({ kind: 'tail', from: tailFrom, to: total });
  }
  const end = (ms: number | null) => (ms === null ? total : Math.min(ms / 1000, total));
  const elements: Omit<TimelineElement, 'lowered'>[] = [];
  if (s.video) {
    // A looped video is a decor: it plays the whole slide.
    const to = s.video.loop ? total : end(s.video.lengthMs);
    elements.push({
      kind: 'video',
      from: 0,
      visualTo: to,
      audioTo: s.video.sound ? to : null,
      lengthS: s.video.lengthMs === null ? null : s.video.lengthMs / 1000,
      loop: s.video.loop,
    });
  }
  if (s.audio) {
    elements.push({
      kind: 'audio',
      from: 0,
      visualTo: null,
      audioTo: end(s.audio.lengthMs),
      lengthS: s.audio.lengthMs === null ? null : s.audio.lengthMs / 1000,
      peaks: s.audio.peaks,
    });
  }
  return {
    totalS: total,
    minimumS: displayS,
    actualS: manual ? null : total,
    phases,
    elements: lower(elements),
    milestones: [],
    openEnded: manual,
  };
}
