import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { contentRoot, type City } from './cities'

// ── Multi-root content loader ────────────────────────────────────────────────
// One content root per city, each the `wiki/` directory of a subproject. The
// loader is read-only: nothing here ever writes into a subproject.
//
// The folder convention is the same as in the standalone engines, so no city
// needs a code change to gain a district — every top-level directory that is not
// one of FLAT_DIRS is a district, read through its `quarters/` and `places/`
// subfolders.

export interface WikiPage {
  /** City slug this page belongs to. Pages are never mixed across cities. */
  city: string
  /** Filename without the .md extension — the URL segment and wikilink target. */
  slug: string
  /** Absolute path on disk. Server-side only: never sent to the client. */
  filePath: string
  title: string
  enTitle?: string
  type: string
  district?: string
  quarter?: string
  coords?: [number, number]
  domain?: string
  tags?: string[]
}

/** The page shape the map client receives — `filePath` deliberately dropped. */
export type ClientPage = Omit<WikiPage, 'filePath'>

/**
 * Flat cross-district directories: not nested under a district folder.
 * `districts/` holds the district overview pages themselves.
 */
const FLAT_DIRS = ['districts', 'concepts', 'people', 'sources']

/**
 * Type subdirectories expected inside each district folder. `quarters` are named
 * areas (grouped by district in the list), `places` specific attractions.
 * Transport is out of scope in every city wiki.
 */
const TYPE_DIRS = ['quarters', 'places']

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
    pages.push({
      city: city.slug,
      slug,
      filePath,
      title: data.title as string,
      enTitle,
      type: (data.type as string) ?? 'unknown',
      district: data.district as string | undefined,
      quarter: data.quarter as string | undefined,
      coords: readCoords(data.coords, `${city.slug}/${slug}`),
      domain: data.domain as string | undefined,
      tags: data.tags as string[] | undefined,
    })
  }
  return pages
}

async function loadCity(city: City): Promise<WikiPage[]> {
  const root = contentRoot(city)

  // Flat cross-district directories.
  const flatPages = (await Promise.all(
    FLAT_DIRS.map(d => readDir(city, path.join(root, d))),
  )).flat()

  // Discover district directories: any top-level dir that is not a flat one.
  let topEntries: string[]
  try {
    topEntries = await fs.readdir(root)
  } catch {
    // A missing content root means the submodule is not checked out. Serve the
    // city empty rather than taking the whole site down with it.
    console.warn(`[wiki] content root missing for "${city.slug}": ${root}`)
    return flatPages
  }

  const districtDirs: string[] = []
  for (const entry of topEntries) {
    if (FLAT_DIRS.includes(entry)) continue
    const full = path.join(root, entry)
    const stat = await fs.stat(full).catch(() => null)
    if (stat?.isDirectory()) districtDirs.push(full)
  }

  const districtPages = (await Promise.all(
    districtDirs.flatMap(dd => TYPE_DIRS.map(t => readDir(city, path.join(dd, t)))),
  )).flat()

  return [...flatPages, ...districtPages]
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
