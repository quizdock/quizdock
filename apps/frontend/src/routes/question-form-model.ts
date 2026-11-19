import {
  type AudioTarget,
  type BackgroundStyle,
  MEDIA_POSITION_DEFAULT,
  type MediaPosition,
  type MediaStyle,
  type QuestionHint,
  NO_QUESTION_MEDIA,
  OPTION_COLORS,
  OPTION_ORDER,
  OPTION_SHAPES,
  OPTION_TYPES,
  QUESTION_TYPES,
  type QuestionMedia,
  type QuestionTypeName,
  REVEAL_DELAY_S,
  type Scoring,
  type SlideGradient,
  type SlideTextTone,
  TIME_LIMIT_S,
  WAVEFORM_SIZE_DEFAULT,
  type WaveformSize,
  scoringsFor,
  TIME_LIMIT_BY_TYPE,
} from '@quiz-dock/contracts';
import { useForm } from '@tanstack/react-form';
import type { QuizDetailDtoQuestionsItem } from '../api/generated/model';
import { NO_BACKGROUND, type BackgroundValue } from './background-field';

export type QType = QuestionTypeName;
export const TYPES = QUESTION_TYPES;
// Eight distinct colour+shape pairs, one per position: no two options ever look alike (max 8).
export const PAIRS = OPTION_ORDER;
export const SINGLE_CORRECT: QType[] = ['single_choice', 'true_false'];

export interface OptionValue {
  /** Client-only stable key (drag and drop); never sent. */
  key: string;
  text: string;
  color: string;
  shape: string;
  isCorrect: boolean;
  correctOrderIndex: number;
  /** An answer's picture: an image choice's, or one kept from an import. */
  mediaId: string | null;
  /** Its alternative text, in the quiz's language (image choice). */
  alt: string;
}
export interface FormValues {
  type: QType;
  prompt: string;
  /** Visual + audio slots, in the contract's shape (never a video with a sound). */
  media: QuestionMedia;
  answerExplanation: string;
  background: BackgroundValue;
  timeLimitS: number;
  revealDelayS: number | null;
  /** Which devices play its sound; null = the game's default. */
  audioTarget: AudioTarget | null;
  /** How thick the sound's waveform is drawn on the screens. */
  waveformSize: WaveformSize;
  mediaPosition: MediaPosition;
  /** How the visual is framed and revealed; empty = as its file is. */
  mediaStyle: MediaStyle;
  /** A clue revealed during the question, for part of its points (SPECIFICATIONS-HINTS). */
  hint: QuestionHint | null;
  /** Listen first: the timer starts when the media ends. */
  timerAfterMedia: boolean;
  pointsMode: 'standard' | 'double' | 'none' | 'fixed';
  scoring: Scoring;
  /** Empty (null) until the author sets it: a draft may wait for it. */
  numericValue: number | null;
  numericTolerance: number | null;
  /** Image choice: several pictures may be right. */
  multiSelect: boolean;
  options: OptionValue[];
  acceptedAnswers: { text: string }[];
}

// Unique across page loads too: a restored draft keeps the keys of the previous load
// (a counter alone starts over at each load and would hand one out again).
let optionSeq = 0;
const optionKey = () => `opt-${Date.now().toString(36)}-${++optionSeq}`;

export function newOption(i: number, text = '', isCorrect = false): OptionValue {
  return {
    key: optionKey(),
    text,
    color: PAIRS[i % PAIRS.length].color,
    shape: PAIRS[i % PAIRS.length].shape,
    isCorrect,
    correctOrderIndex: i,
    mediaId: null,
    alt: '',
  };
}

