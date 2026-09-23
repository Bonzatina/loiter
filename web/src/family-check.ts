import fsSync from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { CITIES, FAMILY_ROOT, ENGINE_REFERENCE_DIR, type City } from './cities'
import { MARKER_COLOR, DOMAIN_COLOR, LEGEND_TYPES, DOMAIN_VOCABULARY } from './constants'
import { loadWikiPages, type WikiPage } from './wiki'

// ── Family check ─────────────────────────────────────────────────────────────
// `npm run check` (second half) — holds the subprojects to ONE shape. Where
// content-check.ts tests the aggregator's assumptions about the data, this tests
// the family's conventions, in three parts:
//
//   Engines   every city's standalone `web/` must equal the reference engine once
//             the city's own data (brand, port, centre, state key, timezone, the
//             area label in the note mail, the about-page source list) is masked.
//             The rural engine speaks another taxonomy, so only the files that do
//             not depend on it are compared; the rest is covered by the probes.
//   Probes    named features every standalone engine must have — one line per
//             feature, so a missing fix is reported by name, not as a diff.
//   Content   conventions every wiki must keep: sources only on the about page,
//             the original name in every map object's title, `fame` on city places,
//             domains from the shared vocabulary, wikilinks that resolve.
//
// Read-only, like everything at the root: it reports, it never fixes.
//
//   npm run check:family            summary plus the first few offenders per row
//   npm run check:family -- --all   every offender

const SHOW_ALL = process.argv.includes('--all')
const SAMPLE = 5

// ── Subprojects ──────────────────────────────────────────────────────────────

interface Subproject {
  dir: string
  sites: City[]
  kind: City['kind']
  web: string
  wiki: string
}

const SUBPROJECTS: Subproject[] = [...new Set(CITIES.map(c => c.dir))].map(dir => {
  const sites = CITIES.filter(c => c.dir === dir)
  return {
    dir,
    sites,
    kind: sites[0].kind,
    web: path.join(FAMILY_ROOT, dir, 'web'),
    wiki: path.join(FAMILY_ROOT, dir, 'wiki'),
  }
})

// ── Reporting ────────────────────────────────────────────────────────────────

let problems = 0
const pad = (s: string | number, n: number): string => String(s).padEnd(n)

