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

  const items = cards.map(({ city, pages }) => `
    <a class="city-card" href="${homeUrl(city.slug, lang)}">
      <span class="city-card-image">
        <img src="${assetsPrefix(city.slug)}/${city.cardImage}" alt="${city.name[lang]}" loading="lazy">
      </span>
      <span class="city-card-body">
        <span class="city-card-name">${city.name[lang]}</span>
        <span class="city-card-count">${pages} ${plural(pages, lang, ui.pages)}</span>
      </span>
    </a>`).join('')

  const intro = lang === 'en'
    ? 'Interactive encyclopaedias for exploring cities on foot: architecture, history, museums, parks, culture, and specific places worth seeing with your own eyes.'
    : 'Интерактивные энциклопедии для исследования городов пешком: архитектура, история, музеи, парки, культура и конкретные места, которые стоит увидеть своими глазами.'

  return renderHtmlDocument({
    lang,
    title: 'Loiter',
    styles: ['/styles/shared.css', '/styles/cities.css'],
    body: `${renderHeader(undefined, undefined, { current: lang })}
<div class="cities-body">
  <h1>${ui.chooseCity}</h1>
  <p class="cities-intro">${intro}</p>
  <div class="city-grid">${items}
  </div>
</div>`,
  })
}

/** Registry order, so the picker and the switcher always agree. */
export const cityOrder = (): City[] => CITIES
