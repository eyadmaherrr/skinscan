/**
 * What a product's ingredients are commonly used for.
 *
 * A small, cited table of well-established skincare ingredients. It
 * describes ingredients, not products: it never says a product works, how
 * well, or for whom (the amount of each ingredient and the formula are
 * unknown). Ingredients that are not in the table are not described, and a
 * product without an ingredient list gets no description at all
 * (docs/PRODUCT_SCAN.md). Every source was checked on PubMed or EUR-Lex.
 * Safe to import from client and server code.
 */

export const BENEFIT_KEYS = [
  'blemishes',
  'pores',
  'redness',
  'unevenTone',
  'texture',
  'fineLines',
  'hydration',
  'barrier',
  'sunProtection',
] as const;
export type BenefitKey = (typeof BENEFIT_KEYS)[number];

export interface Source {
  label: string;
  url: string;
}

const SOURCES = {
  zaenglein2016: {
    label: 'Zaenglein AL, et al. Guidelines of care for the management of acne vulgaris. J Am Acad Dermatol. 2016;74:945–73.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26897386/',
  },
  wohlrab2014: {
    label: 'Wohlrab J, Kreft D. Niacinamide – mechanisms of action and its topical use in dermatology. Skin Pharmacol Physiol. 2014;27:311–5.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/24993939/',
  },
  hakozaki2002: {
    label: 'Hakozaki T, et al. The effect of niacinamide on reducing cutaneous pigmentation and suppression of melanosome transfer. Br J Dermatol. 2002;147:20–31.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/12100180/',
  },
  mukherjee2006: {
    label: 'Mukherjee S, et al. Retinoids in the treatment of skin aging: an overview of clinical efficacy and safety. Clin Interv Aging. 2006;1:327–48.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/18046911/',
  },
  fitton1991: {
    label: 'Fitton A, Goa KL. Azelaic acid: a review of its pharmacological properties and therapeutic efficacy in acne and hyperpigmentary skin disorders. Drugs. 1991;41:780–98.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/1712709/',
  },
  thiboutot2020: {
    label: 'Thiboutot D, et al. Standard management options for rosacea: the 2019 update by the National Rosacea Society Expert Committee. J Am Acad Dermatol. 2020;82:1501–10.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/32035944/',
  },
  alNiaimi2017: {
    label: 'Al-Niaimi F, Chiang NYZ. Topical vitamin C and the skin: mechanisms of action and clinical applications. J Clin Aesthet Dermatol. 2017;10:14–17.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29104718/',
  },
  tang2018: {
    label: 'Tang SC, Yang JH. Dual effects of alpha-hydroxy acids on the skin. Molecules. 2018;23:863.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29642579/',
  },
  purnamawati2017: {
    label: 'Purnamawati S, et al. The role of moisturizers in addressing various kinds of dermatitis: a review. Clin Med Res. 2017;15:75–87.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29229630/',
  },
  fluhr2008: {
    label: 'Fluhr JW, et al. Glycerol and the skin: holistic approach to its origin and functions. Br J Dermatol. 2008;159:23–34.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/18510666/',
  },
  proksch2017: {
    label: 'Proksch E, et al. Topical use of dexpanthenol: a 70th anniversary article. J Dermatolog Treat. 2017;28:766–73.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28503966/',
  },
  euAnnexVI: {
    label: 'Regulation (EC) No 1223/2009 on cosmetic products, Annex VI: list of UV filters allowed in cosmetic products.',
    url: 'https://eur-lex.europa.eu/eli/reg/2009/1223/oj',
  },
} satisfies Record<string, Source>;

interface Rule {
  benefits: BenefitKey[];
  sources: Source[];
  /** INCI and common names, matched as whole ingredient names. */
  names: string[];
  /** Matches any ingredient name containing this (e.g. every hyaluronate). */
  contains?: string[];
  /** Matches any ingredient name starting with this (e.g. "ceramide np"). */
  prefixes?: string[];
}

