import { CITIES, type City } from './cities'
import type { Lang } from './lang'
import { renderHeader, renderHtmlDocument } from './shared'
import { UI_STRINGS } from './constants'
import { plural } from './plural'
import { homeUrl, assetsPrefix } from './routes'

/** A city and how much of it is written up — the card needs both. */
export interface CityCard {
  city: City
  pages: number
}

// ── City picker ──────────────────────────────────────────────────────────────
// The only page that knows about more than one city. Card images come from the
// subprojects' own assets, so nothing needs downloading or duplicating here.

export function renderCitiesPage(cards: CityCard[], lang: Lang = 'ru'): string {
  const ui = UI_STRINGS[lang]

  const card = ({ city, pages }: CityCard) => `
    <a class="city-card" href="${homeUrl(city.slug, lang)}" data-site="${city.slug}">
      <span class="city-card-image">
        <img src="${assetsPrefix(city.slug)}/${city.cardImage}" alt="${city.name[lang]}" loading="lazy">
      </span>
      <span class="city-card-body">
        <span class="city-card-name">${city.name[lang]}</span>
        <span class="city-card-count">${pages} ${plural(pages, lang, ui.pages)}</span>
      </span>
    </a>`

  // Grouped by kind, so the rural wiki is not presented as a sixth city. Headings
  // appear only when there is more than one group to tell apart.
  const groups: [string, CityCard[]][] = [
    [ui.groupCities, cards.filter(c => c.city.kind === 'city')],
    [ui.groupRural, cards.filter(c => c.city.kind === 'rural')],
  ].filter(([, list]) => list.length > 0) as [string, CityCard[]][]

  const items = groups.map(([heading, list]) => {
    const grid = `<div class="city-grid">${list.map(card).join('')}
  </div>`
    return groups.length > 1 ? `<h2 class="city-group-heading">${heading}</h2>${grid}` : grid
  }).join('')

  const intro = lang === 'en'
    ? 'Interactive encyclopaedias for exploring cities on foot: architecture, history, museums, parks, culture, and specific places worth seeing with your own eyes.'
    : 'Интерактивные энциклопедии для исследования городов пешком: архитектура, история, музеи, парки, культура и конкретные места, которые стоит увидеть своими глазами.'

  // Only what the client needs to place and pick a site: name, where its centre is,
  // what kind it is and where to go. No page data — the picker never loads content.
  const geoCities = cards.map(({ city }) => ({
    slug: city.slug,
    name: city.name[lang],
    kind: city.kind,
    center: city.center,
    url: homeUrl(city.slug, lang),
  }))

  return renderHtmlDocument({
    lang,
    title: 'Loiter',
    // Leaflet is NOT linked here. The picker map is a wide-screen affordance, and
    // scripts/cities.js injects the library only once it knows the viewport is wide
    // enough to show one — a phone downloads neither the library nor a single tile.
    styles: ['/styles/shared.css', '/styles/cities.css'],
    body: `${renderHeader(undefined, undefined, { current: lang })}
<div class="cities-body">
  <h1>${ui.chooseCity}</h1>
  <p class="cities-intro">${intro}</p>

  <div class="find-me-box">
    <button id="find-me" class="find-me-btn" type="button" hidden>${ui.geo.findMe}</button>
    <p class="find-me-hint">${ui.geo.hint}</p>
    <p id="find-me-status" class="find-me-status" hidden></p>
  </div>

  <div class="cities-layout">
    <!-- Revealed by the script: without JavaScript there is no map, and the cards
         alone must remain a complete way to choose. -->
    <div class="cities-map-wrap" hidden>
      <div id="cities-map"></div>
      <p class="cities-map-hint">${ui.pickerMapHint}</p>
    </div>
    <div class="cities-list">${items}
    </div>
  </div>
</div>

<script>
  window.DATA = {
    cities: ${JSON.stringify(geoCities)},
    ui: ${JSON.stringify({ locating: ui.locating, geo: ui.geo })}
  }
</script>
<script src="/scripts/cities.js"></script>`,
  })
}

/** Registry order, so the picker and the switcher always agree. */
export const cityOrder = (): City[] => CITIES
