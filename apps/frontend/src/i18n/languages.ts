// The languages and namespaces, apart from `index.ts`: importing them does not
// initialise i18next again.

import { appConfig } from '../config';

/** The namespaces, one file each per language. */
export const namespaces = [
  'common',
  'dashboard',
  'editor',
  'live',
  'join',
  'sessions',
  'store',
  'themes',
  'selections',
  'auth',
  'errors',
  'validation',
  'admin',
] as const;

/** The languages the interface is released in (`UI_LANGUAGES`, `APP_LANG`). */
const RELEASED = [
  'en',
  'fr',
  'es',
  'zh',
  'zh-TW',
  'tr',
  'de',
  'hi',
  'it',
  'ja',
  'pl',
  'ru',
] as const;
export type AppLang = (typeof RELEASED)[number];

/**
 * A translation staging (built with `VITE_LOCALES_IN_PROGRESS=all`) offers too the
 * locales still being translated — a folder under `locales/` not released yet — so
 * that their translators see their work; their missing keys fall back on English.
 * Any other build offers the released ones only.
 */
const IN_PROGRESS =
  import.meta.env.VITE_LOCALES_IN_PROGRESS === 'all'
    ? Object.keys(import.meta.glob('./locales/*/common.json'))
        .map((path) => path.split('/')[2])
        .filter((tag) => !(RELEASED as readonly string[]).includes(tag))
    : [];

/** The languages offered: the released ones, and on a staging those in progress. */
export const supportedLngs = [...RELEASED, ...IN_PROGRESS] as readonly AppLang[];
export type Namespace = (typeof namespaces)[number];

/** A language's name in the interface's language (`fr` → "French" in English), for a menu. */
export function languageName(tag: string, interfaceLang: string): string {
  try {
    return new Intl.DisplayNames([interfaceLang], { type: 'language' }).of(tag) ?? tag;
  } catch {
    return tag; // not a tag Intl knows
  }
}

const DEFAULT_LANG: AppLang = 'en';

/**
 * Langue de l'instance : valeur d'`APP_LANG` (via `appConfig.lang`) si supportée,
 * sinon repli `en`. **En test, on épingle `fr`** (les assertions existantes sont
 * rédigées en français) pour rester déterministe.
 */
export function resolveLang(): AppLang {
  if (import.meta.env.MODE === 'test') return 'fr';
  const configured = appConfig.lang;
  return (supportedLngs as readonly string[]).includes(configured)
    ? (configured as AppLang)
    : DEFAULT_LANG;
}

/** The two Chinese scripts, as their readers name them: the region would say less. */
const NATIVE: Partial<Record<string, string>> = { zh: '中文（简体）', 'zh-TW': '中文（繁體）' };

/**
 * A language in its own words (`fr` → Français), for a language menu: one finds one's
 * own in a list one cannot read.
 */
export function nativeName(tag: string): string {
  const own = NATIVE[tag] ?? languageName(tag, tag);
  return own.charAt(0).toLocaleUpperCase(tag) + own.slice(1);
}