/** Order here is the order benefits are listed in when two ingredients share one. */
export const INGREDIENTS = {
  salicylicAcid: {
    benefits: ['blemishes', 'pores'],
    sources: [SOURCES.zaenglein2016],
    names: ['salicylic acid', 'beta hydroxy acid'],
  },
  benzoylPeroxide: {
    benefits: ['blemishes'],
    sources: [SOURCES.zaenglein2016],
    names: ['benzoyl peroxide'],
  },
  adapalene: {
    benefits: ['blemishes'],
    sources: [SOURCES.zaenglein2016],
    names: ['adapalene'],
  },
  azelaicAcid: {
    benefits: ['blemishes', 'redness', 'unevenTone'],
    sources: [SOURCES.fitton1991, SOURCES.thiboutot2020],
    names: ['azelaic acid'],
  },
  niacinamide: {
    benefits: ['redness', 'unevenTone', 'barrier'],
    sources: [SOURCES.wohlrab2014, SOURCES.hakozaki2002],
    names: ['niacinamide', 'nicotinamide'],
  },
  vitaminC: {
    benefits: ['unevenTone', 'fineLines'],
    sources: [SOURCES.alNiaimi2017],
    names: [
      'ascorbic acid',
      'l ascorbic acid',
      'sodium ascorbyl phosphate',
      'magnesium ascorbyl phosphate',
      'ascorbyl glucoside',
      '3 o ethyl ascorbic acid',
      'ethyl ascorbic acid',
      'tetrahexyldecyl ascorbate',
      'ascorbyl tetraisopalmitate',
    ],
  },
  retinoid: {
    benefits: ['texture', 'fineLines'],
    sources: [SOURCES.mukherjee2006],
    names: ['retinol', 'retinal', 'retinaldehyde', 'tretinoin', 'retinoic acid'],
  },
  ahas: {
    benefits: ['texture', 'unevenTone'],
    sources: [SOURCES.tang2018],
    names: ['glycolic acid', 'lactic acid', 'mandelic acid'],
  },
  uvFilter: {
    benefits: ['sunProtection'],
    sources: [SOURCES.euAnnexVI],
    names: [
      'butyl methoxydibenzoylmethane',
      'avobenzone',
      'octocrylene',
      'ethylhexyl methoxycinnamate',
      'octinoxate',
      'homosalate',
      'ethylhexyl salicylate',
      'octisalate',
      'bis ethylhexyloxyphenol methoxyphenyl triazine',
      'bemotrizinol',
      'methylene bis benzotriazolyl tetramethylbutylphenol',
      'bisoctrizole',
      'ethylhexyl triazone',
      'diethylamino hydroxybenzoyl hexyl benzoate',
      'diethylhexyl butamido triazone',
      'drometrizole trisiloxane',
      'terephthalylidene dicamphor sulfonic acid',
      'ecamsule',
      'phenylbenzimidazole sulfonic acid',
      'ensulizole',
      'disodium phenyl dibenzimidazole tetrasulfonate',
      'benzophenone 3',
      'oxybenzone',
      'tris biphenyl triazine',
      'polysilicone 15',
      'isoamyl p methoxycinnamate',
      '4 methylbenzylidene camphor',
    ],
  },
  /**
   * Titanium dioxide and zinc oxide are UV filters in sunscreens but also
   * colourants and fillers in make-up, so they count only in a product
   * labelled as a sunscreen or one that also has another UV filter.
   */
  mineralUvFilter: {
    benefits: ['sunProtection'],
    sources: [SOURCES.euAnnexVI],
    names: ['titanium dioxide', 'zinc oxide'],
  },
  hyaluronicAcid: {
    benefits: ['hydration'],
    sources: [SOURCES.purnamawati2017],
    names: [],
    contains: ['hyaluron'],
  },
  glycerin: {
    benefits: ['hydration'],
    sources: [SOURCES.fluhr2008],
    names: ['glycerin', 'glycerol', 'glycerine'],
  },
  urea: {
    benefits: ['hydration'],
    sources: [SOURCES.purnamawati2017],
    names: ['urea'],
  },
  ceramides: {
    benefits: ['barrier'],
    sources: [SOURCES.purnamawati2017],
    names: ['ceramides'],
    prefixes: ['ceramide '],
  },
  panthenol: {
    benefits: ['barrier', 'hydration'],
    sources: [SOURCES.proksch2017],
    names: ['panthenol', 'd panthenol', 'dexpanthenol'],
  },
} satisfies Record<string, Rule>;

export type IngredientKey = keyof typeof INGREDIENTS;
export const INGREDIENT_KEYS = Object.keys(INGREDIENTS) as IngredientKey[];

