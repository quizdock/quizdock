# QuizDock — Version rollback (the rollback brief)

> Going back to an earlier release after an upgrade, **without the backup** whenever the migrations allow it, the
> backup staying the safety net. Offered from the administration, run on the server.

Status: **draft** — decisions of 2026-11-21, nothing built.

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
  release, with or without loss, and gives the command. The server runs it.

## 2. Decisions taken (2026-11-21)

- **Window**: three releases minimum. A migration older than the window may lack its `down.sql`.
- **Starting point**: no `down.sql` for the migrations already released, except those after v0.16.0 (none) and the
  four on `dev` (`media_position_behind_alone`, `question_media_style`, `question_hint`,
  `slide_media_as_question`), so the first release with rollback can already go back to 0.17.2, 0.17.1 and 0.17.0.
- **Backup first**, always, as for the upgrade.
- **Fallback**: a migration to undo without a `down.sql` → the rollback stops before touching anything and points to
  `./quizdock restore` with the backup taken before the upgrade (what has been entered since is lost, said).

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
| Admin, Version card | The releases of the window, for each: possible or not, lossless or the losses, the command to copy. Read with `db:rollback --check`. |

## 5. Tests

- **CI, per migration of the window**: up → down → the schema equals the one before (`prisma migrate diff` empty);
  up again → equal to after.
- **CI, the rule**: a migration newer than the start (§2) without `down.sql` fails the build.
- **Data**: the down of a migration that maps or deletes rows has a test with such rows.

## 6. Open points

- The standalone mode (one container, no Compose): same flow, `docker run` of the target in place of `compose up`.
- Keycloak / Authentik: their own database is not migrated by QuizDock; a rollback leaves it as is. To check per
  release that an older QuizDock still works with it.
