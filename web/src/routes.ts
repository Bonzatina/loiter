import type { Lang } from './lang'

// ── URL builders ─────────────────────────────────────────────────────────────
// Language is the outermost segment, as in the standalone sites; the city slug
// namespaces everything below it. The namespace is not cosmetic: page slugs do
// collide across cities — `Hauptbahnhof` and `Kunstgewerbemuseum` each exist in
// both Berlin and Dresden — so a flat /:slug route would quietly serve the wrong
// city's page. `npm run check` reports the current collision list.

/** `/en` for English, empty for Russian. Prepended to every path below. */
export const langPrefix = (lang: Lang): string => (lang === 'en' ? '/en' : '')

/** The city picker — the only page that knows about more than one city. */
export const citiesUrl = (lang: Lang): string => langPrefix(lang) || '/'

/** A city's map page: the site's home once a city is chosen. */
export const homeUrl = (city: string, lang: Lang): string =>
  `${langPrefix(lang)}/${city}`

/** Project-level about page: shared info, no sources — there is no city context. */
export const projectAboutUrl = (lang: Lang): string => `${langPrefix(lang)}/about`

/** A city's about page: the same shared info plus that city's source list. */
export const aboutUrl = (city: string, lang: Lang): string =>
  `${langPrefix(lang)}/${city}/about`

/** Prefix that `[[wikilinks]]` in a page body resolve against. */
export const wikiPrefix = (city: string, lang: Lang): string =>
  `${langPrefix(lang)}/${city}`

export const wikiUrl = (city: string, slug: string, lang: Lang): string =>
  `${wikiPrefix(city, lang)}/${encodeURIComponent(slug)}`

/**
 * Images live in the subprojects and are served per city. Language-independent:
 * an image is the same file in both languages, so no `/en` prefix here.
 */
export const assetsPrefix = (city: string): string => `/${city}/assets`

/** Opens a city's map with one marker highlighted. */
export const mapHighlightUrl = (city: string, slug: string, lang: Lang): string =>
  `${homeUrl(city, lang)}?highlight=${encodeURIComponent(slug)}`
