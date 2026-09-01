/**
 * place-names.mjs — the spelling rules behind `data/countries.json` and
 * `data/cities/*.json`.
 *
 * Both sources spell places in their own interest rather than the reader's.
 * Natural Earth abbreviates to fit a label on a map — `Bosnia and Herz.`,
 * `Dem. Rep. Congo`, `Eq. Guinea` — and the gazetteer occasionally carries a
 * name in its own script, or two spellings of one place in a single field.
 * Neither is what somebody typing into a chart expects to see.
 *
 * Imported by `build-countries.mjs` and `build-cities.mjs` so a rebuild
 * produces clean data, and by `clean-place-names.mjs` so the committed data
 * can be fixed without a rebuild. There is no third copy of these rules.
 */

/**
 * Natural Earth's abbreviation → the name people actually write.
 *
 * Only the eleven that are genuinely abbreviated. Everything else the atlas
 * spells in full already, and rewriting the whole list through a name database
 * would trade these for a different set of surprises — CLDR calls the DRC
 * "Congo - Kinshasa", which is not an improvement.
 */
export const ENGLISH_COUNTRY = {
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'Central African Rep.': 'Central African Republic',
  'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  'Dominican Rep.': 'Dominican Republic',
  'Eq. Guinea': 'Equatorial Guinea',
  'Falkland Is.': 'Falkland Islands',
  'Fr. S. Antarctic Lands': 'French Southern and Antarctic Lands',
  'N. Cyprus': 'Northern Cyprus',
  'S. Sudan': 'South Sudan',
  'Solomon Is.': 'Solomon Islands',
  'W. Sahara': 'Western Sahara',
};

/**
 * Codes the name match in `build-countries.mjs` cannot reach on its own.
 *
 * Trinidad and Tobago had no code at all, so its 51 cities were unreachable
 * from the picker — the country was listed and choosing it gave an empty list.
 */
export const EXTRA_ISO = {
  'Trinidad and Tobago': 'TT',
  Antarctica: 'AQ',
};

/**
 * Codes the name match got *wrong*, which is worse than getting none.
 *
 * The matcher falls back to a prefix comparison for the abbreviated names, and
 * "Congo" is a prefix of both "Congo - Brazzaville" and "Congo - Kinshasa". It
 * picked Kinshasa, so the Republic of the Congo listed the DRC's 118 cities
 * and its own 59 were unreachable. A prefix match cannot tell two countries
 * apart when one name contains the other; only a decision can.
 */
export const CORRECT_ISO = {
  Congo: 'CG',
};

/* ── scripts ─────────────────────────────────────────────────────────────── */

const CYRILLIC = {
  а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', ђ: 'dj', е: 'e', ё: 'yo', є: 'ye',
  ж: 'zh', з: 'z', ѕ: 'dz', и: 'i', і: 'i', ї: 'yi', й: 'y', ј: 'j', к: 'k', ќ: 'kj',
  л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  ћ: 'c', у: 'u', ў: 'w', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', џ: 'dz', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ѓ: 'gj',
};

const GREEK = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k',
  λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't',
  υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o', ά: 'a', έ: 'e', ή: 'i', ί: 'i', ό: 'o',
  ύ: 'y', ώ: 'o', ϊ: 'i', ϋ: 'y', ΐ: 'i', ΰ: 'y',
};

const LATIN = /[A-Za-zÀ-ɏḀ-ỿ]/;
/** Everything a Latin-alphabet reader cannot pronounce: Arabic, CJK, Hebrew, … */
const FOREIGN = /[֐-׿؀-ۿ܀-ݏऀ-ॿ฀-๿぀-ヿ㄀-ㄯ一-鿿가-힯ﭐ-﷿ﹰ-﻿]/g;

/** Case-preserving transliteration of one Cyrillic or Greek letter. */
function romanise(ch) {
  const lower = ch.toLowerCase();
  const hit = CYRILLIC[lower] ?? GREEK[lower];
  if (hit == null) return ch;
  if (ch === lower || !hit) return hit;
  return hit[0].toUpperCase() + hit.slice(1);
}

const transliterate = (s) => [...s].map(romanise).join('');

/** Anything this matches is from a script the cleaner has an opinion about. */
const OTHER_SCRIPT = new RegExp('[' + [
  'Ͱ-Ͽ',   // Greek
  'Ѐ-ӿ',   // Cyrillic
  '֐-׿',   // Hebrew
  '؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿',  // Arabic
  'ऀ-ॿ',   // Devanagari
  '฀-๿',   // Thai
  '぀-ヿ一-鿿가-힯',  // CJK and Hangul
].join('') + ']');

