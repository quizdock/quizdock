# QuizDock — Selections (the selection brief)

> A **selection**: a named, saved, replayable list of quizzes, launched into a room in one go. The room
> ([SPECIFICATIONS-ROOM.md](./SPECIFICATIONS-ROOM.md)) improvises a series of quizzes live; a selection prepares one.
> The model, the decisions taken, the data, and the tests.

Status: **delivered** in v0.16.0.

---

## 1. The model

- **A selection** is content, like a quiz: it belongs to its host and sits next to *My quizzes*. It holds:
  - its **name** (and an optional description), which carries the context: *History, year 8*, *Company night*;
  - its **quizzes, in order**;
  - for each quiz, what depends on the quiz itself: its **pace** (`manual` / `auto`, LIVE §8) and whether the
    **next quiz starts on its own** after the lobby countdown (LIVE §11.4).
- **Launching** a selection opens a room on its first playable quiz. From there, the room is an ordinary room (ROOM §1): same
  screens, same archives, same standings.
- **Saving a room as a selection** turns the quizzes a room played, in their order, into a new selection.

## 2. Decisions taken

- **The word** (2026-10-13): *selection* — neutral on the domain, the duration and the rigour, translatable (fr
  *Sélection*, es *Selección*, de *Auswahl*). It can take a qualifier later if a variant needs one (*ordered
  selection*), and the name the host gives it says the rest. Ruled out:
  - *Programme*, *Path* (*Parcours*): they promise a long-term, structured follow-up;
  - *Playlist*, and the game vocabulary (*round*, *tournament*, *season*): outside quizzes, or too narrow;
  - *Series* (fr *Série*): already the answer streak; *Session*: already one archived quiz; *Bundle*, *pack*: already
    the import/export format.
- **Only what depends on the quizzes** (2026-10-13). The settings that depend on the audience and the place stay the
  room's, picked at each launch as today:
  - capture, personal tracking (RG-16), picking one's own name, participant access;
  - the invitation address, the join lock, the sounds and levels, motion, the audience language, the room's name.

  A selection never imposes a capture the host did not choose, and stays playable in any context.
- **A reference to each quiz, not a copy** (2026-10-13). A quiz edited between two launches is played in its new
  version; each archived session keeps its own frozen copy (`quiz_snapshot`), which is what any follow-up reads.
- **Shared like a quiz** (2026-10-13): a selection can be shared with the instance's other hosts, off by default.
  They see it read-only in their bank and can **create a selection from it**, theirs to edit, with nothing linking
  the two afterwards (as `quiz.shared` and *Create from this* do for a quiz). Settled 2026-10-14:
  - another host **launches** a shared selection as it is: each quiz shared with them is played keeping nothing
    ([SPECIFICATIONS-SHARED-PLAY.md](./SPECIFICATIONS-SHARED-PLAY.md)); the others they cannot read, and do not see;
  - sharing a selection **does not share its quizzes**: the owner decides for each. Sharing it says how many of them
    the other hosts will not see;
  - a selection **created from** a shared one refers to the same quizzes, copying none; whoever wants results keeps
    their own copy of the quiz they need;
  - **beyond the instance** (a bundle, the template catalogue, the store), where everything travels as a copy, is
    outside this brief.
- **The list is a queue the host may leave** (2026-10-14). The room's lobby picks the selection's next quiz on its own:
  the first quiz of the list the room has not played yet (the room already knows them, `playedQuizIds`), so no cursor
  is stored. *Change quiz* stays: a quiz picked outside the list is played, and the queue goes on where it was; a
  quiz skipped stays next until it is played. The order changes in the selection, never live. The lobby says what
  comes: *Next in the selection: X (3 of 5)*. Moving on stays the host's call (ROOM §2).
- **One rule for what shows** (2026-10-14): everyone, the owner included, sees of a selection what they may read;
  what they may read but not play is greyed.
  - A **deleted** quiz leaves the list (its line goes with it). Another host's quiz no longer shared leaves the view
    of whoever cannot read it any more, and comes back if shared again. To keep another host's quiz, the only way is
    one's own copy (*Create a quiz from this*).
  - **In its editor**, the list is edited, and a quiz one may read but not play (back to `draft`, without a question)
    is greyed with why.
  - **In the console**, only what can be played: the quizzes the room played ticked, the next one picked in the
    lobby, the host free to change it at once; *3 of 5* counts the playable ones. A room opened from a single quiz is
    as today: the host picks the next one.
  - Another host's selection none of whose quizzes one may read does not show at all; one's own always shows, an
    empty one included (it is being filled).
- **Saving a room as a selection, from two places** (2026-10-14), the same *Save as a selection*, the new selection
  named after the room and leaving out what its owner may not read:
  - **the console**, in the lobby or when the room closes: every quiz the room played, in order, each with the pace
    it had;
  - ***History*'s room card**, afterwards: the room's archived quizzes in order, at the manual pace (an archived
    session does not keep its pace) — the way back for a host who forgot to save it live.
- **Limits** (2026-10-14), against abuse only: at most **50 quizzes** in a selection (`selection.too_many_quizzes`),
  **each quiz once** (the queue plays the first one not played yet, so a second line would never come; a quiz is
  played again with *Change quiz*), a name of 60 characters as a room's, a description of 2000 as a quiz's. The room
  itself keeps no limit.
- **A quiz that cannot be played is skipped** (2026-10-14): the lobby picks the next playable one. Launching is refused
  only when none of the list can be played (`selection.nothing_playable`).
- **The follow-up compares launches** (2026-10-14), read from their archived sessions like the room's card in
  *History*, settings never locked: each launch with its date, the quizzes played, its participants and each quiz's
  success rate, on the selection's page (*Launches*). Every session of a room its host opened from their own
  selection carries it (`game_session_log.selection_id`, emptied if the selection is deleted: the archives stay);
  another host's launch of a shared selection never reaches its owner. Following each
  participant from one launch to the next — a stable identity, accounts only, RG-16 — is outside this brief.

## 3. Data (sketch)

- `selection`: id (ULID), owner, name, description, timestamps.
- `selection_item`: selection, quiz (deleted with it), order index, pace, starts on its own.
- A launch is not stored as such: its sessions carry the selection they came from (`game_session_log.selection_id`,
  set null on delete), as they carry their room (`room_id`).

## 4. Tests

Each pull request comes with the tests that fail without it, and coverage does not drop; the multi-quiz room's
tests (`apps/backend/test/game/`) stay green, a selection launching an ordinary room. At least:

- the lobby picks the first quiz of the list not played yet; one picked outside the list leaves the queue where it
  was; a quiz skipped stays next;
- a quiz that cannot be played is skipped, and launching is refused when none can be (`selection.nothing_playable`);
- visibility: another host sees only the quizzes they may read, a selection with none does not show, a deleted
  quiz leaves the list; in its editor, a quiz one may read but not play is greyed with why;
- another host launching a shared selection plays its shared quizzes keeping nothing;
- saving a room as a selection, from the console (the quizzes played, their pace) and from *History* (the archived
  ones, manual pace), leaving out what cannot be read;
- every session of a room opened from a selection carries `selection_id`, emptied when the selection is deleted;
  *Launches* compares them;
- the limits: 50 quizzes, each once.
