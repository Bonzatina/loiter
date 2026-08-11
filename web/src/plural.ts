import type { Lang } from './lang'

/** The three forms a countable noun needs to agree with a Russian numeral. */
export interface PluralForms {
  /** 1 страница / 1 page */
  one: string
  /** 2–4 страницы — Russian only; English reuses `many` */
  few: string
  /** 5–20 страниц / 2 pages */
  many: string
}

/**
 * Agrees a noun with a count. Russian needs all three forms and the rule is not
 * "n === 1": 121 takes the singular, 23 the paucal, and everything from 11 to 14
 * the genitive plural regardless of its last digit.
 *
 *   1, 21, 121  → страница
 *   2, 23, 104  → страницы
 *   5, 11, 514  → страниц
 */
export function plural(n: number, lang: Lang, forms: PluralForms): string {
  if (lang === 'en') return n === 1 ? forms.one : forms.many

  const mod100 = Math.abs(n) % 100
  if (mod100 >= 11 && mod100 <= 14) return forms.many

  const mod10 = mod100 % 10
  if (mod10 === 1) return forms.one
  if (mod10 >= 2 && mod10 <= 4) return forms.few
  return forms.many
}
