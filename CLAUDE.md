1# Loiter — Schema of the Combined Site

The **Loiter** family root. This directory holds one aggregator web app plus the city
wiki subprojects it draws content from. The aggregator serves every city from a
**single shared engine** with a city switcher in the header; each subproject keeps its
own repository, its own content, and its own standalone app, all unchanged.

**The rule that shapes everything here:** engine code, templates, styles, marker
colours, the legend and the UI strings exist **once**, at the root. Anything that
genuinely differs between cities lives as *data* in one registry file
(`web/src/cities.ts`). Changing a marker colour is one edit in one place and it
applies to every city.

## Directory Layout

```
Loiter/
├── CLAUDE.md                   ← this file — schema of the COMBINED site
├── web/                        ← the aggregator app (Express + Leaflet, TypeScript)
│   ├── src/
│   │   ├── cities.ts           ← THE SITE REGISTRY — the only per-site data
│   │   ├── taxonomy.ts         ← the two geographies: city and rural
│   │   ├── map-routes.ts       ← railway/ferry polylines (rural only)
│   │   ├── about/{slug}.ts     ← per-city about-page prose + source lists
│   │   ├── lang.ts             ← the Lang / Localized types
│   │   ├── constants.ts        ← shared marker colours, legend, UI strings
│   │   ├── wiki.ts             ← multi-root content loader (one root per city)
│   │   ├── server.ts           ← routing, static mounts, notes endpoint
│   │   ├── page-map.ts / page-detail.ts / page-about.ts / page-cities.ts
│   │   ├── shared.ts           ← <html> shell, header, language + city switcher
│   │   ├── routes.ts           ← URL builders (city- and language-aware)
│   │   └── notes.ts            ← visitor notes → Resend
│   ├── scripts/map.js          ← shared Leaflet client; no city constants inside
│   ├── styles/                 ← shared CSS (shared / map / detail / about / cities)
│   └── assets/                 ← aggregator's own images only (logo, city cards)
├── wiki_berlin/                ← city subproject — git submodule, never edited here
├── wiki_bratislava/            ← city subproject
├── wiki_budapest/              ← city subproject
├── wiki_dresden/               ← city subproject
├── wiki_wroclav/               ← city subproject
└── wiki_rural_travel/          ← the rural wiki — a second taxonomy, see below
```

### Subprojects are read-only from here

The aggregator **reads** `wiki_{city}/wiki/**.md` and **serves** `wiki_{city}/web/assets/`.
It never writes into a subproject and never changes subproject code. Content work
(ingest, lint, translations, images) happens inside the subproject, under that
subproject's own `CLAUDE.md` — those files remain the authority on page conventions,
naming, language and style for their city. This file governs only the shared engine.

When a subproject's engine and this one drift, this one wins: the fix is to teach the
registry a new field, not to special-case a city in the code.

### Two taxonomies — `web/src/taxonomy.ts`

The family speaks two shapes of geography, and the engine does not branch on which:

- **city** — places nest under a `district` and an optional `quarter`; transport is out
  of scope.
- **rural** — places nest under a `region` and an optional `subregion`, and the wiki adds
  heritage railways and ferry crossings drawn as lines.

Each site declares a taxonomy; the loader normalises both frontmatter dialects into ONE
internal pair, **`area` and `subarea`**, and every renderer reads only those. `district`,
`quarter`, `region` and `subregion` appear nowhere downstream — not in `map.js`, not in the
templates. Adding a third geography means an entry in `taxonomy.ts`, not an `if`.

The taxonomy also carries `flatDirs`, `ignoreDirs`, `typeDirs`, the two page types
(`areaType`/`subareaType`), the `routeTypes` the `transport` legend button filters, and the
UI keys for the list headings. `ignoreDirs` matters: an unlisted top-level directory is
otherwise **treated as an area** and probed for `typeDirs`, so the rural wiki's `sources/`
(400 provenance pages its own app renders in no section) and `raw/` are named explicitly
rather than left to luck.

`kind: 'city' | 'rural'` is separate from the taxonomy and only affects presentation: the
picker and the switcher group by it so the rural wiki is not offered as a sixth city.

