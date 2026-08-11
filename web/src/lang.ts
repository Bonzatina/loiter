/**
 * The two languages of every Loiter site. Russian is the base language and
 * English the `.en.md` mirror; a page with no translation falls back to Russian
 * while navigation stays in the English context.
 */
export type Lang = 'ru' | 'en'

/** A string that exists in both languages. */
export interface Localized {
  ru: string
  en: string
}
