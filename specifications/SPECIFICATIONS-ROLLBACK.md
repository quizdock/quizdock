# QuizDock — Version rollback (the rollback brief)

> Going back to an earlier release after an upgrade, **without the backup** whenever the migrations allow it, the
> backup staying the safety net. Assessed in the administration, run from the terminal.

Status: **draft** — decisions of 2026-11-21 and 2026-11-22. Lot 0 (§7) and the release checks are on `dev`; nothing is shown yet.

---

## 1. The model

- A rollback goes back to any release of **the three minors before the running one**, their patches included, and
  to the patches before it in its own minor. Further back, the backup.
- Prisma Migrate only goes forward. Each migration therefore ships a **`down.sql`** next to its `migration.sql`, in the
  same directory; Prisma reads only `migration.sql` and checksums only it.
- The rollback runs with the **current image**: it is the only one that knows the `down.sql` of the migrations it
  added. It undoes them newest first and deletes their rows in `_prisma_migrations`, so that an upgrade again runs
  them again; then the target image starts, and its `migrate deploy` has nothing left to apply.
- **A rollback keeps, it does not drop.** What a newer release added stays in the database as a **ghost** the target
  does not read: its columns and tables are left in place, a value it cannot hold is mapped and its original kept
  aside. The target runs on what it knows; an upgrade again finds the ghosts and gets the data back.
- **What a rollback loses** is therefore narrow and said before it runs: what the target cannot show meanwhile (a
  question's hint is not played while on the older release), what an edit in the target overwrites (a JSON it
  saves without the parts it does not know; a mapped value it changes), and what the target's own clean-ups delete
  for not seeing a ghost use it (§2, 2026-11-22: a release that does not pause them).
- **It stays in QuizDock's own perimeter**: the QuizDock image and its database. The infrastructure (Postgres, Redis,
  Keycloak, Authentik and their Compose files) stays as it runs; their databases only migrate forward.
- The administration **installs nothing**, as for the upgrade: it says whether a rollback is possible, to which
  release, what it would lose, and how to run it from the terminal. The server runs it. If the running release is
  too unstable to serve the administration, the terminal stays the way: `./quizdock rollback --check` says the same.

## 2. Decisions taken

### 2026-11-21

- **Window**: three releases minimum. A migration older than the window may lack its `down.sql`.
- **Starting point**: no `down.sql` for the migrations already released, except those after v0.16.0 (none) and the
  four on `dev` (`media_position_behind_alone`, `question_media_style`, `question_hint`,
  `slide_media_as_question`), so the first release with rollback can already go back to 0.17.2, 0.17.1 and 0.17.0.
- **Backup first**, always, as for the upgrade.
- **Fallback**: a migration to undo without a `down.sql` → the rollback stops before touching anything and points to
  `./quizdock restore` with the backup taken before the upgrade (what has been entered since is lost, said).

### 2026-11-22

- **No rollback from the web.** The administration assesses and explains, at little cost; it starts nothing.
- **Ghosts rather than drops** (§1, §3), and the schema deprecation joins the versioning policy (roadmap §1).
- **The infrastructure is not rolled back** (§1).
- **What the administration shows**: the reachable releases in a list; for the one picked, what the rollback would
  lose (§1), counted from the data, and the terminal steps. Through a restore point instead: what was entered since
  the upgrade, counted from the restore point's date. Deletions made since cannot be counted (a quiz deleted since
  comes back): the figure says it is approximate.
- **Restore points, off by default**: `QUIZDOCK_RESTORE_POINTS` (`0` by default) sets how many to keep. Set, every
  `upgrade` keeps its backup as a restore point named after the release it leaves, apart from the manual backups.
  Older ones are deleted **only once the upgrade has succeeded**; an upgrade to the running release takes no new
  one. Unset, `upgrade` keeps its plain backup, as today. The administration says which, and how to turn them on.
- **Backups are made by the terminal only.** The app never creates one: it lists, serves, deletes and receives restore
  points. The script gives their files to the app's user.
