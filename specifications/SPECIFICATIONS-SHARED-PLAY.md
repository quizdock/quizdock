# QuizDock — Presenting a shared quiz (the shared-play brief)

> Today a quiz shared with the instance's other hosts (`quiz.shared`) can be read and copied, never presented: only its
> owner launches it. This brief lets the other hosts present it as it is, keeping nothing. The model, the decisions
> taken, and the words. It comes before the selections
> ([SPECIFICATIONS-SELECTION.md](./SPECIFICATIONS-SELECTION.md) §4.5), which depend on it.

Status: **delivered** in v0.16.0.

---

## 1. Today

Two mechanisms, often confused:

- **Sharing** (`quiz.shared`, off by default): the original itself is listed in the other hosts' *My quizzes*,
  read-only (`routes/quiz-read-only.tsx`). They can read it and **create a quiz from it** (`duplicate`): an editable
  copy in their own *My quizzes*. They cannot present it: launching loads only the host's own quizzes
  (`game.service.ts`, `playableSnapshot`). Unshared or deleted, it disappears from their list; the copies made stay.
- **Templates** (#39, RG-17): *share as a template* puts a full copy, media included, in the instance's catalogue
  (`STORE_DIR`), licence required. Taking one imports an independent draft. Neither side follows the other afterwards.

The community store (#21) is in preparation and changes neither.

## 2. The model

- A host may **present a shared quiz they do not own**, as it is: `shared`, `ready`, with at least one question.
- **Nothing is kept.** No copy lands in their *My quizzes*, no session is archived: nothing in *History*, no
  per-participant result, no per-question stat, no answer log. The game runs on the snapshot frozen at its start, as
  every game does.
- **Whoever wants a trace makes a copy first**, with the existing *Create a quiz from this*, and presents their copy
  as usual.

## 3. Decisions taken

- **Played by reference, kept by nobody** (2026-10-13). A reference alone would make other hosts depend on the owner
  (a deleted quiz taking their archives with it, `game_session_log` cascading from its quiz; their sessions listed in
  the owner's *History*, which reads `quiz.ownerId`). Keeping nothing removes both: the owner stays free to edit,
  unshare or delete, and only the launches still to come are affected.
- **Said before the launch**: the read-only view offers **Present without keeping results** next to *Create a quiz
  from this*. Both labels may wrap on two lines, `line-height: 1em` (to check in both modes that accents and
  descenders of the two lines do not touch).
- **Where it is presented from** (2026-10-13): the read-only view, the shared quiz's line in *My quizzes*, and the
  room's quiz picker (*Next quiz*, *Change quiz*), which lists the shared quizzes next to the host's own, marked as
  such. Without the picker, a host would have to close the room to present one.
- **What the participants are told** (RG-16): capture and personal tracking are off for such a game, so the notice
  says that nothing is recorded.
- **Ratings stay possible**, without the nickname. They reach the quiz, so its owner reads them in *Reviews*: the
  rating and the comment, never who wrote it. What is public is the quiz, not the other host's audience, who received
  that host's notice and do not know the owner. `quiz_feedback.nickname` becomes nullable (2026-10-13): no nickname
  is `NULL`, never an empty string standing for one, and *Reviews* shows it as anonymous. *Reviews* does not say which ratings came
  from another host's game (2026-10-13): telling it would mean keeping who presented it, which such a game does not.
- **One guard, in the archive** (2026-10-13): such a game carries a flag set at its start (`keepResults: false`), and
  `SessionArchiveService.archive()` writes nothing for it, with no error. Every path goes through it — `host:end` and
  `host:back-to-lobby` with `archive: true`, and `endOrphaned` when the host never came back — and so will any path
  added later. The interface never offers *keep the results* for such a game, so an `archive: true` only comes from an
  old or forged client, which needs no message.
- **In a room**, such a quiz is a game like any other: it counts in the room's live standings (ROOM §6.3), and, being
  unarchived, never in its archived standings (ROOM §5). The *keep the results* choices (end, next quiz, closing a
  quiz) are not offered for it.
- **Media**: nothing to add. A media is served by its id with no authentication (`GET /media/:id`), so another host's
  audience receives it, and it is never deleted while a game in progress holds it (`releaseUnused`). No object
  storage either (SPECIFICATIONS.md, *How media is stored*).
- **RG-17 is unchanged**: it governs the catalogue, where everything travels as a copy. Presenting a shared quiz is the
  one use by reference, and it keeps nothing.

## 4. The words

*Share* names two different things today (the checkbox, *Share as a template*, the *Shared templates* page). Settled:

- **Share** means only the instance sharing: the original, visible to the other hosts, who can read it, present it
  without keeping results, and create a quiz from it. The checkbox's help says they can present it.
- **Offer as a template** replaces *Share as a template*, on a page named **Templates**. Not *publish*: it already
  names the move from draft to ready (*Publish to present*).
- The store, when it opens, is one more source of the *Templates* page, not a third verb.

Every locale and the glossary (`apps/frontend/src/i18n/GLOSSARY.md`) change together.

## 5. Tests

Each pull request comes with the tests that fail without it, and coverage does not drop. At least:

- a host presents another host's shared, `ready` quiz; refused once it is unshared, back to `draft`, archived or
  deleted, and for a quiz never shared;
- **nothing is written to PostgreSQL** by such a game, on every archive path (§3), the room's standings included;
- the owner unsharing or deleting the quiz mid-game: the game goes on to its end, the next launch is refused;
- a rating from such a game reaches the quiz without its nickname;
- the participants' notice says that nothing is recorded;
- presenting from the three places (read-only view, *My quizzes*, the room's picker), and the read-only view's two
  actions, in both modes.
