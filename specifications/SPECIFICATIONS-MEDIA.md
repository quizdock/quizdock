# QuizDock — Audio & video in questions (the media brief)

> The plan for a question's video and sound, phase by phase. What is **delivered** is described for operators in
> [docs/self-hosting/audio-video.md](../docs/self-hosting/audio-video.md); this document keeps the **decisions** and
> the **requirements of the phases still to come**, so they live with the code rather than in anyone's notes.

Working rules for every phase: one phase at a time, one commit per step, the acceptance criteria checked, every
string in the five locales, nothing assumed (read the code first).

---

## 1. The model

A question has two media slots: a **visual** (an image, or an MP4 video in H.264/AAC) and a **sound** (an MP3).
A video brings its own sound, so it excludes the sound slot.

| Phase | Subject | Status |
|---|---|---|
| 1 | Upload, playback in the room (projection) | **Delivered** — PR #44 |
| 2 | Recording a sound with the microphone | **Idea box** — set aside, its value is not settled (§3) |
| 3 | YouTube / Vimeo embeds | **Idea box** — set aside, it goes against the no-tracking, self-hosted promise (§4) |
| 4 | Remote players, preloading and readiness | **Built** on `feat/media-remote` (§5); two error messages in the idea box (§5.5) |
| 5 | Synchronisation and fairness | **Built** on `feat/media-sync` (§6) |

---

## 2. Phase 1 — the decisions it settled

