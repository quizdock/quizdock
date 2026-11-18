# QuizDock — The question timeline (the timeline brief)

> A **timeline** in the quiz builder: the interface that places a question's media and lays out how the question
> unfolds, drawn to scale. It comes first, for the media that exist today; the hints
> ([SPECIFICATIONS-HINTS.md](./SPECIFICATIONS-HINTS.md)) are a new track laid on it afterwards.

Status: **draft** — decisions of 2026-11-18, nothing built.

---

## 1. Why

A question's flow is already a sequence in time, but the builder shows it as separate fields: the reading delay, the
time limit (`timeLimitS`), the visual (`media`, an image or a video), the audio (`audio`), *answers open after the
media* (`timerAfterMedia`), and the quiz's pause after a media (`mediaTailS`). A media longer than its question
stretches the question to its end plus `mediaTailS` ([docs/quiz-bundle.md](../docs/quiz-bundle.md)), and nothing
shows the author by how much. As soon as a second sound can come in (a hint), the author needs to **see** what plays
when.

## 2. The model

- **One timeline per question**, in seconds, drawn to scale from the question's display to the end of its answer
  window:
  - the **reading** phase, then the **answer window** (`timeLimitS`), or the media first when `timerAfterMedia` is on;
  - a **visual** track (image or video) and an **audio** track (the question's audio, or the video's sound), each with
    its known duration (`durationMs` from the media library);
  - the stretch a media causes, and the `mediaTailS` pause, shown as such.
- **It becomes the place to insert media** and to set the question's flow: the fields above are edited on it, not
  beside it.
- **Static and readable**: what the timeline shows is what plays. The engine keeps its rules; the timeline draws
  them, it does not add a second set.

## 3. Decisions taken

- **Identify, never arbitrate** (2026-11-18). A conflict (two sounds overlapping, a sound that stretches the
  question) is **flagged with a warning** on the timeline, pointing at the spot. Nothing is blocked, nothing is fixed
  automatically: the author decides, knowing the constraints.
- **Video counts as audio** (2026-11-18): a video's sound is on the audio track, like an audio file.
- **First for the existing media** (2026-11-18): the timeline is its own project, shipped before the hints, with only
  what a question holds today.
- **The reading delay stays global** (2026-11-18): it paces the quiz and lets it breathe between questions; the
  timeline draws it as a fixed segment, not editable per question.
- **The question's duration is a minimum** (2026-11-18): `timeLimitS` is shown as a *minimum duration*; the media and
  the hints may stretch the question beyond it (the rule already in place), and the timeline shows the actual length.
  The bundle field keeps its name.
- **Slides inherit the timeline** (2026-11-18): they carry media too (`video`, `audio`, `displayDelayS`, MEDIA §10).
  One editing model and one component for both, no duplicated code.

## 4. Open questions

- None for now.

## 5. Method

A throwaway comparison mock first, built on real durations, validated in the app before any pull request.