export function initialValues(q?: QuizDetailDtoQuestionsItem): FormValues {
  if (!q) {
    return {
      type: 'single_choice',
      prompt: '',
      media: NO_QUESTION_MEDIA,
      answerExplanation: '',
      background: NO_BACKGROUND,
      timeLimitS: TIME_LIMIT_BY_TYPE.single_choice,
      revealDelayS: null,
      audioTarget: null,
      waveformSize: WAVEFORM_SIZE_DEFAULT,
      mediaPosition: MEDIA_POSITION_DEFAULT,
      mediaStyle: {},
      hint: null,
      timerAfterMedia: false,
      pointsMode: 'standard',
      scoring: 'standard',
      numericValue: null,
      numericTolerance: 0,
      multiSelect: false,
      options: [newOption(0), newOption(1)],
      acceptedAnswers: [],
    };
  }
  return {
    type: q.type as QType,
    prompt: q.prompt,
    media: (q.media as QuestionMedia | undefined) ?? NO_QUESTION_MEDIA,
    answerExplanation: q.answerExplanation ?? '',
    background: {
      mediaId: q.backgroundMediaId ?? null,
      gradient: (q.backgroundGradient as SlideGradient | null | undefined) ?? null,
      textTone: (q.textTone as SlideTextTone | undefined) ?? 'light',
      textOutline: q.textOutline ?? true,
      style: (q.backgroundStyle as BackgroundStyle | null | undefined) ?? null,
    },
    timeLimitS: q.timeLimitS,
    revealDelayS: q.revealDelayS ?? null,
    audioTarget: (q.audioTarget as AudioTarget | null | undefined) ?? null,
    waveformSize: (q.waveformSize as WaveformSize | undefined) ?? WAVEFORM_SIZE_DEFAULT,
    mediaPosition: (q.mediaPosition as MediaPosition | undefined) ?? MEDIA_POSITION_DEFAULT,
    mediaStyle: (q.mediaStyle as MediaStyle | null | undefined) ?? {},
    hint: (q.hint as QuestionHint | null | undefined) ?? null,
    timerAfterMedia: q.timerAfterMedia ?? false,
    // A poll is stored as 'none', which the menu does not offer: the poll's own
    // setting stays out of the form, so a change of type starts from 'standard'.
    pointsMode: (q.pointsMode === 'none' ? 'standard' : q.pointsMode) as FormValues['pointsMode'],
    scoring: (q.scoring ?? 'standard') as Scoring,
    numericValue: q.numericValue == null ? null : Number(q.numericValue),
    numericTolerance: q.numericTolerance == null ? null : Number(q.numericTolerance),
    multiSelect: q.multiSelect ?? false,
    options: q.options.map((o, i) => ({
      key: o.id,
      text: o.text ?? '',
      color: o.color,
      shape: o.shape,
      isCorrect: o.isCorrect,
      correctOrderIndex: o.correctOrderIndex ?? i,
      mediaId: o.mediaId ?? null,
      alt: o.alt ?? '',
    })),
    acceptedAnswers: q.acceptedAnswers.map((a) => ({ text: a.text })),
  };
}

/** A draft saved before the image choice: its answers get no picture, it gets one right answer. */
export function withDefaults(draft: FormValues): FormValues {
  return {
    ...draft,
    multiSelect: draft.multiSelect ?? false,
    // A draft from before the picture's options.
    mediaStyle: draft.mediaStyle ?? {},
    hint: draft.hint ?? null,
    options: draft.options.map((o) => ({
      ...o,
      mediaId: o.mediaId ?? null,
      alt: o.alt ?? '',
    })),
  };
}

/** The server's refusal of a question saved unfinished in a published quiz. */
export const INCOMPLETE_IN_READY = 'question.incomplete_in_ready_quiz';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));
/** A time out of bounds (or unreadable) becomes the nearest bound, never an error. */
export const clampTime = (value: number) =>
  Number.isFinite(value) ? clamp(value, TIME_LIMIT_S.min, TIME_LIMIT_S.max) : TIME_LIMIT_S.default;
export const clampReveal = (value: number | null) =>
  value == null || !Number.isFinite(value)
    ? null
    : clamp(value, REVEAL_DELAY_S.min, REVEAL_DELAY_S.max);

/** Each option's place in the right order, as 0..n-1 in the order of the places they had. */
export function rankPlaces(options: { correctOrderIndex: number }[]): number[] {
  const byPlace = options
    .map((o, i) => ({ place: o.correctOrderIndex, i }))
    .sort((a, b) => a.place - b.place || a.i - b.i);
  const places: number[] = [];
  byPlace.forEach(({ i }, rank) => (places[i] = rank));
  return places;
}

/** Option `index` takes `place`; the option that held it takes the old place of `index`. */
export function swapPlace<T extends { correctOrderIndex: number }>(
  options: T[],
  index: number,
  place: number,
): T[] {
  const from = options[index].correctOrderIndex;
  return options.map((o, i) =>
    i === index
      ? { ...o, correctOrderIndex: place }
      : o.correctOrderIndex === place
        ? { ...o, correctOrderIndex: from }
        : o,
  );
}

