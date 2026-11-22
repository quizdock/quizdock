/**
 * Upgrades and rollbacks played for real on throwaway databases of the server in
 * DATABASE_URL (SPECIFICATIONS-ROLLBACK §5): what `rollback-check` and `release-check`
 * share. A release is the first `count` migrations of the folder, as its image ships them.
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
export const START = '20261119090000';

export const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const migrations = join(backend, 'prisma', 'migrations');
const prismaBin = join(backend, 'node_modules', '.bin', 'prisma');

/** The migrations of the folder, oldest first. */
export const all = readdirSync(migrations, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
/** Those a rollback can undo; each must ship its `down.sql`. */
export const undoable = all.filter((name) => name >= START);
export const withoutDown = () =>
  undoable.filter((name) => !existsSync(join(migrations, name, 'down.sql')));
/** Whether the release of the first `count` migrations can be reached through the `down.sql`. */
export const reachable = (count) => all.slice(count).every((name) => name >= START);

const DATABASES = ['rehearsal_latest', 'rehearsal_target', 'rehearsal_work'];

/** Runs `body` with a rehearsal, then drops its databases and folders. */
export async function withRehearsal(body) {
  const server = new URL(process.env.DATABASE_URL ?? '');
  const urlOf = (db) => {
    const url = new URL(server);
    url.pathname = `/${db}`;
    return url.toString();
  };
  const run = async (connectionString, sql) => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      return (await client.query(sql)).rows;
    } finally {
      await client.end();
    }
  };
  const admin = (sql) => run(server.toString(), sql);
  const query = (db, sql) => run(urlOf(db), sql);

  const work = mkdtempSync(join(tmpdir(), 'rehearsal-'));
  const release = (count) => {
    const dir = join(work, `release-${count}`);
    const folder = join(dir, 'migrations');
    if (!existsSync(dir)) {
      // Copies: Prisma does not follow links to migration folders.
      mkdirSync(folder, { recursive: true });
      for (const name of all.slice(0, count)) {
        cpSync(join(migrations, name), join(folder, name), { recursive: true });
      }
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
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
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
  const indented = (items) => items.map((i) => `\n    ${i}`).join('');

  const parts = (name) => {
    const file = join(migrations, name, 'down.test.sql');
    if (!existsSync(file)) return null;
    const [seed, rest = ''] = readFileSync(file, 'utf8').split(/^-- after down$/m);
    const [afterDown, afterUp = ''] = rest.split(/^-- after up again$/m);
    return { seed, afterDown, afterUp };
  };

  let latest = null;
  /** The schema of a fresh upgrade to the last migration. */
  const upgraded = async () => {
    if (!latest) {
      await fresh('rehearsal_latest');
      deploy('rehearsal_latest', all.length);
      latest = await schemaOf('rehearsal_latest');
    }
    return latest;
  };

  const rehearsal = {
    /**
     * From the last migration back to the release of the first `count`: its whole schema
     * found again, its `migrate deploy` with nothing to apply; then up again, as a fresh
     * upgrade with no ghost left. The `down.test.sql` of the migrations undone run on the
     * way. What went wrong, if anything.
     */
    async rollback(count) {
      const problems = [];
      const undone = all.slice(count).reverse();
      await fresh('rehearsal_target');
      deploy('rehearsal_target', count);
      const expected = await schemaOf('rehearsal_target');

      const db = 'rehearsal_work';
      await fresh(db);
      deploy(db, all.length);
      const tests = undone.map(parts);
      for (const t of tests) if (t?.seed.trim()) await query(db, t.seed);
      for (const name of undone) {
        await query(
          db,
          `BEGIN; ${readFileSync(join(migrations, name, 'down.sql'), 'utf8')}; COMMIT;`,
        );
        await query(db, `DELETE FROM _prisma_migrations WHERE migration_name = '${name}'`);
      }
      for (const t of tests) if (t?.afterDown.trim()) await query(db, t.afterDown);

      const lost = absent(expected, await schemaOf(db));
      if (lost.length > 0) problems.push(`the release before misses${indented(lost)}`);
      const older = deploy(db, count);
      if (!/No pending migrations/.test(older)) {
        problems.push(`the release before applies migrations\n${older}`);
      }

      deploy(db, all.length);
      for (const t of tests) if (t?.afterUp.trim()) await query(db, t.afterUp);
      const again = await schemaOf(db);
      const full = await upgraded();
      const off = [...absent(full, again), ...absent(again, full).map((i) => `ghost left: ${i}`)];
      if (off.length > 0) problems.push(`up again, unlike a fresh upgrade${indented(off)}`);
      return problems;
    },

    /** From the release of the first `count` migrations up to the last: as a fresh upgrade. */
    async upgrade(count) {
      const db = 'rehearsal_work';
      await fresh(db);
      deploy(db, count);
      deploy(db, all.length);
      const again = await schemaOf(db);
      const full = await upgraded();
      const off = [...absent(full, again), ...absent(again, full).map((i) => `left over: ${i}`)];
      return off.length > 0 ? [`unlike a fresh upgrade${indented(off)}`] : [];
    },
  };

  try {
    return await body(rehearsal);
  } finally {
    for (const db of DATABASES)
      await admin(`DROP DATABASE IF EXISTS "${db}"`).catch(() => undefined);
    rmSync(work, { recursive: true, force: true });
  }
}

/** Runs a step of a rehearsal: its problems, or the error it stopped on. */
export const attempt = (step) => step().catch((err) => [String(err.stderr || err.message).trim()]);
