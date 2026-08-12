// Everything site-specific arrives in `city` and `taxonomy` — the client holds no
// constant of its own, so this file is identical for every site and every geography.
const { pages: allPages, routes, colors, domainColors, legendTypes, legendColors, lang, ui, city, taxonomy } = window.DATA

function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') }
const key = s => (s == null ? '' : norm(String(s)))

// Area pages (a city district, a rural region) rarely carry coordinates of their
// own: the marker sits at the centroid of its members. Members are matched on
// EITHER `area` or `subarea`, because a rural region page may stand for a
// sub-region slug, and matched case- and diacritic-insensitively — `Hortobágy` the
// page has to find `hortobágy` the folder. A page may also declare which key it
// represents in its own `area` field, so that a filename and a slug are allowed to
// differ. An area with no members gets no marker; a manual `coords` still wins.
// A single member is nudged north so the two markers do not sit on top of each other.
;(function assignAreaCoords() {
  const members = {}
  for (const p of allPages) {
    if (!p.coords || p.type === taxonomy.areaType) continue
    for (const k of [key(p.area), key(p.subarea)]) {
      if (k) (members[k] = members[k] || []).push(p.coords)
    }
  }
  for (const r of allPages) {
    if (r.type !== taxonomy.areaType || r.coords) continue
    const pts = members[key(r.area || r.slug)]
    if (!pts || !pts.length) continue
    const lat = pts.reduce((s, c) => s + c[0], 0) / pts.length
    const lng = pts.reduce((s, c) => s + c[1], 0) / pts.length
    r.coords = pts.length === 1 ? [lat + 0.0015, lng] : [lat, lng]
  }
})()

const mappable = allPages.filter(p => p.coords)
// Page URLs are namespaced by city: /{city}/{slug}, /en/{city}/{slug}.
const cityBase = `${lang === 'en' ? '/en' : ''}/${city.slug}`
const wikiBase = cityBase          // prefix for a page link
const mapBase  = cityBase          // this city's map page
function pageTitle(p) { return (lang === 'en' && p.enTitle) ? p.enTitle : p.title }

let searchQuery = ''

function matchesQuery(p, q) {
  const needle = norm(q)
  if (norm(p.title || '').includes(needle)) return true
  if (p.enTitle && norm(p.enTitle).includes(needle)) return true
  if (p.tags && p.tags.some(t => norm(String(t)).includes(needle))) return true
  if (p.area && norm(p.area).includes(needle)) return true
  if (p.subarea && norm(p.subarea).includes(needle)) return true
  return false
}

const map = L.map('map', { boxZoom: false }).setView(city.center, city.zoom)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map)

const activeTypes = new Set(legendTypes)
function isVisible(type, domain) {
  // Railways and ferries have no domain of their own; the `transport` button
  // filters them. Which types those are comes from the taxonomy, so a city — where
  // transport is out of scope — simply has none.
  if (taxonomy.routeTypes.includes(type)) return activeTypes.has('transport')
  if (type === 'place') {
    if (domain) {
      for (const d of domain.split(',').map(s => s.trim())) {
        if (legendTypes.includes(d) && d !== 'sights') return activeTypes.has(d)
      }
    }
    return activeTypes.has('sights')
  }
  return activeTypes.has(type)
}

function placeRadius(zoom) {
  if (zoom <= 10) return 4.4
  if (zoom <= 12) return 5.5
  return 7.7
}
function markerRadius(p) {
  // One radius for the area role, city or region: the same kind of object should
  // look the same size after switching sites.
  if (p.type === taxonomy.areaType) return 9
  if (p.type === 'place' || taxonomy.routeTypes.includes(p.type)) return placeRadius(map.getZoom())
  return 8.8
}

const routeLayers = []

