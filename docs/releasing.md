# Releasing

Creating a version tag starts everything, automated by
[`.github/workflows/release.yml`](../.github/workflows/release.yml). Two things stay by
hand: choosing the number (below), and the release notes' **Upgrading** section.

## Cut a release

```bash
git switch main && git pull
git tag -a v0.4.0 -m "v0.4.0"   # annotated; lightweight (git tag v0.4.0) also works
git push origin v0.4.0
```

That's it. The tag (`v*.*.*`) triggers, in one run:

0. **The release checks** (`apps/backend/scripts/release-check.mjs`), against the stable tags
   before it: released migrations unchanged, new ones after them, none in a patch, the upgrade
   and the rollback from each release of the window played for real, a drop only of what the
   window's oldest release marked `@deprecated` ([SPECIFICATIONS-ROLLBACK](../specifications/SPECIFICATIONS-ROLLBACK.md)).
   If they fail, nothing below is published.
1. **GitHub Release** — source of truth, created with auto notes, marked *latest*.
2. **`CHANGELOG.md`** — regenerated from conventional commits ([git-cliff](https://git-cliff.org),
   config in [`cliff.toml`](../cliff.toml)) and committed back to `main` (`[skip ci]`).
3. **Docker Hub images** — `:X.Y.Z`, `:X.Y`, `:latest`, plus `:standalone` / `:standalone-X.Y.Z`,
   multi-arch (amd64 + arm64), each with its SBOM and provenance. Docker Hub *follows* the
   GitHub release.
4. **The public demo** — redeployed from the new `:standalone` (job `deploy-demo`).

No version is maintained in files: the tag is the version. `package.json` versions are not
used by the pipeline.

## Choose the number

SemVer, pre-1.0 (`0.MINOR.PATCH`). git-cliff groups the commits, it does not pick the bump:

| Bump | When | Commits |
|---|---|---|
| **minor** `0.X.0` | a new user-facing capability ships (screen, game mode, gameplay feature) | at least one `feat:` |
| **patch** `0.x.Y` | fixes or adjustments, no new capability, **no migration** (the checks refuse it) | `fix:` |
| **no release** | CI, tooling or docs only: the published image does not change | `ci:` `chore:` `docs:` |

## Try a release candidate first

A tag `vX.Y.Z-rc.N` passes the same checks and publishes its own image only,
`fchaussin/quizdock:X.Y.Z-rc.N` (and `:standalone-X.Y.Z-rc.N`), with a GitHub pre-release:
no `:X.Y`, no `:latest`, no demo. Upgrade a server to it (`./quizdock upgrade X.Y.Z-rc.N`),
then tag `vX.Y.Z` on the same commit. To run the checks before any tag, against the
throwaway databases of a Postgres server:

```bash
DATABASE_URL=postgresql://… pnpm --filter @quiz-dock/backend release:check vX.Y.Z
```

## Write the Upgrading section

When a release adds migrations or changes what an operator does, edit the GitHub release
and add an **Upgrading** section: what changes in the schema, whether data is converted,
anything manual. Operators are told to read it
([upgrade](https://quizdock.github.io/docs/operator/upgrade/)), and the administration's
update notice shows it.

## Images kept

Every image published so far stays on Docker Hub. A retention policy is proposed, not
applied: [`releasing/retention.md`](releasing/retention.md).

## Conventions that feed the changelog

Commit messages are [Conventional Commits](https://www.conventionalcommits.org) (already
enforced by commitlint). The type/scope drive the changelog grouping:

| Prefix | Section |
|---|---|
| `feat:` | Features |
| `fix:` | Bug Fixes |
| `fix(security…)` / `sec:` | Security |
| `perf:` | Performance |
| `refactor:` | Refactor |
| `docs:` | Documentation |
| `chore(deps…)` | Dependencies |
| `build:` | Build |
| `chore:` / `ci:` / `test:` / `style:` / `chore(release)` | omitted |

## Before tagging

1. **What the release carries is merged into `dev`**, CI green.
2. **The scripts of [`tools/`](../tools) the changes call for have run**, their output
   committed to `dev`. Each runs in a container (the host needs Docker only); its header
   says how:

   | Script | When |
   |---|---|
   | `tools/generate-api/run.sh` | the API changed: the OpenAPI file and the client it generates |
   | `tools/live-check/run.sh` | a live screen changed: a room played for real, its pictures kept |
   | `tools/screenshots/run.sh` | a screen changed: the screenshots the README, the site and Docker Hub show |
   | `tools/sample-media/run.sh` | a sample quiz's media list changed: its files fetched and prepared |
3. **`dev` goes into `main` with a merge commit**, never a squash, so that `main` keeps
   `dev` in its history. If `main` has commits `dev` lacks, merge it into `dev` first.
4. **CI is green on `main`**: the release does not wait for it.
5. **Tag** (above), then write the **Upgrading** section when the release needs one.
