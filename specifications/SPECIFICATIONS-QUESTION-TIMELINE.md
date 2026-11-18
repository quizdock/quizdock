# QuizDock — The question timeline (the timeline brief)

> A **timeline** in the quiz builder: the interface that places a question's media and lays out how the question
> unfolds, drawn to scale. It comes first, for the media that exist today; the hints
> ([SPECIFICATIONS-HINTS.md](./SPECIFICATIONS-HINTS.md)) are a new element laid on it afterwards.

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

- **One timeline per step** (question or slide), in seconds, drawn to scale, in **three rows**, one per channel:
  - **time**: the reading phase, then the answer window (`timeLimitS`), or the media first when `timerAfterMedia` is
    on; the stretch a media causes and the `mediaTailS` pause, shown as such;
  - **visual**: the image or the video, the visual part of a hint;
  - **audio**: the question's sound, the video's sound, the sound of a hint.
- **One element, one shape**: an element sits only in the channels it has. A video with its sound is one shape across
  the visual and audio rows; a hint with a visual and a sound is one L-shaped piece (its visual lasts until the end,
  its sound its own length); a hint without sound stays in the visual row, a sound-only hint in the audio row.
- **It becomes the place to insert media** and to set the step's flow: the fields above are edited on it, not beside
  it.
- **Static and readable**: what the timeline shows is what plays. The engine keeps its rules; the timeline draws
  them, it does not add a second set.

## 3. Decisions taken (2026-11-18)

- **Identify, never arbitrate.** A conflict (two sounds overlapping) is flagged, never blocked nor fixed
  automatically: the author decides, knowing the constraints.
- **What comes later overlays.** An element that collides with an earlier one sits on top of it, lowered a little so
  both stay visible; a hint always overlays the media it sits on.
- **The conflict is marked on its cause only**: a dashed orange outline on the element that causes it, nothing on the
  others; a header chip counts the conflicts and selects the element at fault. The details are in its tooltip.
- **A colour per channel** (time, visual, audio) on the row background, its icon and its elements; each element
  carries its own icon (image, video, sound, hint). The colours become tokens of `index.css`.
- **Compact, details in tooltips**: no captions nor messages under the timeline.
- **First for the existing media**: the timeline is its own project, shipped before the hints, with only what a step
  holds today.
- **The reading delay stays global**: it paces the quiz and lets it breathe between questions; the timeline draws it
  as a fixed segment, not editable per question.
- **The question's duration is a minimum**: `timeLimitS` is shown as a *minimum duration*; the media and the hints
  may stretch the question beyond it (the rule already in place), and the timeline shows the actual length. The bundle
  field keeps its name.
- **Slides inherit the timeline**: they carry media too (`video`, `audio`, `displayDelayS`, MEDIA §10). One editing
  model and one component for both, no duplicated code.

## 4. Editing

- **Defaults per step type** (2026-11-18): each question type and the slide start from their own prefilled values.
  Durations: true/false 10 s, single choice 20 s, text input 30 s, slide 5 s of display. The other types keep 20 s
  until decided otherwise.
- **Clear and reset**: the timeline can be emptied, or brought back to its type's defaults.
- **A + button** opens a modal to choose the kind of element. The kinds the format refuses stay visible, disabled,
  with the reason: an image or a video, not both; never a video and an audio on a question; one audio at most on a
  slide; no own image on an image choice; one hint per question, none on a slide.
- **A drawer** shows the selected element's properties, with a **preview**: a thumbnail for an image, a small player
  for a video, the waveform and a play button for a sound, and for a hint what the projection will show plus its
  sound. Clicking the time row opens the step's own settings (minimum duration, *answers after the media*).
- **Media start at 0**, their length comes from the file; only a hint moves, dragged by one-second steps. **A hint
  never starts before the answers open**, and needs no media: the prompt is content enough.
- **Waveforms are the real ones** (`peaks` from the media library), in the timeline and in the drawer.
- **An accessible alternative view** (2026-11-18): a classic list of the elements (kind, channels, start, length,
  conflict in words), editable with the keyboard, a second view of the same data. It shares as much UI as possible
  with the timeline: the same + and modal, the same drawer, clear and reset. The timeline is the default view; the
  toggle is kept in the user's preferences (`users.preferences`, `/me/preferences`). The timeline's small hit areas
  are then not the only way in.

## 5. Open questions

- The durations of the other question types (multiple choice, numeric, ordering, poll, image choice), 20 s meanwhile.

## 6. Method

Two throwaway mocks (the layout, then the editing) settled the direction on 2026-11-18, on real durations. The code
follows the UI system's tokens; validated in the app before any pull request.
