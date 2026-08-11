import type { AboutData } from './types'

export const wroclawAbout: AboutData = {
  topics: {
    ru: 'архитектура, история, музеи, парки, культура',
    en: 'architecture, history, museums, parks, culture',
  },
  sources: [
    { domain: 'visitwroclaw.eu',        ru: 'Официальный туристический портал',              en: 'Official tourism portal' },
    { domain: 'wroclaw.pl',             ru: 'Официальный сайт города Вроцлав',               en: 'Official website of the city of Wrocław' },
    { domain: 'wroclawguide.com',       ru: 'Городской путеводитель от местных жителей',     en: 'City guide written by locals' },
    { domain: 'pl.wikipedia.org',       ru: 'Польская Википедия',                            en: 'Polish Wikipedia' },
    { domain: 'en.wikipedia.org',       ru: 'Английская Википедия',                          en: 'English Wikipedia' },
    { domain: 'commons.wikimedia.org',  ru: 'Викисклад',                                     en: 'Wikimedia Commons' },
    { domain: 'zajezdnia.org',          ru: 'Центр истории «Заездня»',                       en: 'Depot History Centre' },
    { domain: 'halastulecia.pl',        ru: 'Зал Столетия',                                  en: 'Centennial Hall' },
    { domain: 'ma.wroc.pl',             ru: 'Музей архитектуры во Вроцлаве',                 en: 'Museum of Architecture in Wrocław' },
    { domain: 'muzeum.uni.wroc.pl',     ru: 'Музей Вроцлавского университета',               en: 'Museum of the University of Wrocław' },
  ],
}
