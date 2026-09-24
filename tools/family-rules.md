## Loiter Family Rules

These rules are **the same in every Loiter wiki**. This section is a copy of
`Loiter/tools/family-rules.md`: edit it there and run `node tools/sync-family-rules.mjs`
from the `Loiter` root — `npm run check` fails while any copy differs. Where a rule below and
a city-specific section above seem to disagree, this section wins.

### Titles carry the original name

The `title:` of every map object (district or region, quarter or settlement, place, railway,
ferry) is what the map tooltip, the list and the page heading show, so it names the object in
the original language as well:

- **Places:** «Русское название (Original)» — «Королевский дворец (Budavári Palota)». In the
  rural wiki the settlement follows the original: «Музей Эдьри Йожефа (Egry József Múzeum,
  Badacsony)». A parenthesis holding only a town — «(Tata)», «(Кестхей)» — is not an original.
- **Districts:** «Name (Original, number)» — «Митте (Mitte, Bezirk 01)», «Будавар (Budavár,
  I район)»; a district without an official name: «XIII район (Angyalföld, Újlipótváros)».
- **English titles** carry the original too — «Neptune Fountain (Neptunbrunnen)» — and drop
  the parenthesis only when the English name *is* the original («Albertina»).
- A name kept in the Latin script needs nothing more: «House of One», «Музей Urban Nation».
- No `|` or ` / ` between names outside the parenthesis; two originals may share one:
  «(Neusiedler See / Fertő-tó)».
- The body's leading `# H1` repeats the title. The engine hides it (the template renders the
  title), so a wrong H1 goes unnoticed — keep them equal.
- A title value that opens with a quote must itself be quoted
  (`title: '"Vaulting" Sculpture (Tatabánya)'`), or YAML fails and the page is not served.

### Sources live on the about page only

A reader finds the sources in one place: the about page. So:

- no `## Источник(и)` / `## Sources` section on a page, and no page per source;
- no source named in the text — not «По данным [сайт]», not «According to …», not a
  `[[source-slug|…]]` link. When sources disagree, say so neutrally («по одной версии…
  по другой…», «по разным данным, 1082 или 1231 год») and record who says what in
  `wiki/log.md`;
- provenance is kept centrally: the slug in the page's `sources:` frontmatter; a row
  `` `slug` | URL | short description `` in the «Источники» table of `wiki/index.md`; the
  immutable copy in `raw/` (local, git-ignored);
- every site a page draws on is listed in `web/src/page-about.ts` **and** in the aggregator's
  `Loiter/web/src/about/{site}.ts`, with a brief, unqualified description.

### `fame:` on every city place

Every `type: place` page of a city wiki carries `fame: 1–5` — how mass-touristic the object
is, relative to its own city: `1` only locals notice, `5` is on every postcard. It drives the
aggregator's quiet-places slider. Seed new places with `node tools/seed-fame.mjs wiki_{city}`
from the `Loiter` root and read its report: it rates from Wikipedia coverage and is wrong about
one in ten — a place matched to its street, its district or the building next door comes out
too high, and one it cannot match comes out as `1`. Hand-set values survive a re-run. The
English page carries the same value. The rural wiki does not rate its places.

### Practical information

Visiting facts do not belong in the prose. A place that has any goes in a
`## Практическая информация` section near the end — **a plain bullet list**, one fact per line,
in the order `Адрес` / `Часы` / `Билеты` / `Сайт`, then any of `Расположение`, `Доступ`,
`Как добраться`, `Сезон`, `Телефон`, `Email`. A website is a markdown link with the bare domain
as its text: `- Сайт: [muzeumvac.hu](https://muzeumvac.hu)`. The English page has the same list
under `## Practical Information` — not «Visit», «Access» or «Getting There».

### Domains

`domain:` takes values from one vocabulary, `DOMAIN_VOCABULARY` in
`Loiter/web/src/constants.ts`: architecture, history, museums, sights, lookout, nature,
religion, cuisine, culture, people, heraldry, practical, thermal, transport. Only `museums`,
`nature`, `thermal`, `lookout` and `transport` colour a marker; the rest leave it in `sights`.
A new value needs an entry there first, or the map treats it as sights without a word.

### Images

CSS caps a page image at 440 px wide, and sources hand out full-resolution originals. After an
ingest run `node tools/shrink-images.mjs wiki_{name}` from the `Loiter` root: it resizes
anything wider than 880 px, leaves PNG alone and is idempotent.

### Reader-facing text

The project is **Loiter**, not «вики»: no page, heading or UI string calls it a wiki or refers
to itself («интересна этой вики» is wrong). Russian is the base language; the `.en.md` file is
its English mirror with the same frontmatter and `## See Also` for `## См. также`.

### The standalone app

`web/` in this subproject is a copy of one family engine; the engine readers see is the
aggregator at `Loiter/web`. The copies are held to the reference engine
(`ENGINE_REFERENCE_DIR` in `Loiter/web/src/cities.ts`) by `npm run check`: only site data may
differ — brand, port, map centre, state key, timezone, the source list. An engine fix is made
in every subproject in the same sweep. The user runs the servers; do not start one to check
content.

### After an ingest

Run `npm run check` in `Loiter/web`. It reports, among other things, a title without its
original, a source named on a page, a site missing from the about lists, a place without
`fame`, a domain outside the vocabulary and a wikilink that leads nowhere.

### No email in outgoing requests

Research requests — Wikipedia and MediaWiki APIs, Nominatim, Photon, Commons downloads, any
site — never carry an email address: not the personal one, not the corporate one, not in a
`User-Agent`, a header, a query string or a form field. A contact-bearing `User-Agent`, where
an API asks for one, names the project and its repository URL instead:
`LoiterResearch/1.0 (+https://github.com/Bonzatina)`. On 2026-09-24 research agents put the
personal address into Wikipedia `User-Agent` headers without being asked; this rule exists
so that does not happen again. The address in Git commits below is unaffected.

### Git

Commits are `bonzatina <martymckul@gmail.com>`. The machine's global identity is a corporate
one; the conditional include in `~/.gitconfig` for everything under
`C:/Users/sergei.kulikov/projects/Loiter/` supplies the personal one, and the local config
repeats it. The remote is reached through the `github-personal` SSH alias — plain
`git@github.com` picks the work key.
