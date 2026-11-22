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
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/** The first migration a rollback can undo (SPECIFICATIONS-ROLLBACK §2). */
const START = '20261119090000';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrations = join(backend, 'prisma', 'migrations');
const prismaBin = join(backend, 'node_modules', '.bin', 'prisma');
const server = new URL(process.env.DATABASE_URL ?? '');

const all = readdirSync(migrations, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const undoable = all.filter((name) => name >= START);

const missing = undoable.filter((name) => !existsSync(join(migrations, name, 'down.sql')));
if (missing.length > 0) {
  console.error(
    `Migrations without a down.sql (SPECIFICATIONS-ROLLBACK §3):\n  ${missing.join('\n  ')}`,
  );
  process.exit(1);
}

const urlOf = (db) => {
  const url = new URL(server);
  url.pathname = `/${db}`;
  return url.toString();
};
const admin = async (sql) => {
  const client = new pg.Client({ connectionString: server.toString() });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
};
const query = async (db, sql) => {
  const client = new pg.Client({ connectionString: urlOf(db) });
  await client.connect();
  try {
    return (await client.query(sql)).rows;
  } finally {
    await client.end();
  }
};

/** A migrations folder holding the first `count` migrations: a release as its image ships it. */
const work = mkdtempSync(join(tmpdir(), 'rollback-check-'));
const release = (count) => {
  const dir = join(work, `release-${count}`);
  const folder = join(dir, 'migrations');
  if (!existsSync(dir)) {
    // Copies: Prisma does not follow links to migration folders.
    mkdirSync(folder, { recursive: true });
    for (const name of all.slice(0, count))
      cpSync(join(migrations, name), join(folder, name), { recursive: true });
    cpSync(join(migrations, 'migration_lock.toml'), join(folder, 'migration_lock.toml'));
    writeFileSync(
      join(dir, 'prisma.config.mjs'),
      `export default {
  schema: ${JSON.stringify(join(backend, 'prisma', 'schema.prisma'))},
  migrations: { path: ${JSON.stringify(folder)} },
  datasource: { url: process.env.DATABASE_URL },
};\n`,
    );
  }
  return join(dir, 'prisma.config.mjs');
};
const deploy = (db, count) =>
  execFileSync(prismaBin, ['migrate', 'deploy', '--config', release(count)], {
    cwd: backend,
    env: { ...process.env, DATABASE_URL: urlOf(db) },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const fresh = async (db) => {
  await admin(`DROP DATABASE IF EXISTS "${db}"`);
  await admin(`CREATE DATABASE "${db}"`);
};

/** What a release reads and writes: its tables, columns, enums, constraints and indexes. */
const schemaOf = async (db) => {
  const rows = await query(
    db,
    `SELECT 'column ' || table_name || '.' || column_name || ' ' || data_type || '/' || udt_name
              || ' null=' || is_nullable || ' default=' || coalesce(column_default, '') AS item
       FROM information_schema.columns WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
     UNION ALL
     SELECT 'enum ' || t.typname || '.' || e.enumlabel
       FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
     UNION ALL
     SELECT 'constraint ' || conrelid::regclass || '.' || conname || ' ' || pg_get_constraintdef(oid)
       FROM pg_constraint WHERE connamespace = 'public'::regnamespace
     UNION ALL
     SELECT 'index ' || indexdef FROM pg_indexes WHERE schemaname = 'public'`,
  );
  return new Set(rows.map((r) => r.item));
};
const absent = (expected, actual) => [...expected].filter((item) => !actual.has(item));

const parts = (name) => {
  const file = join(migrations, name, 'down.test.sql');
  if (!existsSync(file)) return null;
  const [seed, rest = ''] = readFileSync(file, 'utf8').split(/^-- after down$/m);
  const [afterDown, afterUp = ''] = rest.split(/^-- after up again$/m);
  return { seed, afterDown, afterUp };
};

/** Undoes the migrations from `target` on, then upgrades again: what went wrong, if anything. */
const rehearse = async (target, upgraded) => {
  const index = all.indexOf(target);
  const undone = all.slice(index).reverse();
  const problems = [];

  const before = 'rollback_check_target';
  await fresh(before);
  deploy(before, index);
  const expected = await schemaOf(before);

  const db = 'rollback_check_work';
  await fresh(db);
  deploy(db, all.length);
  const tests = undone.map(parts);
  for (const t of tests) if (t?.seed.trim()) await query(db, t.seed);
  for (const name of undone) {
    await query(db, `BEGIN; ${readFileSync(join(migrations, name, 'down.sql'), 'utf8')}; COMMIT;`);
    await query(db, `DELETE FROM _prisma_migrations WHERE migration_name = '${name}'`);
  }
  for (const t of tests) if (t?.afterDown.trim()) await query(db, t.afterDown);

  const lost = absent(expected, await schemaOf(db));
  if (lost.length > 0) problems.push(`the release before misses\n    ${lost.join('\n    ')}`);
  const older = deploy(db, index);
  if (!/No pending migrations/.test(older))
    problems.push(`the release before applies migrations\n${older}`);

  deploy(db, all.length);
  for (const t of tests) if (t?.afterUp.trim()) await query(db, t.afterUp);
  const again = await schemaOf(db);
  const off = [
    ...absent(upgraded, again),
    ...absent(again, upgraded).map((i) => `ghost left: ${i}`),
  ];
  if (off.length > 0) problems.push(`up again, unlike a fresh upgrade\n    ${off.join('\n    ')}`);
  return problems;
};

const failures = [];
try {
  const latest = 'rollback_check_latest';
  await fresh(latest);
  deploy(latest, all.length);
  const upgraded = await schemaOf(latest);

  for (const target of [...undoable].reverse()) {
    const label = `back before ${target}`;
    const problems = await rehearse(target, upgraded).catch((err) => [err.stderr || err.message]);
    failures.push(...problems.map((p) => `${label}: ${p}`));
    console.log(`${problems.length > 0 ? '✗' : '✓'} ${label}`);
  }
} finally {
  for (const db of ['rollback_check_latest', 'rollback_check_target', 'rollback_check_work']) {
    await admin(`DROP DATABASE IF EXISTS "${db}"`).catch(() => undefined);
  }
  rmSync(work, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n${failures.join('\n\n')}`);
  process.exit(1);
}
console.log(`Rollback checks passed: ${undoable.length} migrations can be undone.`);