export interface IngredientMatch {
  key: IngredientKey;
  /** The ingredient's name as the product lists it (first one found, for groups like UV filters). */
  asListed: string;
  benefits: BenefitKey[];
  sources: Source[];
}

/** "Benzophenone-3", "CERAMIDE NP*" → "benzophenone 3", "ceramide np". */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\d+(\.\d+)?\s*%/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * An ingredient list ("Aqua/Water, Glycerin, Sodium Hyaluronate (hyaluronic
 * acid)…") as separate names, in label order. Bracketed alternatives and
 * slash-separated synonyms become names of their own.
 */
export function splitIngredients(text: string): { raw: string; name: string }[] {
  return text
    .split(/[,;•·\n()[\]{}/]|\s[-–]\s|\.\s/)
    .map((raw) => raw.replace(/^[\s*:+]+|[\s*.:+]+$/g, '').trim())
    .map((raw) => ({ raw, name: normalizeName(raw) }))
    .filter(({ name }) => name.length > 1 && name.length < 90);
}

function ruleMatches(rule: Rule, name: string): boolean {
  return (
    rule.names.includes(name) ||
    !!rule.contains?.some((part) => name.includes(part)) ||
    !!rule.prefixes?.some((prefix) => name.startsWith(prefix))
  );
}

const NORMALIZED: [IngredientKey, Rule][] = INGREDIENT_KEYS.map((key) => {
  const rule: Rule = INGREDIENTS[key];
  return [key, { ...rule, names: rule.names.map(normalizeName) }];
});

/** "Niacinamide", "SODIUM HYALURONATE" → "Niacinamide", "Sodium hyaluronate". */
function displayName(raw: string): string {
  const text = raw.replace(/\s+/g, ' ').trim();
  const lower = text === text.toUpperCase() ? text.toLowerCase() : text;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export interface IngredientInput {
  /** The ingredient list as printed on the pack. */
  text?: string | null;
  /** Database tags such as "en:niacinamide" (used when they add names the text lacks). */
  tags?: readonly string[] | null;
  /** The product is labelled as a sunscreen (name or category says SPF / sunscreen). */
  sunscreen?: boolean;
}

/**
 * The described ingredients a product lists, in label order (earlier usually
 * means more of it), and how many ingredient names were read. `listed: 0`
 * means there is no ingredient list to describe.
 */
export function matchIngredients({ text, tags, sunscreen = false }: IngredientInput): {
  listed: number;
  matches: IngredientMatch[];
} {
  const names = splitIngredients(text ?? '');
  const seen = new Set(names.map((n) => n.name));
  for (const tag of tags ?? []) {
    const raw = tag.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ');
    const name = normalizeName(raw);
    if (name.length > 1 && !seen.has(name)) {
      seen.add(name);
      names.push({ raw, name });
    }
  }

  const found = new Map<IngredientKey, IngredientMatch>();
  for (const { raw, name } of names) {
    for (const [key, rule] of NORMALIZED) {
      if (found.has(key) || !ruleMatches(rule, name)) continue;
      found.set(key, { key, asListed: displayName(raw), benefits: [...rule.benefits], sources: [...rule.sources] });
    }
  }

  if (found.has('mineralUvFilter') && !sunscreen && !found.has('uvFilter')) found.delete('mineralUvFilter');
  return { listed: names.length, matches: [...found.values()] };
}

/** Each benefit once, in BENEFIT_KEYS order, with the ingredients it comes from. */
export function benefitSummary(matches: readonly IngredientMatch[]): { benefit: BenefitKey; from: IngredientKey[] }[] {
  return BENEFIT_KEYS.flatMap((benefit) => {
    const from = matches.filter((m) => m.benefits.includes(benefit)).map((m) => m.key);
    return from.length ? [{ benefit, from }] : [];
  });
}

const SUNSCREEN = /\bspf\s*\d*|sunscreen|sun\s*(screen|block|cream|lotion|protect)|solaire|uv\s*protect|واقي/i;

/** Whether a product's name or categories label it as a sunscreen. */
export function looksLikeSunscreen(...labels: (string | null | undefined)[]): boolean {
  return labels.some((label) => !!label && SUNSCREEN.test(label.replace(/-/g, ' ')));
}
