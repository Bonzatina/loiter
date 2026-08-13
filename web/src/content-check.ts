import { CITIES, contentRoot, assetsRoot } from './cities'
import { loadWikiPages, type WikiPage } from './wiki'
import fsSync from 'fs'

// ── Content check ────────────────────────────────────────────────────────────
// `npm run check` — exercises the multi-root loader against every city's real
// content and reports what it found. Not a content lint (each subproject lints
// its own wiki): this checks the aggregator's assumptions about the data.
//
//   · every content root and assets root is present (submodules checked out)
//   · no duplicate page slug WITHIN a city — that would make one page unreachable
//   · cross-city slug collisions — the reason routes are namespaced by city
//   · pages with no usable coords, which appear in the list but get no marker

const pad = (s: string | number, n: number): string => String(s).padEnd(n)

function byType(pages: WikiPage[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const p of pages) counts.set(p.type, (counts.get(p.type) ?? 0) + 1)
  return counts
}

async function main(): Promise<void> {
  const loaded = new Map<string, WikiPage[]>()
  let problems = 0

  console.log('\n── Roots ' + '─'.repeat(60))
  for (const city of CITIES) {
    const content = contentRoot(city)
    const assets = assetsRoot(city)
    const cOk = fsSync.existsSync(content)
    const aOk = fsSync.existsSync(assets)
    const card = fsSync.existsSync(`${assets}/${city.cardImage}`)
    if (!cOk || !aOk || !card) problems++
    console.log(
      `  ${pad(city.slug, 12)} content ${cOk ? 'ok' : 'MISSING'}   ` +
      `assets ${aOk ? 'ok' : 'MISSING'}   card ${card ? 'ok' : 'MISSING'}`,
    )
  }

  console.log('\n── Pages ' + '─'.repeat(60))
  for (const city of CITIES) {
    const pages = await loadWikiPages(city)
    loaded.set(city.slug, pages)

    const counts = byType(pages)
    const withCoords = pages.filter(p => p.coords).length
    const withEn = pages.filter(p => p.enTitle).length
    const types = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${t} ${n}`)
      .join(', ')

    console.log(
      `  ${pad(city.slug, 12)} ${pad(pages.length + ' pages', 12)}` +
      `${pad(withCoords + ' mapped', 12)}${pad(withEn + ' en', 9)}${types}`,
    )

    // A duplicate slug inside one city makes one of the two pages unreachable:
    // both /{city}/{slug} and every [[wikilink]] to it resolve to the first hit.
    const seen = new Map<string, WikiPage>()
    for (const p of pages) {
      const key = p.slug.toLowerCase()
      const prev = seen.get(key)
      if (prev) {
        problems++
        console.log(`      ! duplicate slug "${p.slug}"`)
        console.log(`        ${prev.filePath}`)
        console.log(`        ${p.filePath}`)
      } else {
        seen.set(key, p)
      }
    }
  }

  // ── Cross-subproject collisions ────────────────────────────────────────────
  // Not a problem — it is the justification for the /{city}/{slug} namespace.
  // Reported so the count stays visible if anyone proposes flattening the routes.
  //
  // Keyed by SUBPROJECT, not by site. Five sites serve the rural wiki, and its
  // cross-region concepts and people appear in all of them by design; that is one
  // page reachable at five URLs, not a name clash, and counting it as one buried the
  // real collisions under fifty-odd false ones.
  const dirOf = new Map(CITIES.map(c => [c.slug, c.dir]))
  const owners = new Map<string, Set<string>>()
  for (const [slug, pages] of loaded) {
    const dir = dirOf.get(slug)!
    for (const p of pages) {
      const key = p.slug.toLowerCase()
      const set = owners.get(key) ?? new Set<string>()
      set.add(dir)
      owners.set(key, set)
    }
  }
  const shared = [...owners.entries()]
    .filter(([, dirs]) => dirs.size > 1)
    .map(([slug, dirs]) => [slug, [...dirs]] as [string, string[]])

  console.log('\n── Cross-city slug collisions ' + '─'.repeat(39))
  if (shared.length === 0) {
    console.log('  none')
  } else {
    console.log(`  ${shared.length} slug(s) used by more than one subproject — city namespace required:`)
    for (const [slug, cities] of shared.sort()) {
      console.log(`    ${pad(slug, 34)} ${cities.join(', ')}`)
    }
  }

  const total = [...loaded.values()].reduce((n, p) => n + p.length, 0)
  console.log('\n── Total ' + '─'.repeat(60))
  console.log(`  ${total} pages across ${CITIES.length} sites`)
  console.log(problems === 0
    ? '  no problems found\n'
    : `  ${problems} problem(s) found\n`)

  process.exit(problems === 0 ? 0 : 1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
