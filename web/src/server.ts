import express from 'express'
import compression from 'compression'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import matter from 'gray-matter'
import { marked } from 'marked'
import { CITIES, getCity, assetsRoot, type City } from './cities'
import type { Lang } from './lang'
import { loadWikiPages, findPage, type WikiPage } from './wiki'
import { renderPage, renderDetailPage, renderAboutPage, renderCitiesPage } from './templates'
import { wikiPrefix, wikiUrl, assetsPrefix, citiesUrl } from './routes'
import { notesEnabled, validateNote, sendNote } from './notes'
import type { NoteState } from './page-detail'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STYLES_ROOT  = path.resolve(__dirname, '../styles')
const SCRIPTS_ROOT = path.resolve(__dirname, '../scripts')
const OWN_ASSETS   = path.resolve(__dirname, '../assets')

const app = express()
const PORT = process.env.PORT ? Number(process.env.PORT) : 4848

// Render (and any other proxy host) forwards the visitor IP in X-Forwarded-For;
// without this the note rate limiter would see one address for everyone.
app.set('trust proxy', 1)

app.use(compression())
app.use('/styles',  express.static(STYLES_ROOT))
app.use('/scripts', express.static(SCRIPTS_ROOT))
app.use('/assets',  express.static(OWN_ASSETS))

// Each city's images are served from its own subproject, under that city's URL
// namespace. Nothing is copied: the aggregator reads the subprojects in place.
for (const city of CITIES) {
  app.use(assetsPrefix(city.slug), express.static(assetsRoot(city)))
}

// ── Markdown ─────────────────────────────────────────────────────────────────

// The detail template already renders the frontmatter `title` as the page <h1>.
// Every page body also opens with a `# Title` heading (nice when reading the raw
// .md), which would render a second, duplicate <h1> after the meta badges —
// strip that leading H1 so the title isn't shown twice.
function stripLeadingH1(text: string): string {
  return text.replace(/^\s*#\s+.*(\r?\n)+/, '')
}

/** `[[Slug]]` and `[[Slug|Label]]` → links inside this city's namespace. */
function processWikilinks(text: string, prefix: string): string {
  return text
    .replace(/\[\[([^\]|]+?)\\?\|([^\]]+)\]\]/g, (_, slug, label) => `[${label}](${prefix}/${encodeURIComponent(slug.trim())})`)
    .replace(/\[\[([^\]]+)\]\]/g, (_, slug) => `[${slug}](${prefix}/${encodeURIComponent(slug.trim())})`)
}

/**
 * Page bodies were written for a single-city site and embed images as
 * `/assets/name.jpg`. Rewrite that root-relative path into the city namespace so
 * the markdown itself never has to change and stays valid in the standalone app.
 * Only the exact `/assets/` prefix is touched — an absolute URL to another host
 * (`https://…/assets/…`) is left alone.
 */