routes.forEach(r => {
  const line = L.polyline(r.points, {
    color: colors[r.type] ?? '#888',
    opacity: 0.35,
    weight: 3,
    dashArray: r.type === 'ferry' ? '8, 5' : null,
  }).addTo(map)
  routeLayers.push({ layer: line, type: r.type, isLine: true, slug: r.slug })

  if (r.type === 'railway') {
    const color = colors.railway
    const opts = { radius: placeRadius(map.getZoom()), color, fillColor: color, fillOpacity: 0.8, weight: 1.5 }
    const start = r.points[0]
    const end   = r.points[r.points.length - 1]
    const m1 = L.circleMarker(start, opts).addTo(map)
      .bindPopup(`<strong>${r.slug}</strong><br><small>${ui.startStation}</small><br><a href="${wikiBase}/${encodeURIComponent(r.slug)}">${ui.open}</a>`)
    const m2 = L.circleMarker(end, opts).addTo(map)
      .bindPopup(`<strong>${r.slug}</strong><br><small>${ui.terminus}: ${r.terminus}</small><br><a href="${wikiBase}/${encodeURIComponent(r.slug)}">${ui.open}</a>`)
    routeLayers.push({ layer: m1, type: r.type, isLine: false, slug: r.slug })
    routeLayers.push({ layer: m2, type: r.type, isLine: false, slug: r.slug })
  }

  if (r.type === 'ferry') {
    const color = colors.ferry
    const page = allPages.find(p => p.slug === r.slug)
    const opts = { radius: placeRadius(map.getZoom()), color, fillColor: color, fillOpacity: 0.8, weight: 1.5 }
    r.points.forEach(pt => {
      const popup = page
        ? `<strong>${pageTitle(page)}</strong><br><small>ferry</small><br><a href="${wikiBase}/${encodeURIComponent(page.slug)}">${ui.open}</a>`
        : `<strong>${r.slug}</strong><br><small>${ui.terminus}: ${r.terminus}</small>`
      const m = L.circleMarker(pt, opts).addTo(map).bindPopup(popup)
      routeLayers.push({ layer: m, type: r.type, isLine: false, slug: r.slug })
    })
  }
})

// ── Markers ───────────────────────────────────────────────────────────────

function resolveDomainColor(domain) {
  if (!domain || !domainColors) return null
  for (const d of domain.split(',').map(s => s.trim())) {
    if (domainColors[d]) return domainColors[d]
  }
  return null
}

const markerObjects = mappable.map(p => {
  const domainColor = p.type === 'place' ? resolveDomainColor(p.domain) : null
  const color = domainColor || colors[p.type] || '#666'
  const marker = L.circleMarker(p.coords, {
    radius: markerRadius(p),
    color, fillColor: color, fillOpacity: 0.8, weight: 1.5,
  })
  .addTo(map)
  .bindPopup(
    `<strong>${pageTitle(p)}</strong><br>` +
    `<small>${p.type}${p.subarea ? ' · ' + p.subarea : ''}</small><br>` +
    `<a href="${wikiBase}/${encodeURIComponent(p.slug)}">${ui.open}</a>`
  )
  return { marker, page: p, baseColor: color }
})

// ── Type visibility + marker sync ────────────────────────────────────────

