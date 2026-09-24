/**
 * Debug view of the rural sites — every one of them on a single map, so their
 * extents can be judged against each other. Not linked from anywhere, and only
 * mounted when `DEBUG_SITES=on` (see `debugSitesEnabled` in constants.ts); the
 * live site never serves it. It deliberately ignores the "one city at a time" rule
 * that governs every reader-facing page.
 *
 * Each site is drawn as the convex hull of its mapped objects, with the objects as
 * dots; each area folder can be drawn the same way, dashed, to see which folder
 * makes a site sprawl.
 */

export interface DebugSite {
  slug: string
  name: string
  areas: string[]
  points: { lat: number; lon: number; title: string; area: string }[]
}

// A debug palette, nine distinct hues — not the marker vocabulary, which means
// something else on the reader-facing maps.
const PALETTE = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
  '#42a5a5', '#f032e6', '#9a6324', '#808000', '#000075',
]

export function renderRuralDebugPage(sites: DebugSite[]): string {
  const data = sites.map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }))
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Debug: rural sites</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html, body { margin: 0; height: 100%; font: 13px/1.4 system-ui, sans-serif; background: #fff; color: #222; }
  #map { position: absolute; inset: 0 300px 0 0; }
  #panel { position: absolute; top: 0; right: 0; bottom: 0; width: 300px; overflow-y: auto;
           padding: 12px; box-sizing: border-box; border-left: 1px solid #ccc; background: #fafafa; }
  #panel h1 { font-size: 15px; margin: 0 0 8px; }
  #panel label { display: block; margin: 2px 0; cursor: pointer; }
  .site { margin: 8px 0 4px; }
  .swatch { display: inline-block; width: 12px; height: 12px; border-radius: 2px; vertical-align: -1px; margin-right: 4px; }
  .areas { margin-left: 20px; color: #555; }
  .opts { border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 8px; }
  .site-label { background: none; border: none; box-shadow: none; font-weight: 700; font-size: 13px;
                text-shadow: 0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff; }
  .site-label::before { display: none; }
  @media (max-width: 700px) { #map { inset: 0 0 40% 0; } #panel { top: 60%; width: 100%; border-left: none; border-top: 1px solid #ccc; } }
</style>
</head>
<body>
<div id="map"></div>
<div id="panel">
  <h1>Rural sites — debug</h1>
  <div class="opts">
    <label><input type="checkbox" id="opt-dots" checked> объекты</label>
    <label><input type="checkbox" id="opt-areas"> контуры областей</label>
    <label><input type="checkbox" id="opt-labels" checked> подписи сайтов</label>
  </div>
  <div id="sites"></div>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const SITES = ${json};

// Andrew's monotone chain; points as [lat, lon], hull returned in order.
function hull(pts) {
  const p = pts.map(x => [x[1], x[0]]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return pts
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower = [], upper = []
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q) }
  for (const q of p.slice().reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q) }
  return lower.slice(0, -1).concat(upper.slice(0, -1)).map(x => [x[1], x[0]])
}

const map = L.map('map')
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map)

const opts = { dots: true, areas: false, labels: true }
const bounds = []
const panel = document.getElementById('sites')
const layers = []

for (const s of SITES) {
  const pts = s.points.map(p => [p.lat, p.lon])
  pts.forEach(p => bounds.push(p))
  const L_ = { on: true, hull: L.layerGroup(), dots: L.layerGroup(), areas: L.layerGroup(), labels: L.layerGroup() }

  if (pts.length) {
    L.polygon(hull(pts), { color: s.color, weight: 2, fillOpacity: 0.12 })
      .bindTooltip(s.name + ' — ' + pts.length).addTo(L_.hull)
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0])
    L.tooltip({ permanent: true, direction: 'center', className: 'site-label' })
      .setLatLng(c).setContent('<span style="color:' + s.color + '">' + s.name + '</span>').addTo(L_.labels)
  }
  for (const p of s.points) {
    L.circleMarker([p.lat, p.lon], { radius: 3, color: s.color, weight: 1, fillOpacity: 0.9 })
      .bindTooltip(p.title + '<br><small>' + s.slug + ' / ' + p.area + '</small>').addTo(L_.dots)
  }
  const byArea = {}
  for (const p of s.points) (byArea[p.area] ||= []).push([p.lat, p.lon])
  for (const [area, ap] of Object.entries(byArea)) {
    if (ap.length >= 3) {
      L.polygon(hull(ap), { color: s.color, weight: 1, dashArray: '4 4', fill: false })
        .bindTooltip(area + ' — ' + ap.length).addTo(L_.areas)
    }
  }
  layers.push(L_)

  const div = document.createElement('div')
  div.className = 'site'
  const counts = s.areas.map(a => a + ' ' + (byArea[a] ? byArea[a].length : 0)).join(', ')
  div.innerHTML = '<label><input type="checkbox" checked> <span class="swatch" style="background:' + s.color + '"></span>'
    + '<b>' + s.name + '</b> <small>(' + s.slug + ', ' + pts.length + ')</small></label>'
    + '<div class="areas">' + counts + '</div>'
  div.querySelector('input').addEventListener('change', e => { L_.on = e.target.checked; refresh() })
  panel.appendChild(div)
}

function refresh() {
  for (const l of layers) {
    const show = { hull: l.on, dots: l.on && opts.dots, areas: l.on && opts.areas, labels: l.on && opts.labels }
    for (const k of Object.keys(show)) show[k] ? l[k].addTo(map) : map.removeLayer(l[k])
  }
}
for (const k of Object.keys(opts)) {
  document.getElementById('opt-' + k).addEventListener('change', e => { opts[k] = e.target.checked; refresh() })
}
refresh()
if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] })
else map.setView([48, 19], 7)
</script>
</body>
</html>`
}
