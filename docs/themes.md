# Quiz themes

A quiz theme is the look of a quiz on the **live screens**: the projection and the
players' phones, from the lobby to the podium. The console, the editor and the back
office never take it (the console's thumbnail of the current step does): they wear the
instance's look ([`look.md`](look.md)). Intent and
remaining work: [`SPECIFICATIONS-THEMING.md`](../specifications/SPECIFICATIONS-THEMING.md).

## What a theme holds

`ThemeValues` (`packages/contracts/src/theme.ts`):

| Part | What it sets |
|---|---|
| `background` | the background of every step without its own, of the lobby and the podium: a base `color` and its `textTone`, plus a picture or a gradient. A picture is laid by its `mode` — `cover` (under a `veil`), `contain`, `watermark`, `pattern` — with `size` (% of the screen's short side), `opacity`, `grayscale`, `blur`. |
| `slots` | the eight answer slots, keyed by today's colour names (`green`, `red`… `teal`): a `color` and an `icon` — a media of the theme (an SVG), an icon of the bank (`bank:<group>/<name>`), or `null` for the shipped glyph. |
| `markers` | what marks an answer besides its colour: `icons`, `letters` (A–H) or `numbers` (1–8), by the answer's place in its question. Never the colour alone. |
| `accent` | the live screens' `--primary`: the standings' bars, the "ready" and "you" marks. |
| `font` | a shipped font (`system`, `atkinson`, `lexend`, `nunito`, `fredoka`, `inter`, `bitter`, `comic-neue` — OFL, `public/fonts`) or an imported woff2 with its licence. |
| `sounds` | the lobby’s effects (`ding`, `tick`, `countdown`, `gong`). A sample the host picked for the lobby wins, then the theme's, then the synthesised effect. |
| `motion` | a `style` (`standard`, `sober`, `dynamic`, `festive`) setting the live motion tokens, and a `revealEffect` (`confetti`). The lobby's *Animations* switch and the device's reduced motion win. |

The text and icons on the answers are always white (Classic included). The default order
of the answers' colours is green, red, blue, yellow, purple, orange, pink, teal
(`OPTION_ORDER`): a true/false question reads true in green and false in red.

The confetti fall on the phone of a player who found the answer, at the reveal; the
projection, which reveals every question, has none.

## Shipped themes and user themes

The shipped themes (`BUILTIN_THEMES`, values in `theme-builtin.ts`) are read-only:
*Classic* (the default: the settled colours, geometric shapes of the bank); *Sober*
(Classic's hues less saturated, letters); *Kids* (the shipped animal glyphs), *Festive*
(party icons) and *Night* (night-sky icons), in Classic's colours on their own
background, font and motion; *High
contrast* and *High contrast light* (the accessible ones, with Classic's shapes); and the
seasonal *Halloween*,
*Christmas*, *New year*, *Easter*, *Summer* (a picture of their own in
`public/themes`, their season's icons, their own palette).

A user theme (table `theme`) is the child of a shipped theme and stores only what it
overrides; the rest follows the parent live (`mergeTheme`). Every host lists and uses
every theme; its owner and the administrators change or delete it. A theme a quiz uses,
or the instance's default, cannot be deleted. The instance's default is set by an
administrator (`PUT /themes/default`, stored in `instance_setting` under `theme.default`).

A quiz takes a library theme (`quiz.theme_id`), a shipped one (`quiz.theme_builtin`), or
neither: the instance's default, else Classic.

## The files of a theme

- **Icons**: a square, single-colour SVG, uploaded through `POST /themes/assets/icon`. It
  is rebuilt from an allowlist (`theme-assets.ts`): shapes and groups, their geometry,
  `fill` forced to `currentColor`; scripts, styles, links and references dropped, a
  stroke reported. Stored as a media of kind `icon`, served as SVG only from such a row.
- **Fonts**: a whole woff2 (`POST /themes/assets/font`), kind `font`.
- **Pictures and effects**: ordinary media (image, audio).
- **The icon bank**: `public/icons/bank/<group>/<name>.svg` (Phosphor Icons, MIT,
  `public/licenses/phosphor-icons.txt`, but for the shapes drawn for QuizDock in
  `symbols`), listed in `ICON_BANK`, with sets of eight in
  `ICON_SETS`. Shipped pictures are named `shipped:<file>`.

A theme's media are held through `theme_media`: never swept, refused to a deletion while
held.

## On the live screens

The theme is resolved when a game opens and frozen in its snapshot (an edit shows from
the next game), its files by URL (`themeWithUrls`), and sent with `game:media`. The
screens wrap themselves in `LiveTheme` (`apps/frontend/src/game/theme.tsx`): the slot
colours and the accent reach the tokens of the subtree, the font is loaded, the icons
are drawn through a mask (`ShapeIcon`). A step without a background of its own is drawn
on the theme's (`themeBackdrop`); a plain white background with dark text is the page
itself, so Classic draws nothing.

A step's own background (`background_style` on `question` and `slide`) is laid the
same way: a picture by its mode, a gradient, or a plain colour.

## Accessibility

Computed, never declared (`themeAccessibility`), on every save and live in the editor:
the white text on each answer reaches 4.5:1; the question's text 4.5:1 and the answers
and the accent 3:1 on the background as rendered (a picture is bounded by black and
white as its mode lays it); the eight colours stay apart (OKLab distance), the first four
under colour-blindness simulation too; the icons are different files. Only a theme that
passes every check says so: an *Accessible* badge and filter; the others carry nothing.

## Editing

`/themes` (a tab of Quizzes) lists the shipped themes, then the hosts', as cards or a list. A card opens its theme, as a template's does: a shipped one at `/themes/<key>`, read-only, with *New theme from it*, which creates "My <theme>" and opens its editor (no dialog); a library one at `/themes/:id`, which edits it — its licence
(CC0, CC BY, CC BY-SA: what a community store accepts) included —, saved as it changes, with a preview drawn by the real projection and phone (`ThemePreview`, sample
game views in `theme-preview.tsx`) at four moments. The quiz settings pick a theme with
thumbnails; every preview of the quiz's steps (the preview page, the question and slide
forms, the cards, the read-only page) shows it. The console's effects preview plays the
theme's sample of an effect the lobby has none of its own for.

## Bundles

A quiz bundle carries its theme from version 8, a theme travels alone as a theme bundle:
see [`quiz-bundle.md`](quiz-bundle.md).