function syncMarkers() {
  routeLayers.forEach(({ layer, type, isLine, slug }) => {
    const vis = isVisible(type)
    if (!vis) {
      layer.setStyle(isLine ? { opacity: 0 } : { opacity: 0, fillOpacity: 0 })
      return
    }
    if (searchQuery) {
      const page = allPages.find(p => p.slug === slug)
      const matches = page ? matchesQuery(page, searchQuery) : slug.toLowerCase().includes(searchQuery.toLowerCase())
      layer.setStyle(isLine
        ? { opacity: matches ? 0.35 : 0.07 }
        : { opacity: matches ? 1 : 0.25, fillOpacity: matches ? 0.8 : 0.15 }
      )
      return
    }
    layer.setStyle(isLine
      ? { opacity: 0.35 }
      : { opacity: 1, fillOpacity: 0.8 }
    )
  })

  const bounds = selectionActive && selectionRect ? selectionRect.getBounds() : null
  markerObjects.forEach(({ marker, page: p, baseColor }) => {
    if (!isVisible(p.type, p.domain)) {
      marker.setStyle({ opacity: 0, fillOpacity: 0 })
      return
    }
    if (searchQuery && !matchesQuery(p, searchQuery)) {
      marker.setStyle({ color: '#bbb', fillColor: '#ccc', fillOpacity: 0.15, opacity: 0.25 })
      return
    }
    if (bounds) {
      const inside = bounds.contains(L.latLng(p.coords[0], p.coords[1]))
      marker.setStyle({
        color:       inside ? baseColor : '#999',
        fillColor:   inside ? baseColor : '#bbb',
        fillOpacity: inside ? 0.8 : 0.18,
        opacity:     inside ? 1   : 0.35,
      })
    } else {
      marker.setStyle({ color: baseColor, fillColor: baseColor, fillOpacity: 0.8, opacity: 1 })
    }
  })
}

function syncMarkerSizes() {
  markerObjects.forEach(({ marker, page: p }) => {
    if (p.type === 'place' || p.type === 'ferry' || p.type === 'railway')
      marker.setStyle({ radius: placeRadius(map.getZoom()) })
  })
  routeLayers.forEach(({ layer, type, isLine }) => {
    if (!isLine && (type === 'ferry' || type === 'railway')) layer.setStyle({ radius: placeRadius(map.getZoom()) })
  })
}
map.on('zoomend', syncMarkerSizes)

// ── List rendering ────────────────────────────────────────────────────────

function pills(items, cls) {
  return items.map(p =>
    `<a class="pill ${cls}" href="${wikiBase}/${encodeURIComponent(p.slug)}">${pageTitle(p)}</a>`
  ).join('')
}

function section(title, items, cls) {
  if (!items.length) return ''
  return `<h2>${title} <span class="count">${items.length}</span></h2>
    <div class="pill-list">${pills(items, cls)}</div>`
}

function renderList(visible, opts = {}) {
  const { areaType, subareaType } = taxonomy
  const byType = t => visible.filter(p => p.type === t)

  // Sub-areas are grouped under the area they belong to — quarters under their
  // district, settlements under their region.
  const subareas = byType(subareaType)
  const byArea = {}
  subareas.forEach(p => {
    const k = p.area || '—'
    ;(byArea[k] = byArea[k] || []).push(p)
  })

  const visibleAreas = new Set(visible.filter(p => p.coords).map(p => p.area).filter(Boolean))
  const concepts = opts.searchMode
    ? byType('concept')
    : allPages.filter(p => p.type === 'concept' && (!p.area || visibleAreas.has(p.area)))
  const people = opts.searchMode
    ? byType('person')
    : allPages.filter(p => p.type === 'person')

  let html = section(ui[taxonomy.labelKeys.area], byType(areaType), areaType)
  html += section(ui.concepts, concepts, 'concept')
  if (subareas.length) {
    html += `<h2>${ui[taxonomy.labelKeys.subarea]} <span class="count">${subareas.length}</span></h2>`
    Object.entries(byArea).sort().forEach(([area, items]) => {
      html += `<h3>${area}</h3><div class="pill-list">${pills(items, subareaType)}</div>`
    })
  }
  html += section(ui.places, byType('place'), 'place')
  // Rural only: a city's taxonomy lists no route types, so neither section appears.
  if (taxonomy.routeTypes.includes('railway') && (isVisible('railway') || opts.searchMode)) {
    html += section(ui.railways, byType('railway'), 'railway')
  }
  if (taxonomy.routeTypes.includes('ferry') && (isVisible('ferry') || opts.searchMode)) {
    html += section(ui.ferries, byType('ferry'), 'ferry')
  }
  html += section(ui.people, people, 'person')
  if (!html) html = `<p class="hint">${ui.noItems}</p>`
  document.getElementById('list-content').innerHTML = html
}

// ── State ─────────────────────────────────────────────────────────────────

