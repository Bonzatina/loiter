import crypto from 'crypto'
import type { WikiPage } from './wiki'
import type { City } from './cities'
import type { Lang } from './lang'
import { PROJECT_EMAIL } from './constants'
import { wikiUrl } from './routes'

// ── Visitor notes ────────────────────────────────────────────────────────────
// A reader who has been to a place can leave a note about it. There is no
// database and no persistence: the note is validated, formatted and sent to the
// moderator's mailbox through the Resend HTTP API (no SMTP — outbound mail ports
// are unreliable on free hosting). Everything below degrades to "feature off"
// when the environment variables are missing.
//
// Shared across all cities: the city only supplies the subject prefix, the
// timezone of the sent-at stamp and the district row label.

const API_KEY = process.env.NOTES_API_KEY ?? ''
const TO = process.env.NOTES_TO ?? ''
const FROM = process.env.NOTES_FROM ?? 'Loiter notes <onboarding@resend.dev>'
const SECRET = process.env.NOTES_SECRET ?? ''
const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/+$/, '')
/** Overrides every city's own prefix when set — useful for a staging mailbox. */
const SUBJECT_PREFIX_OVERRIDE = process.env.NOTES_SUBJECT_PREFIX ?? ''

/** The form is rendered and the route accepts posts only when mail is configured. */
export function notesEnabled(): boolean {
  return Boolean(API_KEY && TO && SECRET)
}

/** Bare moderator address, offered as a mailto: fallback when sending fails. */
export function notesContact(): string {
  const match = TO.match(/<([^>]+)>/)
  return (match ? match[1] : TO).trim() || PROJECT_EMAIL
}

export const NOTE_MIN = 10
export const NOTE_MAX = 4000
const NAME_MAX = 80
const EMAIL_MAX = 120
const MAX_LINKS = 2
const MIN_FILL_SECONDS = 3
const MAX_FORM_AGE_HOURS = 6

// ── Signed timestamp ─────────────────────────────────────────────────────────
// The render time travels with the form so the server can tell a human filling
// in a textarea from a bot posting the instant it sees the page. Signed, so the
// value cannot simply be back-dated.

export function stamp(): { ts: string; sig: string } {
  const ts = String(Date.now())
  return { ts, sig: sign(ts) }
}

function sign(ts: string): string {
  return crypto.createHmac('sha256', SECRET).update(ts).digest('hex').slice(0, 16)
}

function stampAgeSeconds(ts: string, sig: string): number | null {
  if (!/^\d{10,16}$/.test(ts)) return null
  const expected = sign(ts)
  const given = String(sig ?? '')
  if (given.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return null
  return (Date.now() - Number(ts)) / 1000
}

// ── Rate limiting ────────────────────────────────────────────────────────────
// In memory on purpose: a free instance sleeps and forgets, which is fine — the
// limiter is there to blunt floods, not to keep accounts.

const hits = new Map<string, number[]>()
const SHORT_WINDOW_MS = 10 * 60 * 1000
const SHORT_LIMIT = 3
const DAY_MS = 24 * 60 * 60 * 1000
const DAY_LIMIT = 10

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const seen = (hits.get(ip) ?? []).filter(t => now - t < DAY_MS)
  const recent = seen.filter(t => now - t < SHORT_WINDOW_MS)
  if (recent.length >= SHORT_LIMIT || seen.length >= DAY_LIMIT) {
    hits.set(ip, seen)
    return true
  }
  seen.push(now)
  hits.set(ip, seen)
  if (hits.size > 5000) hits.clear()   // crude guard against unbounded growth
  return false
}

// ── Validation ───────────────────────────────────────────────────────────────

export type NoteErrorCode = 'short' | 'long' | 'links' | 'bot' | 'rate' | 'mail' | 'bad'

export interface NoteValues {
  note: string
  visited: string
  name: string
  email: string
}

export interface NoteCheck {
  ok: boolean
  code?: NoteErrorCode
  values: NoteValues
}

const str = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max)

export function validateNote(body: Record<string, unknown>, ip: string): NoteCheck {
  const values: NoteValues = {
    note:    str(body.note, NOTE_MAX + 1),
    visited: str(body.visited, 10),
    name:    str(body.name, NAME_MAX),
    email:   str(body.email, EMAIL_MAX),
  }
  const fail = (code: NoteErrorCode): NoteCheck => ({ ok: false, code, values })

  // Honeypot: a hidden field only a bot fills in.
  if (str(body.website, 200) !== '') return fail('bot')

  const age = stampAgeSeconds(str(body.ts, 20), str(body.sig, 40))
  if (age === null || age < MIN_FILL_SECONDS || age > MAX_FORM_AGE_HOURS * 3600) return fail('bot')

  if (values.note.length < NOTE_MIN) return fail('short')
  if (values.note.length > NOTE_MAX) return fail('long')
  if ((values.note.match(/https?:\/\//gi) ?? []).length > MAX_LINKS) return fail('links')
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email)) return fail('bad')
  if (values.visited && !/^\d{4}-\d{2}-\d{2}$/.test(values.visited)) return fail('bad')

  if (rateLimited(ip)) return fail('rate')
  return { ok: true, values }
}

// ── Mail ─────────────────────────────────────────────────────────────────────

export interface NotePayload {
  city: City
  page: WikiPage
  displayTitle: string
  lang: Lang
  values: NoteValues
  ip: string
  userAgent: string
}

function formatBody(p: NotePayload): string {
  const { city, page, values } = p
  const url = `${SITE_URL}${wikiUrl(city.slug, page.slug, p.lang)}`
  const sentAt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: city.timezone, dateStyle: 'short', timeStyle: 'short',
  }).format(new Date())
  const rows: [string, string][] = [
    ['Город',            city.name.ru],
    ['Страница',         p.displayTitle],
    ['Слаг',             page.slug],
    ['URL',              url],
    ['Тип / домен',      `${page.type}${page.domain ? ` · ${page.domain}` : ''}`],
    [city.districtLabel, `${page.district ?? '—'}${page.quarter ? ` · квартал: ${page.quarter}` : ''}`],
    ['Координаты',       page.coords ? `${page.coords[0]}, ${page.coords[1]}` : '—'],
    ['Дата визита',      values.visited || '—'],
    ['Отправлено',       `${sentAt} (${city.timezone})`],
    ['Язык формы',       p.lang],
    ['Автор',            [values.name || 'без имени', values.email || 'без адреса'].join(' · ')],
    ['IP / UA',          `${p.ip} · ${p.userAgent.slice(0, 200)}`],
  ]
  const width = Math.max(...rows.map(([k]) => k.length))
  const head = rows.map(([k, v]) => `${(k + ':').padEnd(width + 2)}${v}`).join('\n')
  return `${head}\n\nТекст заметки:\n---\n${values.note}\n---\n`
}

/** Sends the note. Throws when the mail API answers with anything but 2xx. */
export async function sendNote(p: NotePayload): Promise<void> {
  const prefix = SUBJECT_PREFIX_OVERRIDE || p.city.brand
  const subject = `[${prefix}] Заметка · ${p.page.slug}`
  const payload: Record<string, unknown> = {
    from: FROM,
    to: [TO],
    subject,
    text: formatBody(p),
  }
  if (p.values.email) payload.reply_to = p.values.email

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`)
  }
}
