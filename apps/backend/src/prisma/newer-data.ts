import { Prisma, type PrismaClient } from '@prisma/client';

/** The tables and columns this release knows, from its Prisma schema. */
export function knownColumns(
  models: readonly Prisma.DMMF.Model[] = Prisma.dmmf.datamodel.models,
): Map<string, Set<string>> {
  return new Map(
    models.map((m) => [
      m.dbName ?? m.name,
      new Set(m.fields.filter((f) => f.kind !== 'object').map((f) => f.dbName ?? f.name)),
    ]),
  );
}

/**
 * The tables and columns of the database this release does not know: what a newer
 * release left there after a rollback (SPECIFICATIONS-ROLLBACK §1, its ghosts). Prisma's
 * own tables (`_…`) are not counted. Empty when the database is this release's.
 */
export async function newerData(
  prisma: Pick<PrismaClient, '$queryRaw'>,
  known = knownColumns(),
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ table: string; column: string }[]>`
    SELECT table_name AS "table", column_name AS "column"
    FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name NOT LIKE '\\_%'`;
  const unknown = new Set<string>();
  for (const { table, column } of rows) {
    const columns = known.get(table);
    if (!columns) unknown.add(table);
    else if (!columns.has(column)) unknown.add(`${table}.${column}`);
  }
  return [...unknown].sort();
}
