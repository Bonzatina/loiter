import path from 'path'
import { fileURLToPath } from 'url'
import { berlinAbout } from './about/berlin'
import { bratislavaAbout } from './about/bratislava'
import { budapestAbout } from './about/budapest'
import { dresdenAbout } from './about/dresden'
import { wroclawAbout } from './about/wroclaw'
import { ruralAbout } from './about/rural'
import type { AboutData } from './about/types'
import type { Lang, Localized } from './lang'
import { CITY_TAXONOMY, RURAL_TAXONOMY, type Taxonomy } from './taxonomy'
import { NO_ROUTES, RURAL_ROUTES, type RouteLine } from './map-routes'

// ── The site registry ────────────────────────────────────────────────────────
// The ONLY place in this app where a site's name, coordinate, timezone or storage
// key may appear. Everything the standalone engines used to hard-code lives here
// as data; the engine itself never learns a site's name. Adding one is a single
// entry below plus the submodule — no other code change.
//
// "City" in the type and collection names is historical: the registry now also
// holds the rural wiki, which is a set of regions rather than a city. The `kind`
// field is what code should branch on when the difference matters (it matters in
// two places: how the picker groups its cards, and how the switcher groups its
// list). Renaming City → Site throughout is a worthwhile follow-up, kept separate
// from this change so that a live deployment is not refactored and extended in
// the same commit.
//
// The bulky about-page prose and source lists sit in ./about/{slug}.ts, one file
// per site, and are referenced from the `about` field: they are site data too,
// just too long to keep this table readable.

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Family root — the directory holding web/ and every wiki_* subproject. */
export const FAMILY_ROOT = path.resolve(__dirname, '../..')

export type { Lang, Localized }

export interface City {
  /** URL segment: /{slug}, /en/{slug}, /{slug}/assets/… */
  slug: string
  /** Subproject directory name under FAMILY_ROOT. */
  dir: string
  /**
   * A single city, or a set of rural regions. Only the picker and the switcher
   * care — everything else is driven by `taxonomy`.
   */
  kind: 'city' | 'rural'
  /**
   * Which geography this site speaks: district/quarter or region/subregion. The
   * loader normalises both into `area`/`subarea`, so nothing downstream branches.
   */
  taxonomy: Taxonomy
  /** Railway and ferry lines drawn on the map. Empty for every city. */
  routes: RouteLine[]
  /** Brand shown in the header, <title> and note-mail subject. */
  brand: string
  /** City name for the switcher and the picker cards. */
  name: Localized
  /** Initial map view. */
  center: [number, number]
  zoom: number
  /** sessionStorage key for the saved map state. Bump the suffix to invalidate. */
  stateKey: string
  /** IANA zone used to stamp the note mail. */
  timezone: string
  /**
   * Label for the area row of the note mail (the mail is Russian-only).
   * Berlin's districts are Bezirke — «Округ»; the rural wiki has «Регион»;
   * everywhere else «Район».
   */
  districtLabel: string
  /**
   * Legend domains this city actually has objects for. A subset selector, not a
   * colour table: the colours live once in constants.ts. This is how `thermal`
   * appears in Budapest and stays hidden everywhere else.
   */
  domains: string[]
  /** Filename inside this city's assets, used for the picker card. */
  cardImage: string
  about: AboutData
}

