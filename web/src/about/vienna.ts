import type { AboutData } from './types'

// Rows are added as sources are actually used — a domain listed here is a claim
// that this city's pages drew on it. Group them thematically as the list grows:
// tourism portals → Wikipedia → official sites → museums → publications → blogs.
export const viennaAbout: AboutData = {
  topics: {
    ru: 'архитектура, история, дворцы, музеи, парки, кофейни, вино, культура',
    en: 'architecture, history, palaces, museums, parks, coffee houses, wine, culture',
  },
  sources: [
    { domain: 'geschichtewiki.wien.gv.at', ru: 'Историческая энциклопедия города Вены', en: 'Historical encyclopaedia of the city of Vienna' },
    { domain: 'de.wikipedia.org',          ru: 'Немецкая Википедия',                    en: 'German Wikipedia' },
    { domain: 'commons.wikimedia.org',     ru: 'Викисклад',                             en: 'Wikimedia Commons' },
    { domain: 'wien.gv.at',                ru: 'Городской портал Вены',                 en: 'City of Vienna portal' },
    { domain: 'schoenbrunn.at',            ru: 'Дворец Шёнбрунн',                       en: 'Schönbrunn Palace' },
    { domain: 'zoovienna.at',              ru: 'Зоопарк Шёнбрунна',                     en: 'Schönbrunn Zoo' },
    { domain: 'wienmuseum.at',             ru: 'Венский музей',                         en: 'Wien Museum' },
    { domain: 'friedhoefewien.at',         ru: 'Кладбища Вены',                         en: 'Vienna cemeteries' },
  ],
}
