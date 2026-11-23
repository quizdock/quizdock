#!/usr/bin/env node
/**
 * Locale consistency check — `pnpm --filter @quiz-dock/frontend i18n:check`.
 *
 * Compares every locale under src/i18n/locales/ with the reference (`en`) and
 * prints a Markdown report on stdout:
 *   1. keys present in en/ but missing from a locale, and the reverse;
 *   2. `{{placeholder}}` sets that differ between en/ and a translation;
 *   3. values identical to the English one (probably untranslated).
 *
 * Plural forms (`key_one`, `key_other`, …) are compared on their base key, and a
 * locale is only required to provide the CLDR plural categories of its language
 * (e.g. `zh` has no `_one`). No file is ever modified.
 *
 * Exit code: 1 when keys are missing or placeholders differ (CI gate); identical
 * values are informational unless `--strict` is passed. A locale the app does
 * not ship yet (absent from `supportedLngs`, a translation in progress on
 * Weblate) may miss keys: English stands in until it is complete and listed. `LOCALES_DIR` overrides
 * the folder (self-test on a scratch copy).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REFERENCE = 'en';
const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];
const PLURAL_RE = new RegExp(`_(${PLURAL_CATEGORIES.join('|')})$`);
const PLACEHOLDER_RE = /\{\{\s*([^,}\s]+)[^}]*\}\}/g;

const strict = process.argv.includes('--strict');
const localesDir = process.env.LOCALES_DIR
  ? resolve(process.env.LOCALES_DIR)
  : resolve(dirname(fileURLToPath(import.meta.url)), '../src/i18n/locales');

// --- loading ---------------------------------------------------------------

/** Flattens a JSON object into `dotted.key → string` pairs. */
function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    // An empty value is an untranslated string (Weblate writes them so): absent.
    else if (v !== '') out.set(key, String(v));
  }
  return out;
}

/** `{ namespace → Map<key, value> }` for one locale folder. */
function loadLocale(lang) {
  const dir = join(localesDir, lang);
  const namespaces = {};
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    namespaces[file.replace(/\.json$/, '')] = flatten(
      JSON.parse(readFileSync(join(dir, file), 'utf8')),
    );
  }
  return namespaces;
}

const locales = readdirSync(localesDir)
  .filter((d) => statSync(join(localesDir, d)).isDirectory())
  .sort();
if (!locales.includes(REFERENCE)) {
  console.error(`Reference locale "${REFERENCE}" not found in ${localesDir}`);
  process.exit(2);
}
/** The languages the app ships, read from `RELEASED` in languages.ts. */
const shipped = new Set(
  [
    ...readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../src/i18n/languages.ts'),
      'utf8',
    )
      .match(/const RELEASED = \[([^\]]*)\]/)[1]
      .matchAll(/'([^']+)'/g),
  ].map((m) => m[1]),
);
const data = Object.fromEntries(locales.map((l) => [l, loadLocale(l)]));
const reference = data[REFERENCE];

// --- helpers ---------------------------------------------------------------

const baseKey = (key) => key.replace(PLURAL_RE, '');
const pluralCategory = (key) => key.match(PLURAL_RE)?.[1] ?? null;
const pluralCategoriesOf = (lang) => new Intl.PluralRules(lang).resolvedOptions().pluralCategories;

const placeholders = (value) =>
  [...value.matchAll(PLACEHOLDER_RE)]
    .map((m) => m[1])
    .sort()
    .join(', ');

/** Values that carry no language (numbers, placeholders only, symbols). */
const isLanguageNeutral = (value) => !/[\p{L}]{2,}/u.test(value.replace(PLACEHOLDER_RE, ''));

// --- checks ----------------------------------------------------------------

const report = [];
let hardFailures = 0;
let softFindings = 0;

const h = (level, text) => report.push(`${'#'.repeat(level)} ${text}`, '');
const table = (headers, rows) => {
  if (rows.length === 0) return report.push('_none_', '');
  report.push(`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`);
  for (const r of rows)
    report.push(`| ${r.map((c) => String(c).replace(/\|/g, '\\|')).join(' | ')} |`);
  report.push('');
};

