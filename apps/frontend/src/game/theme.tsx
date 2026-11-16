import {
  type BackgroundStyle,
  type SlideBackground,
  type SlideTextTone,
  type ThemeFont,
  type ThemeValues,
  OPTION_COLORS,
  parseHex,
  toHex,
  textOn,
} from '@quiz-dock/contracts';
import { type CSSProperties, type ReactNode, createContext, useContext, useEffect } from 'react';

/**
 * A quiz's look on the live screens (docs/themes.md): the projection and the phones, from
 * the lobby to the podium. Its colours reach the page's tokens (`--answer-*`,
 * `--primary`) on the subtree it wraps; the rest is read from the context.
 */
const LiveThemeContext = createContext<ThemeValues | null>(null);

export const useLiveTheme = () => useContext(LiveThemeContext);

/** A background a surface may draw: a step's, or a theme's plain colour. */
export type SurfaceBackground = SlideBackground | { color: string; style?: BackgroundStyle };

/** The theme's default background, for a step without its own; null: the page itself. */
export function themeBackdrop(
  theme: ThemeValues | null,
): { background: SurfaceBackground; textTone: SlideTextTone } | null {
  if (!theme) return null;
  const { image, gradient, textTone, ...style } = theme.background;
  // A white page with dark text is the page: *Classic* draws nothing (no visual change).
  if (!image && !gradient && style.color.toLowerCase() === '#ffffff' && textTone === 'dark') {
    return null;
  }
  const background: SurfaceBackground = image
    ? { url: image, style }
    : gradient
      ? { gradient, style }
      : { color: style.color, style };
  return { background, textTone };
}

/** The font families of the shipped fonts (`public/fonts`, OFL). */
const BUILTIN_FONTS: Record<
  Exclude<ThemeFont, 'system'>,
  { family: string; faces: { file: string; weight: string; range?: 'ext' }[] }
> = {
  atkinson: {
    family: 'Atkinson Hyperlegible',
    faces: [
      { file: 'atkinson-400', weight: '400' },
      { file: 'atkinson-400-ext', weight: '400', range: 'ext' },
      { file: 'atkinson-700', weight: '700' },
      { file: 'atkinson-700-ext', weight: '700', range: 'ext' },
    ],
  },
  lexend: variable('Lexend', 'lexend'),
  nunito: variable('Nunito', 'nunito'),
  fredoka: variable('Fredoka', 'fredoka'),
  inter: variable('Inter', 'inter'),
  bitter: variable('Bitter', 'bitter'),
  'comic-neue': {
    family: 'Comic Neue',
    faces: [
      { file: 'comic-neue-400', weight: '400' },
      { file: 'comic-neue-700', weight: '700' },
    ],
  },
};

function variable(family: string, file: string) {
  return {
    family,
    faces: [
      { file, weight: '300 800' },
      { file: `${file}-ext`, weight: '300 800', range: 'ext' as const },
    ],
  };
}

const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';
const SYSTEM = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const loaded = new Set<string>();

/**
 * Adds a font's faces to the document once — the browser fetches them when text uses
 * them — and gives its CSS family; undefined for the device's own. `file`: a URL.
 */
export function loadFont(font: ThemeValues['font'] | undefined): string | undefined {
  const family = fontFamilyName(font);
  if (!font || !family) return undefined;
  if (!loaded.has(family) && typeof FontFace !== 'undefined') {
    loaded.add(family);
    const faces =
      'builtin' in font
        ? BUILTIN_FONTS[font.builtin as Exclude<ThemeFont, 'system'>].faces.map(
            (f) =>
              new FontFace(family, `url(/fonts/${f.file}.woff2) format('woff2')`, {
                weight: f.weight,
                unicodeRange: f.range === 'ext' ? LATIN_EXT : LATIN,
                display: 'swap',
              }),
          )
        : [new FontFace(family, `url(${font.file}) format('woff2')`, { display: 'swap' })];
    for (const face of faces) {
      document.fonts.add(face);
      void face.load().catch(() => undefined);
    }
  }
  return `'${family}', ${SYSTEM}`;
}

function fontFamilyName(font: ThemeValues['font'] | undefined): string | undefined {
  return !font || ('builtin' in font && font.builtin === 'system')
    ? undefined
    : 'builtin' in font
      ? BUILTIN_FONTS[font.builtin as Exclude<ThemeFont, 'system'>].family
      : `qd-theme-${font.file.replace(/\W/g, '')}`;
}

/** `loadFont` from a component: the faces added after render. */
export function useFont(font: ThemeValues['font'] | undefined): string | undefined {
  const family = fontFamilyName(font);
  useEffect(() => {
    loadFont(font);
  }, [font, family]);
  return family ? `'${family}', ${SYSTEM}` : undefined;
}

/** The answers' colours in a theme, as tokens. */
function answerVars(theme: ThemeValues): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const name of OPTION_COLORS) {
    const color = theme.slots[name].color;
    vars[`--answer-${name}`] = color;
  }
  return vars;
}

/** The tokens a theme sets on the subtree it wraps. */
function themeVars(theme: ThemeValues, fontFamily: string | undefined): CSSProperties {
  const vars = answerVars(theme);
  vars['--primary'] = theme.accent;
  vars['--ring'] = theme.accent;
  vars['--primary-foreground'] = toHex(textOn(parseHex(theme.accent)));
  if (fontFamily) vars.fontFamily = fontFamily;
  return vars as CSSProperties;
}

/**
 * Around a live screen: the quiz's theme, once the room has told it. Without one (a
 * lobby with no quiz yet, an older server), the page's own look.
 */
export function LiveTheme({
  theme,
  children,
}: {
  theme: ThemeValues | null | undefined;
  children: ReactNode;
}) {
  const fontFamily = useFont(theme?.font);
  if (!theme) return <>{children}</>;
  return (
    <LiveThemeContext.Provider value={theme}>
      <div className="contents" data-theme-scope style={themeVars(theme, fontFamily)}>
        {children}
      </div>
    </LiveThemeContext.Provider>
  );
}

/**
 * Around the answers on the console: their marks and colours as the screens show them, so
 * the host reads the same answers. Nothing else of the theme, the console keeps the
 * instance's look (docs/themes.md).
 */
export function LiveThemeAnswers({
  theme,
  children,
}: {
  theme: ThemeValues | null | undefined;
  children: ReactNode;
}) {
  if (!theme) return <>{children}</>;
  return (
    <LiveThemeContext.Provider value={theme}>
      <div className="contents" style={answerVars(theme) as CSSProperties}>
        {children}
      </div>
    </LiveThemeContext.Provider>
  );
}

/** The icon the theme draws for a slot; null: the option's own shape. */
export function useSlotIcon(slot: string | undefined): string | null {
  const theme = useLiveTheme();
  if (!theme || !slot) return null;
  return theme.slots[slot as keyof ThemeValues['slots']]?.icon ?? null;
}
