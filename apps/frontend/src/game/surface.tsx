import type { BackgroundStyle, SlideGradient, SlideTextTone } from '@quiz-dock/contracts';
import type { CSSProperties, ReactNode } from 'react';
import type { SurfaceBackground } from './theme';
import { cn } from '@/lib/utils';

/** CSS for a generated gradient background. */
export function gradientCss(g: SlideGradient): string {
  return `linear-gradient(${g.angle}deg, ${g.colors.join(', ')})`;
}

/*
 * The author picks any background, so what sits on it follows two layers: text
 * laid on the background keeps the halo; every UI element (tile, list, field,
 * button, avatar) is opaque, has no halo and a two-tone edge — a light and a
 * dark hairline, one of the two always stands out. The classes below only take
 * effect inside a surface that has a background (`on-backdrop:`, index.css).
 */

/** Two-tone edge of a UI element laid on a background. */
export const BACKDROP_EDGE =
  'on-backdrop:ring-1 on-backdrop:ring-black/70 on-backdrop:ring-offset-1 on-backdrop:ring-offset-white/70';

/** The support UI sits on over a background: the local palette's panel, edged, no halo. */
export const BACKDROP_PANEL = `[text-shadow:none] on-backdrop:rounded-[0.75em] on-backdrop:bg-card on-backdrop:p-[0.75em] on-backdrop:text-card-foreground on-backdrop:shadow-lg on-backdrop:backdrop-blur-md ${BACKDROP_EDGE}`;

/** A picked answer, readable on any background: a white ring, then a black one. */
export const PICKED_RING = 'ring-2 ring-black ring-offset-3 ring-offset-white';

/**
 * Full-cover background for a slide, a question, or the quiz's theme: a picture, a
 * generated gradient or a plain colour, laid as its style says (docs/themes.md) — by
 * default a picture covers the screen, darkened or lightened to match the text tone.
 * The text tone sets the local palette of the subtree (`data-scheme`, index.css):
 * light text means a dark palette, and the other way round. Without a background the
 * surface is transparent and everything keeps the page colours.
 */
export function Surface({
  background,
  textTone,
  // The subtitle-like halo is the design default: only an explicit `false` removes it.
  textOutline = true,
  className,
  backdrop,
  overlay,
  children,
}: {
  background: SurfaceBackground | null | undefined;
  textTone?: SlideTextTone;
  textOutline?: boolean;
  className?: string;
  /** A layer drawn behind the content in place of an image — a slide's video (#125). */
  backdrop?: ReactNode;
  /** Drawn over everything, content included: the motion layer's fading background. */
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const light = textTone !== 'dark';
  const has = Boolean(background) || Boolean(backdrop);
  const veil = <div className={cn('absolute inset-0', light ? 'bg-black/40' : 'bg-white/55')} />;
  return (
    <div
      data-scheme={has ? (light ? 'dark' : 'light') : undefined}
      className={cn(
        // `clip`, not `hidden`: no scroll container, so a sticky bar inside still sticks.
        'relative flex flex-col overflow-clip',
        has && 'text-foreground',
        has && textOutline && '[text-shadow:var(--qd-halo)]',
        className,
      )}
      style={background ? backgroundFill(background) : undefined}
    >
      {background && 'url' in background ? (
        <Picture url={background.url} style={background.style} veil={veil} />
      ) : backdrop ? (
        <>
          {backdrop}
          {veil}
        </>
      ) : null}
      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col">{children}</div>
      {overlay}
    </div>
  );
}

/** What a background paints on the surface itself: its gradient, else its base colour. */
export function backgroundFill(background: SurfaceBackground): CSSProperties {
  const color = background.style?.color;
  if ('gradient' in background) {
    return { backgroundImage: gradientCss(background.gradient), backgroundColor: color };
  }
  if ('color' in background) return { backgroundColor: background.color };
  return color ? { backgroundColor: color } : {};
}

/**
 * A background picture, laid by its mode: `cover` fills the screen under its veil,
 * `contain` shows it whole, `watermark` centres it, `pattern` tiles it. Sizes are in
 * the surface's short side (`cqmin`), right in portrait and landscape.
 */
function Picture({
  url,
  style,
  veil,
}: {
  url: string;
  style: BackgroundStyle | undefined;
  veil: ReactNode;
}) {
  const mode = style?.mode ?? 'cover';
  const filter =
    [style?.grayscale ? 'grayscale(1)' : '', style?.blur ? `blur(${style.blur / 10}cqmin)` : '']
      .filter(Boolean)
      .join(' ') || undefined;
  const opacity = mode === 'cover' ? undefined : (style?.opacity ?? 1);
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden [container-type:size]">
      {mode === 'pattern' ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("${url}")`,
            backgroundSize: `${style?.size ?? 20}cqmin`,
            backgroundRepeat: 'repeat',
            backgroundPosition: 'center',
            opacity,
            filter,
          }}
        />
      ) : (
        <img
          src={url}
          alt=""
          className={cn(
            'absolute',
            mode === 'watermark'
              ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 object-contain'
              : 'inset-0 h-full w-full',
            mode === 'cover' ? 'object-cover' : 'object-contain',
          )}
          style={{
            opacity,
            filter,
            ...(mode === 'watermark'
              ? { width: `${style?.size ?? 40}cqmin`, height: `${style?.size ?? 40}cqmin` }
              : {}),
          }}
        />
      )}
      {mode !== 'cover' ? null : style?.veil ? (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: style.veil.color, opacity: style.veil.opacity }}
        />
      ) : (
        veil
      )}
    </div>
  );
}
