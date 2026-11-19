# QuizDock — Hints (the hints brief)

> A **hint**: a clue revealed during a question, which costs part of its points. Asked for in
> [discussion #288](https://github.com/orgs/quizdock/discussions/288). Hints are a track on the question timeline
> ([SPECIFICATIONS-QUESTION-TIMELINE.md](./SPECIFICATIONS-QUESTION-TIMELINE.md)), which comes first.

Status: **draft** — decisions of 2026-11-18, nothing built.

---

## 1. The model

- A hint is **multimedia** by nature: a text, and later a media of the library (an image, a sound), placed on the
  question's timeline at a **fixed position**, with its duration.
- **Off by default**: a quiz without hints plays exactly as today.
- A hint applies to **the whole room** (collective): everyone sees it; the answers given after it lose part of their
  points (2026-11-19), the ones given before keep theirs.
- Two states, kept apart:
  - **revealed**: held by the server, final for the question, the one that triggers the penalty;
  - **displayed**: the hint overlay shown or hidden, visual only. A participant toggles it on their own device; the
    host toggles it on the projection (a server event, kept in the snapshot for a reconnect).
- A hint's sound plays **once, when the hint is revealed**; hiding or showing the overlay never plays nor stops it.

## 2. Decisions taken (2026-11-18)

- **Penalty** (2026-11-19): a percentage taken off the points earned on the question, for the answers given after
  the hint; no floor. The **streak bonus is never reduced**, and a right answer with a hint keeps the streak growing.
  A wrong answer stays at 0; an unrevealed hint costs nothing.
- **A hint belongs to its question** (2026-11-18): its penalty is set on the question, and penalises that question
  only.
- **Its start** (2026-11-19): set in seconds after the answers open, on the timeline; it reveals itself then, when the
  host's switch is on. Turned on later, it reveals at once.
- **The 50:50 strikes the answers the author chose** (2026-11-18); a random mode, drawn by the server, may come
  later. Either way the server sends only the struck options, never the right answer before the reveal.
- **The author decides, the engine does not arbitrate.** The timeline flags overlaps on the hint itself (QUESTION-TIMELINE §3).
  In play, **the hint wins**: its sound takes over the question's.
- **The host's switch**: hints can be turned on and off live from the console. When the current question carries a
  hint and hints are off, a small visual reminder says so. Turned on late, the hint plays late and, like a
  question's media, **stretches the question** to the end of its sound plus `mediaTailS`, never cut: the host's
  responsibility.
- **Concise**: a hint must be readable or audible before the time runs out. The builder warns, it does not block.
- **When it can start**: never before the answers open; it needs no media, the prompt is content enough.
- **Its channels**: a visual (a text or an image), a sound, or both; it sits only in the channels it has
  (QUESTION-TIMELINE §2).

## 3. Lots

1. **Text hint.** One text hint per question, on the timeline; collective; configurable penalty; the host's switch
   and reminder, the projection's show/hide; a phone folds it.
2. **50:50 and report.** A hint that strikes out wrong answers (choice questions only), with its own configurable
   penalty once shown; hint usage in the post-game report.
3. **Room vote.** When a hint is available, each player has a toggle to vote for it, and can withdraw the vote until
   the hint is revealed. One player alone does not change the game; a group can, under conditions the host controls.
   Anonymous tally.

Deferred: media hints (image, sound), on the roadmap backlog (ROADMAP §7). Ruled out for now: several hints per
question, a private hint for the players who asked, progressive penalty shapes, an instance-wide hint configuration.

## 4. Open questions

- The room vote: its threshold, what the host controls, and whether a passed vote reveals the hint at once or at its
  place on the timeline.
- The report: which statistics are worth showing, the hint being part of its question.