## The City Registry — `web/src/cities.ts`

One entry per city, and it is the **only** place a city name, coordinate or port-like
constant may appear. Everything the old per-city engines hard-coded becomes a field:

| Field | Example | Replaces (in the old per-city engines) |
|---|---|---|
| `slug` | `berlin` | — (new: the URL segment) |
| `dir` | `wiki_berlin` | `WIKI_ROOT` in `wiki.ts`, the `/assets` static mount |
| `kind` | `city` / `rural` | — (new: how the picker and switcher group) |
| `taxonomy` | `CITY_TAXONOMY` | the folder names and field names in `wiki.ts`, `map.js` |
| `routes` | `NO_ROUTES` / `RURAL_ROUTES` | the `ROUTES` array in `constants.ts` |
| `brand` | `Loiter: Berlin` | the literal in `page-map.ts`, `page-detail.ts`, `shared.ts` |
| `name.ru` / `name.en` | `Берлин` / `Berlin` | city switcher and picker labels |
| `center` / `zoom` | `[52.5200, 13.4050]` / `11` | the `setView(...)` line in `map.js` |
| `stateKey` | `berlin_map_state_v1` | `STATE_KEY` in `map.js` |
| `timezone` | `Europe/Berlin` | the `timeZone` in `notes.ts` |
| `districtLabel` | `Округ` (Berlin) / `Район` (others) | the note-mail label in `notes.ts` |
| `domains` | `['museums','nature','lookout']` | the per-city `DOMAIN_COLOR` / `LEGEND_TYPES` trimming |
| `cardImage` | `brandenburger-tor.jpg` | — (new: the picker card) |
| `about` | RU/EN topic list + ordered source list | the whole per-city `page-about.ts` |

Both content paths are **derived** from `dir` by `contentRoot(city)` and
`assetsRoot(city)`, because the family layout (`{dir}/wiki`, `{dir}/web/assets`) is a
fixed convention — deriving them makes a wrong path impossible to write.

Notes on two of the fields:

- **`domains`** is a *subset selector*, not a colour table. The colours themselves live
  once in `constants.ts` (`DOMAIN_COLOR`, `LEGEND_TYPES`); a city lists which domains it
  actually has objects for, and the legend renders only those. This is how `thermal`
  shows up in Budapest and stays hidden everywhere else — no per-city colour code.
- **`about`** carries only the topic enumeration of the opening sentence and the ordered
  source list with RU/EN descriptions. The page skeleton, the LLM disclaimer, the
  image-rights paragraph, the notes paragraph and the Ko-fi block are shared text in
  `page-about.ts`. Because these lists run to dozens of rows (Bratislava has 48), they
  live one file per city under `src/about/{slug}.ts` and are referenced from the registry
  — still city data, just too long to keep the registry table readable.

  **Sources are per city and only per city.** `renderAboutPage(city | undefined, lang)`
  renders the shared prose either way; the source list appears only when a city is given.
  The project-level `/about` shows a city list in its place, because there is no city
  context from which to choose sources. The shared prose is therefore rendered in six
  places — deliberately: it is one text in one place in the code, and a reader who lands
  on a city's about page should not have to go elsewhere to learn what the project is.

Adding a site = one registry entry + one `src/about/` file + the submodule. No other code
change, as long as it speaks a taxonomy that already exists.

**The type is still called `City`** although the registry now holds the rural wiki too.
That is historical; `kind` is what to branch on. Renaming `City` → `Site` throughout is a
worthwhile follow-up, deliberately not done in the same change that added a second
taxonomy to a live deployment.

**Slug ≠ directory.** `slug` is user-facing and `dir` is historical, so they are allowed
to differ: Wrocław is served at `/wroclaw` while its subproject folder and repository
keep the existing `wroclav` spelling.

`cities.ts` asserts its own invariants at import time — slug shape, no duplicates, and no
collision with `RESERVED_SEGMENTS` (`en`, `about`, `assets`, `styles`, `scripts`, `note`,
`cities`). A bad registry entry fails at startup, not on a request.

## URLs

