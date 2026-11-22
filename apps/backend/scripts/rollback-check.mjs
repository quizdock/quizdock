#!/usr/bin/env node
/**
 * The rollback's checks (SPECIFICATIONS-ROLLBACK §5), on throwaway databases of the
 * server in DATABASE_URL:
 *
 * - every migration from the start of the rollback on ships its `down.sql`;
 * - for each of them, newest first: up, then the downs back to it, and the release
 *   before it finds its whole schema unchanged, the newer one's data left as ghosts;
 *   its `migrate deploy` has nothing to apply; up again gives the schema of a fresh
 *   upgrade, with no ghost left;
 * - a `down.test.sql` beside a `down.sql` checks what it does to rows: its part before
 *   `-- after down` seeds them once migrated, the next one checks them after the
 *   down, the part after `-- after up again` checks them once migrated again
 *   (an assertion raises, e.g. in a `DO` block).
 *
 *   pnpm --filter @quiz-dock/backend rollback:check
 */
import { all, attempt, undoable, withoutDown, withRehearsal } from './lib/rehearsal.mjs';

const missing = withoutDown();
if (missing.length > 0) {
  console.error(
    `Migrations without a down.sql (SPECIFICATIONS-ROLLBACK §3):\n  ${missing.join('\n  ')}`,
  );
  process.exit(1);
}

const failures = await withRehearsal(async (rehearsal) => {
  const found = [];
  for (const target of [...undoable].reverse()) {
    const label = `back before ${target}`;
    const problems = await attempt(() => rehearsal.rollback(all.indexOf(target)));
    found.push(...problems.map((p) => `${label}: ${p}`));
    console.log(`${problems.length > 0 ? '✗' : '✓'} ${label}`);
  }
  return found;
});

if (failures.length > 0) {
  console.error(`\n${failures.join('\n\n')}`);
  process.exit(1);
}
console.log(`Rollback checks passed: ${undoable.length} migrations can be undone.`);
