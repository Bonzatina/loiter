#!/usr/bin/env node
// ── Shrink oversized page images ─────────────────────────────────────────────
//
// Every wiki page image is displayed at most 440 px wide (220 px for a coat of
// arms) — see `.body img` in web/styles/detail.css. The files, however, arrive
// from Wikimedia and institution sites at full resolution: when this was first
// measured, 948 of 1289 images were wider than twice the display cap and held
// 790 MB of the 826 MB total. Practically all of the weight was in pixels no
// reader ever sees, and a phone had to download 19.8 MB to look at one picture.
//
// This resizes a JPEG down to twice the display cap and re-encodes it, in place.
// It is idempotent: an image already at or under the cap is not touched, and
// neither is one where re-encoding would not actually save anything — so it can
// be re-run after every ingest without degrading the same file twice.
//
// PNGs are left alone. There are 31 of them totalling ~5 MB, nearly all coats of
// arms, and re-encoding flat graphics as JPEG would look worse for no gain.
//
// Usage:
//   node tools/shrink-images.mjs wiki_rural_travel --dry-run
//   node tools/shrink-images.mjs wiki_rural_travel
//   node tools/shrink-images.mjs --all
//
// Requires ffmpeg on PATH. Nothing else — deliberately no npm dependency, so it
// works from a bare checkout.

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SITES = [
  'wiki_berlin', 'wiki_bratislava', 'wiki_budapest',
  'wiki_dresden', 'wiki_wroclav', 'wiki_rural_travel',
]

/** Twice the 440 px display cap, so the picture still looks right on a 2x screen. */
const MAX_W = 880
/** Coats of arms are capped at 220 px on the page. */
const ARMS_W = 440
/** mjpeg quality: 2 is best, 31 worst. 3 keeps a visible margin over the cap. */
const QUALITY = 3
/** Keep the original unless the new file is at least this much smaller. */
const MIN_GAIN = 0.10

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const targets = args.includes('--all') ? SITES : args.filter(a => !a.startsWith('--'))

if (!targets.length) {
  console.error('usage: node tools/shrink-images.mjs <subproject…> | --all  [--dry-run]')
  process.exit(2)
}

// ── Dimensions straight from the file header ──────────────────────────────────

function jpegSize(buf) {
  let i = 2
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue }
    const marker = buf[i + 1]
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue }
    i += 2 + buf.readUInt16BE(i + 2)
  }
  return null
}

/**
 * Dimensions and actual format. A handful of files carry a `.jpg` name over PNG
 * bytes — browsers sniff the content and render them anyway, so nobody noticed,
 * but a photograph stored as PNG costs about ten times what it should. Those get
 * re-encoded to JPEG, which also makes the extension honest. Files that are
 * *named* .png are not touched at all: they are coats of arms and flat graphics,
 * where JPEG would look worse for no gain.
 */
function probe(file) {
  const size = fs.statSync(file).size
  const buf = Buffer.alloc(Math.min(size, 256 * 1024))
  const fd = fs.openSync(file, 'r')
  fs.readSync(fd, buf, 0, buf.length, 0)
  fs.closeSync(fd)
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const d = jpegSize(buf)
    return d ? { ...d, format: 'jpeg' } : null
  }
  if (buf.length >= 24 && buf.toString('latin1', 1, 4) === 'PNG') {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), format: 'png' }
  }
  return null
}

const kb = b => `${Math.round(b / 1024)}K`
const mb = b => `${(b / 1024 / 1024).toFixed(1)} MB`

// ── One site ─────────────────────────────────────────────────────────────────