City slugs namespace everything, because **page slugs collide across cities**:
`Hauptbahnhof` and `Kunstgewerbemuseum` each exist in both Berlin and Dresden today, and
the naming conventions guarantee more as the wikis grow. A flat `/:slug` route would
silently serve the wrong city's page. `npm run check` prints the current collision list.

```
/                        → city picker (landing) — cards with name, page count, photo
/about                   → project about page: shared prose + city list, NO sources
/{city}                  → map + list for that city
/{city}/about            → the same shared prose + THAT city's source list
/{city}/{slug}           → wiki page
/{city}/assets/{file}    → that city's images (served from wiki_{city}/web/assets)
/en, /en/about, /en/{city}, /en/{city}/about, /en/{city}/{slug}   → English mirror
/note                    → POST, visitor notes (city travels in the form body)
/styles/*, /scripts/*    → shared static
```

Language stays the outermost segment, as in the subprojects: `/en/...` serves English
and falls back to the Russian file when no `.en.md` exists.

**Body rewriting.** Page bodies were written for a single-city site and contain
`![…](/assets/file.jpg)` and `[[Slug]]`. The renderer rewrites both to the city
namespace — `/{city}/assets/file.jpg` and `{langPrefix}/{city}/Slug` — so the source
markdown never has to change and stays valid in the standalone subproject app.

**Switching city** preserves language and lands on the target city's **map**, not a
translated slug: pages do not correspond across cities. The last visited city is
remembered client-side so a return visit to `/` can offer it.

**One city at a time — strictly.** The map, the list and the search always operate
inside a single city's bounds, exactly as in the subprojects. There is no all-cities
overview map and no cross-city search: the combined site is five city sites sharing one
engine, not one site about five cities. Serving ~950 objects to the client at once, and
deciding what an intermediate zoom level should show, are problems this deliberately
does not take on. `/` is the only page that knows about more than one city.

## Finding the Reader

The site is for someone standing in a street now, so the picker offers to skip the
choosing: «⊕ Найти меня» geolocates, works out which city that is, and opens its map
centred on the reader with their position marked. It reuses the map's own
`setUserPosition`, so there is one implementation of the user marker.

Three properties of this that are deliberate and should survive any rewrite:

- **The position never travels in a URL.** `scripts/cities.js` writes it to
  `sessionStorage` under `loiter_locate`; `scripts/map.js` reads it once and deletes it
  (ignoring anything older than two minutes or belonging to another city). A query string
  would leak a precise location into server logs, the `Referer` header and the analytics
  hit — a bad trade for saving one click.
- **`NEAR_KM = 30` in `scripts/cities.js`.** Beyond it the nearest city is offered as a
  plain link instead of a redirect. The threshold has to clear the widest city (Berlin's
  outer Bezirke sit ~23 km out) while keeping Vienna (55 km) out of Bratislava and Prague
  (119 km) out of Dresden — otherwise the site drops a reader into an empty patch of map
  and calls it their surroundings. The wording is «вы **рядом** с X», not «в X», because
  Potsdam at 27 km passes the test.
- **The button ships with `hidden`** and the script reveals it only when
  `navigator.geolocation` exists, so a browser that cannot use it never sees a dead
  control — the same rule as the visitor-note form.

## Content Sourcing

Two paths, same filesystem layout, so the code never branches:

- **Local development.** `wiki_berlin/`, `wiki_dresden/` … are the real working copies
  sitting right here. The aggregator reads them live: a page added in a subproject shows
  up on the combined site on the next request, with no sync, copy or build step. The
  loader watches every city root and drops its cache on any `.md` change.
