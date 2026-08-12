// ── Taxonomies ───────────────────────────────────────────────────────────────
// The family speaks two shapes of geography. The city wikis nest places under a
// district and an optional quarter; the rural wiki nests them under a region and
// an optional sub-region, and adds heritage railways and ferries.
//
// The engine does not branch on which one it is looking at. Instead each site
// declares a taxonomy, the loader normalises both dialects into ONE internal pair
// of fields — `area` and `subarea` — and everything downstream reads only those.
// Adding a third shape means adding an entry here, not an `if` in the renderer.

export interface Taxonomy {
  /** Stable id; appears in comments, warnings and the content check. */
  id: 'city' | 'rural'

  /** Frontmatter field naming the top-level area on a sub-area or place page. */
  areaField: string
  /** Frontmatter field naming the optional named sub-area. */
  subareaField: string

  /** `type:` of a top-level area's own overview page. */
  areaType: string
  /** `type:` of a named sub-area page. */
  subareaType: string

  /** Directories directly under `wiki/` whose pages are read as cross-area content. */
  flatDirs: string[]
  /**
   * Directories under `wiki/` that are neither areas nor content. Needed because
   * every unlisted top-level directory is otherwise TREATED AS AN AREA and probed
   * for `typeDirs` — harmless today for the rural wiki's `sources/` and `raw/`,
   * which have no such subfolders, but only by luck. Naming them makes the intent
   * explicit and keeps a future `sources/places/` from quietly appearing.
   */
  ignoreDirs: string[]
  /** Type subdirectories expected inside every area folder. */
  typeDirs: string[]

  /**
   * Page types drawn as points but filtered by the `transport` legend button
   * rather than by a domain. Empty for cities, where transport is out of scope.
   */
  routeTypes: string[]

  /** Keys into UI_STRINGS for the list section headings. */
  labelKeys: { area: string; subarea: string }
}

export const CITY_TAXONOMY: Taxonomy = {
  id: 'city',
  areaField: 'district',
  subareaField: 'quarter',
  areaType: 'district',
  subareaType: 'quarter',
  // `sources/` is empty by convention in every city wiki (a .gitkeep) — sources
  // are registered centrally, not as pages. Read anyway, so a city that starts
  // keeping them is not silently ignored.
  flatDirs: ['districts', 'concepts', 'people', 'sources'],
  ignoreDirs: [],
  typeDirs: ['quarters', 'places'],
  routeTypes: [],
  labelKeys: { area: 'districts', subarea: 'quarters' },
}

export const RURAL_TAXONOMY: Taxonomy = {
  id: 'rural',
  areaField: 'region',
  subareaField: 'subregion',
  areaType: 'region',
  subareaType: 'settlement',
  // Deliberately WITHOUT `sources/`: unlike the cities, the rural wiki keeps a
  // page per source — 400 of them. Its own app loads them and then renders them
  // in no section at all, so they only ever bloated the payload. Not reading the
  // directory changes nothing a reader can see.
  flatDirs: ['regions', 'concepts', 'people'],
  // `raw/` holds 20 `type: article` pages that the rural engine's own flat list
  // does not include either, so they are invisible there too — surfacing them here
  // would show pages the subproject itself never shows. `topics/` is empty.
  ignoreDirs: ['sources', 'raw', 'topics'],
  typeDirs: ['settlements', 'places', 'railways', 'ferries'],
  routeTypes: ['railway', 'ferry'],
  labelKeys: { area: 'regions', subarea: 'settlements' },
}
