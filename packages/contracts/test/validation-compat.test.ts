import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('patched Zod security and compatibility', () => {
  it.each(['array', 'set', 'map'] as const)(
    'rejects an oversized %s before parsing its elements',
    (kind) => {
      let checked = 0;
      const item = z.custom(() => {
        checked++;
        return true;
      });
      const schemas = {
        array: z.array(item).max(1),
        set: z.set(item).max(1),
        map: z.map(item, item).max(1),
      };
      const inputs = {
        array: ['a', 'b'],
        set: new Set(['a', 'b']),
        map: new Map([
          ['a', 'first'],
          ['b', 'second'],
        ]),
      };
      expect(schemas[kind].safeParse(inputs[kind]).success).toBe(false);
      expect(checked).toBe(0);
    },
  );

  it('keeps nullable primitives as anyOf for the existing OpenAPI adapter', () => {
    const schema = z.toJSONSchema(z.string().nullable());
    expect(schema.anyOf).toEqual([{ type: 'string' }, { type: 'null' }]);
    expect(schema.type).toBeUndefined();
  });

  it('preserves the UTC timestamp forms accepted by published quiz bundles', () => {
    const timestamp = z.iso.datetime();
    for (const valid of ['2026-10-30T12:00Z', '2026-10-30T12:00:00.123Z']) {
      expect(timestamp.safeParse(valid).success).toBe(true);
    }
    for (const invalid of ['2026-02-30T12:00Z', '2026-10-30T12:00', 'not a date']) {
      expect(timestamp.safeParse(invalid).success).toBe(false);
    }
  });
});