let selectionActive    = false
let drawModeEnabled    = false
let isSelecting        = false
let startPoint         = null
let selectionRect      = null
let dimOverlay         = null
let drawBtn            = null
let highlightedMarker  = null

function clearHighlight() {
  if (!highlightedMarker) return
  const { marker, page: p, baseColor } = highlightedMarker
  marker.setStyle({ radius: markerRadius(p), weight: 1.5, color: baseColor, fillColor: baseColor, fillOpacity: 0.8, opacity: 1 })
  highlightedMarker = null
}

// ── Viewport update ───────────────────────────────────────────────────────

const noCoords = allPages.filter(p => !p.coords)

function update() {
  if (selectionActive || searchQuery) return
  const bounds = map.getBounds()
  const inBounds = mappable.filter(p =>
    bounds.contains(L.latLng(p.coords[0], p.coords[1])) && isVisible(p.type, p.domain)
  )
  renderList([...inBounds, ...noCoords.filter(p => isVisible(p.type, p.domain))])
}
map.on('moveend zoomend', update)

// ── Apply / clear selection ───────────────────────────────────────────────

function applySelection(bounds) {
  selectionActive = true
  drawModeEnabled = false

  if (dimOverlay) map.removeLayer(dimOverlay)
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  dimOverlay = L.polygon(
    [
      [[-90,-360],[-90,360],[90,360],[90,-360]],
      [[sw.lat,sw.lng],[sw.lat,ne.lng],[ne.lat,ne.lng],[ne.lat,sw.lng]],
    ],
    { weight: 0, fillColor: '#000', fillOpacity: 0.28, interactive: false }
  ).addTo(map)

  syncMarkers()
  const visible = markerObjects
    .filter(({ page: p }) => isVisible(p.type, p.domain) && bounds.contains(L.latLng(p.coords[0], p.coords[1])))
    .map(({ page }) => page)
  renderList([...visible, ...noCoords.filter(p => isVisible(p.type, p.domain))])
  syncDrawBtn()
  saveState()
}

function clearSelection() {
  if (selectionRect) { map.removeLayer(selectionRect); selectionRect = null }
  if (dimOverlay)    { map.removeLayer(dimOverlay);    dimOverlay = null }
  selectionActive = false
  drawModeEnabled = false
  syncMarkers()
  update()
  syncDrawBtn()
  saveState()
}

function syncDrawBtn() {
  if (!drawBtn) return
  if (selectionActive) {
    drawBtn.textContent = ui.clearSel
    drawBtn.classList.add('active')
  } else if (drawModeEnabled) {
    drawBtn.textContent = ui.drawActive
    drawBtn.classList.add('active')
  } else {
    drawBtn.textContent = ui.drawIdle
    drawBtn.classList.remove('active')
  }
}

// ── Drawing helpers ───────────────────────────────────────────────────────

function startDrawing(latLng) {
  isSelecting = true
  startPoint  = latLng
  map.dragging.disable()
}

function updateRect(endLatLng) {
  const bounds = L.latLngBounds(startPoint, endLatLng)
  if (selectionRect) { selectionRect.setBounds(bounds) }
  else {
    selectionRect = L.rectangle(bounds, {
      color: '#1565c0', weight: 1.5, dashArray: '6 4', fillOpacity: 0.07, interactive: false,
    }).addTo(map)
  }
}

function finishDrawing() {
  isSelecting = false
  map.dragging.enable()
  if (selectionRect) applySelection(selectionRect.getBounds())
}

// ── Desktop: Shift+drag or drawMode+drag ──────────────────────────────────

const container = map.getContainer()

container.addEventListener('mousedown', e => {
  if (!e.shiftKey && !drawModeEnabled) return
  if (selectionActive) return
  e.preventDefault()
  startDrawing(map.containerPointToLatLng([e.offsetX, e.offsetY]))
})

