import type { City } from './cities'

// ── Shared visual vocabulary ─────────────────────────────────────────────────
// One definition for every site. Change a colour here and it changes everywhere;
// there is no per-site colour table and no per-site stylesheet.
//
// The colours are shared ACROSS taxonomies on purpose. A reader switching from a
// city to the rural wiki must be able to keep reading the map: the same hue has to
// mean the same kind of thing on both sides, and a hue must never mean two
// different things. Hence `region` is the same green as `district` and
// `settlement` the same blue-grey as `quarter` — the analogous slots — while
// `transport` is deliberately NOT the museum purple it used to collide with.

/**
 * Marker colours by page `type`.
 *
 * `district`/`region` is a site's top-level area (Bezirk, kerület, mestská časť,
 * Stadtbezirk, dzielnica, or a rural region); `quarter`/`settlement` is a named
 * area inside one; `place` is a specific attraction and gets recoloured by domain
 * below. `railway`/`ferry` are rural-only linear objects.
 */
export const MARKER_COLOR: Record<string, string> = {
  district:   '#2e7d32',
  region:     '#2e7d32',   // same slot as district — same green
  quarter:    '#607d8b',
  settlement: '#607d8b',   // same slot as quarter — same blue-grey
  place:      '#a0b930',
  railway:    '#795548',
  ferry:      '#795548',
}

/** Domain colours for `place` markers. A place's first matching domain wins. */
export const DOMAIN_COLOR: Record<string, string> = {
  nature:    '#00acc1',
  thermal:   '#e8743b',
  museums:   '#8e6c9e',
  lookout:   '#c49a2a',
  transport: '#795548',
}

/**
 * Every legend filter button the engine knows, in display order. The key MUST
 * equal either a page `type` (district/region/quarter/settlement) or a place
 * `domain` (sights/museums/nature/thermal/lookout/transport) for filtering to
 * work; `sights` is the default bucket for places without a filtered domain.
 * `transport` also covers the `railway` and `ferry` page types — see
 * `taxonomy.routeTypes` and `isVisible` in scripts/map.js.
 *
 * A site shows its taxonomy's two structural buttons plus `sights` plus whichever
 * domains it lists in `site.domains` — see `legendFor` below. Adding a domain to
 * the family means one entry here, one in DOMAIN_COLOR, and a label in
 * UI_STRINGS.*.legend.
 */
export const LEGEND_TYPES: Record<string, string> = {
  district:   '#2e7d32',
  region:     '#2e7d32',
  quarter:    '#607d8b',
  settlement: '#607d8b',
  sights:     '#a0b930',
  museums:    '#8e6c9e',
  nature:     '#00acc1',
  thermal:    '#e8743b',
  lookout:    '#c49a2a',
  transport:  '#795548',
}

/**
 * The legend for one site: its taxonomy's structural buttons, then `sights`, then
 * the domains it actually has objects for, in the canonical LEGEND_TYPES order.
 * A city with no thermal baths simply never lists `thermal` and the button does
 * not appear — which is what the standalone engines achieved by commenting the
 * line out in each city's copy of this file.
 */
export function legendFor(city: City): Record<string, string> {
  const allowed = new Set([
    city.taxonomy.areaType,
    city.taxonomy.subareaType,
    'sights',
    ...city.domains,
  ])
  return Object.fromEntries(
    Object.entries(LEGEND_TYPES).filter(([type]) => allowed.has(type)),
  )
}