- **Old audio**: the foreign keys are nulled and the rows deleted; the files stay on disk (purged by the hourly clean-up
  job since #50).
- **Orphans**: a media file no reference holds any more is deleted server-side after a 24 h grace period
  (duplicating a quiz shares its media ids); a running game and an archived session protect its media. An hourly
  job does it since #50.
- **Playback**: the media starts with `question:start` and follows the host's pause. Autoplay happens in the
  **projection window only**; phones show the image alone. Peer-to-peer delivery is ruled out (same Wi-Fi access point).
- **Length**: a question lasts at least as long as its media plus a tail (`media_tail_s`, 1 s by default; 3 s before 2026-09-27).
- **Loudness**: measured (ITU-R BS.1770) in the browser at upload, corrected by a Web Audio gain at playback, capped by
  the peak — never re-encoded. Each quiz picks a level: loud −14 / balanced −16 (default) / quiet −23 LUFS.
- **Interruption**: playback resumes one second before the point reached; the console can restart the media.
- **Refused**: SVG images. **Bundle**: version 3 carries video and sound. The Quiz Store is out of scope.
- **Known gap**: not yet tested on Safari iOS.

---

## 3. Phase 2 — microphone recording (idea box)

Set aside on 2026-09-23: the need is not proven. Kept here so it can be picked up as it was specified.

- Offered only when `window.isSecureContext`; otherwise the button is hidden and a message says the microphone needs HTTPS.
- `getUserMedia` + `MediaRecorder` (WebM/Opus on Chromium), **60 s** at most.
- A **music mode** checkbox turns off `echoCancellation`, `noiseSuppression` and `autoGainControl` (on by default, for the voice).
- **Auto-trim** with Web Audio: the noise floor measured on the first 100 ms; a relative threshold on the RMS of short
  windows; the start moved back ~10 ms with a 3–5 ms fade-in; the end found the same way with a 30–50 ms fade-out;
  peak normalisation to −1 dBFS.
- A **preview** with start/end handles to adjust before accepting.
- **MP3 encoding in the browser** (a maintained JS library, licence to check), 192 kbit/s, the original sample rate and channels.
- The same processing is **offered** on an uploaded MP3; an uploaded MP3 left untouched is **never** re-encoded.
- Stored with `origin: 'recording'` (the `audioOrigin` column exists; loudness and peak measurement live in
  `apps/frontend/src/lib/audio-analysis.ts`).
- Errors: insecure context, permission refused, no microphone, maximum length reached.

---

## 4. Phase 3 — YouTube / Vimeo (idea box)

Set aside on 2026-09-23: it contacts Google or Vimeo from the projection, which goes against the promise of a
self-hosted quiz with no tracking, and uploading an MP4 already covers the need. Kept here as it was specified.

- `MEDIA_EMBEDS_ENABLED=false` by default. Document that turning it on **breaks the "no tracking" promise** and does
  not work on a closed network.
- YouTube IFrame API through `youtube-nocookie.com`; Vimeo Player SDK with `dnt=1`.
- Store only **provider / id / start / end**; the iframe is built by QuizDock, never third-party HTML; the id is
  extracted from the pasted URL; no oEmbed.
- A check when the embed is added in the editor: not found, private, embedding forbidden (YouTube's distinct error codes).
- **CSP**: there is none today → create it; allow the providers in `frame-src` / `script-src` only when embeds are
  enabled. Never COEP.
- Adapters with one interface: `load / play / pause / mute / unmute`, events `ready / started / ended / error`.
- Existing: the `EmbeddedVideo` type in the contracts; the API refuses with `media.embeds_disabled`.
- Errors: unrecognised URL, not found / private, embedding forbidden, embeds disabled, provider unreachable.

Points found while preparing it, to settle if it is picked up again:

- **Duration**: the server cannot know an embed's length without oEmbed; the editor's test load would measure it
  (`getDuration`) and store the clipped length, so the question stretches as for an uploaded video.
- **Switch turned off later**: today `resolveQuestionMedia` refuses any save holding an embed, which would block
  editing such a question; decide whether stored embeds are kept (and not played), stripped or refused, and the same
  for a bundle import.
- **Outside the projection** (console screen tab, phones): a static placeholder avoids any third-party request.
- **Adapters** also need `seek` / `currentTime` (resume one second early, restart); Vimeo has no end parameter, pause
  at `endSec` on `timeupdate`; `@vimeo/player` can be bundled from npm, so only YouTube's `iframe_api` needs `script-src`.
- **Limits**: the loudness levels cannot apply (a cross-origin iframe escapes Web Audio); unlisted Vimeo videos need
  their `h=` hash, not stored, so they would read as private; autoplay needs `allow="autoplay"` on the iframe.
- **CSP** (useful on its own): check Swagger UI's inline scripts, the OIDC issuer in `connect-src`, an external
  `APP_LOGO_URL` in `img-src`, `blob:`/`data:`, `ws:`/`wss:`, and test on a production build (Vite dev bypasses it).
- **Every writer of the visual slot** (`visualMediaId`: questions, quiz duplication, transfer, bundle) would need the
  embed columns. Bundle version 3 was not released yet at the time: extend it rather than bump.

---

## 5. Phase 4 — remote players and media readiness

Today every device is assumed to be in the room: the projection plays the video or the sound, the phones show the
prompt, the image and the answers, never a video nor a sound. A player following from home (a video call) cannot hear
a "name this tune" question. Phase 4 gives such a player the whole question, and makes sure no screen starts a media
it has not loaded — the waiting part of the former phase 5, brought forward on 2026-09-23.

### 5.1 Presence

- On joining, a player says whether they are **in the room** or **remote** (in the room by default). The choice is
  offered only when the quiz has a sound or a video; otherwise every player is in the room. The choice is
  kept across a reconnection and shown to the host (console roster).
- A remote player gets the full question view: the prompt, the visual (image or video) and the sound.

### 5.2 Who hears the sound

- An **audio target**: a quiz default plus an optional per-question override — *projection only* / *projection and
  remote players* (the default) / *everyone*. The host can override the quiz default from the lobby, before the start.
- Sound plays only on the targeted devices: the phones in the room stay silent unless the target is *everyone*
  (which echoes in a shared room — the editor says so). A non-targeted device shows the video muted, or the image.
- Resolution: the question's own target, else the host's lobby choice, else the quiz's; the screens receive it
  resolved in `question:start` and `media:preload`, the console reads the session's default in `game:media`.
- The sound is unlocked on the **Join** click: **one** audio element is created there and reused for the whole session
  (iOS only lets an element that was unlocked by a gesture play later). A video follows the same rule.
- A local **mute** button on the player's device.

### 5.3 Preloading

- The existing `media:preload` (sent with the reveal, to non-players only) is extended to the players that need the
  media — remote players, and room phones for the images — and to the **next step**, slide or question.
- **From the lobby**, every device fetches the media of the first step while people wait for the start.
- **Accepted risk** (decided 2026-09-23): a player's device holds the next step's media 10–20 s before it shows,
  without its prompt; a tech-savvy player could open them. The host is told so (console lobby, self-hosting guide).
- Mobile data is spared: at most **one step ahead**; the images and sounds are light, a video is fetched only by a
  device that will play it.

### 5.4 Readiness

- A device tells the server when the media of a step are loaded (`media:ready { stepIndex }`). Only the devices that
  play something count: the projection, and the remote players for a question with a sound or a video.
- **In the lobby**: a "ready" mark next to each participant on the host console; the projection shows a count
  ("18 / 20 ready"). The host sees who is late before starting.
- **During the game**: no waiting page by default, so the pace is kept. Only when a counted device is not ready as a
  step is due, a short **loading** screen appears: the projection shows the count and a progress bar, the console
  lists the late participants, the phones say the question is coming. It lasts at most a configurable cap
  (`GAME_MEDIA_WAIT_S`, 10 s by default); the host can **start anyway**.
- One slow device never holds the room: past the cap, or on "start anyway", the step starts; a late device receives
  it part-way through and plays from where it should be.
- Detail per participant stays on the console; the projection only shows a count (200 names would be unreadable, and
  a name in large letters would single someone out).
- The readiness goes out at most every 100 ms per room (`READINESS_EVERY_MS`), like the answer count: a device
  arriving, leaving, pressing *Ready!* or finishing its loading in a quiet moment is sent at once, those within the
  next 100 ms together at its end, the last one always. A step change sends it at once. A room filling at once
  otherwise sent it to every device on every arrival; the last device ready ends a media wait up to 100 ms later.

### 5.5 Errors

- A remote device refusing the sound (unlock lost, page reloaded): **done** — *Sound blocked* with a button, as on
  the projection.
- A media failing to load on a device: shown only once the question runs (`media.slow`); the wait treats it as not
  ready, so the cap applies. A dedicated message: **idea box** (set aside on 2026-09-24).
- The wait cap reached: the question simply starts; the console said who was late. A message after the fact:
  **idea box** (set aside on 2026-09-24).
- Also shipped with the phase: a waveform size per question (S / M / L) and a playhead that follows the projection
  on every screen that shows the sound without playing it.

---

## 6. Phase 5 — synchronisation and fairness

- **Common start** (built): `mediaStartAt`, `MEDIA_LEAD_MS` (600 ms) ahead, kept as a distance from the answers'
  opening so pauses move it; a late device seeks to it. Measured: projection and a phone whose clock is 5 s off
  start within 1 ms.
- **Play then time** (built): per question, `timerAfterMedia` — the answers open at the media's end; only with a
  known duration; no stretch. The host's *Restart the media* still replays it (accepted).
- **Clock alignment** (built): `ping`/`pong` bursts at each connection then every minute, shortest round trip
  wins; every countdown uses the server's time.

---

## 7. Errors already covered

The projection's "media not loaded in time" (`media.slow`).

---

## 8. After the brief — a media library (a separate project)

Specified in [SPECIFICATIONS-MEDIA-LIBRARY.md](./SPECIFICATIONS-MEDIA-LIBRARY.md): one format per kind converted in the
author's browser, files shared between uses, a media input module, an administration page.

## 9. Audio routing

Several sources may sound at once on one device — a question's sound, a background track, the game's effects — and
they are not the same kind of sound. Every page routes them through **buses** on one Web Audio context
(`game/media/audio-mixer.ts`); no source plays straight to the speakers.

```
question's sound / video ─ loudness gain ─► QUIZ  ─┐
background track (a sound of the library) ─► MUSIC ─┤
tick, gong (synthesised, or a sample) ────► SFX   ─┼─► MASTER ─► limiter ─► speakers
interface sounds (to come) ───────────────► UI    ─┘
```

- **A bus is two gains in a row**: its *level* (a host's volume) and its *duck* (automatic), so a volume change never
  fights a duck. **MASTER** carries the participant's own mute; a **limiter** after it keeps simultaneous sources from
  clipping.
- **Two sounds are never laid over each other**: the background track fades out as a question's own sound or video
  starts, and comes back once it is over — from its common start and length, or from the host's last command on it
  (a media the host holds, or of unknown length, keeps the track out for the question). A sidechain that only lowered
  the track was tried and left: a lowered track still covers a sound to recognise (a blind test), and a video's
  silences would make it pump. SFX is never ducked (the effects are short).
- **Faders are tapered**: a position (0–100 %) becomes its cube as a gain, close to how loudness is heard — half-way
  is about −18 dB, not the −6 dB a straight line gives. Positions are what is kept (the room's levels, a device's
  volume and trims).
- **QUIZ** keeps its per-media loudness correction (§2); it is not a host's volume. A media element joins the bus once
  the context runs (a suspended context would silence it) and once in its life — the phones reuse theirs.
- **Which buses a device plays**:

  | Device | QUIZ | MUSIC, SFX |
  |--------|------|------------|
  | the projection | yes | yes |
  | a remote participant's phone | per the question's audio target (§5.2) | per the room's audio target |
  | a phone in the room | only when the target is *everyone* | never |
  | a participant's copy of the projection (#104) | muted, unless `?sound=1` — then as a remote phone | as a remote phone |

- **Sources**: the effects are synthesised in the browser (no file, no licence); a host may replace one by a sound of
  their media library. The background track is always a sound of the library. Nothing is bundled.
- **Settings**: the MUSIC and SFX levels are the room's (the lobby), each with its own **mute** for every screen (the
  level kept for when the channel is back); QUIZ stays at its normalised level.
- **Fades**: no source starts or stops on a cut. Every start (a question's media, its resume, a sample, the
  background track aside) comes in over ~5 ms — just the click off the attack; a pause or a stop fades out over
  ~120 ms; a host's seek fades out, jumps, comes back in. The background track is a bed, not a playback: it fades in
  and out over ~1.5 s.

### 9.1 The game's sounds (#93)

- **The tick** plays at each new answer while players answer (from `answer:count`, sent at most every 100 ms: up to
  five ticks for the answers of one count) — the last answer too, whose count
  arrives with the reveal; **the gong** when a question moves to its reveal — no event of their own. Each can take a
  sound of the library instead of the synthesised one.
- **Off in a new room** (2026-09-27): the tick, the countdown, the ding and the gong; the host turns on the ones they
  want from the console. In a large room a tick per answer is noise, and a silent room asks no device to unlock its
  sound.
- **The countdown** (2026-09-27): tic… tac… over the last five seconds of the time, on the server's clock — a
  mechanical click (a fixed noise, drawn once from a seed, through a band-pass: 1800 Hz on the second, 1100 Hz on the
  half), the last tac left out so a second of silence leads to **the gong, struck on zero itself** (the reveal comes a
  moment later and does not strike it again). Everyone answered before zero, or a pause: what has not sounded yet is
  called off, and the reveal strikes the gong. Synthesised only (`countdown`).
- **The ding** (2026-09-27): a question starts — one clear tone, A5 (880 Hz; the first 1550 Hz pierced), with two discreet
  overtones (1306, 1787 Hz), an 8 ms attack and a faint strike (a noise burst around 1.5 kHz), all through a
  low-pass far under it (300 Hz, 12 dB per octave, Q −3 dB: flat; chosen by ear in a sandbox) and +2.6 dB after it; not over a
  question with its own sound or video (`ding`).
- **The synthesised gong**: eight inharmonic sine partials (105–890 Hz, slightly detuned), the low ones louder, under a
  low-pass darkening from 7 kHz to 500 Hz over 2.5 s; no mallet noise — after a countdown it reads as one click
  too many.
- **The background track** loops while players answer only — from the moment the answers open, never over the reading
  (or the listening) of the question. Between questions and while the game is paused it fades
  out and **keeps its place**, then comes back where it was — never from the top at each question. It makes way for a
  question's own sound or video while that plays (§9).
- **Kept by the room** (`room:{pin}` `sounds`) from one quiz to the next, set from the console's lobby
  (`host:sounds`), sent to every screen as URLs and levels (`room:sounds`). A sample or a track must be a sound of the
  host's or of the instance's; the hourly media sweep keeps what an open room plays.
- **Played** by the projection, and by a remote participant's phone or copy when the room's audio target reaches
  remote devices; the participant's mute is the MASTER. Nothing plays before the device's unlocking click: the
  projection and a remote phone ask for it when the room has game sounds, even for a silent quiz.

### 9.2 Each device's sound

- **A sound button** on every screen that plays something — the projection, a copy that plays the sound, a remote
  participant's phone (it replaces the phone's old mute): the device's **volume** and **mute**, on MASTER. With a
  mouse, a click mutes or unmutes and hovering shows the volume and *Mixer*; on a phone, a tap opens them (one tap more).
- **Mixer**: this device's own **trim** per bus (questions, music, effects, interface), each with its own **mute**
  (the fader keeps its place for when the channel is back). A bus plays at the room's level (the host's, for MUSIC and
  SFX) times the device's trim. Kept on the device (`localStorage`), from one visit to the next.
