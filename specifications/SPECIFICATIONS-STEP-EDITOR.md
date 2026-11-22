# QuizDock — One editor for every step (the step editor brief)

> Questions and slides are edited in one editor: the same frame, the same preview, the same timeline, the same media.
> A slide is a question without answers, points, hint nor explanation, its blocks in place of the prompt.

Status: **delivered on `dev`** (2026-11-22, the three lots), not released yet.

---

## 1. Why

Slides came after questions (#7, their media with #125) with a form of their own. The data had reason to stay apart:
slides live in their own table, anchored before a question, so questions keep a continuous numbering and scores,
statistics and exports never see a slide. The editor had none: written twice, it drifted. A slide's preview cannot be
pinned nor shown on a phone, a slide gets no layout nor picture options, its media go in differently, its form neither
saves with Cmd+S nor stays open once saved.

## 2. Decisions taken (2026-11-19)

- **The data stay apart** (`question` and `slide` tables): only the editor and the media model are shared.
- **One frame** for both kinds: the action bar (title, issues, Save), the restored-draft notice, the media edits saved
  with the step, the move-to-draft question of a published quiz, Cmd+S, saving before switching step, staying open once
  saved (#195).
- **One preview**: the room's screen of the step, projection or phone, pinnable; *show the answer* for a question only.
- **One timeline and one media model**: a slide's visual (a picture or a video) and its sound, put in by the `+`, with
  the layouts and the picture's options; a slide's video today becomes *behind the text*, what it already does.
- **What each adds**: a question its type, prompt, answers, points, hint and explanation; a slide its blocks.

## 3. Lots

1. **The shared frame and preview** (no change of data): one step form frame and one live preview used by both
   forms; a slide gains the pinnable preview, the phone view, Cmd+S, saving before switching, staying open.
2. **The slide's media as a question's** (a migration): its visual (picture or video) and sound with `mediaPosition`
   and `mediaStyle`; an existing slide video becomes `behind`; bundles in version 9 (not released yet).
3. **The duplicated code removed** once both use the shared parts.

## 4. Open questions

- A slide's image blocks once it has a visual of its own: kept as content, or folded into the media.