export const UI_STRINGS = {
  ru: {
    open:            'Открыть →',
    startStation:    'начальная станция',
    terminus:        'конечная',
    // Заголовки разделов списка — локализованы; всегда по-английски остаётся
    // только легенда-фильтры над картой (см. `legend` ниже). Какая пара
    // используется, решает taxonomy.labelKeys: районы/кварталы или регионы/
    // населённые пункты.
    districts:       'Районы',
    quarters:        'Кварталы',
    regions:         'Регионы',
    settlements:     'Населённые пункты',
    places:          'Достопримечательности',
    railways:        'Железные дороги',
    ferries:         'Паромные переправы',
    concepts:        'Концепции',
    people:          'Персоналии',
    noItems:         'Нет объектов в текущей области — переместите карту или уменьшите масштаб.',
    clearSel:        '✕ Сбросить выделение',
    drawActive:      '◻ Рисуйте область…',
    drawIdle:        '⬚ Выделить зону',
    whereAmI:        '⊕ Где я?',
    locating:        '⊙ Определяю…',
    iAmHere:         '⊙ Я здесь',
    noGeo:           'Геолокация не поддерживается вашим браузером.',
    helpNavTitle:    'Навигация',
    helpNavBody:     'Список обновляется по видимой области при перемещении и зуме.',
    helpSelTitle:    'Выделение зоны',
    helpDesktop:     'Десктоп:',
    helpMobile:      'Мобильный:',
    helpMobileHint:  'кнопка «⬚ Выделить зону» → провести пальцем.',
    helpEsc:         '— сбросить.',
    backToMap:           '← Карта',
    showOnMap:           'Показать на карте →',
    searchPlaceholder:   'Поиск по названию, тегу, району…',
    // Мультигородская обвязка — этого не было в одногородних движках.
    about:               'О проекте',
    allCities:           'Все проекты',
    chooseCity:          'Выберите проект',
    groupCities:         'Города',
    groupRural:          'Сельская местность',
    // Три формы для согласования с числительным — см. src/plural.ts.
    pages:               { one: 'страница', few: 'страницы', many: 'страниц' },
    geo: {
      findMe:  '⊕ Найти меня',
      hint:    'Определим, в каком из городов вы находитесь, и откроем карту вокруг вас.',
      denied:  'Доступ к геолокации запрещён. Разрешите его в настройках браузера и попробуйте снова.',
      failed:  'Не удалось определить местоположение. Попробуйте ещё раз.',
      // {city} и {km} подставляются скриптом.
      far:     'Вы далеко от наших городов. Ближайший — {city}, около {km} км.',
      found:   'Вы рядом с {city} — открываем карту…',
    },
    notes: {
      button:      'Оставить заметку',
      intro:       'Были здесь? Напишите, что увидели, — заметка уйдёт модератору, и, если она добавляет к странице что-то стоящее, попадёт в текст.',
      noteLabel:   'Заметка',
      notePh:      'Что стоит знать тому, кто пойдёт сюда после вас: чего нет на странице, что изменилось, на что обратить внимание…',
      visited:     'Дата посещения',
      name:        'Имя',
      email:       'E-mail',
      optional:    'необязательно',
      submit:      'Отправить заметку',
      privacy:     'Заметка уходит на почту модератора и не публикуется автоматически. E-mail нужен только для ответа и нигде не показывается.',
      ok:          'Спасибо! Заметка отправлена модератору.',
      errShort:    'Заметка слишком короткая — напишите хотя бы пару фраз.',
      errLong:     'Заметка слишком длинная: уместите в 4000 знаков.',
      errLinks:    'Слишком много ссылок в тексте — оставьте не больше двух.',
      errBot:      'Форма не принята: похоже на автоматическую отправку. Попробуйте ещё раз.',
      errRate:     'Слишком много заметок подряд с этого адреса. Попробуйте позже.',
      errBad:      'Проверьте поля: адрес или дата заполнены неверно.',
      errMail:     'Не удалось отправить письмо. Скопируйте текст и пришлите его почтой:',
    },
    legend: {
      district:   'districts',
      region:     'regions',
      quarter:    'quarters',
      settlement: 'settlements',
      sights:     'sights',
      museums:    'museums',
      nature:     'nature',
      thermal:    'baths',
      lookout:    'lookouts',
      transport:  'transport',
    } as Record<string, string>,
  },
  en: {
    open:            'Open →',
    startStation:    'start station',
    terminus:        'terminus',
    districts:       'Districts',
    quarters:        'Quarters',
    regions:         'Regions',
    settlements:     'Settlements',
    places:          'Sights',
    railways:        'Railways',
    ferries:         'Ferries',
    concepts:        'Concepts',
    people:          'People',
    noItems:         'No items in the current view — pan or zoom out.',
    clearSel:        '✕ Clear selection',
    drawActive:      '◻ Draw area…',
    drawIdle:        '⬚ Select area',
    whereAmI:        '⊕ Where am I?',
    locating:        '⊙ Locating…',
    iAmHere:         '⊙ I\'m here',
    noGeo:           'Geolocation is not supported by your browser.',
    helpNavTitle:    'Navigation',
    helpNavBody:     'The list updates to show items in the current map view as you pan and zoom.',
    helpSelTitle:    'Area selection',
    helpDesktop:     'Desktop:',
    helpMobile:      'Mobile:',
    helpMobileHint:  'tap «⬚ Select area» button → drag.',
    helpEsc:         '— clear.',
    backToMap:           '← Map',
    showOnMap:           'Show on map →',
    searchPlaceholder:   'Search by name, tag, district…',
    about:               'About',
    allCities:           'All projects',
    chooseCity:          'Choose a project',
    groupCities:         'Cities',
    groupRural:          'Countryside',
    pages:               { one: 'page', few: 'pages', many: 'pages' },
    geo: {
      findMe:  '⊕ Find me',
      hint:    'We will work out which of the cities you are in and open the map around you.',
      denied:  'Location access was denied. Allow it in your browser settings and try again.',
      failed:  'Could not determine your location. Please try again.',
      far:     'You are far from our cities. The nearest is {city}, about {km} km away.',
      found:   'You are near {city} — opening the map…',
    },
    notes: {
      button:      'Leave a note',
      intro:       'Been here? Write what you saw — the note goes to the moderator, and if it adds something worth having, it makes it into the page.',
      noteLabel:   'Your note',
      notePh:      'What should the next visitor know: what the page misses, what has changed, what to look out for…',
      visited:     'Date of visit',
      name:        'Name',
      email:       'E-mail',
      optional:    'optional',
      submit:      'Send note',
      privacy:     'The note goes to the moderator by e-mail and is not published automatically. Your address is used only to reply and is never shown.',
      ok:          'Thank you! Your note has been sent to the moderator.',
      errShort:    'The note is too short — a couple of sentences, please.',
      errLong:     'The note is too long: keep it under 4000 characters.',
      errLinks:    'Too many links in the text — two at most.',
      errBot:      'The form was rejected: this looked like an automated submission. Please try again.',
      errRate:     'Too many notes from this address in a row. Please try later.',
      errBad:      'Please check the fields: the address or the date is not valid.',
      errMail:     'The message could not be sent. Copy your text and mail it to:',
    },
    legend: {
      district:   'districts',
      region:     'regions',
      quarter:    'quarters',
      settlement: 'settlements',
      sights:     'sights',
      museums:    'museums',
      nature:     'nature',
      thermal:    'baths',
      lookout:    'lookouts',
      transport:  'transport',
    } as Record<string, string>,
  },
} as const
export type UIStrings = typeof UI_STRINGS.ru

/** Contact shown on the about page and used as the note mailto: fallback. */
export const PROJECT_EMAIL = 'loiter.traveler@gmail.com'

/** Support link on the about page. */
export const KOFI_URL = 'https://ko-fi.com/bonzatina'
