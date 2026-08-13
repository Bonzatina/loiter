import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { contentRoot, type City } from './cities'
import { FAME_LEVELS } from './constants'

// ── Multi-root content loader ────────────────────────────────────────────────
// One content root per site, each the `wiki/` directory of a subproject. The
// loader is read-only: nothing here ever writes into a subproject.
//
// The folder convention comes from the site's taxonomy, so no site needs a code
// change to gain an area — every top-level directory that is not one of the
// taxonomy's `flatDirs` is an area, read through its `typeDirs` subfolders.
//
// Two frontmatter dialects arrive here — `district`/`quarter` from the cities and
// `region`/`subregion` from the rural wiki — and both are normalised into ONE
// internal pair, `area`/`subarea`. Nothing downstream has to know which it got.

export interface WikiPage {
  /** Site slug this page belongs to. Pages are never mixed across sites. */
  city: string
  /** Filename without the .md extension — the URL segment and wikilink target. */
  slug: string
  /** Absolute path on disk. Server-side only: never sent to the client. */
  filePath: string
  title: string
  enTitle?: string
  type: string
  /** Normalised from `district:` (cities) or `region:` (rural). */
  area?: string
  /** Normalised from `quarter:` (cities) or `subregion:` (rural). */
  subarea?: string
  coords?: [number, number]
  domain?: string
  /**
   * How mass-touristic this object is: 1 almost unknown, 5 what every guidebook
   * opens with. Ranked within its own site, seeded from Wikipedia language coverage.
   * Absent on most pages — the fame slider treats unrated pages as always visible.
   */
  fame?: number
  tags?: string[]
}

/** The page shape the map client receives — `filePath` deliberately dropped. */
export type ClientPage = Omit<WikiPage, 'filePath'>

/**
 * Coordinates must be a pair of finite numbers to be usable as a marker. A
 * malformed pair is dropped with a warning rather than passed to the client,
 * where it would produce a broken or unplaceable marker.
 */
function readCoords(raw: unknown, where: string): [number, number] | undefined {
  if (raw === undefined || raw === null) return undefined
  const ok = Array.isArray(raw) && raw.length === 2
    && raw.every(n => typeof n === 'number' && Number.isFinite(n))
  if (!ok) {
    console.warn(`[wiki] ignoring malformed coords in ${where}: ${JSON.stringify(raw)}`)
    return undefined
  }
  return [raw[0] as number, raw[1] as number]
}

async function readDir(city: City, dir: string): Promise<WikiPage[]> {
  const pages: WikiPage[] = []
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return pages   // absent directory is normal: not every city has every folder
  }
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue
    if (entry.endsWith('.en.md')) continue
    const filePath = path.join(dir, entry)
    const raw = await fs.readFile(filePath, 'utf-8')
    const { data } = matter(raw)
    if (!data.title) continue

    // The English title is read eagerly so the map list can label markers in EN
    // without touching disk per request.
    let enTitle: string | undefined
    try {
      const enRaw = await fs.readFile(filePath.replace(/\.md$/, '.en.md'), 'utf-8')
      enTitle = matter(enRaw).data.title as string | undefined
    } catch {}

    const slug = entry.replace(/\.md$/, '')
    const { areaField, subareaField } = city.taxonomy
    pages.push({
      city: city.slug,
      slug,
      filePath,
      title: data.title as string,
      enTitle,
      type: (data.type as string) ?? 'unknown',
      area: data[areaField] as string | undefined,
      subarea: data[subareaField] as string | undefined,
      coords: readCoords(data.coords, `${city.slug}/${slug}`),
      domain: data.domain as string | undefined,
      fame: typeof data.fame === 'number' && data.fame >= 1 && data.fame <= FAME_LEVELS
        ? data.fame
        : undefined,
      tags: data.tags as string[] | undefined,
    })
  }
  return pages
}

/**
 * Case- and diacritic-insensitive key for an area name. `Hortobágy` the region page,
 * `hortobágy` the folder and `hortobagy` in a frontmatter field all have to agree.
 */
const areaKey = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

