/**
 * Pulls real US food assistance locations from OpenStreetMap via Overpass and
 * normalises them into the shape api/app.py seeds into SQLite.
 *
 * Source choice: OSM is the only nationwide dataset of these places that is
 * free, key-less, and licensed so we may store and redistribute it (ODbL —
 * see ATTRIBUTION below, which the UI must surface). Google/Yelp/Foursquare
 * all forbid persisting their place records, and Feeding America has no API.
 * The tradeoff is coverage: OSM is community-mapped, so this is a real but
 * incomplete directory, not every pantry in the country.
 *
 * Nothing here invents data. Fields OSM does not carry (inventory, dietary
 * options, languages, photos, reservation windows) stay empty so the UI can
 * show "unknown" rather than a plausible-looking fiction about a real place
 * that a hungry person might travel to.
 *
 *   node scripts/fetch-osm-places.mjs            # all states
 *   node scripts/fetch-osm-places.mjs CA NY TX   # a subset
 *   node scripts/fetch-osm-places.mjs --fresh    # ignore the cache
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { categoryFor } from './osm-category.mjs';

const ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';

/* Rotated on every request, and advanced on failure. The public instances are
   frequently saturated; a single host cannot carry 51 queries reliably. */
const MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO',
  'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA',
  'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

/* Approximate state bounding boxes [south, west, north, east], used only to
   cut a failing state into cheaper tiles. They may be generous: the area
   filter still does the precise work, so a box that overhangs a border costs
   nothing but a slightly larger search window. */
const BBOX = {
  AL: [30.1, -88.5, 35.1, -84.8], AK: [51.0, -180.0, 71.5, -129.0], AZ: [31.3, -115.0, 37.1, -109.0],
  AR: [33.0, -94.7, 36.6, -89.6], CA: [32.5, -124.5, 42.1, -114.1], CO: [36.9, -109.1, 41.1, -102.0],
  CT: [40.9, -73.8, 42.1, -71.7], DE: [38.4, -75.8, 39.9, -75.0], DC: [38.7, -77.2, 39.0, -76.9],
  FL: [24.4, -87.7, 31.1, -79.9], GA: [30.3, -85.7, 35.1, -80.7], HI: [18.8, -160.3, 22.3, -154.7],
  ID: [41.9, -117.3, 49.1, -111.0], IL: [36.9, -91.6, 42.6, -87.0], IN: [37.7, -88.1, 41.8, -84.7],
  IA: [40.3, -96.7, 43.6, -90.1], KS: [36.9, -102.1, 40.1, -94.5], KY: [36.4, -89.6, 39.2, -81.9],
  LA: [28.8, -94.1, 33.1, -88.7], ME: [42.9, -71.1, 47.5, -66.9], MD: [37.8, -79.5, 39.8, -75.0],
  MA: [41.2, -73.6, 42.9, -69.9], MI: [41.6, -90.5, 48.3, -82.1], MN: [43.4, -97.3, 49.4, -89.4],
  MS: [30.1, -91.7, 35.1, -88.0], MO: [35.9, -95.8, 40.7, -89.0], MT: [44.3, -116.1, 49.1, -104.0],
  NE: [39.9, -104.1, 43.1, -95.3], NV: [35.0, -120.1, 42.1, -114.0], NH: [42.6, -72.6, 45.4, -70.6],
  NJ: [38.9, -75.6, 41.4, -73.8], NM: [31.3, -109.1, 37.1, -102.9], NY: [40.4, -79.8, 45.1, -71.8],
  NC: [33.8, -84.4, 36.6, -75.4], ND: [45.9, -104.1, 49.1, -96.5], OH: [38.4, -84.9, 42.0, -80.5],
  OK: [33.6, -103.1, 37.1, -94.4], OR: [41.9, -124.6, 46.3, -116.4], PA: [39.7, -80.6, 42.3, -74.6],
  RI: [41.1, -71.9, 42.1, -71.1], SC: [32.0, -83.4, 35.3, -78.5], SD: [42.4, -104.1, 46.0, -96.4],
  TN: [34.9, -90.4, 36.7, -81.6], TX: [25.8, -106.7, 36.6, -93.5], UT: [36.9, -114.1, 42.1, -109.0],
  VT: [42.7, -73.5, 45.1, -71.4], VA: [36.5, -83.7, 39.5, -75.2], WA: [45.5, -124.9, 49.1, -116.9],
  WV: [37.1, -82.7, 40.7, -77.7], WI: [42.4, -92.9, 47.1, -86.2], WY: [40.9, -111.1, 45.1, -104.0],
};

const CACHE_DIR = new URL('../.cache/osm/', import.meta.url);
const OUT_PATH = new URL('../api/osm_places.json', import.meta.url);

