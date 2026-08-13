import type { City } from './cities'
import type { Lang } from './lang'
import { toClientPages, type WikiPage } from './wiki'
import { MARKER_COLOR, DOMAIN_COLOR, UI_STRINGS, FAME_LEVELS, fameSliderEnabled, legendFor } from './constants'
import { renderHeader, renderHtmlDocument } from './shared'

export function renderPage(city: City, pages: WikiPage[], lang: Lang = 'ru'): string {
  const ui = UI_STRINGS[lang]
  // Only the domains this site has objects for — see legendFor in constants.ts.
  const legend = legendFor(city)

  // Marker colours are narrowed to the same domain set as the legend. Otherwise a
  // page carrying a domain the site never declared would be drawn in that domain's
  // colour while being filtered as an ordinary sight — colour and legend saying
  // different things. Nothing hits this today; it is closed by construction.
  const domainColors = Object.fromEntries(
    Object.entries(DOMAIN_COLOR).filter(([d]) => city.domains.includes(d)),
  )

  // The slider appears only where the ratings exist. Nothing in the registry says
  // which sites have them — the pages do, and rating them is gradual work, so the
  // control shows up on its own as soon as a site has any rated place. The whole
  // feature is still on trial, hence the kill switch.
  const rated = pages.filter(p => p.type === 'place' && p.fame != null).length
  const showFame = fameSliderEnabled() && rated > 0
  const fameUi = ui.fame

  return renderHtmlDocument({
    lang,
    title: city.brand,
    styles: [
      'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
      '/styles/shared.css',
      '/styles/map.css',
    ],
    body: `
${renderHeader(city, undefined, { current: lang })}

<div class="legend">
  ${Object.entries(legend).map(([type, color]) =>
    `<button class="legend-btn" data-type="${type}"><span class="dot" style="background:${color}"></span>${ui.legend[type] ?? type}</button>`
  ).join('')}
</div>

${showFame ? `<div class="fame-bar">
  <label class="fame-label" for="fame-slider">${fameUi.legend}</label>
  <input type="range" id="fame-slider" min="1" max="${FAME_LEVELS}" step="1" value="${FAME_LEVELS}"
         aria-describedby="fame-hint">
  <output id="fame-readout" for="fame-slider"></output>
  <span id="fame-hint" class="fame-hint">${fameUi.hint}</span>
</div>` : ''}

<div id="map"></div>

<div class="search-wrap">
  <input type="search" id="search-input" placeholder="${ui.searchPlaceholder}" autocomplete="off">
  <button id="search-clear" aria-label="Clear" style="display:none">✕</button>
</div>

<div class="content" id="list-content"></div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  window.DATA = {
    pages: ${JSON.stringify(toClientPages(pages))},
    routes: ${JSON.stringify(city.routes)},
    colors: ${JSON.stringify(MARKER_COLOR)},
    domainColors: ${JSON.stringify(domainColors)},
    legendTypes: ${JSON.stringify(Object.keys(legend))},
    legendColors: ${JSON.stringify(legend)},
    lang: ${JSON.stringify(lang)},
    ui: ${JSON.stringify(ui)},
    city: ${JSON.stringify({
      slug: city.slug,
      center: city.center,
      zoom: city.zoom,
      stateKey: city.stateKey,
    })},
    taxonomy: ${JSON.stringify({
      areaType: city.taxonomy.areaType,
      subareaType: city.taxonomy.subareaType,
      routeTypes: city.taxonomy.routeTypes,
      labelKeys: city.taxonomy.labelKeys,
    })},
    fame: ${showFame ? JSON.stringify({
      levels: FAME_LEVELS,
      labelAll: fameUi.all,
      labelUpTo: fameUi.upTo,
    }) : 'null'}
  }
</script>
<script src="/scripts/map.js"></script>`,
  })
}
