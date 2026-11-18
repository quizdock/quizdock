# QuizDock — How a question's picture is shown (the picture brief)

> The options of a question's picture or video, set in its timeline panel
> ([SPECIFICATIONS-QUESTION-TIMELINE.md](./SPECIFICATIONS-QUESTION-TIMELINE.md)): its frame, how it fills it, where it
> is cropped, and a progressive reveal.

Status: **draft** — decisions of 2026-11-19.

---

## 1. Why

A question's picture is shown as its file is, fitted whole in the room its layout leaves (`mediaPosition`). The author
cannot frame it (a portrait photo next to the text, a square crop), fill the room with it, nor make it the game itself:
a picture that sharpens while the room answers.

## 2. Decisions taken (2026-11-19)

- **One stored field, `mediaStyle`**: an object, like `backgroundStyle`, every setting optional. Absent, the picture is
  shown as today. One migration for all of it; a later setting needs none.
- **Ratio**: the file's own by default; presets 16:9, 4:3, 1:1, 3:4; or free, typed `W:H` (whole numbers, between 1:4
  and 4:1). The frame takes the largest size of that ratio the layout's room allows.
- **Fill**: `contain` (the whole picture in the frame, the default) or `cover` (the frame filled, the picture cropped).
- **Crop point**, for `cover`: centre (default), top, bottom, left, right.
- **Behind the text** (`mediaPosition: behind`): the media fills the text's area, always cropped; only the crop point
  applies.
- **No static effects** (black and white, blur): the progressive reveal does the one that matters.
- **Progressive reveal** (`revealS`, a picture only): blurred while the question is read, it sharpens from the answers'
  opening over `revealS` seconds (at most the answer time), then stays sharp. Projection and phones alike (a phone must
  not show the room the answer); a revealing picture cannot be zoomed on a phone. The host's console sees it sharp.
  On the timeline, the reveal is an element of the visual row over the picture.
- **Video**: ratio, fill and crop point apply; the reveal does not.
- **Bundles**: `mediaStyle` travels with the question, in bundle version 9 (not released yet, with `behind`/`alone`).

## 3. Open questions

- A reveal by tiles or by zoom, beside the blur.
