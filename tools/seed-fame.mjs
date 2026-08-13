#!/usr/bin/env node
// ── Seed the `fame:` rating from Wikidata ────────────────────────────────────
//
// `fame` says how mass-touristic an object is, 1 (almost unknown) to 5 (what every
// guidebook opens with). The slider on the map uses it to filter places, so the
// value has to mean something — and the honest source of "how widely is this known"
// is how many Wikipedia language editions bothered to write about it. The
// Frauenkirche has 48; the Cholerabrunnen next to it has 2.
//
// The rating is RELATIVE TO ITS OWN SITE. "The least touristy thing in Dresden" is a
// different question from "the least touristy thing in Europe", and the slider is
// per site, so the bucket comes from the percentile of an object's sitelink count
// among that site's own objects.
//
// Usage:
//   node tools/seed-fame.mjs wiki_dresden --dry-run
//   node tools/seed-fame.mjs wiki_bratislava
//   node tools/seed-fame.mjs wiki_bratislava --force     # overwrite hand-edited values
//
// --force is deliberately required: once a rating has been corrected by hand, a
// re-seed must not silently undo that. The automatic match gets roughly nine in ten
// right, and the misses need a human.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(ROOT, '.wikidata-cache')

const FAME_LEVELS = 5

/**
 * Per site: the language whose Wikidata labels to match against (the wikis name
 * objects in the local language), and the item for the settlement itself, which must
 * never be matched — it is the most linked thing in any city box, so a loose match
 * against it would rate a side street as the city's top attraction.
 */
const SITES = {
  wiki_berlin:     { lang: 'de', cityQid: 'Q64' },
  wiki_bratislava: { lang: 'sk', cityQid: 'Q1780' },
  wiki_budapest:   { lang: 'hu', cityQid: 'Q1781' },
  wiki_dresden:    { lang: 'de', cityQid: 'Q1731' },
  wiki_wroclav:    { lang: 'pl', cityQid: 'Q1799' },
  // wiki_rural_travel spans Hungary, Slovakia and Austria; one bounding box over all
  // of it would pull hundreds of thousands of items. It needs per-region boxes, which
  // is a separate job.
}

const args = process.argv.slice(2)
const site = args.find(a => !a.startsWith('--'))
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')
const refetch = args.includes('--refetch')

if (!site || !SITES[site]) {
  console.error(`usage: node tools/seed-fame.mjs <${Object.keys(SITES).join(' | ')}> [--dry-run] [--force] [--refetch]`)
  process.exit(2)
}
const { lang, cityQid } = SITES[site]

// ── Read the site's place pages ──────────────────────────────────────────────

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.md') && !e.name.endsWith('.en.md')) out.push(p)
  }
  return out
}

const pages = []
for (const file of walk(path.join(ROOT, site, 'wiki'))) {
  const text = fs.readFileSync(file, 'utf8')
  const end = text.indexOf('\n---', 4)
  if (end < 0) continue
  const fm = text.slice(0, end)
  if (!/^type:\s*place\s*$/m.test(fm)) continue
  const title = (fm.match(/^title:\s*(.+)$/m) ?? [])[1]?.trim() ?? ''
  const c = fm.match(/^coords:\s*\[\s*([0-9.+-]+)\s*,\s*([0-9.+-]+)\s*\]/m)
  const slug = path.basename(file, '.md')
  // Titles read «Русское название (Original)»; the parenthetical is the local name,
  // which is what Wikidata labels it by.
  const paren = (title.match(/\(([^)]+)\)/) ?? [])[1] ?? ''
  // The Russian part of the title counts as a name too, now that Russian labels are
  // fetched: «Михальская башня (Michalská veža)» offers two independent chances to match.
  const russian = title.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  pages.push({
    file, slug, title,
    names: [paren, slug.replace(/-/g, ' '), russian].filter(Boolean),
    lat: c ? Number(c[1]) : null,
    lon: c ? Number(c[2]) : null,
    hasFame: /^fame:/m.test(fm),
  })
}
if (!pages.length) { console.error(`${site}: no place pages found`); process.exit(1) }

