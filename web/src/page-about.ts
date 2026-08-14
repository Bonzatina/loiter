import { CITIES, type City } from './cities'
import type { Lang } from './lang'
import { renderHeader, renderHtmlDocument } from './shared'
import { PROJECT_EMAIL, KOFI_URL } from './constants'
import { homeUrl } from './routes'

// ── About page ───────────────────────────────────────────────────────────────
// One skeleton, two contexts:
//
//   /about          — the project: shared prose, a list of the cities, no sources.
//   /{city}/about   — the same shared prose plus THAT city's source list.
//
// The shared prose is written once here. It used to be copy-pasted into five
// nearly identical page-about.ts files, one per subproject.
//
// A city contributes exactly two things, both from `city.about`
// (src/about/{slug}.ts): the topic enumeration of the opening sentence, and its
// ordered source list.

export function renderAboutPage(city: City | undefined, lang: Lang = 'ru'): string {
  const isEn = lang === 'en'
  const brand = city ? city.brand : 'Loiter'
  const topics = city
    ? city.about.topics[lang]
    : (isEn
        ? 'architecture, history, museums, parks, culture'
        : 'архитектура, история, музеи, парки, культура')

  // Without a city the sentence describes the family, not one of its members.
  const intro1 = city
    ? (isEn
        ? `${brand} is an interactive encyclopaedia for exploring the city: ${topics}, and specific places worth seeing with your own eyes.`
        : `${brand} — интерактивная энциклопедия для исследования города: ${topics} и конкретные места, которые стоит увидеть своими глазами.`)
    : (isEn
        ? `Loiter is a family of interactive encyclopaedias for exploring cities on foot: ${topics}, and specific places worth seeing with your own eyes.`
        : `Loiter — семейство интерактивных энциклопедий для исследования городов пешком: ${topics} и конкретные места, которые стоит увидеть своими глазами.`)

  const t = {
    pageTitle: isEn ? `About — ${brand}` : `О проекте — ${brand}`,
    h1:        isEn ? 'About' : 'О проекте',
    intro2:    isEn
      ? 'The project is personal and does not claim completeness or academic rigour. The choice of topics, places, and materials is subjective and reflects the author\'s own interests.'
      : 'Проект ведётся в личных целях и не претендует на полноту или академическую строгость. Выбор тем, мест и материалов субъективен и отражает личные интересы автора.',
    note:      isEn
      ? 'A language model (LLM) is used to process and structure material. Although all information is drawn from open sources, errors of interpretation or inaccuracies are possible. If you notice a mistake — it is probably there.'
      : 'При обработке и структурировании материалов используется языковая модель (LLM). Несмотря на то что все сведения берутся из открытых источников, ошибки интерпретации или неточности возможны. Если вы заметили ошибку — она там, скорее всего, есть.',
    support:   isEn ? 'Support the project:' : 'Поддержать проект:',
    citiesH2:  isEn ? 'Cities' : 'Города',
    sourcesH2: isEn ? 'Sources' : 'Источники',
    sourceIntro: isEn
      ? 'Open resources used as sources:'
      : 'Открытые ресурсы, использованные как источники:',
    // Only meaningful where images are actually shown, i.e. alongside a source list.
    images:    isEn
      ? `Photographs on place pages are taken from the open sources listed below. Copyright on images belongs to their respective owners. If you are a rights holder and wish to request removal of an image, please write to <a href="mailto:${PROJECT_EMAIL}">${PROJECT_EMAIL}</a>.`
      : `Фотографии на страницах объектов взяты из открытых источников, перечисленных ниже. Авторские права на изображения принадлежат их правообладателям. Если вы правообладатель и хотите запросить удаление изображения, напишите на <a href="mailto:${PROJECT_EMAIL}">${PROJECT_EMAIL}</a>.`,
    imagesProject: isEn
      ? `Photographs on place pages are taken from open sources, listed on each city's about page. Copyright on images belongs to their respective owners. If you are a rights holder and wish to request removal of an image, please write to <a href="mailto:${PROJECT_EMAIL}">${PROJECT_EMAIL}</a>.`
      : `Фотографии на страницах объектов взяты из открытых источников, перечисленных на странице «О проекте» каждого города. Авторские права на изображения принадлежат их правообладателям. Если вы правообладатель и хотите запросить удаление изображения, напишите на <a href="mailto:${PROJECT_EMAIL}">${PROJECT_EMAIL}</a>.`,
    sourcesElsewhere: isEn
      ? 'Sources are listed per city — each city\'s about page carries its own list.'
      : 'Источники перечислены по городам — у каждого города свой список на его странице «О проекте».',
    // A city that is in the registry but has not been ingested yet. Better to say
    // so than to print an empty list under a heading promising sources.
    sourcesNone: isEn
      ? 'This city has only just been started — nothing has been ingested yet, so there is nothing to list.'
      : 'Город только начат — источники ещё не разбирались, перечислять пока нечего.',
  }

  // ── The part that differs between the two contexts ────────────────────────
  const tail = city
    ? city.about.sources.length === 0
      ? `
  <h2>${t.sourcesH2}</h2>

  <p>${t.sourcesNone}</p>`
      : `
  <h2>${t.sourcesH2}</h2>

  <p>${t.sourceIntro}</p>

  <p class="images-note">${t.images}</p>

  <ul class="sources-list">${city.about.sources.map(s => `
    <li>
      <span class="src-domain">${s.domain}</span>
      <span class="src-desc">${s[lang]}</span>
    </li>`).join('')}
  </ul>`
    : `
  <h2>${t.citiesH2}</h2>

  <ul class="about-cities">${CITIES.map(c => `
    <li><a href="${homeUrl(c.slug, lang)}">${c.name[lang]}</a></li>`).join('')}
  </ul>

  <p class="images-note">${t.imagesProject}</p>

  <p class="images-note">${t.sourcesElsewhere}</p>`

  return renderHtmlDocument({
    lang,
    title: t.pageTitle,
    styles: ['/styles/shared.css', '/styles/about.css'],
    body: `${renderHeader(city, 'about', { current: lang })}
<div class="page-body">
  <h1>${t.h1}</h1>

  <p>${intro1}</p>

  <p>${t.intro2}</p>

  <div class="note">${t.note}</div>

  <div class="support-section">
    <p>${t.support}</p>
    <a href="${KOFI_URL}" class="donate-button">Ko-fi</a>
  </div>
${tail}
</div>`,
  })
}