- **GitHub and deployment.** The root is its own repository (`Loiter`) with each city
  repo mounted as a **git submodule at exactly the same path**, declared
  `shallow = true` and fetched `--depth 1`. Submodule pointers are recorded in the parent
  repo only — the city repos are not modified, and their standalone deployments keep
  working untouched. Publishing new content is `git submodule update --remote` in the
  root, then a commit; this can be automated (nightly action, or a `repository_dispatch`
  fired from each city repo on push). Pinning to a commit is the point: a build is
  reproducible and a bad content state can be rolled back.

  **`.gitmodules` holds plain `https://github.com/…` URLs**, because they have to resolve
  on a build host that knows nothing about this machine's `~/.ssh/config`. They still go
  over SSH as the personal account locally, via a rewrite in `~/.gitconfig`:
  `url."git@github-personal:Bonzatina/".insteadOf "https://github.com/Bonzatina/"`.
  Do not put the SSH alias back into `.gitmodules` — that is what broke portability.

  **The city repositories are private**, so a build host needs its own credential: a
  fine-grained token with `Contents: Read` on those five repos, passed as
  `GIT_SUBMODULE_TOKEN` and applied by a *conditional* rewrite in `render.yaml`. It is
  conditional so the first deploy can be tried without it — Render reaches GitHub through
  its own app, which may already have access. Making the repos public would remove the
  token, the rewrite and the Actions secret entirely; that is the one cost of keeping them
  private.

City repos (branch `main`, `master` for rural):

| Subproject | Repository |
|---|---|
| `wiki_berlin` | `Bonzatina/Loiter-berlin` |
| `wiki_bratislava` | `Bonzatina/Loiter-bratislava` |
| `wiki_budapest` | `Bonzatina/Loiter-budapest` |
| `wiki_dresden` | `Bonzatina/Loiter-dresden` |
| `wiki_wroclav` | `Bonzatina/Loiter-wroclav` |
| `wiki_rural_travel` | `Bonzatina/rural_travel` (branch `master`, not `main`) |

**Image weight used to be the real constraint**, not the markdown. The `web/assets/`
folders held 826 MB across the six subprojects — against 11 MB of markdown — because
images were committed at whatever resolution the source handed out while CSS displays
them at most 440 px wide. 948 of 1289 files were wider than twice that cap and accounted
for 790 MB: almost the entire weight was pixels no reader ever sees, and one file was
19.8 MB.

`tools/shrink-images.mjs` fixed that — **826 MB → 192 MB**, and the heaviest asset is now
under 1 MB. Run it after any ingest:

```
node tools/shrink-images.mjs wiki_dresden      # one subproject
node tools/shrink-images.mjs --all --dry-run   # see what would change
```

It resizes JPEGs wider than 880 px, keeps the original whenever the re-encode would save
less than 10%, refuses any output that is not a valid JPEG of the expected width, and
touches nothing named `.png` (coats of arms, where JPEG would look worse). It needs only
ffmpeg, and it is idempotent — re-running never re-compresses the same file twice. Each
subproject's own `CLAUDE.md` now tells its ingest flow to run it.

Note what this does and does not shrink: the working tree and therefore the deploy drop
immediately, because submodules are fetched `--depth 1` and only the tip is downloaded.
The repositories on GitHub do **not** shrink — the original blobs stay in history — and
making them smaller would mean rewriting six histories, which is not worth it.

## Engine Invariants

These are the properties that keep the site one system rather than five:

- **No city literal outside `cities.ts`.** No city name, coordinate, timezone, port or
  `STATE_KEY` anywhere in `src/`, `scripts/` or `styles/`. `map.js` receives everything
  through `window.DATA` — including `DATA.city.center`, `DATA.city.zoom`,
  `DATA.city.stateKey`. If a change needs a new literal, it needs a new registry field.
- **One CSS set.** `styles/` is shared verbatim; there is no per-city stylesheet and no
  per-city override block. Image display size stays capped globally in `detail.css`.
- **One marker vocabulary, shared across taxonomies.** `MARKER_COLOR`, `DOMAIN_COLOR` and
  `LEGEND_TYPES` in `constants.ts` are the single source of truth. A new domain = an entry
  in `DOMAIN_COLOR` and `LEGEND_TYPES`, a label in `UI_STRINGS.*.legend`, and the domain
  listed in the `domains` array of the sites that have it.

  **A hue means one thing everywhere, and analogous roles share a hue.** A reader
  switching between a city and the countryside must be able to keep reading the map, so
  `region` is the same green as `district` and `settlement` the same blue-grey as
  `quarter`. Three defects were fixed when the rural wiki joined, and none of them should
  be reintroduced: its `transport` was the museum purple (`#9a7bb0` against `#8e6c9e` —
  indistinguishable at marker size, and it meant transport on one site and museums on
  another), so transport is now brown `#795548`; its `settlement` was `#1565c0`, the very
  blue `map.js` uses for the "you are here" dot and the selection rectangle; and its
  museums and thermal baths had no colour at all, so 122 museums and 10 baths were drawn
  as ordinary olive sights while the city maps showed them purple and orange.

  `page-map.ts` narrows `domainColors` to the site's declared `domains`, so a colour can
  never disagree with the legend that filters it.
