import type { AboutData } from './types'

// Vienna has just been started: the wiki is an empty skeleton and nothing has
// been ingested yet, so the source list is genuinely empty rather than seeded.
// Rows are added as sources are actually used — a domain listed here is a claim
// that this wiki drew on it. Group them thematically as the list grows:
// tourism portals → Wikipedia → official sites → museums → publications → blogs.
export const viennaAbout: AboutData = {
  topics: {
    ru: 'архитектура, история, дворцы, музеи, парки, кофейни, вино, культура',
    en: 'architecture, history, palaces, museums, parks, coffee houses, wine, culture',
  },
  sources: [],
}
