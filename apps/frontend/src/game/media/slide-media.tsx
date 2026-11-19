import type { LiveAudio, SlideVideo } from '@quiz-dock/contracts';
import { type CSSProperties, createContext, useContext } from 'react';
import {
  AudioTrack,
  type FollowedPosition,
  FollowedWaveform,
  type StageAnchor,
  type StageMode,
  VideoBox,
} from './question-media-stage';

/**
 * How a screen plays a slide's media (#125) — the question's rules, applied to
 * the slide's video and sound. The one with sound gets the host's anchor,
 * reports its position (the projection) and catches up; a muted video plays on
 * the same common start.
 */
export interface SlidePlayback {
  mode: StageMode;
  /** The slide's sound is meant for this device: without it, the video plays muted, the sound is followed or left out. */
  audible: boolean;
  /** The device's owner turned the sound off: everything plays on, silently. */
  muted?: boolean;
  /** The common start on the server's clock (`slide:show.mediaStartAt`). */
  startAt: number | null;
  /** Where the host put the slide's sound-bearing media from the console. */
  anchor: StageAnchor | null;
  /** Session + step: where the positions are kept across an interruption (projection only). */
  resumeKey: string | null;
  /** Given (even null) on a screen that draws the sound without playing it. */
  follow?: FollowedPosition | null;
  /** A device that plays too: the projection's position, to jump to when it starts late. */
  catchUp?: FollowedPosition | null;
  /** The projection only: says where it is in the sound. */
  onPosition?: (t: number, playing: boolean) => void;
  /** The host's console: a waveform hidden from the screens is drawn here. */
  showHidden?: boolean;
  /** False on a phone in the room: the video is the big screen's (unless it plays its sound here). */
  videos?: boolean;
}

/** Without a provider (the builder, a preview): shown still, nothing plays. */
const STILL: SlidePlayback = {
  mode: 'still',
  audible: false,
  startAt: null,
  anchor: null,
  resumeKey: null,
  follow: null,
};

export const SlidePlaybackContext = createContext<SlidePlayback>(STILL);

/** Whether a device plays this media's sound: its own, meant for the device. */
function playsSoundHere(sound: boolean, play: SlidePlayback) {
  return sound && play.audible && play.mode !== 'still';
}

/** The slide's sound: drawn under its content at its size — hidden by default, the console draws it. */
export function SlideSound({ audio }: { audio: LiveAudio }) {
  const play = useContext(SlidePlaybackContext);
  if (!playsSoundHere(true, play)) {
    // Not played here: its waveform follows where the projection is (still at 0 without it).
    if (play.follow === undefined && play.mode !== 'still') return null;
    return (
      <div className="mx-auto flex w-full max-w-[40em] justify-center">
        <FollowedWaveform audio={audio} follow={play.follow ?? null} showHidden={play.showHidden} />
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-[40em]">
      <AudioTrack
        audio={audio}
        mode={play.mode}
        resumeKey={play.resumeKey}
        anchor={play.anchor}
        silent={!!play.muted}
        onPosition={play.onPosition}
        catchUp={play.catchUp}
        startAt={play.startAt}
        showHidden={!!play.showHidden}
      />
    </div>
  );
}

/** Whether a screen shows the slide's video: not a phone in the room, unless it plays its sound. */
export function showsVideo(video: SlideVideo, play: SlidePlayback): boolean {
  return play.videos !== false || playsSoundHere(video.sound, play);
}

/** The slide's video, behind its content (cover): looped or played once, with its sound or muted. */
export function SlideVideoLayer({
  video,
  placed,
}: {
  video: SlideVideo;
  /** Placed against the blocks rather than behind them: its box, frame and fill. */
  placed?: { boxClassName: string; frame?: CSSProperties; focus?: string; cover: boolean };
}) {
  const play = useContext(SlidePlaybackContext);
  const withSound = playsSoundHere(video.sound, play);
  if (!showsVideo(video, play)) return null;
  return (
    <VideoBox
      url={video.url}
      mode={play.mode}
      gainDb={video.gainDb}
      boxClassName={placed?.boxClassName ?? 'absolute inset-0 h-full w-full max-w-none aspect-auto'}
      frame={placed?.frame}
      focus={placed?.focus}
      resumeKey={play.resumeKey}
      anchor={video.sound ? play.anchor : null}
      silent={!withSound || !!play.muted}
      catchUp={video.sound ? play.catchUp : undefined}
      onPosition={video.sound ? play.onPosition : undefined}
      startAt={play.startAt}
      loop={video.loop}
      cover={placed ? placed.cover : true}
      notices={false}
      mutedElement={!withSound}
    />
  );
}