/** Registry order = display order in the picker and the switcher. */
export const CITIES: City[] = [
  {
    slug: 'berlin',
    dir: 'wiki_berlin',
    kind: 'city',
    taxonomy: CITY_TAXONOMY,
    routes: NO_ROUTES,
    brand: 'Loiter: Berlin',
    name: { ru: 'Берлин', en: 'Berlin' },
    center: [52.5200, 13.4050],
    zoom: 11,
    stateKey: 'berlin_map_state_v1',
    timezone: 'Europe/Berlin',
    districtLabel: 'Округ',
    domains: ['museums', 'nature', 'lookout'],
    cardImage: 'brandenburger-tor.jpg',
    about: berlinAbout,
  },
  {
    slug: 'bratislava',
    dir: 'wiki_bratislava',
    kind: 'city',
    taxonomy: CITY_TAXONOMY,
    routes: NO_ROUTES,
    brand: 'Loiter: Bratislava',
    name: { ru: 'Братислава', en: 'Bratislava' },
    center: [48.1486, 17.1077],
    zoom: 12,
    stateKey: 'bratislava_map_state_v1',
    timezone: 'Europe/Bratislava',
    districtLabel: 'Район',
    domains: ['museums', 'nature', 'lookout'],
    cardImage: 'bratislavsky-hrad.jpg',
    about: bratislavaAbout,
  },
  {
    slug: 'dresden',
    dir: 'wiki_dresden',
    kind: 'city',
    taxonomy: CITY_TAXONOMY,
    routes: NO_ROUTES,
    brand: 'Loiter: Dresden',
    name: { ru: 'Дрезден', en: 'Dresden' },
    center: [51.0500, 13.7400],
    zoom: 12,
    stateKey: 'dresden_map_state_v1',
    timezone: 'Europe/Berlin',
    districtLabel: 'Район',
    domains: ['museums', 'nature', 'lookout'],
    cardImage: 'frauenkirche.jpg',
    about: dresdenAbout,
  },
  {
    slug: 'budapest',
    dir: 'wiki_budapest',
    kind: 'city',
    taxonomy: CITY_TAXONOMY,
    routes: NO_ROUTES,
    brand: 'Loiter: Budapest',
    name: { ru: 'Будапешт', en: 'Budapest' },
    center: [47.4979, 19.0402],
    zoom: 13,
    stateKey: 'budapest_map_state_v1',
    timezone: 'Europe/Budapest',
    districtLabel: 'Район',
    // The only city with thermal baths — hence the only one showing the filter.
    domains: ['museums', 'nature', 'thermal', 'lookout'],
    cardImage: 'halaszbastya.jpg',
    about: budapestAbout,
  },
  {
    slug: 'wroclaw',
    dir: 'wiki_wroclav',
    kind: 'city',
    taxonomy: CITY_TAXONOMY,
    routes: NO_ROUTES,
    brand: 'Loiter: Wrocław',
    name: { ru: 'Вроцлав', en: 'Wrocław' },
    center: [51.1100, 17.0325],
    zoom: 12,
    stateKey: 'wroclaw_map_state_v1',
    timezone: 'Europe/Warsaw',
    districtLabel: 'Район',
    domains: ['museums', 'nature', 'lookout'],
    cardImage: 'rynek.jpg',
    about: wroclawAbout,
  },
  {
    // Not a city: 31 rural regions across Hungary, Slovakia and Burgenland. The
    // slug is a new URL for the combined site only — the subproject keeps its own
    // name, folder and repository, and renaming it is a separate open question.
    slug: 'rural',
    dir: 'wiki_rural_travel',
    kind: 'rural',
    taxonomy: RURAL_TAXONOMY,
    routes: RURAL_ROUTES,
    brand: 'Loiter: Rural Travel',
    // Left untranslated on purpose: the project's naming is still undecided, and
    // inventing a Russian label here would pre-empt that decision.
    name: { ru: 'Rural Travel', en: 'Rural Travel' },
    center: [47.7800, 18.9500],
    zoom: 10,
    stateKey: 'rural_map_state_v1',
    timezone: 'Europe/Budapest',
    districtLabel: 'Регион',
    // Museums (135 pages) and thermal baths (12) were invisible on the rural map
    // before: its own engine gave them no colour, so they were drawn as ordinary
    // olive sights while the city maps showed them purple and orange. `transport`
    // covers the railway and ferry page types too.
    domains: ['museums', 'nature', 'thermal', 'lookout', 'transport'],
    cardImage: 'esztergomi-var.jpg',
    about: ruralAbout,
  },
]

// ── Derived paths ────────────────────────────────────────────────────────────
// The family layout is a fixed convention, so these are derived from `dir`
// rather than repeated per city: a wrong path is then impossible to write.

/** Where this city's markdown lives — read-only from here. */
export const contentRoot = (city: City): string =>
  path.join(FAMILY_ROOT, city.dir, 'wiki')

/** Where this city's images live — served at /{slug}/assets. */
export const assetsRoot = (city: City): string =>
  path.join(FAMILY_ROOT, city.dir, 'web', 'assets')

// ── Lookup ───────────────────────────────────────────────────────────────────

const BY_SLUG = new Map(CITIES.map(c => [c.slug, c]))

export const getCity = (slug: string): City | undefined =>
  BY_SLUG.get(slug.toLowerCase())

export const isCitySlug = (slug: string): boolean => BY_SLUG.has(slug.toLowerCase())

/**
 * Top-level URL segments the router owns. A city slug must never collide with
 * one, or `/{city}` would shadow a real route — checked at startup below.
 */
export const RESERVED_SEGMENTS = ['en', 'about', 'assets', 'styles', 'scripts', 'note', 'cities']

for (const city of CITIES) {
  if (RESERVED_SEGMENTS.includes(city.slug)) {
    throw new Error(`City slug "${city.slug}" collides with a reserved route segment`)
  }
  if (!/^[a-z][a-z0-9-]*$/.test(city.slug)) {
    throw new Error(`City slug "${city.slug}" must be lowercase ASCII, digits and hyphens`)
  }
}
if (BY_SLUG.size !== CITIES.length) {
  throw new Error('Duplicate city slug in the registry')
}
