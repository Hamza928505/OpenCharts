/**
 * geodata.js — the country and city lists behind the map pickers.
 *
 * Both files are generated once (see `.cache/build-cities.mjs`) and committed,
 * so the site keeps its no-build-step promise and has no runtime dependency on
 * a gazetteer API.
 *
 * Cities are split per country for a reason: the full list is 4.4MB, but the
 * country somebody actually picks is between 4KB and 363KB. Nothing is fetched
 * until a country is chosen, and each country is fetched at most once.
 */

const ROOT = new URL('../../', import.meta.url);

let countriesPromise = null;
const cityCache = new Map();
const cityPromises = new Map();

/**
 * Every country on the world map, whether or not it has a city list.
 * @returns {Promise<Array<{name:string, iso2:string, cities:number}>>}
 */
export function loadCountries() {
  if (!countriesPromise) {
    countriesPromise = fetch(new URL('data/countries.json', ROOT))
      .then((r) => {
        if (!r.ok) throw new Error(`countries.json: ${r.status}`);
        return r.json();
      })
      .then((rows) => rows.map(([name, iso2, cities]) => ({ name, iso2, cities })))
      .catch((err) => {
        // A failed fetch must not poison the cache — a retry should be able to
        // succeed after, say, the dev server is restarted.
        countriesPromise = null;
        throw err;
      });
  }
  return countriesPromise;
}

/**
 * The cities of one country, alphabetically.
 * @param {string} iso2
 * @returns {Promise<Array<{name:string, lat:number, lon:number}>>}
 */
export function loadCities(iso2) {
  const code = String(iso2 || '').toUpperCase();
  if (!code) return Promise.resolve([]);
  if (cityCache.has(code)) return Promise.resolve(cityCache.get(code));
  if (cityPromises.has(code)) return cityPromises.get(code);

  const p = fetch(new URL(`data/cities/${code}.json`, ROOT))
    .then((r) => (r.ok ? r.json() : []))
    .then((rows) => {
      const list = rows.map(([name, lat, lon]) => ({ name, lat, lon }));
      cityCache.set(code, list);
      cityPromises.delete(code);
      return list;
    })
    .catch(() => {
      cityPromises.delete(code);
      return [];
    });

  cityPromises.set(code, p);
  return p;
}

/** Cities already loaded for this country, or null. Lets callers avoid an await. */
export function citiesIfLoaded(iso2) {
  return cityCache.get(String(iso2 || '').toUpperCase()) || null;
}

/**
 * One canonical key for a country, whoever is spelling it.
 *
 * Three places needed to answer "are these the same country?" and each had its
 * own answer: the picker's search, the map's focus, and the choropleth's value
 * lookup — which had no aliases at all, so a table saying "Bosnia and
 * Herzegovina" left the country grey while the atlas called it "Bosnia and
 * Herz." and nothing said why.
 *
 * Accents are folded before anything else, so `Cote d'Ivoire` typed on a
 * keyboard without them matches `Cote d\u2019Ivoire` from the atlas.
 *
 * Serialised into exported maps, so it must reference nothing outside itself.
 */
export function countryKey(name) {
  const k = String(name == null ? '' : name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z]/g, '');
  const SAME = {
    // Natural Earth abbreviates to fit a label on a map. Nobody writes these.
    bosniaandherz: 'bosniaandherzegovina',
    centralafricanrep: 'centralafricanrepublic',
    demrepcongo: 'democraticrepublicofthecongo',
    dominicanrep: 'dominicanrepublic',
    eqguinea: 'equatorialguinea',
    falklandis: 'falklandislands',
    frsantarcticlands: 'frenchsouthernandantarcticlands',
    ncyprus: 'northerncyprus',
    ssudan: 'southsudan',
    solomonis: 'solomonislands',
    wsahara: 'westernsahara',
    // What people type instead of the long form.
    usa: 'unitedstatesofamerica', us: 'unitedstatesofamerica',
    unitedstates: 'unitedstatesofamerica', america: 'unitedstatesofamerica',
    uk: 'unitedkingdom', britain: 'unitedkingdom', greatbritain: 'unitedkingdom',
    england: 'unitedkingdom', uae: 'unitedarabemirates', emirates: 'unitedarabemirates',
    drc: 'democraticrepublicofthecongo', drcongo: 'democraticrepublicofthecongo',
    congokinshasa: 'democraticrepublicofthecongo', congobrazzaville: 'congo',
    republicofthecongo: 'congo',
    ivorycoast: 'cotedivoire', holland: 'netherlands', burma: 'myanmar',
    swaziland: 'eswatini', czechrepublic: 'czechia', macedonia: 'northmacedonia',
    southkorea: 'southkorea', korea: 'southkorea', northkorea: 'northkorea',
    vatican: 'vaticancity', eastimor: 'timorleste',
  };
  return SAME[k] || k;
}

/**
 * Match a country the way a person would type it.
 *
 * Exact key first, then a prefix, then a substring — so `Bos` finds Bosnia
 * while `United States` is never beaten to the answer by `United Arab
 * Emirates` on a substring.
 */
export function findCountryEntry(list, query) {
  const target = countryKey(query);
  if (!target) return null;
  return list.find((c) => countryKey(c.name) === target)
    || list.find((c) => countryKey(c.name).startsWith(target))
    || list.find((c) => countryKey(c.name).includes(target))
    || null;
}

/** Items for a country Combobox, countries with cities listed first-class. */
export function countryItems(list, { onlyWithCities = false } = {}) {
  return list
    .filter((c) => (onlyWithCities ? c.cities > 0 : true))
    .map((c) => ({
      value: c.name,
      label: c.name,
      note: c.cities ? `${c.cities.toLocaleString()} cities` : '',
      iso2: c.iso2,
    }));
}