function section(title: string): void {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(4, 66 - title.length))}`)
}

/** One result row; `offenders` empty means pass. */
function row(dir: string, label: string, offenders: string[], note = ''): void {
  const ok = offenders.length === 0
  if (!ok) problems++
  // Indented entries are detail under the entry above them, not offenders of their own.
  const status = ok ? 'ok' : `${offenders.filter(o => !o.startsWith(' ')).length}`
  console.log(`  ${pad(dir, 18)} ${pad(label, 26)} ${pad(status, 6)} ${note}`.trimEnd())
  if (ok) return
  for (const o of SHOW_ALL ? offenders : offenders.slice(0, SAMPLE)) console.log(`      ${o}`)
  if (!SHOW_ALL && offenders.length > SAMPLE) console.log(`      … ${offenders.length - SAMPLE} more (--all)`)
}

// ── Engines ──────────────────────────────────────────────────────────────────

const read = (file: string): string | null =>
  fsSync.existsSync(file) ? fsSync.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n') : null

/** Every engine file of a standalone app, relative to its `web/`. */
function engineFiles(web: string): string[] {
  const out: string[] = []
  for (const sub of ['src', 'scripts', 'styles']) {
    const dir = path.join(web, sub)
    if (!fsSync.existsSync(dir)) continue
    for (const f of fsSync.readdirSync(dir, { recursive: true }) as string[]) {
      if (/\.(ts|js|css)$/.test(f)) out.push(path.join(sub, f).replace(/\\/g, '/'))
    }
  }
  for (const f of ['package.json', 'tsconfig.json', '.npmrc']) {
    if (fsSync.existsSync(path.join(web, f))) out.push(f)
  }
  return out.sort()
}

/**
 * Masks what legitimately differs between two copies of the engine, and drops
 * comments and layout, so that what remains is behaviour. Every substitution here
 * is one kind of per-site data; anything else that differs is drift.
 */
function normalise(text: string, file: string): string[] {
  let t = text.replace(/\/\*[\s\S]*?\*\//g, '')

  // The about page's opening sentence enumerates the site's own topics — site data.
  // Dropped before the brand is masked, since masking eats the words that find it.
  if (file.endsWith('page-about.ts')) {
    t = t.split('\n').filter(l => !/interactive encyclopaedia|интерактивная энциклопедия/.test(l)).join('\n')
  }

  // Site data.
  t = t
    .replace(/Loiter: [^'"`<\n]+/g, 'Loiter: {BRAND}')
    .replace(/Rural Travel/g, 'Loiter: {BRAND}')
    .replace(/Number\(process\.env\.PORT\) : \d+/g, 'Number(process.env.PORT) : {PORT}')
    .replace(/setView\(\[[^\]]+\],\s*\d+\)/g, 'setView({CENTER})')
    .replace(/STATE_KEY = '[^']+'/g, "STATE_KEY = '{STATE_KEY}'")
    .replace(/Europe\/[A-Za-z_]+/g, '{TZ}')
    .replace(/\['[^']+',(\s*)`\$\{page\.(district|region)/g, "['{AREA_LABEL}',$1`${page.$2")
    .replace(/"name": "wiki-[^"]+"/g, '"name": "{NAME}"')

  let lines = t.split('\n')
    .map(l => l.replace(/(^|[\s;,{}()[\]'"`])\/\/\s.*$/, '$1'))   // `// comment`, not `https://`
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  // Whether a site has thermal baths is `domains` in the registry, not engine code.
  lines = lines.filter(l => !/^thermal: '#e8743b',$/.test(l))

  if (file.endsWith('page-about.ts')) {
    lines = lines.filter(l =>
      !/^'[^']+':\s*'.*',?$/.test(l) &&                      // source descriptions
      !/^\$\{src\('/.test(l))                                  // source list rows
  }
  return lines
}

/** Lines present on one side only, as a multiset difference — enough to see what drifted. */
function lineDiff(ref: string[], got: string[]): string[] {
  const count = new Map<string, number>()
  for (const l of ref) count.set(l, (count.get(l) ?? 0) + 1)
  const extra: string[] = []
  for (const l of got) {
    const n = count.get(l) ?? 0
    if (n > 0) count.set(l, n - 1)
    else extra.push(`+ ${l}`)
  }
  const missing: string[] = []
  for (const [l, n] of count) for (let i = 0; i < n; i++) missing.push(`- ${l}`)
  return [...missing, ...extra].map(s => s.length > 110 ? s.slice(0, 107) + '…' : s)
}

/** Engine files of the rural app that do not depend on its taxonomy. */
const TAXONOMY_FREE = [
  'src/routes.ts', 'src/templates.ts', 'src/shared.ts', 'src/page-map.ts', 'src/page-about.ts',
  'styles/shared.css', 'styles/about.css', 'styles/detail.css',
  'tsconfig.json', '.npmrc',
]

function checkEngines(): void {
  section(`Engines — held to ${ENGINE_REFERENCE_DIR}/web`)
  const refWeb = path.join(FAMILY_ROOT, ENGINE_REFERENCE_DIR, 'web')
  const refFiles = engineFiles(refWeb)

  for (const sp of SUBPROJECTS) {
    if (sp.dir === ENGINE_REFERENCE_DIR) continue
    const own = engineFiles(sp.web)
    const compared = sp.kind === 'city' ? refFiles : TAXONOMY_FREE
    const offenders: string[] = []

    if (sp.kind === 'city') {
      for (const f of refFiles) if (!own.includes(f)) offenders.push(`missing  ${f}`)
      for (const f of own) if (!refFiles.includes(f)) offenders.push(`extra    ${f}`)
    }
    for (const f of compared) {
      const a = read(path.join(refWeb, f))
      const b = read(path.join(sp.web, f))
      if (a === null || b === null) {
        if (sp.kind !== 'city' && b === null) offenders.push(`missing  ${f}`)
        continue
      }
      const d = lineDiff(normalise(a, f), normalise(b, f))
      if (d.length) offenders.push(`differs  ${f}`, ...d.slice(0, 4).map(s => `           ${s}`))
    }
    row(sp.dir, sp.kind === 'city' ? 'engine = reference' : 'shared files = reference', offenders)
  }
}

// ── Probes ───────────────────────────────────────────────────────────────────

/** `const NAME ... = { key: '#hex', … }` → the pairs, from a standalone constants.ts. */
function colourTable(src: string, name: string): Map<string, string> {
  const m = src.match(new RegExp(`const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\}`))
  const out = new Map<string, string>()
  if (!m) return out
  for (const line of m[1].split('\n')) {
    const kv = line.replace(/\/\/.*$/, '').match(/^\s*([a-z]+):\s*'(#[0-9a-fA-F]{6})'/)
    if (kv) out.set(kv[1], kv[2].toLowerCase())
  }
  return out
}

function checkProbes(): void {
  section('Probes — features every standalone engine must have')
  for (const sp of SUBPROJECTS) {
    const f = (rel: string): string => read(path.join(sp.web, rel)) ?? ''
    const server = f('src/server.ts')
    const wiki = f('src/wiki.ts')
    const pkg = JSON.parse(f('package.json') || '{}')
    const consts = f('src/constants.ts')
    const missing: string[] = []

    if (!/stripLeadingH1\(/.test(server)) missing.push('title shown once        server.ts strips the body\'s leading `# Title`')
    if (/import fs from 'fs\/promises'/.test(wiki) && /\bfs\.watch\(/.test(wiki)) {
      missing.push('cache drops on edit     wiki.ts calls fs/promises watch() — the callback is never run')
    }
    if (!/app\.set\('trust proxy'/.test(server)) missing.push('trust proxy             server.ts, for the note rate limiter behind Render')
    if (!fsSync.existsSync(path.join(sp.web, 'src/notes.ts')) || !/app\.post\('\/note'/.test(server)) {
      missing.push('visitor notes           src/notes.ts and POST /note')
    }
    if (!/max-width: min\(100%, 440px\)/.test(f('styles/detail.css'))) missing.push('image size cap          detail.css caps page images at 440 px')
    if (!/UI_STRINGS\[lang\]\.legend/.test(f('src/page-map.ts'))) missing.push('legend labels           page-map.ts reads UI_STRINGS.legend')
    if (!pkg.dependencies?.tsx) missing.push('tsx at runtime          package.json: tsx in dependencies, not devDependencies')
    if (!/norm\(p\.enTitle\)/.test(f('scripts/map.js'))) missing.push('search by English title map.js matches p.enTitle')

    // Colours: every key the subproject defines must carry the family's colour, and
    // every domain one of its sites lists must be defined at all.
    const tables: [string, Record<string, string>][] = [
      ['MARKER_COLOR', MARKER_COLOR], ['DOMAIN_COLOR', DOMAIN_COLOR], ['LEGEND_TYPES', LEGEND_TYPES],
    ]
    for (const [name, family] of tables) {
      const own = colourTable(consts, name)
      for (const [k, v] of own) {
        if (family[k] && family[k].toLowerCase() !== v) missing.push(`colour                  ${name}.${k} is ${v}, family ${family[k]}`)
      }
      if (name === 'MARKER_COLOR') continue
      for (const d of new Set(sp.sites.flatMap(s => s.domains))) {
        if (!own.has(d)) missing.push(`colour                  ${name} lacks \`${d}\`, which the site lists`)
      }
    }
    row(sp.dir, 'features', missing)
  }
}

// ── Content ──────────────────────────────────────────────────────────────────

interface Doc { rel: string; lang: 'ru' | 'en'; page: WikiPage; data: Record<string, unknown>; body: string }

/** Every served page of a subproject, RU and EN, parsed once. */
async function docsOf(sp: Subproject): Promise<{ docs: Doc[]; slugs: Set<string> }> {
  const bySlug = new Map<string, WikiPage>()
  for (const site of sp.sites) for (const p of await loadWikiPages(site)) bySlug.set(p.slug.toLowerCase(), p)
  const docs: Doc[] = []
  for (const page of bySlug.values()) {
    for (const [lang, file] of [['ru', page.filePath], ['en', page.filePath.replace(/\.md$/, '.en.md')]] as const) {
      const raw = read(file)
      if (raw === null) continue
      const { data, content } = matter(raw)
      docs.push({ rel: path.relative(sp.wiki, file).replace(/\\/g, '/'), lang, page, data, body: content })
    }
  }
  return { docs, slugs: new Set(bySlug.keys()) }
}

const CYRILLIC = /[А-Яа-яЁё]/
const LATIN = /[A-Za-zÀ-ɏ]/
const SOURCE_HEADING = /^#{1,6}\s*(Источники?|Sources?)\s*$/m

/** Words after «According to» that attribute to nobody in particular. */
const NOT_A_SOURCE = new Set([
  'tradition', 'legend', 'legends', 'local', 'some', 'many', 'one', 'other', 'another', 'his',
  'her', 'their', 'its', 'this', 'that', 'these', 'those', 'popular', 'most', 'official',
  'contemporary', 'early', 'later', 'sources', 'records', 'estimates', 'a', 'an', 'folk',
])

function attributions(d: Doc): string[] {
  const hits: string[] = []
  if (d.lang === 'ru') {
    for (const m of d.body.matchAll(/По данным\s+(\[|сайта|источник|[A-Za-z])[^\n.;]{0,40}/g)) hits.push(m[0])
  } else {
    for (const m of d.body.matchAll(/According to\s+([^\s,.;:]+)(\s+[^\s,.;:]+)?[^\n.;]{0,30}/g)) {
      const w = m[1]
      const next = (m[2] ?? '').trim()
      const named = w.startsWith('[') || w.includes('.') ||
        (w === 'the' && /^(source|site|website)$/.test(next)) ||
        (/^[a-z][a-z0-9-]+$/.test(w) && !NOT_A_SOURCE.has(w) && w !== 'the')
      if (named) hits.push(m[0])
    }
  }
  return hits
}

/** Hosts cited as sources: in a source section, or on a `wiki/sources/` page. */
function citedHosts(sp: Subproject, docs: Doc[]): Map<string, string> {
  const hosts = new Map<string, string>()
  const add = (text: string, where: string): void => {
    for (const m of text.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
      const h = m[1].toLowerCase().replace(/^www\./, '')
      if (!hosts.has(h)) hosts.set(h, where)
    }
  }
  for (const d of docs) {
    const at = d.body.search(SOURCE_HEADING)
    if (at < 0) continue
    const rest = d.body.slice(at)
    const end = rest.slice(1).search(/\n#{1,6}\s/)       // up to the next heading
    add(end >= 0 ? rest.slice(0, end + 1) : rest, d.rel)
  }
  const srcDir = path.join(sp.wiki, 'sources')
  if (fsSync.existsSync(srcDir)) {
    for (const f of fsSync.readdirSync(srcDir)) if (f.endsWith('.md')) add(read(path.join(srcDir, f)) ?? '', `sources/${f}`)
  }
  add(read(path.join(sp.wiki, 'index.md')) ?? '', 'index.md')
  return hosts
}

const covered = (host: string, list: string[]): boolean =>
  list.some(d => host === d || host.endsWith('.' + d))

/** The original name a RU title carries: the first comma part of a Latin parenthesis. */
function originalOf(title: string): string | null {
  for (const m of title.matchAll(/\(([^()]+)\)/g)) {
    const first = m[1].split(',')[0].trim()
    if (LATIN.test(first) && !CYRILLIC.test(first)) return first
  }
  return null
}

const fold = (s: string): string => s.normalize('NFC').toLowerCase()

function titleProblem(d: Doc, ruTitle: string): string | null {
  const t = String(d.data.title ?? '')
  // Two original names inside one parenthesis may be slashed; the title itself may not.
  if (/ \| | \/ /.test(t.replace(/\([^()]*\)/g, ''))) return 'separator'
  if (d.lang === 'ru') {
    if (!CYRILLIC.test(t)) return null                       // the name is the original
    if (originalOf(t)) return null
    // A brand kept in the Latin script inside the Russian name — «Музей Urban
    // Nation», «Научный центр Spectrum» — shows the original too. A parenthesis
    // naming a place in Cyrillic («(Бадачонь)») does not.
    return /[A-Za-zÀ-ɏ]{3,}/.test(t.replace(/\([^()]*\)/g, '')) ? null : 'no original'
  }
  const orig = originalOf(ruTitle) ?? (!CYRILLIC.test(ruTitle) ? ruTitle : null)
  if (!orig) return null                                     // RU is the worklist then
  const T = fold(t), O = fold(orig)
  if (T.includes(O) || O.includes(fold(t.replace(/\s*\(.*\)\s*$/, '')))) return null
  // The English title already IS the original, reordered: «Carlton Hotel» for «Hotel Carlton».
  const tw = new Set(T.split(/[^\p{L}\p{N}]+/u))
  const ow = O.split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 4)
  if (ow.length && ow.every(w => tw.has(w))) return null
  // A shortened original in parentheses still counts: a shared word of 4+ letters.
  const words = new Set(O.split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 4))
  for (const m of t.matchAll(/\(([^()]+)\)/g)) {
    if (fold(m[1]).split(/[^\p{L}\p{N}]+/u).some(w => words.has(w))) return null
  }
  return 'no original'
}

async function checkContent(): Promise<void> {
  section('Content — conventions every wiki keeps')
  const vocabulary = new Set<string>(DOMAIN_VOCABULARY)

  for (const sp of SUBPROJECTS) {
    const { docs, slugs } = await docsOf(sp)
    const tax = sp.sites[0].taxonomy
    const mapTypes = new Set([tax.areaType, tax.subareaType, 'place', ...tax.routeTypes])
    const ruTitle = new Map(docs.filter(d => d.lang === 'ru').map(d => [d.page.slug, String(d.data.title ?? '')]))

    // Sources live on the about page only.
    const leftovers: string[] = []
    const srcDir = path.join(sp.wiki, 'sources')
    const srcPages = fsSync.existsSync(srcDir) ? fsSync.readdirSync(srcDir).filter(f => f.endsWith('.md')).length : 0
    if (srcPages) leftovers.push(`wiki/sources/ holds ${srcPages} pages`)
    if (fsSync.existsSync(path.join(sp.wiki, 'raw'))) leftovers.push('wiki/raw/ exists — raw material belongs in the root raw/')
    for (const f of fsSync.readdirSync(sp.wiki)) {
      if (/sources/i.test(f) && f.endsWith('.md')) leftovers.push(`wiki/${f}`)
    }
    row(sp.dir, 'no source pages', leftovers)
    row(sp.dir, 'no source sections', docs.filter(d => SOURCE_HEADING.test(d.body)).map(d => d.rel))
    row(sp.dir, 'no inline attribution', docs.flatMap(d => attributions(d).map(a => `${d.rel}: «${a.trim()}»`)))

    // The about lists must name every host cited anywhere — the subproject's own
    // page-about.ts and the aggregator's about file for each of its sites.
    const hosts = citedHosts(sp, docs)
    const ownAbout = [...(read(path.join(sp.web, 'src/page-about.ts')) ?? '').matchAll(/src\('([^']+)'\)/g)].map(m => m[1].toLowerCase())
    const rootAbout = [...new Set(sp.sites.flatMap(s => s.about.sources.map(x => x.domain.toLowerCase())))]
    row(sp.dir, 'about lists sources (own)', [...hosts].filter(([h]) => !covered(h, ownAbout)).map(([h, w]) => `${h}  ← ${w}`))
    row(sp.dir, 'about lists sources (root)', [...hosts].filter(([h]) => !covered(h, rootAbout)).map(([h, w]) => `${h}  ← ${w}`))

    // Titles: the original name travels with the translated one.
    const titles: string[] = []
    for (const d of docs) {
      if (!mapTypes.has(d.page.type)) continue
      const p = titleProblem(d, ruTitle.get(d.page.slug) ?? '')
      if (p) titles.push(`${pad(p, 12)} ${d.rel}: ${String(d.data.title ?? '')}`)
    }
    row(sp.dir, 'original name in title', titles)

    // fame — city places only; the rural wiki does not rate.
    if (sp.kind === 'city') {
      row(sp.dir, 'fame on every place', docs
        .filter(d => d.lang === 'ru' && d.page.type === 'place' && d.data.fame === undefined)
        .map(d => d.rel))
    }

    const domains: string[] = []
    for (const d of docs) {
      if (d.lang !== 'ru' || d.data.domain === undefined) continue
      // `domain: lookout, history` is a list written as one string — common and valid.
      const vals = Array.isArray(d.data.domain) ? d.data.domain : String(d.data.domain).split(',').map(v => v.trim())
      for (const v of vals) if (!vocabulary.has(String(v))) domains.push(`${pad(String(v), 12)} ${d.rel}`)
    }
    row(sp.dir, 'domain in vocabulary', domains)

    const broken: string[] = []
    for (const d of docs) {
      for (const m of d.body.matchAll(/\[\[([^\]|]+?)\\?(?:\|[^\]]*)?\]\]/g)) {
        const target = m[1].trim()
        if (!slugs.has(target.toLowerCase())) broken.push(`${d.rel} → [[${target}]]`)
      }
    }
    row(sp.dir, 'wikilinks resolve', broken)
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  checkEngines()
  checkProbes()
  await checkContent()
  section('Total')
  console.log(problems === 0 ? '  the family is one shape\n' : `  ${problems} row(s) out of line\n`)
  process.exit(problems === 0 ? 0 : 1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
