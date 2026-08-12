// ── Route lines ──────────────────────────────────────────────────────────────
// Heritage railways and ferry crossings, drawn as polylines with a marker at each
// end. Unlike everything else on the map these are not derived from page
// frontmatter: a line needs an ordered list of points, which a single `coords`
// cannot express, so the geometry lives here and the pages it links to are found
// by slug.
//
// City wikis have none — transport is out of scope in all five, and their `routes`
// stay empty.

export interface RouteLine {
  /** Page slug this line links to; also the popup title when no page exists. */
  slug: string
  type: 'railway' | 'ferry'
  /** Ordered points; the first and last get a marker. */
  points: [number, number][]
  /** Name shown for the far end. */
  terminus: string
}

export const NO_ROUTES: RouteLine[] = []

/** Carried over verbatim from wiki_rural_travel/web/src/constants.ts. */
export const RURAL_ROUTES: RouteLine[] = [
  { slug: 'Királyréti Erdei Vasút',         type: 'railway', terminus: 'Királyrét',      points: [[47.8266, 19.0129], [47.8680, 19.0061], [47.8939, 18.9791]] },
  { slug: 'Kemencei Erdei Múzeumvasút',     type: 'railway', terminus: 'Feketevölgy',    points: [[48.0171, 18.8916], [47.9817, 18.8966]] },
  { slug: 'Nagybörzsönyi Erdei Vasút',      type: 'railway', terminus: 'Szob',           points: [[47.93166, 18.83734], [47.8998, 18.8837], [47.82198, 18.86081]] },
  { slug: 'Visegrád-Nagymaros komp',        type: 'ferry',   terminus: 'Nagymaros',      points: [[47.78944, 18.96097], [47.78696, 18.96718]] },
  { slug: 'Szentendre-Szigetmonostor komp', type: 'ferry',   terminus: 'Szigetmonostor', points: [[47.67061, 19.07929], [47.66994, 19.08230]] },
  { slug: 'Horány-Dunakeszi komp',          type: 'ferry',   terminus: 'Dunakeszi',      points: [[47.66038, 19.112707], [47.65767, 19.11941]] },
  { slug: 'Kompjarat-Tihany-Szantod',       type: 'ferry',   terminus: 'Szántódrév',     points: [[46.88864, 17.89173], [46.87962, 17.90023]] },
  { slug: 'Cunovo-Hamuliakovo-komp',        type: 'ferry',   terminus: 'Hamuliakovo',    points: [[48.03317, 17.22685], [48.03600, 17.25100]] },
  { slug: 'Balatonfenyves-kisvaut',         type: 'railway', terminus: 'Somogyszentpál', points: [[46.71284, 17.48233], [46.64162, 17.47394]] },
  { slug: 'Ciernohronska-zeleznica',        type: 'railway', terminus: 'Hronec',         points: [[48.74546, 19.66005], [48.80233, 19.57500]] },
]
