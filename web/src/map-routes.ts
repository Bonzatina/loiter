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
  { slug: 'Kompa-Zahorska-Ves-Angern',      type: 'ferry',   terminus: 'Angern an der March', points: [[48.38220, 16.83417], [48.38246, 16.83334]] },
  { slug: 'Balatonfenyves-kisvaut',         type: 'railway', terminus: 'Somogyszentpál', points: [[46.71284, 17.48233], [46.64162, 17.47394]] },
  { slug: 'Ciernohronska-zeleznica',        type: 'railway', terminus: 'Hronec',         points: [[48.74546, 19.66005], [48.80233, 19.57500]] },
  { slug: 'Matrai-kisvasut',                type: 'railway', terminus: 'Mátrafüred',     points: [[47.78412, 19.93347], [47.78946, 19.93756], [47.79785, 19.94497], [47.80594, 19.95114], [47.81284, 19.95877], [47.82701, 19.97130], [47.83064, 19.97070]] },
  { slug: 'Oravska-lesna-zeleznica',        type: 'railway', terminus: 'Sedlo Beskyd',   points: [[49.38546, 19.16147], [49.38728, 19.15164], [49.38914, 19.14952], [49.38907, 19.14377], [49.38874, 19.13253], [49.39016, 19.12789]] },
  { slug: 'Historicka-lesna-uvratova-zeleznica', type: 'railway', terminus: 'Sedlo Beskyd', points: [[49.37510, 19.07339], [49.38271, 19.09602], [49.38584, 19.10719], [49.38652, 19.10079], [49.39501, 19.11360], [49.39016, 19.12789]] },
  { slug: 'Almamelleki-erdei-vasut',        type: 'railway', terminus: 'Sasrét',         points: [[46.16773, 17.88995], [46.16720, 17.89091], [46.16522, 17.89106], [46.16506, 17.89347], [46.17244, 17.90083], [46.18273, 17.90320], [46.18792, 17.90100], [46.19942, 17.89891], [46.20358, 17.89164], [46.20630, 17.88847], [46.20680, 17.88793]] },
]
