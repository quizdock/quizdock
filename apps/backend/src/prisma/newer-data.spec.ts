import { knownColumns, newerData } from './newer-data';

describe('newerData (SPECIFICATIONS-ROLLBACK)', () => {
  const known = new Map([
    ['question', new Set(['id', 'prompt'])],
    ['quiz', new Set(['id'])],
  ]);
  const db = (rows: { table: string; column: string }[]) => ({
    $queryRaw: jest.fn(async () => rows),
  });

  it('reads the tables and columns this release knows from its schema', () => {
    const question = knownColumns().get('question');
    expect(question).toContain('media_position');
    expect(question).toContain('prompt');
    // A relation is no column.
    expect(question).not.toContain('quiz');
  });

  it('nothing when the database is this release’s', async () => {
    const rows = [
      { table: 'question', column: 'id' },
      { table: 'question', column: 'prompt' },
      { table: 'quiz', column: 'id' },
    ];
    await expect(newerData(db(rows) as never, known)).resolves.toEqual([]);
  });

  it('names the columns and the tables a newer release left', async () => {
    const rows = [
      { table: 'question', column: 'id' },
      { table: 'question', column: 'hint' },
      { table: 'selection', column: 'id' },
      { table: 'selection', column: 'name' },
    ];
    await expect(newerData(db(rows) as never, known)).resolves.toEqual([
      'question.hint',
      'selection',
    ]);
  });

  it('this release’s schema finds nothing in a database it migrated', async () => {
    const rows = [...knownColumns()].flatMap(([table, columns]) =>
      [...columns].map((column) => ({ table, column })),
    );
    await expect(newerData(db(rows) as never)).resolves.toEqual([]);
  });
});
