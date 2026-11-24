# Performance roadmap

> **Status: 2026-09-27, after the refactoring lots.** Where the live engine
> spends its time, what was done, and the options to go further, in the order
> they are worth trying. Every step is measured with the [load test](load-testing.md)
> before and after, and must keep the sync tests green
> (`src/game/game.engine.spec.ts`, "sync between devices").

## 1. Where we stand

From the [measure after the lots](load-testing.md#3-results), taken on a machine that
had just started (one room, questions without media, Xeon @ 2.10 GHz):

- **Fluid up to ~1500 players in one room, on one core**: an answer acknowledged in
  18 ms (p95) at 700 players, 61 ms at 1500 where the slowest 1 % reach 0.4 s. The
  baseline, before the lots, queued the answers past 400 players (3.4 s at 700).
- **No answer lost**, the devices receive each question within 40 ms of each other
  up to 700 players.
- **A second core barely changes it** for one room: the engine runs on Node's single
  JavaScript thread.
- **Several rooms at once**: 60 rooms of 30 (1800 players), all started together,
  answered within 25 ms (p95) on one core; the limit is beyond.

## 2. Where the time goes

**Measured** with a CPU profile of the backend at 400 players (one core saturated,
`node --cpu-prof`-style sampling through the inspector), after the lots and before 3.0:

| Share of the backend's time | What |
|--:|---|
| ~27 % | sending over the network (`writev`, engine.io, socket.io): mostly `answer:count`, sent to every device on every answer, so 400 × 400 = 160,000 messages a question |
| ~6 % | re-reading and parsing every player on every answer, to count who answered |
| ~4 % | Redis transfers |
| ~3 % | garbage collection |
| ~40 % | idle (the joins, the waits between questions) |

Before that measure, the analysis read the code:

| Moment | What the engine does | Cost |
|---|---|---|
| Each answer (`submit`) | reads the room and the game, parses the **whole quiz snapshot**, then re-reads and parses **every player**, every score and every answer to count who answered | O(N) per answer, **O(N²) per question** |
| Each reveal | for each device, looks its player up in the ranking with a linear search, twice | **O(N²)** |
| Each lobby arrival | recounts who is ready or loaded, and sends the count to every device | O(N) per arrival, **O(N²) to fill a room** |
| Every event | sends it to N devices; the reveal and the podium build one payload per device | O(N), the floor |

## 3. Options, in order

### 3.0 Coalescing `answer:count`: **done** (lot 5b)

- The answer count goes out at most every 100 ms (`ANSWER_COUNT_EVERY_MS`), the last
  one always, instead of on every answer: an answer in a quiet moment goes out at once,
  those within the next 100 ms together at its end. A count still waiting when the
  question is revealed goes out first, so the screens show every answer the reveal
  counts. The count is the same on every device, only its steps are coarser: the room's
  sync is untouched.
- **Audible**: the screens tick once per answer counted, at most 5 ticks per update.
  In a large room (133 answers a second at 400 players) the clatter thins out; in a
  room of 30, answers rarely come within 100 ms of each other and nothing changes.
  The game's sounds are off in a new room anyway: the host turns on the ones they want.
- **Measured**, A/B against the code before the lots, alternated, three rounds, on a
  machine that had just started: answer ack p95 from 120–623 ms to 11–12 ms at 500
  players on two cores, from 18–37 ms to 7–8 ms at 300 on one; Redis from 12 to 10
  commands per answer; no answer lost. A warm A/B just before and after this change
  alone gave the same order (480–503 ms to 12 ms).

### 3.1 In-memory indexes and a snapshot cache (low risk): **done**

- **Done**: the rank index (lot 2) and the snapshot cache (`GameService`, the last
  50 games). Measured on a text-heavy quiz (`--rich`, 10 questions) at 400 players:
  answer ack p95 from 91–129 ms to 60–75 ms, the start spread from 23–35 ms to
  17–21 ms. The CPU stays saturated: it lightens each answer, it does not move
  the ceiling.

- **Rank index.** Build `playerId → rank` once per reveal or podium, instead
  of a linear search per device. Same result, pure code.
- **Snapshot cache**, keyed by game id. The snapshot is frozen for a game,
  except its form refreshed between steps: the cache is invalidated there. A
  new game of the room has a new id and can never read the previous snapshot.
- Only frozen data is cached in memory. Players, scores and answers change all
  the time: they stay in Redis, the source of truth, so a restart (timers
  re-armed from Redis) and, later, several processes stay correct.

### 3.2 Indexes in Redis (medium risk): **not done**

- The profile gives what they would save, the per-answer parse of every player,
  about 6 % of the time at 400 players (and less since 3.0: the players are counted
  once per count sent, not once per answer). Not worth the drift risk.

- A set of the game's **connected players** and a set of **who answered** each
  question, kept up to date on join, reconnect, disconnect, ban, answer and
  quiz change. Counting becomes `SCARD` / `SINTERCARD` (Redis ≥ 7): one command,
  no parsing on the Node side.
- The risk is these sets drifting from the truth. The convergence tests
  (departures, bans, reconnections, next quiz) cover the cases; each one must
  keep passing.

### 3.3 Coalescing the lobby broadcasts: **done** (#291)

- The readiness (the screens' *ready* count, the lobby's count on the phones) goes out
  at most every 100 ms per room (`READINESS_EVERY_MS`), the last one always, instead of
  on every arrival, *Ready!*, departure or media loaded: the pattern of 3.0. The step
  changes still send it at once. The counts move in steps of at most 100 ms; the last
  device ready ends a media wait up to 100 ms later.
- **Measured**, a join wave (50 at a time, as the load test) into one lobby, Apple M4,
  two runs each: the messages to the participants from 265,000 to 134,400 at 500
  players and from 1,034,000 to 536,000 at 1000; `player:join` ack p95 from 319–344 ms
  to 176–194 ms at 500 and from 744–749 ms to 386–394 ms at 1000 (`load-test.mjs`);
  the backend's CPU over the wave from 2.1 s to 1.2–1.4 s at 500, 8.4 s to 4.2–4.4 s at
  1000.
- **Then** `player:joined` and `player:left` to the screens only (SPECIFICATIONS-LIVE §9.1),
  the same wave: the messages to the participants from 135,000 to 8,000 at 500 players and
  from 536,000 to 24,000 at 1000; `player:join` ack p95 from 184–190 ms to 90–99 ms and from
  383–386 ms to 174–175 ms; the backend's CPU from 1.3–1.6 s to 0.8–1.1 s and from 4.3 s
  to 2.2 s. The roster each participant gets on joining is still O(N) long.

### 3.4 Several processes — architecture

- One Node process per available core (`cluster`, sized from
  `os.availableParallelism()`), each room owned by one process: the Socket.IO
  Redis adapter, sticky sessions at the proxy, and the owner of a room's
  timers (in memory today) to settle.
- It multiplies the **rooms** an instance holds, **not the players of one
  room**: a room's actions must stay in order, or the locks and the sync break.
- Days of work. Worth it only if several large rooms at once on one instance
  become a need. The load test would first get a multi-room mode to decide on
  figures.

### Not planned

- **Worker threads inside a room.** The sockets and the timers live on the main
  thread; moving computation out would add round trips for a small gain, and a
  room's work is sequential anyway.
- **Players or scores cached in memory.** They would drift from Redis on a
  restart and block the multi-process option.

## 4. Order of work

1. ~~The engine refactoring (lot 2), behaviour unchanged, measured.~~ Done.
2. ~~3.1, measured.~~ Done. 3.2 set aside (see above).
3. ~~3.0.~~ Done (lot 5b). ~~3.3.~~ Done.
4. ~~The sizing table measured again and published in the
   [sizing guide](https://quizdock.github.io/docs/operator/sizing/).~~ Done, measured cold, 3.0 included.
5. 3.4 only on a confirmed need, after a multi-room measure.

## 5. Also noted

- Fixed in lot 4a: the reveal settled a `closest` question's points after writing its
  state; the `pg` overlap warning under load.
- **Found while measuring**: the author's media library matched every media against
  every quiz with `LIKE`, 28.6 s for an author with 2,000 quizzes and 200 media. It
  reads the one-pass definition the administration used: 0.25 s (lot 4c).
- **Candidate, not measured**: the archive of a finished game writes one row per
  player, in a transaction (`createManyAndReturn` would take one query). A game's
  end, not its play: to measure before changing.
- **Found while measuring several rooms**: Redis's peak memory stayed near 19 MB over
  60 rooms of 30 and a room of 300, but reached 71 MB from 400 to 700 players in one room
  and 271 MB after 1000 and 1500: a large room seems to hold more in Redis than its
  players alone. Not explained, to look into.
- Not measured yet: media (bandwidth, the reverse proxy), a real Wi-Fi network,
  Postgres archiving a large session, rooms starting at their own moments.
