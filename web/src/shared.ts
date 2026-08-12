import { CITIES, type City } from './cities'
import type { Lang } from './lang'
import { UI_STRINGS } from './constants'
import { homeUrl, aboutUrl, projectAboutUrl, wikiUrl, citiesUrl } from './routes'

export interface LangConfig {
  current: Lang
  /** Navigation context; differs from `current` when an EN page has no .en.md. */
  nav?: Lang
  slug?: string
  hasEn?: boolean
}

function renderLangSwitcher(
  lang: Lang,
  ruHref: string,
  enHref: string,
  enDisabled = false,
): string {
  const ruPart = lang === 'ru'
    ? `<span class="lang-btn lang-active">RU</span>`
    : `<a class="lang-btn lang-link" href="${ruHref}">RU</a>`
  const enPart = lang === 'en'
    ? `<span class="lang-btn lang-active">EN</span>`
    : enDisabled
      ? `<span class="lang-btn lang-off" title="No translation yet">EN</span>`
      : `<a class="lang-btn lang-link" href="${enHref}">EN</a>`
  return `<div class="lang-switcher">${ruPart}${enPart}</div>`
}

/**
 * The city switcher: a `<details>` dropdown, so it works with JavaScript off —
 * the same reasoning as the visitor-note form.
 *
 * Every entry points at the target city's **map**, never at a translated slug:
 * pages do not correspond across cities, so there is nothing to carry over. The
 * language, on the other hand, is preserved.
 *
 * The list includes the current city, marked. That is not redundancy: the `Loiter`
 * wordmark leads to the picker, so this is the header's only route back to the
 * city's own map from, say, its about page.
 *
 * With no city (the picker), the summary reads «Все города» and the header is
 * otherwise identical — one header for the whole site.
 */
function renderCitySwitcher(current: City | undefined, lang: Lang): string {
  const ui = UI_STRINGS[lang]

  // Grouped by kind: the rural wiki is a set of regions, not a city, and listing
  // it as a sixth city would misdescribe it. The group heading only appears once
  // there is more than one kind to separate.
  const groups: [string, City[]][] = [
    [ui.groupCities, CITIES.filter(c => c.kind === 'city')],
    [ui.groupRural, CITIES.filter(c => c.kind === 'rural')],
  ].filter(([, list]) => list.length > 0) as [string, City[]][]

  const body = groups.map(([heading, list]) => {
    const items = list.map(c => {
      const isCurrent = c.slug === current?.slug
      return `<li${isCurrent ? ' class="city-current"' : ''}>` +
        `<a href="${homeUrl(c.slug, lang)}">${c.name[lang]}</a></li>`
    }).join('')
    return groups.length > 1
      ? `<li class="city-group">${heading}</li>${items}`
      : items
  }).join('')

  return `<details class="city-switcher">
    <summary title="${ui.chooseCity}">${current ? current.name[lang] : ui.allCities}</summary>
    <ul>
      ${body}
    </ul>
  </details>`
}

export function renderHtmlDocument(opts: {
  lang?: string
  title: string
  styles: string[]
  body: string
}): string {
  const htmlLang = opts.lang ?? 'ru'
  const styleLinks = opts.styles
    .map(href => `  <link rel="stylesheet" href="${href}"/>`)
    .join('\n')
  const updated = new Date().toISOString().slice(0, 10)
  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title}</title>
${styleLinks}
</head>
<body>
${opts.body}
<footer>© bonzatina · ${updated}</footer>
<script data-goatcounter="https://bonzatina.goatcounter.com/count"
        async src="//gc.zgo.at/count.js"></script>
</body>
</html>`
}

/**
 * The site header — one implementation for every page. `city` is undefined only
 * on the picker and the project-level about page; everything else in the header
 * looks and behaves the same either way.
 */
export function renderHeader(
  city: City | undefined,
  activePage?: string,
  langConfig?: LangConfig,
): string {
  const lang  = langConfig?.current ?? 'ru'
  const nav   = langConfig?.nav ?? lang
  const slug  = langConfig?.slug
  const hasEn = langConfig?.hasEn ?? false
  const ui    = UI_STRINGS[nav]

  // Where the about link points depends on whether a city is in context: a city's
  // about page carries that city's sources, the project one carries none.
  const aboutHref = city ? aboutUrl(city.slug, nav) : projectAboutUrl(nav)

  // The language toggle stays on whatever page you are on.
  let ruHref: string
  let enHref: string
  if (city && slug) {
    ruHref = wikiUrl(city.slug, slug, 'ru')
    enHref = wikiUrl(city.slug, slug, 'en')
  } else if (activePage === 'about') {
    ruHref = city ? aboutUrl(city.slug, 'ru') : projectAboutUrl('ru')
    enHref = city ? aboutUrl(city.slug, 'en') : projectAboutUrl('en')
  } else {
    ruHref = city ? homeUrl(city.slug, 'ru') : citiesUrl('ru')
    enHref = city ? homeUrl(city.slug, 'en') : citiesUrl('en')
  }
  const langSwitcher = renderLangSwitcher(lang, ruHref, enHref, Boolean(slug) && !hasEn)

  return `<header>
  <div class="header-left">
    <h1><a href="${citiesUrl(nav)}">Loiter</a></h1>
    ${renderCitySwitcher(city, nav)}
  </div>
  <nav class="header-nav">
    <a href="${aboutHref}"${activePage === 'about' ? ' class="active"' : ''}>${ui.about}</a>
    ${langSwitcher}
  </nav>
</header>`
}