- **Their space is watched and cleaned**: the administration shows each restore point (release left, date, size)
  and their total against the free disk, and lets the admin delete one, after saying what it is for (the only way
  back to that release beyond the `down.sql`) and what deleting it risks.
- **A restore point hard-links the media unchanged since the previous one**: they are named by their hash
  (`media_blob`), so only the new ones take space.
- **Download and upload**: a restore point can be downloaded as one archive, streamed as it is built (no copy on the
  disk), to keep it off the server and delete it there. The archive leaves the env out; the administration says the
  rest is sensitive (password hashes, and in full mode the identity provider's database with its client secrets).
- **An upload from the administration is accepted only if this instance produced it** (the archive is signed with a
  key of the instance), and only if the disk has the room: a restore replays its SQL as the database owner. An
  archive from elsewhere (a server rebuilt after a loss) goes through `./quizdock restore` in the terminal, on the
  operator's responsibility.
- **The directory of the restore points is mounted read-write in the app container.**
- **Not in standalone mode**: no restore points; the administration shows none of the above. `./quizdock rollback`
  does nothing there before lot 4 (§7), and says so.
- **Built in lots** (§7), each one useful on its own.

### 2026-11-22, tried on Prisma 7

- **What Prisma 7 does**, tried on a throwaway database: an older release's `migrate deploy` ignores the applied
  migrations it does not know; it accepts a `migration.sql` changed after it was applied; a migration run again
  over its ghosts fails unless it was written to run again.
- **Hence**: a rollback deletes the rows of the migrations it undoes, and every migration runs again over its
  ghosts (§3). The four migrations of `dev` (§2, 2026-11-21) are rewritten so, before their release.
- **An enum keeps its values**: a value the target does not know stays in the type, a ghost it never reads; only the
  rows using it are mapped. A type recreated without it would leave nothing to put back on an upgrade again.
- **Clean-ups pause on a newer release's data**: while the database holds tables or columns the running release
  does not know, it deletes no media (the hourly sweep, the release on save), since a ghost may use them. From the
  next release on; a rollback to 0.17.x does not have it, and its sweep deletes, after 24 h, the media only hints
  and slide pictures use: a loss said before it runs.
- **The window counts minors** (three, with their patches), and **a patch adds no migration**: a migration comes
  with a minor, so a window is a span of time, not three patches out in a week.
- **Releases are checked before anything is published** (`scripts/release-check.mjs`, first job of the release
  workflow): released migrations unchanged, new ones after them, none in a patch, upgrade and rollback from each
  release of the window, a drop only of what the window's oldest release marked `@deprecated`. A release candidate
  (`vX.Y.Z-rc.N`) passes them and publishes its own image only, to try on a server first.
- **Nothing of the rollback is shown or announced yet**: the next release ships what makes it work at its release
  (§7, lot 0).

## 3. Writing migrations from now on

- Every new migration has its `down.sql`, **written and read by hand**. Prisma's own workflow (*Generating down
  migrations*: `prisma migrate diff --script`, schema N → schema N-1) lists what changed; its drops are what the
  down does not do.
- **The down leaves ghosts** (§1):
  - an added column or table stays; the down only relaxes what would make the target fail on its own writes: a
    `NOT NULL` without default, a restrictive foreign key (the target could no longer delete a user who owns a
    selection), a check, a unique index;
  - **a value added to an enum**: the type keeps it (§2); the down maps the rows that use it to a stated value and
    keeps the original in a ghost column (`<column>_ghost`); the `down.sql` says the mapping in a comment, the
    rollback quotes it;
  - the same for a value the target does not know inside a JSON column (a position, a kind of block).
- **The up runs again over its ghosts**: `IF NOT EXISTS` on what it creates, guards on its constraints, and it puts
  back the mapped values whose row still holds the value the down set, then drops the ghost column that kept them.
  `20261119090000_media_position_behind_alone` shows both sides.