const argv = process.argv.slice(2);
const fresh = argv.includes('--fresh');
const requested = argv.filter((a) => !a.startsWith('--')).map((s) => s.toUpperCase());
const targets = requested.length ? requested.filter((s) => STATES.includes(s)) : ['CA'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------------------------------------------- fetch */

/* The area is emitted first: if the ISO3166-2 lookup misses, Overpass returns
   an empty set and a genuine "no pantries here" becomes indistinguishable
   from a broken query. Seeing the area element back proves the lookup
   resolved, so a zero count afterwards is real. */
/** `bounds` restricts the search window; the area filter still decides membership. */
const query = (state, bounds) => {
  const within = bounds ? `(${bounds.join(',')})` : '';
  return `
[out:json][timeout:70];
area["ISO3166-2"="US-${state}"]->.s;
.s out ids;
(
  nwr(area.s)${within}["social_facility"~"^(food_bank|soup_kitchen)$"];
  nwr(area.s)${within}["amenity"~"^(food_bank|food_sharing)$"];
);
out center tags;
`.trim();
};

/** Split a bbox into an n x n grid of [s, w, n, e] tiles. */
function tiles([s, w, n, e], divisions) {
  const out = [];
  const dLat = (n - s) / divisions;
  const dLng = (e - w) / divisions;
  for (let i = 0; i < divisions; i += 1) {
    for (let j = 0; j < divisions; j += 1) {
      out.push([s + i * dLat, w + j * dLng, s + (i + 1) * dLat, w + (j + 1) * dLng]);
    }
  }
  return out;
}

let mirrorIndex = 0;

async function overpass(state, bounds, maxAttempts = MIRRORS.length * 3) {
  const body = new URLSearchParams({ data: query(state, bounds) });
  let lastError = 'unknown';

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const url = MIRRORS[mirrorIndex % MIRRORS.length];
    mirrorIndex += 1;
    try {
      const response = await fetch(url, {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'NeighborCart/1.0 (open food assistance directory)',
        },
        signal: AbortSignal.timeout(75_000),
      });
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        // Overpass rate-limits per IP; retrying fast just burns the slot.
        await sleep(response.status === 429 ? 20_000 : 15_000);
        continue;
      }
      const text = await response.text();
      if (!text.trimStart().startsWith('{')) {
        /* Overpass reports runtime/timeout errors as an HTML page with a 200. */
        lastError = 'non-JSON response (server busy)';
        await sleep(15_000);
        continue;
      }
      const elements = JSON.parse(text).elements ?? [];
      /* First element is the area echo (see `query`). Without it the state
         lookup did not resolve, so treat it as a failure worth retrying
         rather than caching a false zero. */
      const areaIndex = elements.findIndex((e) => e.type === 'area');
      if (areaIndex === -1) {
        lastError = `area lookup for US-${state} did not resolve`;
        await sleep(4_000);
        continue;
      }
      return elements.filter((e, i) => i !== areaIndex && e.type !== 'area');
    } catch (error) {
      lastError = error.name === 'TimeoutError' ? 'timeout' : error.message;
      await sleep(4_000);
    }
  }
  throw new Error(`${state}: every mirror failed (${lastError})`);
}

/**
 * A whole-state query for somewhere dense is expensive enough that the public
 * instances drop it with a 504. Splitting the state into tiles turns one
 * costly request into several cheap ones, which get served.
 */
async function overpassTiled(state) {
  const box = BBOX[state];
  if (!box) throw new Error(`${state}: no bounding box to tile`);

  const grid = tiles(box, 3);
  const merged = new Map();
  let pending = grid.map((bounds, index) => ({ bounds, index }));

  // Two passes: these endpoints fail intermittently, and letting one flaky
  // tile discard a whole state wastes the eight that worked.
  for (let pass = 1; pass <= 2 && pending.length; pass += 1) {
    const stillFailing = [];
    for (const tile of pending) {
      try {
        for (const element of await overpass(state, tile.bounds, MIRRORS.length)) {
          merged.set(`${element.type}/${element.id}`, element);
        }
        console.log(`    tile ${tile.index + 1}/${grid.length} ok (${merged.size} so far)`);
      } catch {
        stillFailing.push(tile);
        console.log(`    tile ${tile.index + 1}/${grid.length} failed (pass ${pass})`);
      }
      await sleep(3_000);
    }
    pending = stillFailing;
    if (pending.length) await sleep(20_000); // let the rate limit recover
  }

  // A partial tile set would cache a quietly incomplete state, so refuse it.
  if (pending.length) throw new Error(`${state}: ${pending.length}/${grid.length} tiles failed after 2 passes`);
  return [...merged.values()];
}

/* ------------------------------------------------------------- normalise */

