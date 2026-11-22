# QuizDock — Slide layouts (the slide layouts brief)

> A slide's media works as a question's: set on its timeline, one picture or one video and a sound. Its blocks
> hold the text and say where the media goes; ready-made layouts lay a slide out in one click.

Status: **built on `feat/slide-layouts`** (2026-11-22), to be tried; nothing released.

---

## 1. Why

A slide had two ways to show a picture: an **Image block** among its blocks, and its **own picture** on its
timeline (SPECIFICATIONS-STEP-EDITOR), where its video and sound also were. Nothing said which to use. The data
showed one picture per slide at most: 24 sample slides, 12 with an image block, none with two nor in a column;
88 slides on a development base, the same.

## 2. Decisions taken (2026-11-22)

- **The media is the timeline's**, as for a question: a picture or a video, framed there, and a sound.
- **A Media block places it** within the content, between two blocks or in a column; one per slide. Above and
  below move that block first or last. **Left and right** set the media beside all the blocks, without a block.
- **Behind and alone stay layouts of the whole slide**: the media block, if any, is then not used.
- **The Image block is no longer offered.** One already written is shown and edited as before, with a button that
  makes it the slide's media (its picture on the timeline, a Media block in its place), when the slide has no
  media yet. Several pictures on one slide are no longer made: a gallery would be a block of its own, when asked.
- **No migration.** The blocks are JSON; the media block is one more type. A slide without it is drawn as before,
  by its stored position. The sample quizzes are converted (their revision goes up).
- **Ready-made layouts**, nothing stored: those that lay blocks out apply to an empty slide only (no block written
  yet); those that place the media (above, below, left, right, behind, alone) apply to any slide and only move the media block
  or set where the media sits. A layout never removes nor reorders a written block.

## 3. The layouts

| For an empty slide | Blocks | Media |
|---|---|---|
| Title · Title and subtitle · Title and text | H1 · H1 H2 · H1 text | behind |
| Title, text, media · Media and title | H1 text media · media H1 | in the content |
| Text \| media · Media \| text | two columns: H2 and text, the media | in the content |
| Title over media · Media only | H1 · none | behind · alone |
| Two columns · Title, two columns · Three columns | H2 and text per column · H1 over two texts | behind |
| Section · Quote · Welcome | H2 H1 · large text, small source · `{title}`, how to join with `{pin}` | behind |

| For any slide | What it does |
|---|---|
| Media above · Media below | the media block first or last, the others unchanged |
| Media left · Media right | the media beside all the blocks, no media block; the blocks unchanged |
| Media behind · Media alone | where the media sits; the blocks unchanged |

## 4. The pieces

| Piece | What it does |
|-------|--------------|
| `{ "type": "media", "id": … }` (contracts, bundle version 9) | The media block, top level or in a column. |
| `SlideView` | Draws the media at its block when it is in the content; else as before. |
| Slide editor | *Media* in the add bar and the columns (once), the block's state, *Layouts*, the image block's notice. |
| Timeline layout (slides) | The same six places as the Layouts': above, below, left, right, behind, alone. |
| Format guide | The media block is layout: a converted quiz leaves it out, as the image block. |

## 5. Open points

- A rollback to 0.17.x: its game ignores a media block, its editor refuses to save a slide holding one
  (SPECIFICATIONS-ROLLBACK, losses).
- The layouts list is to be tried: some may go, others come.