- **A column renamed or no longer read is a ghost of the newer release** (Prisma's *expand and contract*): it stays,
  still written, marked `/// @deprecated` in `schema.prisma`; a release drops it once every release of its window
  has the mark (roadmap §1). A rewritten value (`roles` replacing `role`) keeps its source written the same way.

## 4. The pieces

| Piece | What it does |
|-------|--------------|
| `migrations/<name>/down.sql` | The reverse of the migration, leaving its ghosts, in one transaction. |
| `migrations/<name>/down.test.sql` | For a down that maps rows: seeds them, checks them after the down (`-- after down`) and once migrated again (`-- after up again`). |
| `newerData` (`prisma/newer-data.ts`) | The tables and columns the running release does not know; the media clean-ups delete nothing while there are any. |
| Release manifest in the image | For each of the releases of the window: the list of its migrations. Built at release from the tags. |
| CLI `db:rollback --to <version>` (in the image) | Undoes the applied migrations the target lacks, newest first; deletes their `_prisma_migrations` rows (Prisma's `migrate resolve --rolled-back` only takes a failed migration); `--check` only says what it would do and the losses. |
| `./quizdock rollback [tag]` (server) | Backup → `db:rollback` with the current image → `QUIZDOCK_TAG` of the target, the infrastructure's Compose files kept → restart → doctor. Without a tag: the previous one, kept by `upgrade` (`QUIZDOCK_PREVIOUS_TAG`). |
| Restore points (server) | `upgrade` keeps its backup under a restore-point name with the release it leaves, when `QUIZDOCK_RESTORE_POINTS` is set. |
| Admin, Version card | A list of the releases of the window; for the one picked: possible or not, the losses counted, the terminal steps to copy. Read with `db:rollback --check`. Starts nothing. |
| Admin, restore points | The list with sizes and the disk use; delete (with the warning), download, upload. Compose modes only. |

## 5. Tests

`pnpm --filter @quiz-dock/backend rollback:check` (`scripts/rollback-check.mjs`), in the CI on the test server:

- **The rule**: a migration from the start (§2) on without `down.sql` fails the build.
- **Per migration, newest first**: up, the downs back to it; then the release before finds its whole schema
  unchanged (tables, columns, enum values, constraints, indexes), its `migrate deploy` has nothing to apply, and
  up again gives the schema of a fresh upgrade, no ghost left.
- **Data**: a `down.test.sql` checks the rows a down maps, and that an upgrade again gets them back.

## 6. Open points

- **Large restore points**: how to move one that is too big for the browser, to and from the server. To settle,
  simple and pragmatic for ops (e.g. `scp` into the restore points' directory, the script taking it from there).
- **Prisma 8** (a release candidate on 2026-11-22; Prisma 7 supported 18 months after its release) changes the
  ground: migrations form a graph of states, going back is a migration planned to the state before
  (`migration plan --to "<dir>^"`), every operation is checked before and after (so it runs again safely), data
  transforms are built in, and *refs* name states (a release manifest for free). It checks the database's state by
  a hash of its schema (`db verify`): whether the ghosts pass is the first thing to prototype. Lot 4 waits for that.
- Keycloak / Authentik: their own database is not migrated by QuizDock; a rollback leaves it as is. To check per
  release that an older QuizDock still works with it.

## 7. Lots

0. **Groundwork (with the next release, nothing shown)**: the `down.sql` of the migrations from the start on, the
   migrations written to run again, the CI checks (§5), the clean-ups paused on a newer release's data.
1. **Restore points (server)**: `QUIZDOCK_RESTORE_POINTS`, `upgrade` names and keeps them, the size said;
   `./quizdock rollback` back to the previous release through its restore point. From this lot on, every new migration ships its `down.sql` with ghosts and the CI checks it (§3, §5): what is not written
   when the migration is written cannot be caught up.
2. **Admin, read only**: the Version card (reachable releases, what was entered since the upgrade, the terminal
   steps); the restore points with their sizes and the disk use.
3. **Admin, management**: delete with the warning, download, upload.
4. **Rollback through the `down.sql`**: the release manifest, `db:rollback` and `--check`, the losses counted per
   migration; `./quizdock rollback` takes this path when it exists, the restore point otherwise. Built once Prisma 8
   is settled (§6): on Prisma 7, it would be built twice.
