#!/usr/bin/env node
// ── Copy the family rules into every subproject's CLAUDE.md ──────────────────
//
// `tools/family-rules.md` is the one text of the rules every Loiter wiki shares —
// titles, sources, fame, practical information, domains, images, git. Each subproject's
// CLAUDE.md carries a copy between two markers, so a session working inside a
// subproject reads them without going to the root. This writes that copy; the family
// check (`npm run check`) fails while any copy differs from the master.
//
// Usage:
//   node tools/sync-family-rules.mjs            write every copy
//   node tools/sync-family-rules.mjs --check    report, write nothing (exit 1 on drift)
//
// It writes into the subprojects' CLAUDE.md and nowhere else. Commit the result inside
// each subproject, as with any other change there.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const START = '<!-- loiter-family-rules:start — copied from Loiter/tools/family-rules.md; edit it there -->'
export const END = '<!-- loiter-family-rules:end -->'

const master = fs.readFileSync(path.join(ROOT, 'tools', 'family-rules.md'), 'utf8').replace(/\r\n/g, '\n').trim()
const block = `${START}\n\n${master}\n\n${END}`
const check = process.argv.includes('--check')

let drift = 0
for (const dir of fs.readdirSync(ROOT).filter(d => d.startsWith('wiki_')).sort()) {
  const file = path.join(ROOT, dir, 'CLAUDE.md')
  if (!fs.existsSync(file)) continue
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  const a = text.indexOf(START.slice(0, 32)), b = text.indexOf(END)
  const next = a >= 0 && b > a
    ? text.slice(0, a) + block + text.slice(b + END.length)
    : text.replace(/\s*$/, '') + '\n\n' + block + '\n'
  const state = next === text ? 'up to date' : a >= 0 ? 'updated' : 'added'
  if (next !== text) drift++
  if (!check && next !== text) fs.writeFileSync(file, next)
  console.log(`${dir.padEnd(18)} ${check && next !== text ? 'DIFFERS' : state}`)
}
if (check && drift) process.exit(1)