function processAssetPaths(text: string, city: City): string {
  return text.replace(/(!\[[^\]]*\]\()\/assets\//g, `$1${assetsPrefix(city.slug)}/`)
}

// ── Page rendering ───────────────────────────────────────────────────────────

async function serveWikiPage(
  city: City,
  slug: string,
  nav: Lang,
  res: express.Response,
  noteState?: NoteState,
): Promise<void> {
  const page = await findPage(city, slug)
  if (!page) { res.status(404).send(`Page not found: ${slug}`); return }

  const enPath = page.filePath.replace(/\.md$/, '.en.md')
  let hasEn = false
  try { await fs.access(enPath); hasEn = true } catch {}

  const effectiveLang: Lang = (nav === 'en' && hasEn) ? 'en' : 'ru'
  const filePath = effectiveLang === 'en' ? enPath : page.filePath

  const raw = await fs.readFile(filePath, 'utf-8')
  const { content, data } = matter(raw)
  const body = processAssetPaths(
    processWikilinks(stripLeadingH1(content), wikiPrefix(city.slug, nav)),
    city,
  )
  const bodyHtml = marked.parse(body) as string
  const displayTitle = (data.title as string) || page.title

  res.send(renderDetailPage(
    city,
    page,
    bodyHtml,
    { current: effectiveLang, nav, slug, hasEn },
    displayTitle,
    noteState,
  ))
}

async function serveCityMap(city: City, lang: Lang, res: express.Response): Promise<void> {
  const pages: WikiPage[] = await loadWikiPages(city)
  res.send(renderPage(city, pages, lang))
}

async function serveCityPicker(lang: Lang, res: express.Response): Promise<void> {
  const cards = await Promise.all(
    CITIES.map(async city => ({ city, pages: (await loadWikiPages(city)).length })),
  )
  res.send(renderCitiesPage(cards, lang))
}

// ── Visitor notes ────────────────────────────────────────────────────────────
// One endpoint for every city and page: both the city and the slug travel in the
// form body. Post/Redirect/Get on success so a refresh cannot send the note
// twice; on failure the page is re-rendered with the form open and the text kept.

app.post('/note', express.urlencoded({ extended: false, limit: '32kb' }), async (req, res) => {
  if (!notesEnabled()) { res.status(404).send('Not found'); return }

  const body = (req.body ?? {}) as Record<string, unknown>
  const nav: Lang = body.lang === 'en' ? 'en' : 'ru'

  const city = getCity(String(body.city ?? ''))
  if (!city) { res.status(400).send('Bad request'); return }

  const page = await findPage(city, String(body.slug ?? ''))
  if (!page || page.type !== 'place') { res.status(400).send('Bad request'); return }

  const check = validateNote(body, req.ip ?? 'unknown')
  if (!check.ok) {
    await serveWikiPage(city, page.slug, nav, res, { status: 'err', code: check.code, values: check.values })
    return
  }

  try {
    await sendNote({
      city,
      page,
      displayTitle: page.title,
      lang: nav,
      values: check.values,
      ip: req.ip ?? 'unknown',
      userAgent: String(req.get('user-agent') ?? ''),
    })
    res.redirect(303, `${wikiUrl(city.slug, page.slug, nav)}?note=ok`)
  } catch (err) {
    console.error('[note] send failed:', err)
    await serveWikiPage(city, page.slug, nav, res, { status: 'err', code: 'mail', values: check.values })
  }
})

/** `?note=ok` after the redirect that follows a successful submission. */
function noteBanner(req: express.Request): NoteState | undefined {
  return req.query.note === 'ok' ? { status: 'ok' } : undefined
}

// ── Routes ───────────────────────────────────────────────────────────────────
// Language is the outer segment and the city the next one in. Each language block
// puts its city routes before the catch-alls, and `/en` is declared ahead of the
// Russian tree so it is never captured as a city slug.

function mountCityRoutes(lang: Lang, base: string): void {
  // Declared before `/:city` so `about` is never read as a city slug. It cannot be
  // one — `about` is in RESERVED_SEGMENTS — but the order keeps that independent
  // of the registry's guarantees.
  app.get(`${base}/about`, (_req, res) => {
    res.send(renderAboutPage(undefined, lang))
  })

  app.get(`${base}/:city/about`, async (req, res, next) => {
    const city = getCity(req.params.city)
    if (!city) { next(); return }
    res.send(renderAboutPage(city, lang))
  })


  app.get(`${base}/:city`, async (req, res, next) => {
    const city = getCity(req.params.city)
    if (!city) { next(); return }
    await serveCityMap(city, lang, res)
  })

  app.get(`${base}/:city/:slug`, async (req, res, next) => {
    const city = getCity(req.params.city)
    if (!city) { next(); return }
    await serveWikiPage(city, decodeURIComponent(req.params.slug), lang, res, noteBanner(req))
  })
}

// EN first: /en must not be read as a city slug by the Russian tree.
app.get('/en', async (_req, res) => { await serveCityPicker('en', res) })
mountCityRoutes('en', '/en')

app.get('/', async (_req, res) => { await serveCityPicker('ru', res) })
mountCityRoutes('ru', '')

// Anything left is a real 404 — an unknown city slug lands here via next().
app.use((req, res) => {
  res.status(404).send(`Not found: ${req.path} — <a href="${citiesUrl('ru')}">Loiter</a>`)
})

app.listen(PORT, () => {
  console.log(`Running at http://localhost:${PORT}`)
  Promise.all(CITIES.map(async city => {
    const pages = await loadWikiPages(city)
    return `${city.slug} ${pages.length}`
  })).then(counts => console.log(`Wiki cache warm: ${counts.join(', ')}`))
})
