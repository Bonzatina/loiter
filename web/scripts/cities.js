// ── "Find me" on the city picker ─────────────────────────────────────────────
// The project is for someone standing in a street right now, so the picker offers
// to skip the choosing: work out which city they are in and open its map centred
// on them.
//
// The position is handed to the map page through sessionStorage, NOT through the
// URL. A query string with precise coordinates would end up in server logs, in
// the Referer header and in the analytics hit — a location is not something to
// leave lying around in exchange for saving one click.

const { cities, ui } = window.DATA

// Beyond this, opening a city map centred on the reader would put them in an
// empty area and call it their surroundings, so the nearest city is offered as a
// plain link instead. 30 km clears the widest city here — Berlin's outer Bezirke
// sit ~23 km from the centre — while keeping Vienna (55 km) out of Bratislava and
// Prague (119 km) out of Dresden.
const NEAR_KM = 30

/** Same key and shape as the reader in scripts/map.js. */
const HANDOFF_KEY = 'loiter_locate'

const btn = document.getElementById('find-me')
const status = document.getElementById('find-me-status')

/** Great-circle distance in km. Fine at these scales, no projection needed. */
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function nearestCity(lat, lng) {
  let best = null
  for (const c of cities) {
    const km = distanceKm(lat, lng, c.center[0], c.center[1])
    if (!best || km < best.km) best = { city: c, km }
  }
  return best
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '')
}

function setStatus(text, kind) {
  if (!status) return
  status.textContent = text
  status.className = `find-me-status${kind ? ' ' + kind : ''}`
  status.hidden = false
}

/** A nearest city that is too far away: a link, not a redirect. */
function setFarStatus(best) {
  if (!status) return
  const km = best.km < 100 ? Math.round(best.km / 5) * 5 : Math.round(best.km / 10) * 10
  status.textContent = ''
  status.className = 'find-me-status warn'
  status.append(document.createTextNode(
    fill(ui.geo.far, { city: best.city.name, km: String(km) }) + ' ',
  ))
  const link = document.createElement('a')
  link.href = best.city.url
  link.textContent = best.city.name
  status.append(link)
  status.hidden = false
}

function idle() {
  btn.disabled = false
  btn.textContent = ui.geo.findMe
}

function onSuccess(pos) {
  const { latitude: lat, longitude: lng, accuracy } = pos.coords
  const best = nearestCity(lat, lng)
  if (!best) { idle(); return }

  if (best.km > NEAR_KM) {
    setFarStatus(best)
    idle()
    return
  }

  setStatus(fill(ui.geo.found, { city: best.city.name }), 'ok')
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({
      city: best.city.slug,
      lat,
      lng,
      accuracy: accuracy || 50,
      ts: Date.now(),
    }))
  } catch {
    // Private mode with storage blocked: still open the city, just not centred.
  }
  location.href = best.city.url
}

function onError(err) {
  setStatus(err && err.code === 1 ? ui.geo.denied : ui.geo.failed, 'warn')
  idle()
}

if (btn && navigator.geolocation) {
  // Revealed only now: without JavaScript or geolocation the button would be dead,
  // so it ships hidden and is never shown to a browser that cannot use it.
  btn.hidden = false
  btn.addEventListener('click', () => {
    btn.disabled = true
    btn.textContent = ui.locating
    if (status) status.hidden = true
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    })
  })
}