document.addEventListener('mousemove', e => {
  if (!isSelecting) return
  const r = container.getBoundingClientRect()
  updateRect(map.containerPointToLatLng([e.clientX - r.left, e.clientY - r.top]))
})

document.addEventListener('mouseup', () => {
  if (!isSelecting) return
  finishDrawing()
})

// ── Mobile: touch events when drawMode active ─────────────────────────────

container.addEventListener('touchstart', e => {
  if (!drawModeEnabled || selectionActive) return
  e.preventDefault()
  const t = e.touches[0]
  const r = container.getBoundingClientRect()
  startDrawing(map.containerPointToLatLng([t.clientX - r.left, t.clientY - r.top]))
}, { passive: false })

container.addEventListener('touchmove', e => {
  if (!isSelecting) return
  e.preventDefault()
  const t = e.touches[0]
  const r = container.getBoundingClientRect()
  updateRect(map.containerPointToLatLng([t.clientX - r.left, t.clientY - r.top]))
}, { passive: false })

container.addEventListener('touchend', () => {
  if (!isSelecting) return
  finishDrawing()
})

// Clear on plain map click / Escape
map.on('click', e => {
  if (e.originalEvent.shiftKey || drawModeEnabled) return
  clearHighlight()
  if (selectionActive) clearSelection()
})

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (isSelecting) { isSelecting = false; map.dragging.enable() }
    clearHighlight()
    if (selectionActive || drawModeEnabled) clearSelection()
  }
})

// ── Draw mode button (works on both desktop and mobile) ───────────────────

const drawCtrl = L.control({ position: 'topright' })
drawCtrl.onAdd = () => {
  drawBtn = L.DomUtil.create('button', 'draw-btn')
  syncDrawBtn()
  L.DomEvent.on(drawBtn, 'click', () => {
    if (selectionActive || drawModeEnabled) { clearSelection() }
    else { drawModeEnabled = true; syncDrawBtn() }
  })
  L.DomEvent.disableClickPropagation(drawBtn)
  L.DomEvent.disableScrollPropagation(drawBtn)
  return drawBtn
}
drawCtrl.addTo(map)

// ── User geolocation ─────────────────────────────────────────────────────

let userMarker    = null
let userAccCircle = null
let watchId       = null
let locateBtn     = null
let locateState   = 'idle'  // 'idle' | 'locating' | 'located'

function syncLocateBtn() {
  if (!locateBtn) return
  locateBtn.classList.toggle('locating', locateState === 'locating')
  locateBtn.classList.toggle('located',  locateState === 'located')
  if (locateState === 'idle')     locateBtn.textContent = ui.whereAmI
  if (locateState === 'locating') locateBtn.textContent = ui.locating
  if (locateState === 'located')  locateBtn.textContent = ui.iAmHere
}

function setUserPosition(lat, lng, accuracy) {
  const latlng = L.latLng(lat, lng)
  if (userMarker) {
    userMarker.setLatLng(latlng)
    userAccCircle.setLatLng(latlng).setRadius(accuracy)
  } else {
    userAccCircle = L.circle(latlng, {
      radius: accuracy,
      color: '#1565c0', weight: 1,
      fillColor: '#1565c0', fillOpacity: 0.08,
      interactive: false,
    }).addTo(map)
    userMarker = L.circleMarker(latlng, {
      radius: 9, color: '#fff', weight: 2.5,
      fillColor: '#1565c0', fillOpacity: 1,
      interactive: false,
    }).addTo(map)
  }
  if (locateState === 'locating') map.flyTo(latlng, Math.max(map.getZoom(), 13), { duration: 1 })
  locateState = 'located'
  syncLocateBtn()
}

function onLocateError() {
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null }
  locateState = 'idle'
  syncLocateBtn()
}

