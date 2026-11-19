import type { LiveAudio, LiveQuestionMedia, MediaAnchor } from '@quiz-dock/contracts';
import { Volume2, VolumeX } from 'lucide-react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  TRACK_FADE_S,
  fadeElement,
  heardTime,
  muteElementForFade,
  outputLatencyS,
  routeElement,
} from './audio-mixer';
import { unlockAudio, useAudioUnlocked } from './audio-unlock';
import { releaseMedia, takeMedia } from './media-pool';
import { clearPosition, readPosition, resumeAt, writePosition } from './media-position';
import { mediaFrame, type Reveal, SIZE_CONTAINER, useRevealStyle } from './media-frame';
import { Waveform } from './waveform';
import { serverNow } from '../clock';
import { ZoomableImage } from '../live-components';

/**
 * - `play`: the projection plays the media as the question appears;
 * - `pause`: the host paused the game — the media holds its position;
 * - `still`: shown without sound nor playback (the console, its screen tab).
 */
export type StageMode = 'play' | 'pause' | 'still';

/** Where the projection was in a sound when it last said so, on this screen's clock. */
/** The host's anchor on this question's media, numbered as it arrived (the same anchor twice is one). */
export type StageAnchor = MediaAnchor & { seq: number };

export interface FollowedPosition {
  questionIndex: number;
  /** The sound of a slide (#125), not of the question. */
  slideIndex?: number;
  t: number;
  playing: boolean;
  /** `performance.now()` at reception. */
  receivedAt: number;
}

/** How far behind the projection a late device may start before it jumps ahead (s). */
const CATCH_UP_S = 1;

/**
 * A device that starts a media late (it was still loading when the question
 * opened) jumps to where the projection is, once, so the room hears the same
 * moment. `catchUp` is read when playback starts, not before.
 */
function useCatchUp(el: HTMLMediaElement | null, catchUp: FollowedPosition | null | undefined) {
  const latest = useRef(catchUp);
  latest.current = catchUp;
  useEffect(() => {
    if (!el) return;
    const onPlaying = () => {
      const at = latest.current;
      if (!at?.playing) return;
      const target = at.t + (performance.now() - at.receivedAt) / 1000;
      const end = Number.isFinite(el.duration) ? el.duration : Infinity;
      if (target - el.currentTime > CATCH_UP_S && target < end) el.currentTime = target;
    };
    el.addEventListener('playing', onPlaying, { once: true });
    return () => el.removeEventListener('playing', onPlaying);
  }, [el]);
}

/** How often the projection says where it is while a sound plays (ms). */
const POSITION_EVERY_MS = 1000;

/**
 * The projection tells the room where it is: at each play, pause or jump, and
 * every second while it plays, so the other screens' playheads keep up and a
 * late device knows where to start.
 */
function usePositionReport(
  el: HTMLMediaElement | null,
  onPosition: ((t: number, playing: boolean) => void) | undefined,
) {
  useEffect(() => {
    if (!el || !onPosition) return;
    // What the room hears, not what the decoder has read (see `heardTime`).
    const say = () => onPosition(heardTime(el), !el.paused && !el.ended);
    const events = ['play', 'pause', 'seeked', 'ended'] as const;
    events.forEach((e) => el.addEventListener(e, say));
    const timer = window.setInterval(() => {
      if (!el.paused && !el.ended) say();
    }, POSITION_EVERY_MS);
    return () => {
      events.forEach((e) => el.removeEventListener(e, say));
      window.clearInterval(timer);
    };
  }, [el, onPosition]);
}

/** A late device jumps to the common position only when this far from it (s). */
const SYNC_TOLERANCE_S = 0.3;

/**
 * Puts the element at `t` seconds — once its length is known, and within it; a
 * looped one (a slide's background, #125) at where its loop has come round to.
 */
function seekTo(el: HTMLMediaElement, t: number) {
  const apply = () => {
    const end = Number.isFinite(el.duration) ? el.duration : Infinity;
    const at = el.loop && end > 0 && end !== Infinity ? t % end : t;
    if (at < end && Math.abs(el.currentTime - at) > SYNC_TOLERANCE_S) el.currentTime = at;
  };
  if (el.readyState >= HTMLMediaElement.HAVE_METADATA) apply();
  else el.addEventListener('loadedmetadata', apply, { once: true });
}