async function loadCity(city: City): Promise<WikiPage[]> {
  const root = contentRoot(city)
  const { flatDirs, ignoreDirs, typeDirs } = city.taxonomy

  // A site may cover only part of its subproject — see `areas` in the registry.
  const wanted = city.areas ? new Set(city.areas.map(areaKey)) : null

  // Cross-area directories. Their pages are shared by every site out of this
  // subproject, EXCEPT the area overview pages themselves, which belong to whichever
  // site covers them. An overview page names the area it stands for in its own `area`
  // field when its filename differs from the folder slug; otherwise its slug is the
  // name.
  const flatPages = (await Promise.all(
    flatDirs.map(d => readDir(city, path.join(root, d))),
  )).flat().filter(p => {
    if (!wanted || p.type !== city.taxonomy.areaType) return true
    return wanted.has(areaKey(p.area ?? p.slug))
  })

  // Discover area directories: any top-level dir that is not a flat one.
  let topEntries: string[]
  try {
    topEntries = await fs.readdir(root)
  } catch {
    // A missing content root means the submodule is not checked out. Serve the
    // site empty rather than taking the whole thing down with it.
    console.warn(`[wiki] content root missing for "${city.slug}": ${root}`)
    return flatPages
  }

  // Every top-level directory that is not flat content and not explicitly ignored
  // counts as an area. `ignoreDirs` exists because the default is "treat it as an
  // area", which would otherwise probe the rural wiki's `sources/` and `raw/` for
  // area subfolders.
  const skip = new Set([...flatDirs, ...ignoreDirs])
  const areaDirs: string[] = []
  for (const entry of topEntries) {
    if (skip.has(entry)) continue
    if (wanted && !wanted.has(areaKey(entry))) continue
    const full = path.join(root, entry)
    const stat = await fs.stat(full).catch(() => null)
    if (stat?.isDirectory()) areaDirs.push(full)
  }

  const areaPages = (await Promise.all(
    areaDirs.flatMap(ad => typeDirs.map(t => readDir(city, path.join(ad, t)))),
  )).flat()

  return [...flatPages, ...areaPages]
}

// ── Cache ────────────────────────────────────────────────────────────────────
// Per city, so a change in one city's content does not cost a reload of the
// other four. In-flight loads are shared: a burst of first requests must not
// start five concurrent walks of the same tree.

const cache = new Map<string, WikiPage[]>()
const inFlight = new Map<string, Promise<WikiPage[]>>()
const watched = new Set<string>()

/**
 * Drops a city's cache whenever any `.md` under its root changes, so content
 * edited in a subproject shows up on the next request with no restart.
 */
function watchCity(city: City): void {
  if (watched.has(city.slug)) return
  watched.add(city.slug)
  const root = contentRoot(city)
  if (!fsSync.existsSync(root)) return
  try {
    fsSync.watch(root, { recursive: true }, (_event, filename) => {
      if (typeof filename === 'string' && filename.endsWith('.md')) {
        cache.delete(city.slug)
      }
    }).unref()
  } catch (err) {
    console.warn(`[wiki] cannot watch "${city.slug}": ${String(err)}`)
  }
}

export async function loadWikiPages(city: City): Promise<WikiPage[]> {
  const hit = cache.get(city.slug)
  if (hit) return hit

  const pending = inFlight.get(city.slug)
  if (pending) return pending

  const load = loadCity(city)
    .then(pages => {
      cache.set(city.slug, pages)
      watchCity(city)
      return pages
    })
    .finally(() => inFlight.delete(city.slug))

  inFlight.set(city.slug, load)
  return load
}

// ── Lookup ───────────────────────────────────────────────────────────────────

/**
 * Case-insensitive page lookup, matching the standalone engines: links written
 * with different capitalisation than the filename still resolve.
 */
export async function findPage(city: City, slug: string): Promise<WikiPage | undefined> {
  const pages = await loadWikiPages(city)
  const wanted = slug.toLowerCase()
  return pages.find(p => p.slug.toLowerCase() === wanted)
}

/** Page count for the picker card. */
export async function pageCount(city: City): Promise<number> {
  return (await loadWikiPages(city)).length
}

/** Strips the server-only fields before the page list is handed to the client. */
export function toClientPages(pages: WikiPage[]): ClientPage[] {
  return pages.map(({ filePath, ...rest }) => rest)
}