/** Whether the media play a sound: an MP3, or a video's own track. */
export function mediaHasSound(media: QuestionMedia): boolean {
  return !!media.audio || media.visual?.kind === 'video';
}

/** The engine's default reading window before answers open (GAME_READ_DELAY_MS), for the hint. */
export const READ_DELAY_DEFAULT_MS = 3000;

/** Construit le payload API en n'envoyant que les champs pertinents pour le type. */
export function buildPayload(v: FormValues) {
  const base = {
    type: v.type,
    prompt: v.prompt,
    // Saved before the field was left: the same bounds as on leaving it.
    timeLimitS: clampTime(v.timeLimitS),
    revealDelayS: clampReveal(v.revealDelayS),
    // Nothing to hear, nothing to target: a removed sound takes its setting with it.
    audioTarget: mediaHasSound(v.media) ? v.audioTarget : null,
    waveformSize: v.waveformSize,
    mediaPosition: v.mediaPosition,
    mediaStyle: styleToSend(v),
    // A hint without words is none.
    hint: v.hint && v.hint.text.trim() ? { ...v.hint, text: v.hint.text.trim() } : null,
    // Only with a media to wait for; the server also falls back when its length is unknown.
    timerAfterMedia: mediaHasSound(v.media) && v.timerAfterMedia,
    // 'none' is a poll's: a restored draft may still carry it after a change of type.
    pointsMode:
      v.type === 'poll'
        ? ('none' as const)
        : v.pointsMode === 'none'
          ? ('standard' as const)
          : v.pointsMode,
    scoring: scoringsFor(v.type, v.multiSelect).includes(v.scoring)
      ? v.scoring
      : ('standard' as const),
    media: v.media,
    answerExplanation: v.answerExplanation.trim() || null,
    backgroundMediaId: v.background.mediaId,
    backgroundGradient: v.background.gradient,
    backgroundStyle: v.background.style,
    textTone: v.background.textTone,
    textOutline: v.background.textOutline,
  };
  if (v.type === 'image_choice') {
    return {
      ...base,
      // The answers are the pictures: no visual of the question's own.
      media: { visual: null, audio: v.media.audio } as QuestionMedia,
      multiSelect: v.multiSelect,
      options: v.options.map((o) => ({
        mediaId: o.mediaId ?? undefined,
        alt: o.alt.trim(),
        color: o.color as (typeof OPTION_COLORS)[number],
        shape: o.shape as (typeof OPTION_SHAPES)[number],
        isCorrect: o.isCorrect,
      })),
    };
  }
  if (OPTION_TYPES.includes(v.type)) {
    return {
      ...base,
      options: v.options.map((o) => ({
        text: o.text || undefined,
        // A picture an answer already holds (an imported quiz) is kept, not lost on save.
        mediaId: o.mediaId ?? undefined,
        color: o.color as (typeof OPTION_COLORS)[number],
        shape: o.shape as (typeof OPTION_SHAPES)[number],
        isCorrect: o.isCorrect,
        correctOrderIndex: v.type === 'ordering' ? o.correctOrderIndex : undefined,
      })),
    };
  }
  if (v.type === 'text_input') {
    return {
      ...base,
      acceptedAnswers: v.acceptedAnswers
        .filter((a) => a.text.trim())
        .map((a) => ({ text: a.text })),
    };
  }
  if (v.type === 'numeric') {
    return {
      ...base,
      numericValue: v.numericValue ?? undefined,
      numericTolerance: v.numericTolerance == null ? undefined : Math.max(0, v.numericTolerance),
    };
  }
  return base;
}

/** The question's form, created here so that its sections share its type. */
export function useQuestionFormApi(
  defaultValues: FormValues,
  onSubmit: (value: FormValues) => Promise<void>,
) {
  return useForm({ defaultValues, onSubmit: ({ value }) => onSubmit(value) });
}

export type QuestionFormApi = ReturnType<typeof useQuestionFormApi>;

/** The style worth sending: none without a visual or when empty; a video is never revealed. */
function styleToSend(v: Pick<FormValues, 'media' | 'mediaStyle'>): MediaStyle | null {
  const visual = v.media.visual;
  if (!visual) return null;
  const { revealS, ...rest } = v.mediaStyle;
  const style = visual.kind === 'image' && revealS ? { ...rest, revealS } : rest;
  return Object.keys(style).length > 0 ? style : null;
}
