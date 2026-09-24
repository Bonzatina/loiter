#!/usr/bin/env node
// ── Find map markers that sit on top of each other ───────────────────────────
//
// Two pages whose `coords` differ by a few metres draw two markers the reader
// cannot tell apart, and at any zoom only the top one can be clicked. The page
// conventions say to offset a marker by ~0.002–0.003° when the exact spot is
// unknown; this lists every pair of Russian base pages closer than that, nearest
// first, so a duplicate page (two pages of one church) or a lazy geocode (a place
// pinned to its village centre) shows up.
//
// A pair on this list is not automatically wrong — a castle and its chapel can
// genuinely stand 150 m apart. Read it, don't blindly fix it.
//
// Usage:
//   node tools/check-coords.mjs wiki_rural_travel
//   node tools/check-coords.mjs wiki_rural_travel 0.001   # tighter threshold
//
// Only reads; changes nothing.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const [site, thresholdArg] = process.argv.slice(2)
if (!site) {
  console.error('usage: node tools/check-coords.mjs <wiki_dir> [threshold_deg]')
  process.exit(1)
}
const wikiRoot = path.join(ROOT, site, 'wiki')
if (!fs.existsSync(wikiRoot)) {
  console.error(`no wiki/ under ${site}`)
  process.exit(1)
}
const THRESHOLD = thresholdArg ? parseFloat(thresholdArg) : 0.003

function walk(dir) {
  let files = []
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f)
    if (fs.statSync(full).isDirectory()) files = files.concat(walk(full))
    else if (f.endsWith('.md') && !f.endsWith('.en.md')) files.push(full)
  }
  return files
}

const entries = []
for (const f of walk(wikiRoot)) {
  const m = fs.readFileSync(f, 'utf8').match(/^coords:\s*\[([0-9.+-]+),\s*([0-9.+-]+)\]/m)
  if (m) {
    entries.push({
      lat: parseFloat(m[1]),
      lon: parseFloat(m[2]),
      file: path.relative(wikiRoot, f).replace(/\\/g, '/'),
    })
  }
}

const overlaps = []
for (let i = 0; i < entries.length; i++) {
  for (let j = i + 1; j < entries.length; j++) {
    const a = entries[i], b = entries[j]
    if (Math.abs(a.lat - b.lat) < THRESHOLD && Math.abs(a.lon - b.lon) < THRESHOLD) {
      overlaps.push({ d: Math.hypot(a.lat - b.lat, a.lon - b.lon), a, b })
    }
  }
}
overlaps.sort((x, y) => x.d - y.d)

for (const { d, a, b } of overlaps) {
  console.log(`d=${d.toFixed(5)}  ${a.file}`)
  console.log(`           ${b.file}`)
  console.log()
}
console.log(`${entries.length} markers, ${overlaps.length} pairs closer than ${THRESHOLD}° on both axes`)