- **One set of UI strings.** `UI_STRINGS.ru` / `UI_STRINGS.en` in `constants.ts`. List
  section headers are localized; the legend filter buttons above the map stay in English,
  matching the subprojects. Counted nouns go through `plural()` (`src/plural.ts`) — the
  Russian rule is not `n === 1`: 121 takes the singular, 23 the paucal, and 11–14 the
  genitive plural whatever their last digit.
- **One header.** `renderHeader(city | undefined, …)` renders every page's header,
  picker included: wordmark → `/`, the city dropdown listing all cities with the current
  one marked, the about link, the language toggle. Only the link targets differ by
  context; there is no second header implementation. The dropdown keeps the current city
  as a live link because the wordmark goes to the picker — from a city's about page it is
  the only way back to that city's map.
- **Page loading stays convention-driven.** Every top-level folder inside a city's
  `wiki/` that is not `districts` / `concepts` / `people` / `sources` is a district,
  read through its `quarters/` and `places/` subfolders. Adding a district needs no code
  change in any city.
- **No reader coordinates in URLs.** Neither a query string nor a path segment ever
  carries a geolocated position — see «Finding the Reader». Page `coords` from the wiki
  are public data and unaffected by this.
- **Notes stay one implementation.** `POST /note` validates and mails through Resend and
  stores nothing; the city comes from the form body and only picks the subject prefix,
  timezone and district label out of the registry. Anti-spam behaviour (honeypot,
  HMAC-signed timestamp with a 3 s floor, two-link cap, in-memory rate limits) is shared.

## Web App (`web/`)

Express + Leaflet (TypeScript via `tsx`). Run with `cd web && npm install && npm start`
→ http://localhost:4848. The standalone city apps use 3001 (Budapest), 3002 (Bratislava),
3003 (Berlin), 3004 (Wrocław), 3005 (Dresden), so the combined site and any subproject can
run side by side.

- **Map + filterable list** — markers from page `coords`; the list follows the visible
  map area, with box-select and search. `district` markers are large and green, `quarter`
  markers blue-grey, `place` markers coloured by domain.
- **Environment** — `PORT`; and for notes `NOTES_API_KEY`, `NOTES_TO`, `NOTES_SECRET`
  (all three required, otherwise the note button is not rendered and `POST /note` returns
  404 — the correct state for local work), optional `NOTES_FROM`,
  `NOTES_SUBJECT_PREFIX`, `SITE_URL`.
- **Who runs the server:** the user does. Do not start it to verify a content change.
  Start it only when asked, or when engine code under `web/src`, `web/scripts` or
  `web/styles` was changed on request.

### Feature flags — `FEATURES` in `web/src/constants.ts`

Things that are built but not decided on live behind a flag there. The flag is the
default; an environment variable of the same name overrides it, so a feature can be
tried on the live site and switched off from the host's dashboard without a commit.

| Flag | State | Override |
|---|---|---|
| `fameSlider` | **off** | `FAME_SLIDER=on` / `=off` |

**`fameSlider`** rates every place 1–5 by how mass-touristic it is and lets the reader
filter down to the quiet end. Seeded for Dresden (78 of 78 rated) and Bratislava (156 of
157) by `tools/seed-fame.mjs`, from how many Wikipedia language editions cover an object,
bucketed by share of that city's own maximum. Two known weaknesses, both worth knowing
before switching it on: language coverage measures how widely something has been
*written about*, not how many people go — a pilgrimage site scores like a coach stop; and
an object the matcher cannot find is rated 1 on the evidence that nothing was written
about it, which is right for a fairytale tree and wrong for St Martin's Cathedral.

