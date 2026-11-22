#!/usr/bin/env node
/**
 * What a tag must pass before anything is published (docs/releasing.md), against the
 * stable tags before it, on throwaway databases of the server in DATABASE_URL:
 *
 * 1. a released migration is frozen: its `migration.sql` as the last release shipped it;
 * 2. the new migrations come after the last released one;
 * 3. a patch adds no migration;
 * 4. from each release of the window (the three minors before, their patches, and the
 *    patches before in the same minor), an upgrade gives the schema of a fresh one;
 * 5. back to each of them, the rollback through the `down.sql` (SPECIFICATIONS-ROLLBACK
 *    §5), where they reach; elsewhere it says the restore point is the way;
 * 6. a column or table a new migration drops was marked `@deprecated` in the schema of
 *    the oldest release of the window (roadmap §1, schema deprecation).
 *
 *   pnpm --filter @quiz-dock/backend release:check v0.18.0
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { all, attempt, backend, migrations, reachable, withRehearsal } from './lib/rehearsal.mjs';

const MINORS_BACK = 3;
const FOLDER = 'apps/backend/prisma/migrations';
const SCHEMA = 'apps/backend/prisma/schema.prisma';

const git = (...args) =>
  execFileSync('git', ['-c', 'safe.directory=*', '-C', join(backend, '..', '..'), ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const parse = (tag) => {
  const m = /^v(\d+)\.(\d+)\.(\d+)(-.+)?$/.exec(tag);
  return m && { tag, major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? '' };
};
const before = (a, b) =>
  a.major - b.major || a.minor - b.minor || a.patch - b.patch || (a.pre && !b.pre ? -1 : 0);

const current = parse(process.argv[2] ?? '');
if (!current) {
  console.error('usage: release-check vX.Y.Z[-rc.N]');
  process.exit(2);
}
const stable = git('tag', '--list', 'v*')
  .split('\n')
  .map(parse)
  .filter((t) => t && !t.pre && before(t, current) < 0)
  .sort(before);
const previous = stable.at(-1);
const window = stable.filter(
  (t) => t.major === current.major && t.minor >= current.minor - MINORS_BACK,
);

const shipped = (tag) =>
  git('ls-tree', '--name-only', `${tag}:${FOLDER}`)
    .split('\n')
    .filter((name) => /^\d{14}_/.test(name))
    .sort();

const failures = [];
const notices = [];

if (previous) {
  const released = shipped(previous.tag);
  // 1. Frozen: Prisma would take a changed one silently, and installs would part ways.
  for (const name of released) {
    const path = `${FOLDER}/${name}/migration.sql`;
    let now = null;
    try {
      now = readFileSync(join(migrations, name, 'migration.sql'), 'utf8');
    } catch {
      // gone: said below
    }
    if (now === null) failures.push(`${name}: released in ${previous.tag}, gone since`);
    else if (now !== git('show', `${previous.tag}:${path}`)) {
      failures.push(`${name}: released in ${previous.tag}, its migration.sql changed since`);
    }
  }
  // 2. After the last released one: a late branch must not slip one in before.
  const last = released.at(-1) ?? '';
  const added = all.filter((name) => !released.includes(name));
  for (const name of added.filter((name) => name < last)) {
    failures.push(`${name}: new, but older than ${last}, released in ${previous.tag}`);
  }
  // 3. A patch fixes; a migration comes with a minor.
  if (current.patch > 0 && added.length > 0) {
    failures.push(`${current.tag} is a patch and adds migrations: ${added.join(', ')}`);
  }
  // 6. Drops of what the window's oldest release still declared without @deprecated.
  const oldest = window[0] ?? previous;
  const declared = declarations(git('show', `${oldest.tag}:${SCHEMA}`));
  for (const name of added) {
    for (const drop of drops(readFileSync(join(migrations, name, 'migration.sql'), 'utf8'))) {
      const found = declared.get(drop);
      if (found && !found.deprecated) {
        failures.push(
          `${name} drops ${drop}, not marked @deprecated in ${oldest.tag}: a rollback to it would lose it`,
        );
      }
    }
  }
}

// 4 and 5, played for real.
await withRehearsal(async (rehearsal) => {
  const seen = new Map();
  for (const release of window) {
    const names = shipped(release.tag);
    const count = names.length;
    if (names.some((name, i) => all[i] !== name)) {
      failures.push(`${release.tag}: its migrations are not the first ${count} of the folder`);
      continue;
    }
    if (!seen.has(count)) {
      const problems = [...(await attempt(() => rehearsal.upgrade(count)))];
      if (reachable(count)) problems.push(...(await attempt(() => rehearsal.rollback(count))));
      seen.set(count, problems);
    }
    const problems = seen.get(count);
    failures.push(...problems.map((p) => `${release.tag}: ${p}`));
    const back = reachable(count) ? 'rollback' : 'rollback through a restore point only';
    if (!reachable(count)) notices.push(`${release.tag}: ${back}`);
    console.log(`${problems.length > 0 ? '✗' : '✓'} ${release.tag}: upgrade, ${back}`);
  }
});

for (const n of notices) console.log(`  note — ${n}`);
if (failures.length > 0) {
  console.error(`\n${current.tag} cannot be released:\n\n${failures.join('\n\n')}`);
  process.exit(1);
}
console.log(`${current.tag} can be released (after ${previous?.tag ?? 'no release'}).`);

/** The `"table"` and `"table"."column"` a migration drops. */
function drops(sql) {
  const found = [];
  for (const statement of sql.split(';')) {
    const table = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?"(\w+)"/i.exec(statement)?.[1];
    if (table) {
      for (const m of statement.matchAll(/DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?"(\w+)"/gi)) {
        found.push(`${table}.${m[1]}`);
      }
    }
    for (const m of statement.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?"(\w+)"/gi)) {
      found.push(m[1]);
    }
  }
  return found;
}

/**
 * The tables and columns a Prisma schema declares, by their database names, and whether
 * a `///` comment above them marks them `@deprecated`.
 */
function declarations(schema) {
  const found = new Map();
  let doc = '';
  let model = null;
  for (const raw of schema.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('///')) {
      doc += line;
      continue;
    }
    const opened = /^model\s+(\w+)\s*\{/.exec(line);
    if (opened) {
      model = {
        name: opened[1],
        table: opened[1],
        deprecated: doc.includes('@deprecated'),
        fields: [],
      };
    } else if (model && line === '}') {
      found.set(model.table, { deprecated: model.deprecated });
      for (const f of model.fields) {
        found.set(`${model.table}.${f.column}`, { deprecated: model.deprecated || f.deprecated });
      }
      model = null;
    } else if (model) {
      const mapped = /^@@map\("(\w+)"\)/.exec(line);
      const field = /^(\w+)\s+(\w+)/.exec(line);
      if (mapped) model.table = mapped[1];
      else if (field && !line.startsWith('@@')) {
        const column = /@map\("(\w+)"\)/.exec(line)?.[1] ?? field[1];
        model.fields.push({ column, deprecated: doc.includes('@deprecated') });
      }
    }
    doc = '';
  }
  return found;
}