/** How often a playing device checks it is on the room's instant (ms). */
const DRIFT_EVERY_MS = 500;
/** Close enough: under this gap (s), nothing is touched. */
const DRIFT_OK_S = 0.03;
/** Too far to catch up by speed (s): the device jumps. */
const DRIFT_JUMP_S = 0.6;
/** How much faster or slower a device plays while it catches up (5 %: not heard). */
const DRIFT_NUDGE = 0.05;

/** How long a media may take to start before the screen says it is late. */
const SLOW_MS = 4000;

type Blocked = null | 'video' | 'audio';

/**
 * Plays an element per `mode`, and says what went wrong: a sound the browser
 * refused (a video then plays muted, both offer to turn the sound on) or a
 * media that has not loaded in time.
 */
function usePlayback(
  el: HTMLMediaElement | null,
  mode: StageMode,
  gainDb: number,
  /** Where the host put the media from the console (null: nothing yet, the common start holds). */
  anchor: StageAnchor | null,
  positionKey: string | null,
  /** Plays without sound: the device is not targeted, or its owner muted it. */
  silent = false,
  /** The common start of the media, on the server's clock (null: start at once). */
  startAt: number | null = null,
  /** A bed (a slide's looped background, #125): long fades, like the room's track. */
  bed = false,
) {
  const fadeS = bed ? TRACK_FADE_S : undefined;
  const [blocked, setBlocked] = useState<Blocked>(null);
  const [slow, setSlow] = useState(false);
  // Sound unlocked meanwhile (the projection's overlay): what was refused plays now.
  const unlocked = useAudioUnlocked();

  // Every pause fades out first; a play (or a newer pause) cancels one still fading.
  const fading = useRef(0);

  // The host's anchor wins over everything else: where it is now on the server's clock.
  // Moved while it plays, the media fades out, jumps, and fades back in.
  const anchored = useRef<number | null>(null);
  useEffect(() => {
    if (!el || !anchor || anchored.current === anchor.seq) return;
    anchored.current = anchor.seq;
    if (positionKey) clearPosition(positionKey);
    const jump = () => {
      // Playing on: ahead by this device's output latency, heard where the host put it.
      const moved = anchor.playing
        ? Math.max(0, serverNow() - anchor.at) / 1000 + (silent ? 0 : outputLatencyS())
        : 0;
      seekTo(el, anchor.t + moved);
    };
    if (el.paused || !anchor.playing) {
      jump();
      return;
    }
    // A host's jump stays quick, even on a bed: out, jump, back in.
    const token = ++fading.current;
    void fadeElement(el, 'out').then(() => {
      if (fading.current !== token) return;
      jump();
      void fadeElement(el, 'in');
    });
  }, [el, anchor, positionKey, silent]);

  useEffect(() => {
    if (!el) return;
    // Held by the host, or the game paused: nothing plays.
    if (mode !== 'play' || anchor?.playing === false) {
      const token = ++fading.current;
      if (el.paused) {
        el.pause();
        return;
      }
      void fadeElement(el, 'out', fadeS).then(() => {
        if (fading.current === token) el.pause();
      });
      return;
    }
    fading.current++; // a pause still fading out: it does not stop what plays now
    // Played to its end before an interruption (or anchored past it): it does not
    // start again on its own.
    if (!anchor && positionKey && readPosition(positionKey)?.ended) return;
    if (anchor && Number.isFinite(el.duration)) {
      const moved = anchor.playing ? Math.max(0, serverNow() - anchor.at) / 1000 : 0;
      if (anchor.t + moved >= el.duration) return;
    }
    let cancelled = false;
    // The common start: every device plays from the same instant of the server's
    // clock. Early, wait for it; late (still loading, joined mid-question), start
    // where the media is. Only a first start: a resumed media keeps its own place,
    // and an anchored one is where the host put it.
    let wait = 0;
    // (A position of a few tenths — written as the element loads — is not a resume.)
    const resumed = positionKey !== null && resumeAt(readPosition(positionKey)) !== null;
    if (startAt !== null && !resumed && !anchor) {
      // Started ahead by the time its sound takes to be heard here: every device is
      // heard on the common instant, whatever its output (a Bluetooth headset, a phone).
      // A silent one is only seen: it keeps the instant itself.
      const ahead = startAt - serverNow() - (silent ? 0 : outputLatencyS() * 1000);
      if (ahead > 0) wait = ahead;
      else seekTo(el, -ahead / 1000);
    }
    const start = async () => {
      if (silent) el.muted = true;
      else if (unlocked && el.muted) el.muted = false; // the video that went on muted gets its sound
      await routeElement(el, gainDb);
      // From silence, a short fade in: a start (or a resume) never clicks.
      const fromSilence = el.paused;
      if (fromSilence) muteElementForFade(el);
      if (!cancelled) await el.play();
      if (!cancelled) setBlocked(null);
      void fadeElement(el, 'in', fadeS);
    };
    const go = () =>
      start().catch((err: DOMException) => {
        // Refused after the silence a fade starts from: back to its level.
        void fadeElement(el, 'in', fadeS);
        if (cancelled || err.name !== 'NotAllowedError') return;
        if (el instanceof HTMLVideoElement) {
          // Picture without sound beats nothing: the room still sees the question.
          el.muted = true;
          void el.play().catch(() => undefined);
          setBlocked('video');
        } else {
          setBlocked('audio');
        }
      });
    let startTimer = 0;
    if (wait > 0) startTimer = window.setTimeout(go, wait);
    else void go();
    const timer = window.setTimeout(() => {
      if (!cancelled && el.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) setSlow(true);
    }, SLOW_MS);
    const onPlaying = () => setSlow(false);
    el.addEventListener('playing', onPlaying);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(startTimer);
      el.removeEventListener('playing', onPlaying);
    };
  }, [el, mode, gainDb, positionKey, unlocked, silent, startAt, anchor, fadeS]);

  // Kept on the room's instant while it plays: a start is never instant (a phone's
  // decoder takes its time), so each device measures where it should be — the common
  // start, or the host's anchor, ahead by its output latency — and closes the gap:
  // a nudge of the speed, unheard, for a small one; a jump for a large one.
  useEffect(() => {
    if (!el || mode !== 'play' || (startAt === null && !anchor?.playing)) return;
    const timer = window.setInterval(() => {
      if (el.paused || el.seeking || el.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return;
      const now = serverNow();
      let target = anchor
        ? anchor.playing
          ? anchor.t + (now - anchor.at) / 1000
          : null
        : (now - (startAt as number)) / 1000;
      if (target === null) return;
      target += silent ? 0 : outputLatencyS();
      const end = el.duration;
      if (!Number.isFinite(end) || end <= 0) return;
      if (el.loop) target %= end;
      if (target < 0 || target >= end) {
        el.playbackRate = 1;
        return;
      }
      const drift = el.currentTime - target;
      if (Math.abs(drift) > DRIFT_JUMP_S) {
        el.playbackRate = 1;
        el.currentTime = target;
      } else if (Math.abs(drift) > DRIFT_OK_S) {
        el.playbackRate = drift > 0 ? 1 - DRIFT_NUDGE : 1 + DRIFT_NUDGE;
      } else {
        el.playbackRate = 1;
      }
    }, DRIFT_EVERY_MS);
    return () => {
      window.clearInterval(timer);
      el.playbackRate = 1;
    };
  }, [el, mode, startAt, anchor, silent]);

  const enableSound = async () => {
    if (!el) return;
    await unlockAudio();
    el.muted = false;
    await routeElement(el, gainDb);
    try {
      await el.play();
      setBlocked(null);
      void fadeElement(el, 'in', fadeS);
    } catch {
      // Still refused: the indicator stays, the host can try again.
    }
  };

  return { blocked, slow, enableSound };
}

