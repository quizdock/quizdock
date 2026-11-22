# QuizDock — Version rollback (the rollback brief)

> Going back to an earlier release after an upgrade, **without the backup** whenever the migrations allow it, the
> backup staying the safety net. Assessed in the administration, run from the terminal.

Status: **draft** — decisions of 2026-11-21 and 2026-11-22, nothing built.

---

## 1. The model

- A rollback goes back to one of **the three releases before the running one** at least (any release: minor or
  patch). Further back, the backup.
- Prisma Migrate only goes forward. Each migration therefore ships a **`down.sql`** next to its `migration.sql`, in the
  same directory; Prisma reads only `migration.sql` and checksums only it.
- The rollback runs with the **current image**: it is the only one that knows the `down.sql` of the migrations it
  added. It undoes them newest first, then the target image starts; its `migrate deploy` has nothing left to apply.
- **A rollback keeps, it does not drop.** What a newer release added stays in the database as a **ghost** the target
  does not read: its columns and tables are left in place, a value it cannot hold is mapped and its original kept
  aside. The target runs on what it knows; an upgrade again finds the ghosts and gets the data back.
- **What a rollback loses** is therefore narrow and said before it runs: what the target cannot show meanwhile (a
  question's hint is not played while on the older release), and what an edit in the target overwrites (a JSON it
  saves without the parts it does not know; a mapped value it changes).
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

## 3. Writing migrations from now on

- Every new migration has its `down.sql`, **written and read by hand**, the generated diff as a draft: Prisma's own
  workflow (*Generating down migrations*: `prisma migrate diff --script`, schema N → schema N-1; applied with
  `prisma db execute --file`).
- **The down leaves ghosts** (§1):
  - an added column or table stays; the down only relaxes what would make the target fail on its own writes: a
    `NOT NULL` without default, a restrictive foreign key (the target could no longer delete a user who owns a
    selection), a check, a unique index;
  - **a value added to an enum**: the down recreates the type without it, maps the rows that use it to a stated value
    and keeps the original in a ghost column; the `down.sql` says the mapping in a comment, the rollback quotes it;
  - the same for a value the target does not know inside a JSON column (a position, a kind of block).
- **The up runs again over its ghosts**: `IF NOT EXISTS` on what it creates, guards on its constraints, and it puts
  back the mapped values whose row still holds the value the down set.
- **A column renamed or no longer read is a ghost of the newer release** (Prisma's *expand and contract*): it stays and is still written through the
  window, then dropped by a later release (roadmap §1). A rewritten value (`roles` replacing `role`) keeps its source
  written the same way.

## 4. The pieces

| Piece | What it does |
|-------|--------------|
| `migrations/<name>/down.sql` | The reverse of the migration, leaving its ghosts, in one transaction. |
| Release manifest in the image | For each of the releases of the window: the list of its migrations. Built at release from the tags. |
| CLI `db:rollback --to <version>` (in the image) | Undoes the applied migrations the target lacks, newest first; deletes their `_prisma_migrations` rows (Prisma's `migrate resolve --rolled-back` only takes a failed migration); `--check` only says what it would do and the losses. |
| `./quizdock rollback [tag]` (server) | Backup → `db:rollback` with the current image → `QUIZDOCK_TAG` of the target, the infrastructure's Compose files kept → restart → doctor. Without a tag: the previous one, kept by `upgrade` (`QUIZDOCK_PREVIOUS_TAG`). |
| Restore points (server) | `upgrade` keeps its backup under a restore-point name with the release it leaves, when `QUIZDOCK_RESTORE_POINTS` is set. |
| Admin, Version card | A list of the releases of the window; for the one picked: possible or not, the losses counted, the terminal steps to copy. Read with `db:rollback --check`. Starts nothing. |
| Admin, restore points | The list with sizes and the disk use; delete (with the warning), download, upload. Compose modes only. |

## 5. Tests

- **CI, per migration of the window**: up → down → the target's schema is all there, unchanged (`prisma migrate
  diff` shows only the ghosts); the target's writes pass on it; up again → equal to after, the ghosts' data back.
- **CI, the rule**: a migration newer than the start (§2) without `down.sql` fails the build.
- **Data**: the down of a migration that maps rows has a test with such rows, and the up again gets them back.

## 6. Open points

- **Large restore points**: how to move one that is too big for the browser, to and from the server. To settle,
  simple and pragmatic for ops (e.g. `scp` into the restore points' directory, the script taking it from there).
- **To check in the prototype**: the up again over its ghosts (`IF NOT EXISTS`, enum values re-added, the mapped
  values put back), and a ghost column whose type is the enum the down recreates.
- **Prisma 8** (a release candidate on 2026-11-22; Prisma 7 supported 18 months after its release) changes the
  ground: migrations form a graph of states, going back is a migration planned to the state before
  (`migration plan --to "<dir>^"`), every operation is checked before and after (so it runs again safely), data
  transforms are built in, and *refs* name states (a release manifest for free). It checks the database's state by
  a hash of its schema (`db verify`): whether the ghosts pass is the first thing to prototype. Lot 4 waits for that.
- Keycloak / Authentik: their own database is not migrated by QuizDock; a rollback leaves it as is. To check per
  release that an older QuizDock still works with it.

## 7. Lots

1. **Restore points (server)**: `QUIZDOCK_RESTORE_POINTS`, `upgrade` names and keeps them, the size said;
   `./quizdock rollback` back to the previous release through its restore point. From this lot on, every new migration ships its `down.sql` with ghosts and the CI checks it (§3, §5): what is not written
   when the migration is written cannot be caught up.
2. **Admin, read only**: the Version card (reachable releases, what was entered since the upgrade, the terminal
   steps); the restore points with their sizes and the disk use.
3. **Admin, management**: delete with the warning, download, upload.
4. **Rollback through the `down.sql`**: the release manifest, `db:rollback` and `--check`, the losses counted per
   migration; `./quizdock rollback` takes this path when it exists, the restore point otherwise. Built once Prisma 8
   is settled (§6): on Prisma 7, it would be built twice.