const locateCtrl = L.control({ position: 'bottomright' })
locateCtrl.onAdd = () => {
  locateBtn = L.DomUtil.create('button', 'locate-btn')
  syncLocateBtn()
  L.DomEvent.on(locateBtn, 'click', () => {
    if (!navigator.geolocation) {
      alert(ui.noGeo)
      return
    }
    if (locateState === 'located') {
      map.flyTo(userMarker.getLatLng(), Math.max(map.getZoom(), 13), { duration: 1 })
      return
    }
    if (locateState === 'locating') return
    locateState = 'locating'
    syncLocateBtn()
    if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    watchId = navigator.geolocation.watchPosition(
      pos => setUserPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      onLocateError,
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
  L.DomEvent.disableClickPropagation(locateBtn)
  L.DomEvent.disableScrollPropagation(locateBtn)
  return locateBtn
}
locateCtrl.addTo(map)

// ── Help tooltip ──────────────────────────────────────────────────────────

const helpCtrl = L.control({ position: 'bottomleft' })
helpCtrl.onAdd = () => {
  const div = L.DomUtil.create('div')
  div.innerHTML = `<div class="map-help" style="
    background:rgba(255,255,255,0.88);padding:10px 14px;border-radius:6px;
    font-size:0.76rem;line-height:1.55;max-width:210px;color:#333;
    box-shadow:0 1px 5px rgba(0,0,0,0.18)">
    <strong style="font-size:0.8rem">${ui.helpNavTitle}</strong><br>
    ${ui.helpNavBody}<br><br>
    <strong style="font-size:0.8rem">${ui.helpSelTitle}</strong><br>
    <em>${ui.helpDesktop}</em> <kbd style="background:#eee;padding:1px 5px;border-radius:3px;border:1px solid #ccc">Shift</kbd> + drag.<br>
    <em>${ui.helpMobile}</em> ${ui.helpMobileHint}<br>
    Click / <kbd style="background:#eee;padding:1px 5px;border-radius:3px;border:1px solid #ccc">Esc</kbd> ${ui.helpEsc}
  </div>`
  L.DomEvent.disableClickPropagation(div)
  return div
}
helpCtrl.addTo(map)

// ── Legend type filter buttons ────────────────────────────────────────────

document.querySelectorAll('.legend-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type
    if (activeTypes.has(type)) {
      if (activeTypes.size === 1) return  // keep at least one active
      activeTypes.delete(type)
      btn.classList.add('off')
    } else {
      activeTypes.add(type)
      btn.classList.remove('off')
    }
    syncMarkers()
    if (selectionActive) {
      const bounds = selectionRect.getBounds()
      const visible = markerObjects
        .filter(({ page: p }) => isVisible(p.type, p.domain) && bounds.contains(L.latLng(p.coords[0], p.coords[1])))
        .map(({ page }) => page)
      renderList(visible)
    } else {
      update()
    }
    saveState()
  })
})

// ── State persistence (survives Back navigation) ──────────────────────────

// Per city, so switching cities never restores the other one's viewport.
const STATE_KEY = city.stateKey

function saveState() {
  const c = map.getCenter()
  const state = {
    lat: c.lat, lng: c.lng, zoom: map.getZoom(),
    activeTypes: [...activeTypes],
    sel: selectionRect ? (() => {
      const b = selectionRect.getBounds()
      const sw = b.getSouthWest(), ne = b.getNorthEast()
      return { swLat: sw.lat, swLng: sw.lng, neLat: ne.lat, neLng: ne.lng }
    })() : null,
  }
  sessionStorage.setItem(STATE_KEY, JSON.stringify(state))
}

function restoreState() {
  let state
  try { state = JSON.parse(sessionStorage.getItem(STATE_KEY) || '') } catch { return false }
  if (!state) return false
  map.setView([state.lat, state.lng], state.zoom, { animate: false })
  if (state.activeTypes) {
    activeTypes.clear()
    state.activeTypes.forEach(t => activeTypes.add(t))
    document.querySelectorAll('.legend-btn').forEach(btn => {
      btn.classList.toggle('off', !activeTypes.has(btn.dataset.type))
    })
  }
  if (state.sel) {
    const { swLat, swLng, neLat, neLng } = state.sel
    const bounds = L.latLngBounds([swLat, swLng], [neLat, neLng])
    selectionRect = L.rectangle(bounds, {
      color: '#1565c0', weight: 1.5, dashArray: '6 4', fillOpacity: 0.07, interactive: false,
    }).addTo(map)
    applySelection(bounds)
    return true
  }
  return false
}