/** Adopts (or creates) the element for `url` and releases it when the screen changes. */
function useMediaElement(
  tag: 'video' | 'audio',
  url: string | null,
  still: boolean,
  positionKey: string | null,
  /** Never plays sound here: the phone's own element is left for the media that does. */
  mutedElement = false,
) {
  const [el, setEl] = useState<HTMLMediaElement | null>(null);
  useEffect(() => {
    if (!url) return;
    const media = takeMedia(tag, url, { muted: mutedElement });
    if (still) {
      media.muted = true;
      media.preload = 'metadata';
    }
    // Back after an interruption: a second before where it was, not from the top.
    const track = !still && positionKey;
    const start = track ? resumeAt(readPosition(positionKey)) : null;
    if (start !== null) media.currentTime = start;
    const save = () =>
      track && writePosition(positionKey, { t: media.currentTime, ended: media.ended });
    media.addEventListener('timeupdate', save);
    media.addEventListener('ended', save);
    setEl(media);
    return () => {
      media.removeEventListener('timeupdate', save);
      media.removeEventListener('ended', save);
      releaseMedia(media);
      setEl(null);
    };
  }, [tag, url, still, positionKey, mutedElement]);
  return el;
}

function SoundNotice({ onEnable, kind }: { onEnable: () => void; kind: 'video' | 'audio' }) {
  const { t } = useTranslation('live');
  return (
    <div
      role="alert"
      className="flex items-center gap-[0.5em] rounded-full bg-warning/15 px-[0.8em] py-[0.3em] text-[0.8em]"
    >
      <VolumeX className="size-[1.1em] shrink-0" />
      <span>{kind === 'video' ? t('media.videoMuted') : t('media.soundBlocked')}</span>
      <Button type="button" size="sm" variant="outline" onClick={onEnable}>
        <Volume2 className="size-4" />
        {t('media.enableSound')}
      </Button>
    </div>
  );
}