function shrinkSite(site) {
  const dir = path.join(ROOT, site, 'web', 'assets')
  if (!fs.existsSync(dir)) {
    console.log(`${site}: no assets directory, skipped`)
    return null
  }

  const stat = { files: 0, resized: 0, converted: 0, alreadySmall: 0, noGain: 0, failed: 0, before: 0, after: 0 }
  const failures = []

  for (const name of fs.readdirSync(dir).sort()) {
    if (!/\.jpe?g$/i.test(name)) continue
    const file = path.join(dir, name)
    if (!fs.statSync(file).isFile()) continue

    stat.files++
    const before = fs.statSync(file).size
    stat.before += before

    const dim = probe(file)
    if (!dim) {
      stat.failed++
      failures.push(`${name}: unrecognised image format, left untouched`)
      stat.after += before
      continue
    }

    const cap = /^(wappen|erb|herb)-/i.test(name) ? ARMS_W : MAX_W
    // A mislabelled PNG is worth re-encoding at any width; a real JPEG only when
    // it is actually oversized.
    const mislabelled = dim.format === 'png'
    if (dim.w <= cap && !mislabelled) { stat.alreadySmall++; stat.after += before; continue }

    if (dryRun) {
      if (mislabelled) stat.converted++; else stat.resized++
      stat.after += before   // unknown until done; totals below report "before" only
      continue
    }

    // Encode beside the original, then swap only on success and only if smaller.
    const tmp = path.join(dir, `.shrink-${name}`)
    try {
      execFileSync('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', file,
        '-vf', `scale='min(${cap},iw)':-2:flags=lanczos`,
        '-q:v', String(QUALITY),
        tmp,
      ], { stdio: ['ignore', 'ignore', 'pipe'] })
    } catch (err) {
      stat.failed++
      failures.push(`${name}: ffmpeg failed — ${String(err.stderr ?? err).trim().slice(0, 120)}`)
      fs.rmSync(tmp, { force: true })
      stat.after += before
      continue
    }

    const out = fs.existsSync(tmp) ? fs.statSync(tmp).size : 0
    const outDim = out ? probe(tmp) : null

    // Refuse a result that is not a valid JPEG, not the width we asked for, or not
    // meaningfully smaller. Better to keep a fat original than a broken picture.
    if (!out || !outDim || outDim.format !== 'jpeg' || outDim.w > cap || out > before * (1 - MIN_GAIN)) {
      fs.rmSync(tmp, { force: true })
      stat.noGain++
      stat.after += before
      continue
    }

    fs.rmSync(file)
    fs.renameSync(tmp, file)
    if (mislabelled) stat.converted++; else stat.resized++
    stat.after += out
  }

  const label = dryRun ? 'would resize' : 'resized'
  console.log(
    `${site.padEnd(19)} ${String(stat.files).padStart(4)} jpg   ` +
    `${label} ${String(stat.resized).padStart(4)}   ` +
    `png→jpg ${String(stat.converted).padStart(2)}   ` +
    `already small ${String(stat.alreadySmall).padStart(4)}   ` +
    `no gain ${String(stat.noGain).padStart(3)}   ` +
    `failed ${String(stat.failed).padStart(2)}   ` +
    (dryRun ? mb(stat.before) : `${mb(stat.before)} → ${mb(stat.after)}`),
  )
  for (const f of failures) console.log(`    ! ${f}`)
  return stat
}

// ── Run ──────────────────────────────────────────────────────────────────────

try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
} catch {
  console.error('ffmpeg not found on PATH — install it or add it to PATH first')
  process.exit(1)
}

console.log(
  `max width ${MAX_W}px (arms ${ARMS_W}px), quality ${QUALITY}, ` +
  `keep original unless ≥${Math.round(MIN_GAIN * 100)}% smaller` +
  (dryRun ? '  [DRY RUN]' : ''),
)
console.log('─'.repeat(112))

const totals = { before: 0, after: 0, resized: 0, converted: 0, failed: 0 }
for (const site of targets) {
  const s = shrinkSite(site)
  if (!s) continue
  totals.before += s.before
  totals.after += s.after
  totals.resized += s.resized
  totals.converted += s.converted
  totals.failed += s.failed
}

console.log('─'.repeat(112))
if (dryRun) {
  console.log(`would resize ${totals.resized} files and re-encode ${totals.converted} mislabelled PNGs; currently ${mb(totals.before)}`)
} else {
  const saved = totals.before - totals.after
  const factor = totals.after ? (totals.before / totals.after).toFixed(1) : '—'
  console.log(
    `${totals.resized} resized + ${totals.converted} re-encoded, ${mb(totals.before)} → ${mb(totals.after)} ` +
    `(saved ${mb(saved)}, ${factor}× smaller)`,
  )
}
if (totals.failed) {
  console.log(`${totals.failed} file(s) failed and were left untouched`)
  process.exit(1)
}