h(1, `Locale check — reference \`${REFERENCE}\``);
report.push(`Locales: ${locales.map((l) => `\`${l}\``).join(', ')}`, '');

for (const lang of locales.filter((l) => l !== REFERENCE)) {
  const target = data[lang];
  const categories = pluralCategoriesOf(lang);
  const missing = [];
  const extra = [];
  const placeholderDiffs = [];
  const identical = [];

  const namespaces = new Set([...Object.keys(reference), ...Object.keys(target)]);
  for (const ns of [...namespaces].sort()) {
    const ref = reference[ns];
    const tgt = target[ns];
    if (!ref) {
      extra.push([ns, '(whole file)']);
      continue;
    }
    if (!tgt) {
      missing.push([ns, '(whole file)']);
      continue;
    }
    const tgtBases = new Set([...tgt.keys()].map(baseKey));
    const refBases = new Set([...ref.keys()].map(baseKey));

    for (const [key, value] of ref) {
      const cat = pluralCategory(key);
      if (cat) {
        // Plural key: the base must exist; each category the locale uses must too.
        if (!tgtBases.has(baseKey(key))) missing.push([ns, key]);
        else if (categories.includes(cat) && !tgt.has(key)) missing.push([ns, key]);
        continue;
      }
      if (!tgt.has(key)) {
        missing.push([ns, key]);
        continue;
      }
      const tv = tgt.get(key);
      const ph = placeholders(value);
      const tph = placeholders(tv);
      if (ph !== tph) placeholderDiffs.push([ns, key, ph || '—', tph || '—']);
      if (tv === value && !isLanguageNeutral(value)) identical.push([ns, key, value]);
    }
    for (const key of tgt.keys()) {
      const cat = pluralCategory(key);
      if (cat ? !refBases.has(baseKey(key)) : !ref.has(key)) extra.push([ns, key]);
    }
    // Plural variants: compare placeholders on the shared forms too, but for
    // `{{count}}`: i18next always passes it, and a form may spell the number
    // instead ("1 error") or need it where English does not (Russian `_one`
    // also covers 21, 31…).
    const withoutCount = (list) =>
      list
        .split(', ')
        .filter((p) => p && p !== 'count')
        .join(', ');
    for (const [key, tv] of tgt) {
      if (pluralCategory(key) && ref.has(key)) {
        const ph = withoutCount(placeholders(ref.get(key)));
        const tph = withoutCount(placeholders(tv));
        if (ph !== tph) placeholderDiffs.push([ns, key, ph || '—', tph || '—']);
        if (tv === ref.get(key) && !isLanguageNeutral(tv)) identical.push([ns, key, tv]);
      }
    }
  }

  const inProgress = !shipped.has(lang);
  hardFailures += (inProgress ? 0 : missing.length) + extra.length + placeholderDiffs.length;
  softFindings += identical.length;

  h(
    2,
    `\`${lang}\`${inProgress ? ' (in progress, not shipped: missing keys allowed)' : ''} — ${missing.length} missing, ${extra.length} extra, ${placeholderDiffs.length} placeholder mismatch(es), ${identical.length} identical to English`,
  );
  h(3, `Missing in \`${lang}\` (present in \`${REFERENCE}\`)`);
  table(['namespace', 'key'], missing);
  h(3, `Extra in \`${lang}\` (absent from \`${REFERENCE}\`)`);
  table(['namespace', 'key'], extra);
  h(3, 'Placeholder mismatches');
  table(['namespace', 'key', `\`${REFERENCE}\``, `\`${lang}\``], placeholderDiffs);
  h(3, 'Identical to English (possibly untranslated)');
  table(['namespace', 'key', 'value'], identical);
}

h(2, 'Result');
report.push(
  hardFailures
    ? `❌ ${hardFailures} blocking issue(s) (missing/extra keys, placeholder mismatches).`
    : '✅ Keys and placeholders are consistent across locales.',
  softFindings
    ? `ℹ️ ${softFindings} value(s) identical to English${strict ? ' (blocking with --strict)' : ''}.`
    : '',
  '',
);

process.stdout.write(report.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n'));
process.exit(hardFailures || (strict && softFindings) ? 1 : 0);