map.on('moveend zoomend', saveState)

const wasRestored = restoreState()

// ── Search ────────────────────────────────────────────────────────────────

function applySearch(q) {
  searchQuery = q.trim()
  const clearBtn = document.getElementById('search-clear')
  if (clearBtn) clearBtn.style.display = searchQuery ? '' : 'none'

  if (!searchQuery) {
    syncMarkers()
    if (selectionActive && selectionRect) {
      const bounds = selectionRect.getBounds()
      const visible = markerObjects
        .filter(({ page: p }) => isVisible(p.type, p.domain) && bounds.contains(L.latLng(p.coords[0], p.coords[1])))
        .map(({ page }) => page)
      renderList([...visible, ...noCoords.filter(p => isVisible(p.type, p.domain))])
    } else {
      update()
    }
    return
  }

  syncMarkers()
  const results = allPages.filter(p => matchesQuery(p, searchQuery))
  renderList(results, { searchMode: true })
}

const searchInput = document.getElementById('search-input')
const searchClearBtn = document.getElementById('search-clear')

if (searchInput) {
  searchInput.addEventListener('input', e => applySearch(e.target.value))
}
if (searchClearBtn) {
  searchClearBtn.addEventListener('click', () => {
    if (searchInput) { searchInput.value = ''; searchInput.focus() }
    applySearch('')
  })
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && searchQuery) {
    if (searchInput) searchInput.value = ''
    applySearch('')
  }
})

// ── Arriving from the picker's "find me" button ────────────────────────────
// The picker geolocated, worked out which city this is and left the position in
// sessionStorage — deliberately not in the URL, so precise coordinates stay out
// of server logs, the Referer header and the analytics hit. Read once, then
// dropped: a reload should not silently re-centre on a stale position.

const HANDOFF_KEY = 'loiter_locate'
const HANDOFF_MAX_AGE_MS = 2 * 60 * 1000

function consumeLocateHandoff() {
  let h
  try { h = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) || '') } catch { return null }
  sessionStorage.removeItem(HANDOFF_KEY)
  if (!h || h.city !== city.slug) return null
  if (!Number.isFinite(h.lat) || !Number.isFinite(h.lng)) return null
  if (!Number.isFinite(h.ts) || Date.now() - h.ts > HANDOFF_MAX_AGE_MS) return null
  return h
}

const handoff = consumeLocateHandoff()

// ── Highlight marker from "Показать на карте" ─────────────────────────────

const highlightSlug = new URLSearchParams(location.search).get('highlight')

if (handoff) {
  // Beats both the restored viewport and the city's default centre: the reader
  // asked to be shown where they are.
  map.setView([handoff.lat, handoff.lng], Math.max(city.zoom, 14), { animate: false })
  locateState = 'located'   // pre-set so setUserPosition skips its flyTo
  setUserPosition(handoff.lat, handoff.lng, handoff.accuracy)
  // A box selection restored from an earlier visit would hide exactly what is
  // around the reader, which is the one thing they asked to see.
  if (selectionActive) clearSelection()
  update()
} else if (highlightSlug) {
  history.replaceState(null, '', mapBase)
  const found = markerObjects.find(m => m.page.slug === highlightSlug)
  if (found) {
    clearHighlight()
    const { marker, page: p, baseColor } = found
    const baseRadius = markerRadius(p)
    map.setView(p.coords, map.getZoom(), { animate: false })
    marker.setStyle({ radius: baseRadius + 6, weight: 3, color: '#fff', fillColor: baseColor, fillOpacity: 1 })
    highlightedMarker = found
  }
} else if (!wasRestored) {
  update()
}