// ── Bounding box, derived from the pages themselves ──────────────────────────
// No hand-written coordinates per city: the wiki already knows where it is. Padded
// so an object slightly outside the outermost marker is still covered.

const withCoords = pages.filter(p => p.lat != null)
const PAD = 0.03   // ≈3 km
const box = {
  swLat: Math.min(...withCoords.map(p => p.lat)) - PAD,
  swLon: Math.min(...withCoords.map(p => p.lon)) - PAD,
  neLat: Math.max(...withCoords.map(p => p.lat)) + PAD,
  neLon: Math.max(...withCoords.map(p => p.lon)) + PAD,
}
const boxDeg = (box.neLat - box.swLat) * (box.neLon - box.swLon)

// ── Fetch ────────────────────────────────────────────────────────────────────

fs.mkdirSync(CACHE, { recursive: true })
const cacheFile = path.join(CACHE, `${site}-${lang}.json`)

async function fetchItems() {
  // Aliases matter as much as labels. Wikidata calls the Blue Church by its official
  // name, `Kostol svätej Alžbety`; `Modrý kostolík` — what everyone including this
  // wiki actually calls it — is only an altLabel. Without aliases the most recognisable
  // building in Bratislava went unmatched.
  // Names are collected in the local language, in Russian and in English, labels and
  // aliases alike. Russian matters because these wikis title their pages in Russian:
  // «Михальская башня (Michalská veža)». Until Russian labels were included, only the
  // parenthetical could ever match, and a page whose local name diverges from
  // Wikidata's — a museum known by its building, a gallery by its society — had nothing
  // to match on at all.
  const query = `
SELECT ?item ?label (GROUP_CONCAT(DISTINCT ?name; separator="|") AS ?names) ?lat ?lon ?sitelinks WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(${box.swLon.toFixed(4)} ${box.swLat.toFixed(4)})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(${box.neLon.toFixed(4)} ${box.neLat.toFixed(4)})"^^geo:wktLiteral .
  }
  ?item wikibase:sitelinks ?sitelinks .
  ?item p:P625/psv:P625 ?node .
  ?node wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon .
  OPTIONAL { ?item rdfs:label ?label . FILTER(LANG(?label) = "${lang}") }
  OPTIONAL {
    { ?item rdfs:label ?name . FILTER(LANG(?name) IN ("${lang}", "ru", "en")) }
    UNION
    { ?item skos:altLabel ?name . FILTER(LANG(?name) IN ("${lang}", "ru")) }
  }
} GROUP BY ?item ?label ?lat ?lon ?sitelinks`
  const res = await fetch('https://query.wikidata.org/sparql?format=json', {
    method: 'POST',
    headers: {
      'User-Agent': 'LoiterWiki/1.0 (https://github.com/Bonzatina/loiter; martymckul@gmail.com)',
      'Accept': 'application/sparql-results+json',
      'Content-Type': 'application/sparql-query',
    },
    body: query,
  })
  if (!res.ok) throw new Error(`WDQS HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  return json.results.bindings.map(b => ({
    qid: b.item.value.split('/').pop(),
    label: b.label?.value ?? '',
    alts: (b.names?.value ?? '').split('|').filter(Boolean),
    lat: Number(b.lat.value),
    lon: Number(b.lon.value),
    sitelinks: Number(b.sitelinks.value),
  }))
}

let items
if (!refetch && fs.existsSync(cacheFile)) {
  items = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
  console.log(`cache: ${items.length} Wikidata items (${cacheFile}; --refetch to renew)`)
} else {
  console.log(`querying Wikidata for a ${boxDeg.toFixed(3)}° box around ${site}…`)
  items = await fetchItems()
  fs.writeFileSync(cacheFile, JSON.stringify(items))
  console.log(`fetched ${items.length} items -> cached`)
}

// ── Matching ─────────────────────────────────────────────────────────────────

// Cyrillic is kept, not stripped: Russian names have to survive normalisation to be
// comparable at all. Latin and Cyrillic simply never match each other, which is fine —
// the score is the best over every pair of names, so each side finds its own alphabet.
const ascii = s => s
  .toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/ё/g, 'е')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9а-я]+/g, ' ')
  .trim()

const STOP = new Set([
  'der', 'die', 'das', 'zu', 'zur', 'in', 'im', 'am', 'an', 'von', 'und', 'st', 'sankt',
  'a', 'az', 'es', 'na', 'do', 'i', 'w', 'we', 'sv', 'svateho', 'svaty',
])
const tokens = s => ascii(s).split(' ').filter(w => w && !STOP.has(w))

function jaccard(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b))
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  return inter / (A.size + B.size - inter)
}

/** With proximity to corroborate it, "one name contains the other" is useful. */
function similarity(a, b) {
  const sa = ascii(a), sb = ascii(b)
  if (!sa || !sb) return 0
  if (sa === sb) return 1
  const j = jaccard(a, b)
  if (sa.includes(sb) || sb.includes(sa)) return Math.max(j, 0.85)
  return j
}

const metres = (aLat, aLon, bLat, bLon) => {
  const R = 6371000, rad = d => d * Math.PI / 180
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const MAX_M = 500, NAME_STRONG = 0.55, NAME_WEAK = 0.34, NEAR_M = 90
const NAME_ONLY_JACCARD = 0.60

// ── Areas must not be matched as places ──────────────────────────────────────
// A borough carries far more sitelinks than anything inside it, and often shares a
// name with its landmark: the Devín amphitheatre matched the Devín borough (34) and
// came out as the most touristic thing in the city, which is the opposite of true.
// The exclusion set is built from the site's OWN area pages, so it needs no
// hand-written list and stays right as boroughs are added.
const areaNames = new Set()
for (const file of walk(path.join(ROOT, site, 'wiki'))) {
  const text = fs.readFileSync(file, 'utf8')
  const end = text.indexOf('\n---', 4)
  if (end < 0) continue
  const fm = text.slice(0, end)
  if (!/^type:\s*(district|region|quarter|settlement)\s*$/m.test(fm)) continue
  const title = (fm.match(/^title:\s*(.+)$/m) ?? [])[1] ?? ''
  const paren = (title.match(/\(([^)]+)\)/) ?? [])[1] ?? ''
  // «Девин (Devín, Bratislava IV)» → the first comma-separated part is the name.
  for (const cand of [paren.split(',')[0], path.basename(file, '.md').replace(/-/g, ' ')]) {
    const k = ascii(cand)
    if (k) areaNames.add(k)
  }
}

/** Every name an item answers to, minus the ones that name an area of this site. */
function itemNames(it) {
  // `alts` is tolerated as absent: a cache written before aliases were queried is
  // still usable, just without them.
  return [it.label, ...(it.alts ?? [])].filter(n => n && !areaNames.has(ascii(n)))
}

const results = pages.map(p => ({ p, hit: null, pass: 0, why: p.lat == null ? 'no coords' : 'no match nearby' }))

// Pass 1 — proximity, corroborated by the name.
for (const r of results) {
  if (r.p.lat == null) continue
  let best = null
  for (const it of items) {
    if (it.qid === cityQid) continue
    const names = itemNames(it)
    if (!names.length) continue
    const d = metres(r.p.lat, r.p.lon, it.lat, it.lon)
    if (d > MAX_M) continue
    let sim = 0
    for (const a of r.p.names) for (const b of names) sim = Math.max(sim, similarity(a, b))
    if (!(sim >= NAME_STRONG || (sim >= NAME_WEAK && d <= NEAR_M))) continue
    const score = sim * 2 - d / 1000
    if (!best || score > best.score) best = { it, d, sim, score }
  }
  if (best) { r.hit = best; r.pass = 1; r.why = '' }
}

// Pass 2 — name only, for pages that carry no coordinates. Some wikis deliberately
// omit them when several pages share one building's marker, and those can be the most
// visited museums in the city. Containment must NOT count here: without proximity to
// check it, `Kunsthaus Dresden` matched `Dresden` itself.
for (const r of results) {
  if (r.hit || r.p.lat != null) continue
  let best = null
  for (const it of items) {
    if (it.qid === cityQid) continue
    const names = itemNames(it)
    if (!names.length) continue
    let sim = 0
    for (const a of r.p.names) for (const b of names) sim = Math.max(sim, jaccard(a, b))
    if (sim < NAME_ONLY_JACCARD) continue
    const score = sim * 100 + it.sitelinks
    if (!best || score > best.score) best = { it, d: null, sim, score }
  }
  if (best) { r.hit = best; r.pass = 2; r.why = '' }
}

// Pass 3 — proximity alone, at very short range. Names fail for a whole class of
// objects that are known by something other than their own name: the clock museum is
// Wikidata's `Dom U dobrého pastiera`, the house it occupies; Galéria Umelka is
// `Umelecká beseda slovenská`, the society that built it; Michalská veža is
// `Michalská brána`, one word apart and rejected by seven thousandths of a threshold.
// All four sit within nine metres of their item.
//
// Within 30 m in an old town, the nearest item that anyone has written an article
// about is either the object or the building holding it, and inheriting that building's
// fame is the right answer for this purpose — a museum inside a photographed landmark
// is on the coach route whatever it is called. Items nobody has written about (zero
// sitelinks) carry no information and are ignored.
const PROXIMITY_ONLY_M = 30
for (const r of results) {
  if (r.hit || r.p.lat == null) continue
  let best = null
  for (const it of items) {
    if (it.qid === cityQid || it.sitelinks < 1) continue
    if (!itemNames(it).length) continue
    const d = metres(r.p.lat, r.p.lon, it.lat, it.lon)
    if (d > PROXIMITY_ONLY_M) continue
    if (!best || it.sitelinks > best.it.sitelinks) best = { it, d, sim: 0, score: it.sitelinks }
  }
  if (best) { r.hit = best; r.pass = 3; r.why = '' }
}

// ── Buckets, by percentile within this site ──────────────────────────────────

// Buckets are cut by SHARE OF THE CITY'S OWN MAXIMUM, not by percentile.
//
// Percentiles were the first attempt and they misread the data. Sitelink counts are a
// long tail — Bratislava runs 47, 36, 34, 31, 27, 25, then twenty-odd objects between
// 10 and 23 — so forcing equal fifths onto it put 24 objects in the top bucket with an
// entry threshold of 10 links. "What every guidebook opens with" is not "the top fifth
// of the list"; by share of maximum the top bucket holds 6, which is about how many
// mass-tourism sights Bratislava actually has.
//
// Still relative to the site, as intended: the yardstick is that city's best-known
// object, so nothing is compared against Paris.
const maxLinks = Math.max(1, ...results.filter(r => r.hit).map(r => r.hit.it.sitelinks))
const bucketOf = n => {
  const share = n / maxLinks
  if (share >= 0.50) return 5
  if (share >= 0.25) return 4
  if (share >= 0.10) return 3
  if (share >= 0.04) return 2
  return 1
}

for (const r of results) {
  if (r.hit) { r.fame = bucketOf(r.hit.it.sitelinks); continue }

  // A miss means one of two different things, and they must not be conflated.
  //
  // With coordinates, the page has been through all three passes: names in three
  // languages, aliases, and anything at all within thirty metres. Finding nothing then
  // is EVIDENCE — nobody has written a Wikipedia article about it in any language — and
  // that is exactly what fame 1 says. This is the opposite of the earlier rule, and the
  // earlier rule was wrong: it left «Сказочное дерево» and «Выдух», enamelled ironwork
  // and a ventilation shaft turned into public art, with no rating at all, so they
  // vanished the moment the slider moved toward the quiet end — the very place they
  // belong. Back when the matcher missed fifty-three pages including Michalská veža,
  // refusing to rate was right; now that it misses a fairytale tree, rating is right.
  //
  // Without coordinates no proximity search was possible, so a miss says nothing. Those
  // stay unrated and keep needing a human.
  r.fame = r.p.lat != null ? 1 : null
}

// ── Report ───────────────────────────────────────────────────────────────────

const matched = results.filter(r => r.hit)
console.log(
  `\n${site}: ${pages.length} place pages — matched ${matched.length} ` +
  `(${results.filter(r => r.pass === 2).length} by name only), unmatched ${results.length - matched.length}\n`,
)
console.log('fame  links   dist  sim  by  page                                ← wikidata')
console.log('─'.repeat(108))
for (const r of [...matched].sort((a, b) => b.hit.it.sitelinks - a.hit.it.sitelinks)) {
  console.log(
    `  ${r.fame}   ${String(r.hit.it.sitelinks).padStart(4)}  ${(r.hit.d == null ? '—' : Math.round(r.hit.d) + 'm').padStart(6)}  ${r.hit.sim.toFixed(2)}  ${r.pass}   ` +
    `${r.p.slug.slice(0, 36).padEnd(36)}  ${r.hit.it.label} (${r.hit.it.qid})`,
  )
}
const missed = results.filter(r => !r.hit)
if (missed.length) {
  console.log('\nno Wikidata item found — rated 1, check these by hand:')
  for (const r of missed) console.log(`  ${r.p.slug.padEnd(40)} ${r.why}`)
}
const dist = {}
for (const r of results) dist[r.fame] = (dist[r.fame] || 0) + 1
console.log('\ndistribution: ' + Array.from({ length: FAME_LEVELS }, (_, i) => `${i + 1}→${dist[i + 1] || 0}`).join('  '))

// ── Write ────────────────────────────────────────────────────────────────────

let written = 0, kept = 0, unrated = 0, cleared = 0
for (const r of results) {
  // A forced re-seed must also take a value AWAY when the page no longer earns one,
  // or an earlier run's guesses survive the rule that replaced them.
  if (r.fame == null) {
    unrated++
    if (!force) continue
    for (const suffix of ['.md', '.en.md']) {
      const file = r.p.file.replace(/\.md$/, suffix)
      if (!fs.existsSync(file)) continue
      const text = fs.readFileSync(file, 'utf8')
      const end = text.indexOf('\n---', 4)
      if (end < 0 || !/^fame:/m.test(text.slice(0, end))) continue
      const next = text.slice(0, end).replace(/^fame:.*\r?\n/m, '') + text.slice(end)
      if (!dryRun) fs.writeFileSync(file, next)
      cleared++
    }
    continue
  }
  for (const suffix of ['.md', '.en.md']) {
    const file = r.p.file.replace(/\.md$/, suffix)
    if (!fs.existsSync(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    const end = text.indexOf('\n---', 4)
    if (end < 0) continue
    const fm = text.slice(0, end), rest = text.slice(end)

    let next
    if (/^fame:/m.test(fm)) {
      if (!force) { kept++; continue }
      next = fm.replace(/^fame:.*$/m, `fame: ${r.fame}`)
    } else if (/^domain:.*$/m.test(fm)) {
      next = fm.replace(/^(domain:.*)$/m, `$1\nfame: ${r.fame}`)
    } else {
      next = fm.replace(/^(type:.*)$/m, `$1\nfame: ${r.fame}`)
    }
    if (!dryRun) fs.writeFileSync(file, next + rest)
    written++
  }
}
console.log(
  `${dryRun ? '[dry run] ' : ''}fame written to ${written} file(s)` +
  (kept ? `, ${kept} left alone because they already had a value (--force to overwrite)` : '') +
  (unrated ? `, ${unrated} page(s) left unrated` : '') +
  (cleared ? `, ${cleared} stale value(s) removed` : ''),
)
