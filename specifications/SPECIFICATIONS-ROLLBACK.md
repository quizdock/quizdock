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
- **What a rollback keeps**: everything the target release could hold. **What it loses**: only what nothing but a
  newer release could represent (a value added to an enum, a new kind of block), said before it runs.
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
- **What the administration shows**: the reachable releases in a list; for the one picked, what the rollback would
  lose, counted from the data (rows that use what the down removes or maps), and the terminal steps. Without a
  `down.sql` path, the restore point instead: what was entered since the upgrade, counted from `updated_at` after
  the last applied migration.
- **Restore points**: every `upgrade` keeps its backup as a restore point named after the release it leaves, apart
  from the manual backups. The last **3** are kept, older ones deleted; `QUIZDOCK_RESTORE_POINTS` raises the number.
  Each one holds the database, the media and the env, so its size multiplies the disk use: `upgrade` says it.
- **Their space is watched and cleaned**: the administration shows each restore point (release left, date, size)
  and their total against the free disk, and lets the admin delete one, after saying what it is for (the only way
  back to that release beyond the `down.sql`) and what deleting it risks.
- **Download and upload**: a restore point can be downloaded as one archive, to keep it off the server and delete
  it there; an archive downloaded this way can be uploaded again from the administration when it is needed.
- **Not in standalone mode**: no restore points (`upgrade` keeps its plain backup); the administration shows none of
  the above.
- **The directory of the restore points is mounted read-write in the app container**, owned so that the app's
  user can write it: the administration sees, serves and receives them there.
- **A downloaded archive leaves the env out**, and the administration says the rest is sensitive: the dump holds
  password hashes and, in full mode, the identity provider's database (client secrets).
- **An upload is accepted only if this instance produced it**: the archive is signed with a key of the instance; a
  restore replays its SQL as the database owner.
- **A restore point hard-links the media unchanged since the previous one**: they are named by their hash
  (`media_blob`), so only the new ones take space.
- **Built in lots** (§7), each one useful on its own.

## 3. Writing migrations from now on

- Every new migration has its `down.sql`, **written and read by hand**, the generated diff as a draft
  (`prisma migrate diff`, schema N → schema N-1).
- **The down rebuilds what the target reads from the current data.** A change whose down cannot do it is split over
  releases so that it can:
  - a column the code stops using is **dropped three releases later** at the earliest, and written meanwhile
    (expand/contract);
  - a rewritten value (`roles` replacing `role`) keeps a derivable source until the window has passed.
- **A value added to an enum**: the down recreates the type without it and maps the rows that use it to a stated
  value, or deletes them when nothing fits; the `down.sql` says which in a comment, the rollback quotes it.

## 4. The pieces

| Piece | What it does |
|-------|--------------|
| `migrations/<name>/down.sql` | The reverse of the migration, in one transaction. |
| Release manifest in the image | For each of the releases of the window: the list of its migrations. Built at release from the tags. |
| CLI `db:rollback --to <version>` (in the image) | Undoes the applied migrations the target lacks, newest first; deletes their `_prisma_migrations` rows; `--check` only says what it would do and the losses. |
| `./quizdock rollback [tag]` (server) | Backup → `db:rollback` with the current image → `QUIZDOCK_TAG` and the Compose files of the target (`refresh_files`) → restart → doctor. Without a tag: the previous one, kept by `upgrade` (`QUIZDOCK_PREVIOUS_TAG`). |
| Restore points (server) | `upgrade` keeps its backup under a restore-point name with the release it leaves; keeps the last `QUIZDOCK_RESTORE_POINTS` (3). |
| Admin, Version card | A list of the releases of the window; for the one picked: possible or not, the losses counted, the terminal steps to copy. Read with `db:rollback --check`. Starts nothing. |
| Admin, restore points | The list with sizes and the disk use; delete (with the warning), download, upload. Compose modes only. |

## 5. Tests

- **CI, per migration of the window**: up → down → the schema equals the one before (`prisma migrate diff` empty);
  up again → equal to after.
- **CI, the rule**: a migration newer than the start (§2) without `down.sql` fails the build.
- **Data**: the down of a migration that maps or deletes rows has a test with such rows.

## 6. Open points

- **Uploads of several gigabytes** meet the reverse proxy's body limit: raise it for that route, or upload in parts.
- The standalone mode (one container, no Compose): same flow, `docker run` of the target in place of `compose up`.
- Keycloak / Authentik: their own database is not migrated by QuizDock; a rollback leaves it as is. To check per
  release that an older QuizDock still works with it.

## 7. Lots

1. **Restore points (server)**: `upgrade` names and keeps them, `QUIZDOCK_RESTORE_POINTS`, the size said;
   `./quizdock rollback` back to the previous release through its restore point. From this lot on, every new
   migration ships its `down.sql` and the CI checks it (§3, §5): what is not written when the migration is written
   cannot be caught up.
2. **Admin, read only**: the Version card (reachable releases, what was entered since the upgrade, the terminal
   steps); the restore points with their sizes and the disk use.
3. **Admin, management**: delete with the warning, download, upload.
4. **Rollback through the `down.sql`**: the release manifest, `db:rollback` and `--check`, the losses counted per
   migration; `./quizdock rollback` takes this path when it exists, the restore point otherwise.