/**
 * Countries whose own writing system is not the Latin alphabet.
 *
 * This is the whole basis for folding a name's diacritics, and it has to be a
 * list of countries rather than a list of characters. The marks themselves are
 * ambiguous: `ā` is a romanisation of Arabic in `Ḩātim` and a native letter in
 * Latvian `Alūksne`; `ş` is a transliteration of ص in `Al Ḩişn` and a native
 * letter in Turkish `Akkuş`; `‘` stands for ayn in `‘Ajlūn` and is the
 * Hawaiian ʻokina in `‘Ewa Beach`. Strip by character and you fix Jordan while
 * corrupting 1,557 Romanian names, 311 Turkish, 65 Hawaiian and every Latvian
 * town with a long vowel in it.
 *
 * Where the local script is not Latin, every Latin name in the gazetteer is by
 * definition a transliteration, so there is no native spelling to damage — the
 * only question is which romanisation, and the plainest one wins.
 */
export const NON_LATIN_SCRIPT = new Set([
  // Arabic
  'AE', 'AF', 'BH', 'DZ', 'EG', 'EH', 'IQ', 'IR', 'JO', 'KW', 'LB', 'LY',
  'MA', 'MR', 'OM', 'PK', 'PS', 'QA', 'SA', 'SD', 'SY', 'TN', 'YE',
  // Hebrew, Armenian, Georgian, Thaana
  'IL', 'AM', 'GE', 'MV',
  // Cyrillic
  'BG', 'BY', 'KG', 'KZ', 'MK', 'MN', 'RU', 'TJ', 'UA',
  // Greek
  'GR', 'CY',
  // CJK and Korean
  'CN', 'HK', 'JP', 'KP', 'KR', 'MO', 'TW',
  // Indic, Sinhala, Burmese, Thai, Lao, Khmer, Ethiopic
  'BD', 'BT', 'ET', 'ER', 'IN', 'KH', 'LA', 'LK', 'MM', 'NP', 'TH',
]);

/**
 * The stand-ins for ayn and hamza. Not diacritics — punctuation doing a
 * consonant's job — so `normalize` will not touch them and they need naming.
 * The straight apostrophe is in here too: in these countries it is the same
 * sound typed on a keyboard that has no ayn.
 */
const GLOTTAL = /['‘’ʻʼʾʿ՚]/g;

/**
 * `Ḩātim` → `Hatim`, `‘Ayn al Bāshā` → `Ayn al Basha`, `Anjō` → `Anjo`.
 *
 * Decomposing to NFD splits a letter from its marks, and every mark this is
 * aimed at — macron, dot below, cedilla, line below, breve, pinyin tone —
 * lands in the combining block, so one range removes all of them.
 *
 * Only ever called for a country in `NON_LATIN_SCRIPT`.
 */
export function foldRomanisation(name) {
  const folded = String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(GLOTTAL, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+-/g, '-')
    .trim();
  // A name that folds away to nothing keeps whatever it had.
  return folded || String(name ?? '');
}

/**
 * A city name a Latin-alphabet reader can use.
 *
 * The gazetteer sometimes puts two spellings of one place in the name field,
 * separated by commas — `Kalimpong, Крукети`, `Mosynopolis, Maximianopolis,
 * Μαξιμιανούπολις`. Those are one place written twice, so the segments that
 * are not Latin are dropped rather than transliterated into a near-duplicate
 * of the segment beside them.
 *
 * A name with nothing Latin in it at all is transliterated instead of dropped:
 * `Октябрьский` is a real town, and losing it would be worse than romanising
 * it. Stray marks from another script inside an otherwise Latin name are
 * removed — a lone Arabic kasra on the end of `shokhaib` is a typo in the
 * source, not part of the name.
 *
 * @returns {string} the cleaned name, or the original if there was nothing to do
 */
export function cleanCityName(name, iso2) {
  const raw = String(name ?? '');

  // Whether this country's Latin text is a transliteration rather than a
  // spelling. Decided by the country, never by the characters — see
  // `NON_LATIN_SCRIPT`.
  const romanised = !!iso2 && NON_LATIN_SCRIPT.has(String(iso2).toUpperCase());

  // Names with nothing foreign in them are returned untouched, deliberately.
  // An earlier version tidied punctuation on every name as well and quietly
  // broke the ones that need it: `'s-Gravenvoeren` is Dutch, the apostrophe in
  // `Homyel'` is a soft sign, and the one leading `'Ākra` is an ayn. The fold
  // is the one exception, and only where the country earns it.
  if (!OTHER_SCRIPT.test(raw)) return romanised ? foldRomanisation(raw) : raw;

  const segments = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const latin = segments.filter((s) => LATIN.test(s));

  const tidy = (s) => transliterate(s).replace(FOREIGN, '').replace(/\s+/g, ' ').trim();

  const cleaned = latin.length
    ? latin.map(tidy).filter(Boolean).join(', ')
    : tidy(segments[0] || raw);

  const out = cleaned || raw;

  // Folding has to come *after* transliteration, never before it. NFD splits
  // Cyrillic `й` into `и` plus a breve and `ё` into `е` plus a diaeresis, so a
  // fold applied first would hand the transliterator the wrong letters and
  // turn `Октябрьский` into `Oktyabrskii`.
  return romanised ? foldRomanisation(out) : out;
}

/** True when this name needs `cleanCityName` at all — cheap enough to run on 156k rows. */
export const needsCleaning = (name, iso2) => cleanCityName(name, iso2) !== String(name ?? '');
