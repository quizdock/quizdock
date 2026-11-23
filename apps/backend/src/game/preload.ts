import {
  type AudioTarget,
  type LiveQuestionMedia,
  type MediaPreloadPayload,
  type PlayerPresence,
  type SlideBlock,
  liveMediaUrls,
  playsSound,
  slideHasPlayback,
  slideMutedVideos,
  slideSoundMedia,
} from '@quiz-dock/contracts';
import type { QuizSnapshot, SnapshotSlide } from './game.types';
import {
  hasSoundOrVideo,
  questionAudioTarget,
  questionHasSound,
  slideAudioTarget,
  slideHasSound,
} from './snapshot';

/** Who fetches: a screen (projection, console) or a participant, by presence. */
export type PreloadDevice = 'screen' | PlayerPresence;

/**
 * The part of a question's media a device will show or play — all it should
 * fetch ahead. A screen shows everything. A remote participant sees the visual
 * (a video, muted when the sound is not theirs) and gets the sound when meant
 * for them. A phone in the room shows the image, and plays only when the
 * sound is meant for every device. Mobile data goes to nothing else.
 */
export function mediaForDevice(
  media: LiveQuestionMedia,
  target: AudioTarget | undefined,
  device: PreloadDevice,
): LiveQuestionMedia {
  if (device === 'screen') return media;
  const hears = !!target && playsSound(target, device);
  const visual = media.visual;
  const keepVisual =
    visual?.kind === 'image' || (visual?.kind === 'video' && (device === 'remote' || hears));
  return { visual: keepVisual ? visual : null, audio: hears ? media.audio : null };
}

function blockImages(block: SlideBlock): string[] {
  if (block.type === 'columns') return block.columns.flat().flatMap(blockImages);
  return block.type === 'image' && block.url ? [block.url] : [];
}

/** The images a slide shows: its background, its own picture and its image blocks. */
function slideImages(slide: SnapshotSlide): string[] {
  const background = slide.background && 'url' in slide.background ? [slide.background.url] : [];
  const image = slide.image ? [slide.image.url] : [];
  return [...background, ...image, ...slide.blocks.flatMap(blockImages)];
}

/**
 * The part of a slide's media a device will play or show (#125), as a question's
 * are split: its one sound-bearing media when the sound is meant for it — else,
 * a video, shown muted by a remote participant — and its muted videos. A phone
 * in the room shows no video (the big screen does): it plays only a sound meant
 * for every device.
 */
export function slideMediaForDevice(
  slide: SnapshotSlide,
  target: AudioTarget,
  device: PreloadDevice,
): { media: LiveQuestionMedia; videos: string[] } {
  const sound = slideSoundMedia(slide) ?? { visual: null, audio: null };
  const muted = slideMutedVideos(slide);
  if (device === 'screen') return { media: sound, videos: muted };
  const hears = playsSound(target, device);
  if (hears) return { media: sound, videos: device === 'remote' ? muted : [] };
  if (device === 'room') return { media: { visual: null, audio: null }, videos: [] };
  // A remote participant not meant to hear: the sound-bearing video plays muted too.
  const video = sound.visual && 'url' in sound.visual ? [sound.visual.url] : [];
  return { media: { visual: null, audio: null }, videos: [...video, ...muted] };
}

/** A step of the sequence: a question, or the slide `slideIndex` shown before `questionIndex`. */
export type PreloadStep = { questionIndex: number; slideIndex?: number };

/** The first step of question `index`: the first slide anchored before it, else itself; null past the end. */
export function firstStepOf(snapshot: QuizSnapshot, index: number): PreloadStep | null {
  const slideIndex = snapshot.slides.findIndex((s) => s.beforeQuestionIndex === index);
  if (slideIndex >= 0) return { questionIndex: index, slideIndex };
  return index < snapshot.questions.length ? { questionIndex: index } : null;
}

/** The step after slide `slideIndex`: the next slide on the same anchor, else its question. */
export function stepAfterSlide(snapshot: QuizSnapshot, slideIndex: number): PreloadStep | null {
  const slide = snapshot.slides[slideIndex];
  if (!slide) return null;
  const following = snapshot.slides[slideIndex + 1];
  if (following && following.beforeQuestionIndex === slide.beforeQuestionIndex) {
    return { questionIndex: slide.beforeQuestionIndex, slideIndex: slideIndex + 1 };
  }
  const index = slide.beforeQuestionIndex;
  return index < snapshot.questions.length ? { questionIndex: index } : null;
}

/** The step's audio target and what a device of it plays (a question's media, or a slide's). */
export function stepMediaForDevice(
  snapshot: QuizSnapshot,
  step: PreloadStep,
  gameTarget: AudioTarget,
  device: PreloadDevice,
): { media: LiveQuestionMedia; videos: string[]; target?: AudioTarget } | null {
  if (step.slideIndex !== undefined) {
    const slide = snapshot.slides[step.slideIndex];
    if (!slide) return null;
    const target = slideHasSound(slide) ? slideAudioTarget(slide, gameTarget) : undefined;
    return { ...slideMediaForDevice(slide, target ?? gameTarget, device), target };
  }
  const question = snapshot.questions[step.questionIndex];
  if (!question) return null;
  const target = questionHasSound(question) ? questionAudioTarget(question, gameTarget) : undefined;
  return { media: mediaForDevice(question.media, target, device), videos: [], target };
}

/** Whether the step holds a sound or a video — what the screens are waited for (an image is not). */
export function stepHasPlayback(snapshot: QuizSnapshot, step: PreloadStep): boolean {
  if (step.slideIndex !== undefined) {
    const slide = snapshot.slides[step.slideIndex];
    return !!slide && slideHasPlayback(slide);
  }
  const question = snapshot.questions[step.questionIndex];
  return !!question && hasSoundOrVideo(question.media);
}

/**
 * What a device fetches ahead of a step, one step ahead and no more: a slide's
 * images and what it plays there (#125) — with the images of the slides after
 * it on the same anchor, light enough — or a question's media. Null when there
 * is nothing to fetch.
 */
export function preloadFor(
  snapshot: QuizSnapshot,
  step: PreloadStep,
  gameTarget: AudioTarget,
  device: PreloadDevice,
): MediaPreloadPayload | null {
  const own = stepMediaForDevice(snapshot, step, gameTarget, device);
  if (!own) return null;
  const images =
    step.slideIndex === undefined
      ? []
      : [
          ...new Set(
            snapshot.slides
              .filter(
                (s, i) => i >= step.slideIndex! && s.beforeQuestionIndex === step.questionIndex,
              )
              .flatMap(slideImages),
          ),
        ];
  if (liveMediaUrls(own.media).length === 0 && images.length === 0 && own.videos.length === 0) {
    return null;
  }
  return {
    questionIndex: step.questionIndex,
    ...(step.slideIndex !== undefined ? { slideIndex: step.slideIndex } : {}),
    media: own.media,
    ...(own.target ? { audioTarget: own.target } : {}),
    ...(images.length ? { images } : {}),
    ...(own.videos.length ? { videos: own.videos } : {}),
  };
}

/** Whether anything in the quiz is fetched ahead: a question's media, a slide's image or video. */
export function snapshotHasMedia(snapshot: QuizSnapshot): boolean {
  return (
    snapshot.questions.some((q) => liveMediaUrls(q.media).length > 0) ||
    snapshot.slides.some((s) => slideImages(s).length > 0 || slideHasPlayback(s))
  );
}