function SlowNotice() {
  const { t } = useTranslation('live');
  return (
    <p role="status" className="text-muted-foreground text-[0.8em]">
      {t('media.slow')}
    </p>
  );
}

export function VideoBox({
  url,
  mode,
  gainDb,
  boxClassName,
  resumeKey,
  anchor,
  silent,
  catchUp,
  onPosition,
  startAt,
  loop = false,
  cover = false,
  frame,
  focus,
  notices = true,
  mutedElement = false,
}: {
  url: string;
  mode: StageMode;
  gainDb: number;
  boxClassName?: string;
  resumeKey: string | null;
  anchor: StageAnchor | null;
  silent: boolean;
  catchUp?: FollowedPosition | null;
  onPosition?: (t: number, playing: boolean) => void;
  startAt: number | null;
  /** Runs as long as it shows, with long fades — a slide's background (#125). */
  loop?: boolean;
  /** Fills its box, cropped (a background), rather than fitting in it. */
  cover?: boolean;
  /** Its frame in the box, for a ratio of its own (the box is then a size container). */
  frame?: CSSProperties;
  /** Where it is cropped when it fills its frame. */
  focus?: string;
  /** Says under the picture what went wrong (sound refused, slow); off behind a slide. */
  notices?: boolean;
  /** It never plays sound on this device (a slide's muted video, #125). */
  mutedElement?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const key = resumeKey && `${resumeKey}:${url}`;
  const el = useMediaElement('video', url, mode === 'still', key, mutedElement);
  // Looped before it plays (this effect runs first): a late device lands where the loop
  // has come round to.
  useEffect(() => {
    if (el) el.loop = loop;
  }, [el, loop]);
  const { blocked, slow, enableSound } = usePlayback(
    el,
    mode,
    gainDb,
    anchor,
    key,
    silent,
    startAt,
    loop,
  );
  // Without a common start (an older server), a late device follows the projection instead;
  // never over the host's anchor.
  useCatchUp(el, startAt === null && !anchor ? catchUp : null);
  usePositionReport(el, onPosition);

  const frameKey = JSON.stringify(frame ?? null);
  useEffect(() => {
    if (!el || !box.current) return;
    el.className = cn(
      'absolute inset-0',
      !frame && 'h-full w-full',
      cover ? 'object-cover' : 'object-contain',
    );
    // Every property a frame sets, set or cleared: the element is pooled, and a frame left
    // from another use (or a ratio taken back) would size it against the page.
    Object.assign(el.style, {
      position: '',
      inset: '',
      margin: '',
      width: '',
      height: '',
      ...(frame ?? {}),
      objectPosition: focus ?? '',
    });
    box.current.appendChild(el);
    // The frame by its value: a new object each render must not re-append the element.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el, cover, frameKey, focus]);

  return (
    <>
      <div
        ref={box}
        className={cn('relative aspect-video max-w-full overflow-hidden', boxClassName)}
        style={frame ? SIZE_CONTAINER : undefined}
      />
      {notices && blocked ? <SoundNotice kind="video" onEnable={() => void enableSound()} /> : null}
      {notices && slow ? <SlowNotice /> : null}
    </>
  );
}

export function AudioTrack({
  audio,
  mode,
  resumeKey,
  anchor,
  silent,
  onPosition,
  catchUp,
  startAt,
  showHidden,
}: {
  audio: LiveAudio;
  mode: StageMode;
  resumeKey: string | null;
  anchor: StageAnchor | null;
  silent: boolean;
  onPosition?: (t: number, playing: boolean) => void;
  catchUp?: FollowedPosition | null;
  startAt: number | null;
  showHidden: boolean;
}) {
  const { t } = useTranslation('live');
  const key = resumeKey && `${resumeKey}:${audio.url}`;
  const el = useMediaElement('audio', audio.url, mode === 'still', key);
  const { blocked, slow, enableSound } = usePlayback(
    el,
    mode,
    audio.gainDb,
    anchor,
    key,
    silent,
    startAt,
  );
  useCatchUp(el, startAt === null && !anchor ? catchUp : null);
  const [progress, setProgress] = useState(0);

  // The filled part follows the sound, frame by frame, only while it plays.
  useEffect(() => {
    if (!el) return;
    let frame = 0;
    const tick = () => {
      const duration = el.duration || audio.durationMs / 1000;
      setProgress(duration > 0 ? Math.min(1, heardTime(el) / duration) : 0);
      if (!el.paused && !el.ended) frame = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };
    el.addEventListener('play', start);
    el.addEventListener('seeked', start);
    el.addEventListener('ended', tick);
    if (!el.paused) start();
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('play', start);
      el.removeEventListener('seeked', start);
      el.removeEventListener('ended', tick);
    };
  }, [el, audio.durationMs]);

  usePositionReport(el, onPosition);

  return (
    <div className="flex w-full flex-col items-center gap-[0.5em]">
      {/* A hidden waveform: the sound plays, nothing is drawn (the console still draws it). */}
      {audio.size !== 'hidden' || showHidden ? (
        <Waveform
          peaks={audio.peaks}
          progress={progress}
          size={audio.size}
          label={t('media.waveform')}
        />
      ) : null}
      {blocked ? <SoundNotice kind="audio" onEnable={() => void enableSound()} /> : null}
      {slow ? <SlowNotice /> : null}
    </div>
  );
}

/**
 * A sound this screen does not play, drawn where the projection is in it: the
 * last position it gave, moved on by the time since while it plays.
 */
export function FollowedWaveform({
  audio,
  follow,
  showHidden = false,
}: {
  audio: LiveAudio;
  follow: FollowedPosition | null;
  /** The host's console: a waveform hidden from the screens is still drawn here. */
  showHidden?: boolean;
}) {
  const { t } = useTranslation('live');
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const duration = audio.durationMs / 1000;
    const at = () => {
      if (!follow || duration <= 0) return 0;
      const moved = follow.playing ? (performance.now() - follow.receivedAt) / 1000 : 0;
      return Math.min(1, (follow.t + moved) / duration);
    };
    setProgress(at());
    if (!follow?.playing) return;
    let frame = 0;
    const tick = () => {
      setProgress(at());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [follow, audio.durationMs]);
  if (audio.size === 'hidden' && !showHidden) return null;
  return (
    <div className="w-full max-w-[40em]">
      <Waveform
        peaks={audio.peaks}
        progress={progress}
        size={audio.size}
        label={t('media.waveform')}
      />
    </div>
  );
}

/**
 * The media of a question on the projected screen: one box for the visual —
 * image or video, same ratio, `object-fit: contain` — and the sound as its
 * waveform. It plays as the question appears, holds while the host pauses,
 * and stops for good when the screen moves on (the elements are released on
 * unmount), so no sound runs into the reveal or the next question.
 */
export function QuestionMediaStage({
  media,
  mode,
  boxClassName,
  className,
  resumeKey = null,
  anchor = null,
  audible = true,
  muted = false,
  follow,
  onPosition,
  catchUp,
  startAt = null,
  zoomable = false,
  showHiddenWaveform = false,
  cover = false,
  reveal = null,
}: {
  media: LiveQuestionMedia | null | undefined;
  /** The visual fills its box, cropped, rather than fitting in it: a media behind the text. */
  cover?: boolean;
  /** A picture's progressive reveal, when its style asks for one and the question is open. */
  reveal?: Reveal | null;
  /** A phone's picture: sized by `boxClassName`, a tap opens it over the whole screen. */
  zoomable?: boolean;
  /** The host's console: draws a waveform the author hid from the screens. */
  showHiddenWaveform?: boolean;
  mode: StageMode;
  /** False on a device the sound is not meant for: the video plays muted, the sound is left out. */
  audible?: boolean;
  /** The device's owner turned the sound off: everything plays on, silently. */
  muted?: boolean;
  /**
   * Given (even null) on a screen that shows the sound without playing it: its
   * waveform follows the projection's position instead of an element of its own.
   */
  follow?: FollowedPosition | null;
  /** The projection only: says where it is in the sound, for the other screens. */
  onPosition?: (t: number, playing: boolean) => void;
  /** A device that plays too: the projection's position, to jump to when it starts late. */
  catchUp?: FollowedPosition | null;
  /** The common start of the media on the server's clock (`question:start.mediaStartAt`). */
  startAt?: number | null;
  /** Session + question: where the position is kept across an interruption (projection only). */
  resumeKey?: string | null;
  /** Where the host put the media from the console: restart, play, pause, seek. */
  anchor?: StageAnchor | null;
  /** Size of the visual box (its height, mostly). */
  boxClassName?: string;
  className?: string;
}) {
  const { t } = useTranslation('live');
  const visual = media?.visual ?? null;
  // A sound not meant for this device is left out — or drawn following the projection.
  const audio = audible || follow !== undefined ? (media?.audio ?? null) : null;
  const look = mediaFrame(media?.style, cover);
  const revealed = useRevealStyle(visual?.kind === 'image' ? reveal : null, mode === 'still');
  if (!visual && !audio) return null;
  const picture = visual?.kind === 'image' && (
    <img
      src={visual.url}
      alt={visual.alt?.trim() || t('question.mediaAlt')}
      className={cn(
        'absolute inset-0 h-full w-full',
        look.fill === 'cover' ? 'object-cover' : 'object-contain',
        !cover && !look.ratio && 'rounded-lg',
      )}
      style={{ objectPosition: look.focus, ...revealed }}
    />
  );
  return (
    <div className={cn('flex w-full flex-col items-center gap-[0.75em]', className)}>
      {visual?.kind === 'image' ? (
        // A revealing picture is not opened over the screen: it would show it sharp.
        zoomable && !revealed ? (
          <ZoomableImage src={visual.url} alt={visual.alt?.trim() || t('question.mediaAlt')}>
            <img
              src={visual.url}
              alt={visual.alt?.trim() || t('question.mediaAlt')}
              className={cn(
                'rounded-lg',
                look.fill === 'cover' ? 'object-cover' : 'object-contain',
                boxClassName,
              )}
              style={{
                aspectRatio: look.ratio ?? undefined,
                objectPosition: look.focus,
              }}
            />
          </ZoomableImage>
        ) : (
          // Clipped: a reveal's blur would spill past the picture's place.
          <div
            className={cn('relative aspect-video max-w-full overflow-hidden', boxClassName)}
            style={look.box}
          >
            {look.frame ? (
              <div className="overflow-hidden rounded-lg" style={look.frame}>
                {picture}
              </div>
            ) : (
              picture
            )}
          </div>
        )
      ) : visual?.source === 'upload' ? (
        <VideoBox
          url={visual.url}
          mode={mode}
          gainDb={visual.gainDb}
          boxClassName={boxClassName}
          resumeKey={resumeKey}
          anchor={anchor}
          silent={muted || !audible}
          catchUp={catchUp}
          onPosition={onPosition}
          startAt={startAt}
          cover={look.fill === 'cover'}
          frame={look.frame}
          focus={look.focus}
        />
      ) : null}
      {audio && (mode === 'still' || !audible) && follow !== undefined ? (
        <FollowedWaveform audio={audio} follow={follow} showHidden={showHiddenWaveform} />
      ) : audio ? (
        <div className="w-full max-w-[40em]">
          <AudioTrack
            audio={audio}
            mode={mode}
            resumeKey={resumeKey}
            anchor={anchor}
            silent={muted}
            onPosition={onPosition}
            catchUp={catchUp}
            startAt={startAt}
            showHidden={showHiddenWaveform}
          />
        </div>
      ) : null}
    </div>
  );
}