The `fame:` values stay in the pages' frontmatter with the flag off. They are inert:
nothing reads them, no control is rendered, nothing is filtered.

### Deploying

The family is hosted on Render as **manually created Web Services**, not Blueprints. A
manual service ignores `render.yaml`, so that file is the written-down reference and these
values go into the dashboard by hand:

| Field | Value |
|---|---|
| Language | Node |
| Branch | `main` |
| Root Directory | `web` |
| Start Command | `npm start` |
| Instance Type | Free |
| Health Check Path | `/` |

Build Command — one line, because the dashboard field is a single shell command. It
installs first, then steps out to the repository root for the submodules, which Render
does not initialise on its own:

```
if [ -n "$GIT_SUBMODULE_TOKEN" ]; then git config --global url."https://x-access-token:$GIT_SUBMODULE_TOKEN@github.com/".insteadOf "https://github.com/"; fi && npm ci --omit=dev --no-audit --no-fund && cd .. && git submodule update --init --depth 1 && echo "--- disk ---" && df -h . && echo "--- content ---" && du -sh wiki_* | sort -h
```

`--omit=dev` because the runtime needs none of it: `tsx` transpiles through its own
esbuild, and nothing under `src/` imports `typescript` or `@types`. Install goes first
because nothing about it depends on the content, which keeps a dependency failure from
looking like a content one.

**`web/.npmrc` pins `registry=https://registry.npmjs.org/`, and it must stay pinned.**
This machine's global npm registry is an internal corporate proxy; installing through it
writes that unreachable host into all 128 `resolved` URLs of `package-lock.json`, and
`npm ci` on a build host then dies with npm's opaque *"Exit handler never called!"*. That
cost three failed deploys. If the lockfile is ever regenerated, check it with
`grep -c registry.npmjs.org package-lock.json` before committing.

Environment: `NOTES_API_KEY`, `NOTES_TO`, `NOTES_SECRET`, `SITE_URL`.
`GIT_SUBMODULE_TOKEN` turned out **not** to be needed — Render reaches the private city
repos through its own GitHub app; the conditional rewrite stays in place in case that ever
changes.
- **Dev-server note (Windows):** a leftover process holding the port keeps serving a
  stale wiki cache and will mislead smoke tests. Clear it with
  `Get-NetTCPConnection -LocalPort 4848 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`.

## Working Here

- **Do not read** `wiki_*/raw/` or the content pages under `wiki_*/wiki/` while working
  on the engine — the volume is large and irrelevant to it. Frontmatter fields, the
  district-folder convention and this file are enough. Read content only when the task
  is genuinely about content.
- **Do not edit subprojects** from the root. If a city's content or its standalone app
  needs a change, do it in that subproject, in its own commit, under its own `CLAUDE.md`.
- **Log** aggregator work in `log.md` at this root: `## [YYYY-MM-DD] {kind} | summary`,
  same convention as the subprojects (`init`, `feat`, `fix`, `lint`, `convention`).
- **Git identity is personal, and it is automatic.** Commits here are
  `bonzatina <martymckul@gmail.com>`. The machine's *global* identity is the corporate
  one (`sergei.kulikov@devexpress.com`), and a repo that inherits it commits under the
  work address without saying so — that is exactly how it got into `wiki_dresden` and
  `wiki_wroclav`, whose histories had to be rewritten to remove it.

  Two things prevent a recurrence. Every existing repo here carries the identity in its
  local config; and `~/.gitconfig` has a conditional include —
  `[includeIf "gitdir/i:C:/Users/sergei.kulikov/projects/Loiter/"] path = ~/.gitconfig-loiter`
  — so **any** repository under this directory picks the personal identity up on its own,
  including a fresh clone or a new subproject. The local configs are belt and braces: they
  are not committed and so do not survive a clone, which is what the include covers.
  Repositories outside this path are untouched and stay corporate.

  The remote must still be reached through the `github-personal` SSH alias: plain
  `git@github.com` picks the default key, which is the work account.
- This file and log-entry prefixes stay in English as operational instructions; any
  user-facing text follows the subprojects' rule — Russian is the base language, English
  is the `.en` mirror.