- **The room's mixer** is the host's: *Game sounds* in the console's control bar, at any moment of a quiz, besides the
  folded panel of the lobby (§9.1).
- **Declining the sound**: the *Turn sound on* overlay (and the phone's prompt) also offers *Without sound*. That click
  still unlocks the browser's audio — and readies a phone's media elements — but mutes the device; the sound button turns
  it on at once, without asking again. A device kept muted is not asked again.


## 10. Media on slides (arbitrated 2026-09-27, reframed the same day)

A slide (#7) can play a video and a sound. Everything a question's media already does is reused — library media
only, loudness correction, a common start on the server's clock, fetched ahead, the wait for the devices that play
it, the console's transport, the audio routing of §9. Decided with the author, then reframed: the media of a slide
are **settings of the slide, like a question's**, never blocks — the block builder stays visual (heading, text,
image, columns).

### 10.1 What the builder offers

- A **Media** section, the question's own component: **Video** and **Sound** side by side, at the same level —
  never buried in the background settings.
  - **Video** (an MP4 of the library) fills the slide behind its content (*cover*, cropped to the screen). Its
    switches: **Loop** (on by default: it runs as long as the slide shows; off: it plays once and stays on its last
    frame) and **Sound** (on by default). Looped with its sound, its fades are long (a bed, like the room's track).
  - **Sound** (a sound of the library): its waveform size, **hidden by default** (the console still draws it), and
    who hears it.
- The background image or gradient stays: behind the video, it is the poster while the video loads, and what a
  phone in the room shows.
- Embedded videos (YouTube, Vimeo) are left for later; a *fit* option (contain rather than cover) too.

### 10.2 One sound at a time

- A slide plays **one sound at most**: a video with its sound excludes the Sound, as a question's video does. A
  muted video and a sound go together. The builder greys the one out as the question does; the server refuses a
  slide breaking it (`slide.two_sounds`).
- The room's background track never plays on a slide (it only plays while players answer, §9.1).

### 10.3 Timing

- **Auto mode**: a slide with a timed media — its sound, or its video played once — stays until that media has
  played, plus the quiz's pause after it (`mediaTailS`), like a question stretched by its media. Its own display
  time still applies when longer. A looped video never stretches it.
- The media start on the common start (`mediaStartAt`, `MEDIA_LEAD_MS` after the slide shows), and the room waits
  for the devices that play them, as for a question (§5.4). Each step is fetched one step ahead (§5.3): a phone's
  one blessed element may be busy with the slide's sound while the question after it is due, so a remote phone may
  make the room wait a moment there.
- The game's pause holds the slide's media; they go on where they stood.

### 10.4 Who hears, and the console

- **Who hears**: as a question — the quiz's audio target, overridable per slide and per session. A remote
  participant sees the video (muted when the sound is not theirs); a phone in the room shows no video (the big
  screen does) and plays only a sound meant for every device.
- **The console**: the slide's sound-bearing media gets the question's transport (play / pause, the waveform to click
  or drag, restart), anchored on the server's clock (`media:control`, keyed by the step); a muted video, a mention.

### 10.5 Format and scope

- The bundle manifest gains the slide's `video`, `videoLoop`, `videoSound`, `audio`, `waveformSize`,
  `audioTarget`: **version 5**; an export still stamps the lowest version it needs (a quiz without slide media stays
  at 3 or 4).
- Engine: the slide step gets the media machinery of the question step (preload, readiness, media wait, anchor,
  stretch, pause), keyed by step (`s<i>`) where a question's is keyed by its index.
- Tests: the one-sound rule (builder and server), the stretch, the common start and the wait on a slide, a looped
  video never stretching, the transport on a slide, bundle v5 round trip.
