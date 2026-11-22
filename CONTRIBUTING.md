# Contributing

Thanks for helping! A few things make a pull request easy to take in.

## Branches

- **Start from `dev` and open the pull request against `dev`.** `main` holds the
  last release; `dev` is where the next one is built. GitHub offers `main` by
  default: change the base before creating the pull request.
- One subject per pull request. For anything larger than a fix, say what you
  plan in the issue first: the design may already be decided in
  [`specifications/`](specifications/README.md).

## Before you push

- Setting up: [README › Development](README.md#development).
- `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat(import): …`, `fix(game): …`); a git hook checks them.
- A changed API: regenerate the client with `pnpm generate:api` and commit it
  (`tools/generate-api/run.sh` does it in a container when the host cannot).
- A changed live screen: `tools/live-check/run.sh` plays a room for real on the demo
  stack (console, projection, a phone), checks it and keeps the pictures;
  `LIVE_CHECK_STACK=dev` runs it on the dev stack, through its identity provider when it
  is in OIDC.
- Code, comments, commits and documentation are in English; user-facing text
  goes through the translations, in every language of `apps/frontend/src/i18n/locales`.
- A database migration ships a `down.sql` beside its `migration.sql`, and runs again
  over what that down leaves: the rules are in
  [SPECIFICATIONS-ROLLBACK §3](specifications/SPECIFICATIONS-ROLLBACK.md);
  `pnpm --filter @quiz-dock/backend rollback:check` tries them (the CI does too). If
  `prisma migrate dev` says a `20261119…` migration was modified after it was applied,
  it was made to run again before its release: set its checksum in your database,
  `UPDATE _prisma_migrations SET checksum = '<sha256 of its migration.sql>' WHERE
  migration_name = '<its name>';`.