const CATEGORY = {
  food_bank: 'food-bank',
  soup_kitchen: 'hot-meal',
  food_sharing: 'community-fridge',
};

/* OSM has one tag (`social_facility=food_bank`) for what the UI splits into
   food banks, pantries and mobile distributions, so the tag alone left the
   "Food Pantries" and "Mobile Distributions" filters empty while 45 records
   were literally named "...Food Pantry". The name decides when it is
   specific; the tag is the fallback. Order matters — "Mobile Food Pantry"
   is a mobile distribution first. */
/* categoryFor lives in its own module so the patterns stay readable and are
   not mangled by shell escaping. */

const TYPE_LABEL = {
  'food-bank': 'Food Bank',
  pantry: 'Food Pantry',
  mobile: 'Mobile Distribution',
  'hot-meal': 'Hot Meals & Community Kitchen',
  'community-fridge': 'Community Fridge / Free Food Point',
  pantry: 'Food Pantry',
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_INDEX = { Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4, Sa: 5, Su: 6 };

/** Decimal hours, for the "open now" comparison the UI already does. */
const toDecimal = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h + (m || 0) / 60;
};

const pretty = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m || 0).padStart(2, '0')} ${suffix}`;
};

/**
 * A deliberately partial `opening_hours` reader. The full grammar supports
 * things like "Su[-1] off" and sunrise offsets; rather than half-implement it,
 * anything that does not match the common `Mo-Fr 09:00-17:00` shapes is left
 * for the raw string so the UI shows what OSM actually says.
 */
function parseHours(raw) {
  const empty = DAYS.map((day) => ({ day, hours: 'Hours not listed', open: 0, close: 0 }));
  if (!raw) return { weeklyHours: empty, parsed: false };
  if (/^24\/7$/.test(raw.trim())) {
    return {
      weeklyHours: DAYS.map((day) => ({ day, hours: 'Open 24 hours', open: 0, close: 24 })),
      parsed: true,
    };
  }

  const week = DAYS.map((day) => ({ day, hours: 'Closed', open: 0, close: 0 }));
  let matched = false;

  for (const rule of raw.split(';')) {
    const m = rule.trim().match(
      /^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/,
    );
    if (!m) continue;
    const [, dayPart, from, to] = m;

    const indices = new Set();
    for (const chunk of dayPart.split(',')) {
      const [a, b] = chunk.trim().split(/\s*-\s*/);
      if (!(a in DAY_INDEX)) continue;
      if (b && b in DAY_INDEX) {
        for (let i = DAY_INDEX[a]; i !== (DAY_INDEX[b] + 1) % 7; i = (i + 1) % 7) indices.add(i);
      } else {
        indices.add(DAY_INDEX[a]);
      }
    }
    for (const i of indices) {
      week[i] = { day: DAYS[i], hours: `${pretty(from)} – ${pretty(to)}`, open: toDecimal(from), close: toDecimal(to) };
      matched = true;
    }
  }
  return matched ? { weeklyHours: week, parsed: true } : { weeklyHours: empty, parsed: false };
}

const titleCase = (s) => s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

function normalise(element, state) {
  const t = element.tags ?? {};
  const name = (t.name || t['name:en'] || '').trim();
  if (!name) return null; // an unnamed point is not something we can send anyone to

  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const tagged = t.social_facility && CATEGORY[t.social_facility]
    ? CATEGORY[t.social_facility]
    : CATEGORY[t.amenity] ?? 'food-bank';
  const kind = categoryFor(name, tagged);

  const houseNumber = t['addr:housenumber'] ?? '';
  const street = t['addr:street'] ?? '';
  const address = [houseNumber, street].filter(Boolean).join(' ');
  const city = t['addr:city'] ?? '';
  const zip = t['addr:postcode'] ?? '';
  const cityStateZip = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  const rawHours = t.opening_hours ?? '';
  const { weeklyHours, parsed } = parseHours(rawHours);

  const phone = t.phone ?? t['contact:phone'] ?? '';
  const website = t.website ?? t['contact:website'] ?? '';

  const destination = address && city
    ? `${address}, ${city}, ${state} ${zip}`.trim()
    : `${lat},${lng}`;

  const eligibilityTags = [];
  if (t.wheelchair === 'yes') eligibilityTags.push('Wheelchair Accessible');
  if (t['social_facility:for']) {
    eligibilityTags.push(`Serves: ${titleCase(t['social_facility:for'].replace(/[_;]/g, ' '))}`);
  }
  if (kind === 'community-fridge') eligibilityTags.push('Self-Serve', 'Walk-ins Welcome');

  return {
    id: `osm-${element.type}-${element.id}`,
    name,
    type: kind,
    typeLabel: TYPE_LABEL[kind] ?? TYPE_LABEL['food-bank'],
    tagline: '',
    neighborhood: t['addr:suburb'] ?? t['addr:neighbourhood'] ?? '',
    address,
    city,
    state,
    zip,
    cityStateZip,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    phone,
    email: t.email ?? t['contact:email'] ?? '',
    website,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,

    /* Community-mapped, so never shown as staff-verified. */
    verifiedBadge: false,
    verifiedDate: '',
    /* Without confirmed hours a wasted trip is the real risk, so say so. */
    callAheadWarning: !parsed,

    requirements: '',
    languages: [],
    dietary: [],
    hasFreshProduce: false,
    transitInfo: '',
    accessibility: t.wheelchair === 'yes'
      ? 'Mapped as wheelchair accessible.'
      : t.wheelchair === 'limited'
        ? 'Mapped as partially wheelchair accessible.'
        : '',
    eligibilityTags,
    images: [],

    hoursSummary: rawHours || 'Hours not listed — call ahead',
    rawOpeningHours: rawHours,
    /* Lets the UI withhold an "Open now" badge it cannot actually justify. */
    hoursKnown: parsed,
    weeklyHours,

    services: [],
    inventory: [],
    urgentNeeds: [],
    acceptsReservations: false,
    reservationWindows: [],

    dataSource: 'openstreetmap',
    osmType: element.type,
    osmId: element.id,
    attribution: ATTRIBUTION,
  };
}

/* ------------------------------------------------------------------ run */

await mkdir(CACHE_DIR, { recursive: true });

const failures = [];
for (const [i, state] of targets.entries()) {
  const cacheFile = new URL(`${state}.json`, CACHE_DIR);
  if (!fresh && existsSync(cacheFile)) {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8'));
    console.log(`[${i + 1}/${targets.length}] ${state} — ${cached.length} (cached)`);
    continue;
  }
  try {
    let elements;
    try {
      // Only one pass per mirror before tiling: exhausting a dozen
      // whole-state retries first costs ~18 minutes to learn what the
      // first few already showed.
      elements = await overpass(state, undefined, MIRRORS.length);
    } catch (error) {
      console.warn(`[${i + 1}/${targets.length}] ${state} — whole-state query failed (${error.message}); tiling`);
      elements = await overpassTiled(state);
    }
    await writeFile(cacheFile, JSON.stringify(elements), 'utf8');
    console.log(`[${i + 1}/${targets.length}] ${state} — ${elements.length}`);
  } catch (error) {
    failures.push(state);
    console.warn(`[${i + 1}/${targets.length}] ${state} — FAILED: ${error.message}`);
  }
  await sleep(5_000); // be a good citizen on a free shared endpoint
}

/* Build the output from whatever is cached, so a partial run is still usable. */
const places = [];
const seen = new Set();
const byState = {};

for (const file of (await readdir(CACHE_DIR)).filter((f) => f.endsWith('.json'))) {
  const state = file.replace('.json', '');
  const elements = JSON.parse(await readFile(new URL(file, CACHE_DIR), 'utf8'));
  for (const element of elements) {
    const place = normalise(element, state);
    if (!place || seen.has(place.id)) continue;
    seen.add(place.id);
    places.push(place);
    byState[state] = (byState[state] ?? 0) + 1;
  }
}

// Filter strictly to San Francisco and the Greater Bay Area
const bayAreaPlaces = places.filter((p) => p.lat >= 37.15 && p.lat <= 38.35 && p.lng >= -122.75 && p.lng <= -121.70);
bayAreaPlaces.sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));
await writeFile(OUT_PATH, `${JSON.stringify(bayAreaPlaces, null, 2)}\n`, 'utf8');

const counts = bayAreaPlaces.reduce((acc, p) => ({ ...acc, [p.type]: (acc[p.type] ?? 0) + 1 }), {});
const withAddress = bayAreaPlaces.filter((p) => p.address && p.city).length;
const withHours = bayAreaPlaces.filter((p) => p.rawOpeningHours).length;
const withPhone = bayAreaPlaces.filter((p) => p.phone).length;

console.log(`\nWrote ${bayAreaPlaces.length} Bay Area places to api/osm_places.json`);
console.log('By category:', counts);
console.log(`States covered: ${Object.keys(byState).length}`);
console.log(
  `Completeness — address ${withAddress} (${Math.round((withAddress / places.length) * 100)}%), ` +
  `hours ${withHours} (${Math.round((withHours / places.length) * 100)}%), ` +
  `phone ${withPhone} (${Math.round((withPhone / places.length) * 100)}%)`,
);
if (failures.length) console.log(`Re-run for failed states: node scripts/fetch-osm-places.mjs ${failures.join(' ')}`);
