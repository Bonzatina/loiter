import path from 'path'
import { fileURLToPath } from 'url'
import { berlinAbout } from './about/berlin'
import { bratislavaAbout } from './about/bratislava'
import { budapestAbout } from './about/budapest'
import { dresdenAbout } from './about/dresden'
import { wroclawAbout } from './about/wroclaw'
import { viennaAbout } from './about/vienna'
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
  /**
   * Optional: serve only these top-level area folders out of `dir`.
   *
   * Several sites may share one subproject. The rural wiki spans 377 km east to west,
   * far more than one map can show — at its old single starting view 413 of its 772
   * mapped objects were off screen, Balaton and Burgenland among them — so it is
   * presented as five landscape clusters, each with its own map, while remaining one
   * repository with one history and one standalone app.
   *
   * Omit to serve every area in `dir`, which is what each city does.
   */
  areas?: string[]
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
  // Slug ≠ dir again, as with Wrocław: the folder was created as `wiki_viena`
  // and the repository carries that spelling, while readers get /vienna.
  {
    slug: 'vienna',
    dir: 'wiki_viena',
    kind: 'city',
    taxonomy: CITY_TAXONOMY,
    routes: NO_ROUTES,
    brand: 'Loiter: Wien',
    name: { ru: 'Вена', en: 'Vienna' },
    center: [48.2082, 16.3738],
    zoom: 12,
    stateKey: 'vienna_map_state_v1',
    timezone: 'Europe/Vienna',
    districtLabel: 'Район',
    domains: ['museums', 'nature', 'lookout'],
    cardImage: 'stephansdom.jpg',
    about: viennaAbout,
  },
  // ── The rural wiki, presented as five landscapes ───────────────────────────
  //
  // One repository, one history, one standalone app — five sites here. It spans
  // 377 km east to west and 257 north to south, and a single map could not show it:
  // at the old starting view 413 of its 772 mapped objects were off screen, Balaton
  // (113) and Burgenland (80) among them. Splitting the presentation gives each
  // landscape a map that actually frames it.
  //
  // The clusters are landscapes, not countries. Burgenland belongs with Bratislava's
  // hinterland — Eisenstadt is 40 km away and was Kismarton in the same county — and
  // splitting by modern border would contradict the subproject's own premise, which
  // is cultural continuity across them.
  //
  // `concepts/` and `people/` are cross-region and shared by all five: a note on
  // timber framing belongs to every landscape it appears in.
  //
  // Centres and zooms are computed from each cluster's own content, not guessed.
  {
    slug: 'dunakanyar',
    dir: 'wiki_rural_travel',
    kind: 'rural',
    taxonomy: RURAL_TAXONOMY,
    routes: RURAL_ROUTES,
    areas: ['dunakanyar', 'pilis', 'gerecse', 'gödöllői-dombság', 'velence', 'del-duna'],
    brand: 'Loiter: Излучина Дуная',
    name: { ru: 'Излучина Дуная', en: 'Danube Bend' },
    center: [47.3325, 18.7856],
    zoom: 9,
    stateKey: 'dunakanyar_map_state_v1',
    timezone: 'Europe/Budapest',
    districtLabel: 'Регион',
    // Museums and thermal baths were invisible on the rural map before: its own
    // engine gave them no colour, so they drew as ordinary olive sights while the
    // city maps showed them purple and orange. `transport` covers the railway and
    // ferry page types too.
    domains: ['museums', 'nature', 'thermal', 'lookout', 'transport'],
    cardImage: 'fellegvar-visegrad.jpg',
    about: ruralAbout,
  },
  {
    slug: 'male-karpaty',
    dir: 'wiki_rural_travel',
    kind: 'rural',
    taxonomy: RURAL_TAXONOMY,
    routes: RURAL_ROUTES,
    areas: ['podunajsko', 'záhorie', 'male-karpaty', 'považie', 'ponitrie', 'burgenland', 'römerland'],
    brand: 'Loiter: Малые Карпаты и Бургенланд',
    name: { ru: 'Малые Карпаты и Бургенланд', en: 'Little Carpathians & Burgenland' },
    center: [47.9613, 17.5159],
    zoom: 8,
    stateKey: 'male_karpaty_map_state_v1',
    timezone: 'Europe/Bratislava',
    districtLabel: 'Регион',
    domains: ['museums', 'nature', 'thermal', 'lookout', 'transport'],
    cardImage: 'cerveny-kamen-castle.jpg',
    about: ruralAbout,
  },
  {
    slug: 'balaton',
    dir: 'wiki_rural_travel',
    kind: 'rural',
    taxonomy: RURAL_TAXONOMY,
    routes: RURAL_ROUTES,
    areas: ['balaton', 'bakony', 'kisalföld'],
    brand: 'Loiter: Балатон и Задунавье',
    name: { ru: 'Балатон и Задунавье', en: 'Balaton & Transdanubia' },
    center: [47.1535, 17.4863],
    zoom: 8,
    stateKey: 'balaton_map_state_v1',
    timezone: 'Europe/Budapest',
    districtLabel: 'Регион',
    domains: ['museums', 'nature', 'thermal', 'lookout', 'transport'],
    cardImage: 'egry-jozsef-kilato-badacsony.jpg',
    about: ruralAbout,
  },
  {
    // Named for the landscapes, not for a state. «Верхняя Венгрия» / Felvidék is
    // historically exact and unusable here: in present-day usage it carries an
    // irredentist edge that would read badly to a Slovak reader, and it also
    // misdirects a traveller by naming a country that has not existed for a century
    // for territory that is now in another one. «Средняя и Восточная Словакия» was
    // the obvious replacement and is wrong too — Hollókő, a UNESCO village, and the
    // Drégely castle sit inside this cluster on the Hungarian side of the border.
    // «Рудогорье» is qualified as Slovak because the bare name would collide with the
    // Erzgebirge, which this family also covers, next to Dresden.
    slug: 'spis-rudohorie',
    dir: 'wiki_rural_travel',
    kind: 'rural',
    taxonomy: RURAL_TAXONOMY,
    routes: RURAL_ROUTES,
    areas: ['stiavnicke-vrchy', 'banskobystricky', 'novohrad', 'gemer', 'spiš', 'šariš', 'zemplín', 'abaujtorna'],
    brand: 'Loiter: Спиш и Словацкое Рудогорье',
    name: { ru: 'Спиш и Словацкое Рудогорье', en: 'Spiš & the Slovak Ore Mountains' },
    center: [48.6741, 20.2406],
    zoom: 8,
    stateKey: 'spis_rudohorie_map_state_v1',
    timezone: 'Europe/Bratislava',
    districtLabel: 'Регион',
    domains: ['museums', 'nature', 'thermal', 'lookout', 'transport'],
    cardImage: 'mestsky-hrad-banska-bystrica.jpg',
    about: ruralAbout,
  },
  {
    slug: 'alfold',
    dir: 'wiki_rural_travel',
    kind: 'rural',
    taxonomy: RURAL_TAXONOMY,
    routes: RURAL_ROUTES,
    areas: ['kiskunság', 'tiszavidék', 'hortobágy', 'mátra', 'bükk'],
    brand: 'Loiter: Большая равнина',
    name: { ru: 'Большая равнина', en: 'Great Plain' },
    center: [47.6474, 20.1814],
    zoom: 8,
    stateKey: 'alfold_map_state_v1',
    timezone: 'Europe/Budapest',
    districtLabel: 'Регион',
    domains: ['museums', 'nature', 'thermal', 'lookout', 'transport'],
    cardImage: 'cifrapalota-kecskemet.jpg',
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
