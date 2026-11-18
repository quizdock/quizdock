import type { SlideVideo } from './index';
import type { LiveAudio, LiveQuestionMedia } from './question-media';

/**
 * Media on slides (#125): settings of the slide, like a question's — a video
 * filling the slide behind its content, and a sound. One sound at most: a
 * video that plays its own excludes the sound, as a question's video does; a
 * muted video and a sound go together. Checked by the builder and the server.
 */

/** Error code of a slide with a video playing its sound next to a sound. */
export const SLIDE_TWO_SOUNDS = 'slide.two_sounds';

/** What a slide plays, as the live payload carries it. */
interface LiveSlideMedia {
  video?: SlideVideo | null;
  audio?: LiveAudio | null;
}

/**
 * The slide's sound-bearing media, in a question's shape — what the console's
 * transport steers and what a device that hears the slide must load. Null when
 * the slide plays no sound.
 */
export function slideSoundMedia(slide: LiveSlideMedia): LiveQuestionMedia | null {
  if (slide.audio) return { visual: null, audio: slide.audio };
  const video = slide.video;
  if (!video?.sound) return null;
  return {
    visual: {
      kind: 'video',
      source: 'upload',
      url: video.url,
      gainDb: video.gainDb,
      ...(video.durationMs ? { durationMs: video.durationMs } : {}),
    },
    audio: null,
  };
}

/** The slide's video when it plays muted, else none. */
export function slideMutedVideos(slide: LiveSlideMedia): string[] {
  return slide.video && !slide.video.sound ? [slide.video.url] : [];
}

/** Whether a slide plays anything: a sound, or a video (muted or not). */
export function slideHasPlayback(slide: LiveSlideMedia): boolean {
  return !!slide.video || !!slide.audio;
}

/**
 * How long the slide's timed media play, in ms — its sound, and its video
 * when played once. A looped video is a decor: it never holds the slide. Null
 * when nothing is timed or no length is known.
 */
export function slideTimedMs(slide: LiveSlideMedia): number | null {
  const lengths: number[] = [];
  if (slide.audio?.durationMs) lengths.push(slide.audio.durationMs);
  if (slide.video && !slide.video.loop && slide.video.durationMs) {
    lengths.push(slide.video.durationMs);
  }
  return lengths.length ? Math.max(...lengths) : null;
}

/**
 * How long the slide is held for its timed media, in ms: their length plus the
 * quiz's pause after them (`mediaTailS`). Null when nothing holds it. The room counts
 * it from the media's common start; the editor's timeline from the slide's display.
 */
export function slideMediaHoldMs(slide: LiveSlideMedia, tailS: number): number | null {
  const timed = slideTimedMs(slide);
  return timed === null ? null : timed + tailS * 1000;
}

/** A media step: a question, or the slide `slideIndex` shown before question `questionIndex`. */
export interface MediaStepRef {
  questionIndex: number;
  slideIndex?: number;
}

/** Whether two payloads speak of the same step (a slide and its question share `questionIndex`). */
export function sameMediaStep(a: MediaStepRef | null | undefined, b: MediaStepRef): boolean {
  return (
    !!a && a.questionIndex === b.questionIndex && (a.slideIndex ?? -1) === (b.slideIndex ?? -1)
  );
}

/**
 * Variables a slide's text may hold (heading and text blocks), replaced wherever
 * the slide shows. The quiz's are filled by the server from the quiz as it is
 * now — a new quiz's intro follows its title as the author changes it; the room's
 * by each screen from what it knows of the room, so a count stays live. An
 * unknown name is left as written.
 */
export const QUIZ_VARIABLES = [
  'title',
  'description',
  'questions',
  'author',
  'tags',
  'license',
] as const;
export const ROOM_VARIABLES = [
  'room',
  'host',
  'pin',
  'join',
  'players',
  'question',
  'total',
  'remaining',
  'date',
  'time',
] as const;
export type SlideVariable = (typeof QUIZ_VARIABLES)[number] | (typeof ROOM_VARIABLES)[number];
export const SLIDE_VARIABLES: readonly SlideVariable[] = [...QUIZ_VARIABLES, ...ROOM_VARIABLES];

/** Replaces each `{name}` the values know; the others stay as written. */
export function fillVariables(
  text: string,
  values: Partial<Record<SlideVariable, string | number | null | undefined>>,
): string {
  return text.replace(/\{([a-z]+)\}/g, (whole, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) return whole;
    const v = values[name as SlideVariable];
    return v === null || v === undefined ? '' : String(v);
  });
}

/** The quiz's variables, as the server fills them. */
export function quizVariables(quiz: {
  title: string;
  description?: string | null;
  questionCount?: number;
  author?: string | null;
  tags?: string[];
  license?: string | null;
}): Partial<Record<SlideVariable, string | number | null>> {
  return {
    title: quiz.title,
    description: quiz.description ?? '',
    ...(quiz.questionCount !== undefined ? { questions: quiz.questionCount } : {}),
    ...(quiz.author !== undefined ? { author: quiz.author ?? '' } : {}),
    ...(quiz.tags ? { tags: quiz.tags.join(', ') } : {}),
    ...(quiz.license !== undefined ? { license: quiz.license ?? '' } : {}),
  };
}

/** Every text of a slide's blocks with its variables filled. */
export function fillSlideBlocks<B extends SlideBlockLike>(
  blocks: B[],
  values: Partial<Record<SlideVariable, string | number | null | undefined>>,
): B[] {
  const leaf = (b: SlideLeafLike): SlideLeafLike =>
    b.type === 'heading' && typeof b.text === 'string'
      ? { ...b, text: fillVariables(b.text, values) }
      : b.type === 'text' && typeof b.md === 'string'
        ? { ...b, md: fillVariables(b.md, values) }
        : b;
  return blocks.map((b) =>
    b.type === 'columns' && Array.isArray(b.columns)
      ? ({ ...b, columns: b.columns.map((c) => c.map(leaf)) } as B)
      : (leaf(b as SlideLeafLike) as B),
  );
}

interface SlideLeafLike {
  type: string;
  text?: string;
  md?: string;
}
interface SlideBlockLike extends SlideLeafLike {
  columns?: SlideLeafLike[][];
}
