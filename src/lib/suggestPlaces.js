/* What the ask bar should offer while someone is still typing.

   The bar already understood sentences — it just could not answer one until
   you pressed Search, and then it answered by rearranging the page. Half a
   sentence is usually enough to name a real place: "halal pantry fre" has a
   kind, a diet and the start of a city in it, and there are only a handful of
   verified places that satisfy all three.

   So this reads the half-sentence with the same parser the Search button uses,
   scores every verified place against what it found, and hands back the few
   that actually fit, each carrying the reasons it fit. The reasons matter as
   much as the ranking: a suggestion that cannot say why it is being offered is
   a guess, and someone deciding where to go for food should not have to take a
   guess on trust.

   Nothing here contacts a model. The hosted navigator can add to this list
   (see `mergeNavigatorPicks`), but it is never what the list waits on — the
   suggestions appear on the keystroke, offline, every time. */

import { parseSearch } from './searchParser.js';
import { getIsOpenNow } from '../data/places.js';
import { haversineMiles, formatMiles } from './geo.js';

/* A term is "started" if the place's own words begin with it, so a city half
   typed — "fre" — still finds Fremont, while "ont" does not. Matching from the
   start of a word is what keeps a three-letter fragment from matching
   everything. */
const startsWord = (haystack, term) =>
  new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(haystack);

const placeText = (place) => [
  place.name,
  place.typeLabel,
  place.tagline,
  place.neighborhood,
  place.city,
  place.cityStateZip,
  place.address,
  (place.services || []).join(' '),
  (place.inventory || []).map((item) => `${item.item} ${item.category}`).join(' '),
  (place.eligibilityTags || []).join(' '),
  (place.dietary || []).join(' '),
].filter(Boolean).join(' ');

/* The last word of a half-typed query is the one still being typed, so it is
   matched as a prefix while the finished words before it are matched whole. */
const splitTyping = (query) => {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const trailing = /\s$/.test(query) ? '' : (words.pop() || '');
  return { settled: words.join(' '), trailing };
};

/* Every signal is worth what it narrows. A named city or a named place rules
   out nearly the whole directory and so outweighs a diet, which many places
   satisfy; being open right now beats being open on Thursday, because the
   person typing is usually hungry today. */
const WEIGHTS = {
  name: 14,
  where: 10,
  item: 9,
  category: 7,
  eligibility: 6,
  diet: 5,
  language: 5,
  openNow: 5,
  produce: 3,
  reservations: 3,
  typing: 4,
  verified: 1,
};

/**
 * Rank verified places against a part-typed query.
 *
 * @returns {Array<{place, score, reasons: string[], distanceMiles: number|null}>}
 *   ordered best first, and empty when the query says nothing to match on —
 *   an empty list is the honest answer, and better than a list of filler.
 */
export function suggestPlaces(query, places, { origin = null, limit = 6 } = {}) {
  const text = (query || '').trim();
  if (text.length < 2 || !Array.isArray(places) || places.length === 0) return [];

  const { filters } = parseSearch(text);
  const { trailing } = splitTyping(text);
  // One- and two-letter fragments match too much to be worth matching.
  const typing = trailing.length >= 3 ? trailing.toLowerCase() : '';

  const scored = places.map((place) => {
    const haystack = placeText(place);
    const reasons = [];
    let score = 0;

    if (filters.category !== 'all' && place.type === filters.category) {
      score += WEIGHTS.category;
      reasons.push(place.typeLabel || filters.category);
    }

    if (filters.where) {
      const where = filters.where.toLowerCase();
      if (`${place.city} ${place.cityStateZip} ${place.neighborhood || ''} ${place.address}`.toLowerCase().includes(where)) {
        score += WEIGHTS.where;
        reasons.push(place.neighborhood ? `${place.neighborhood}, ${place.city}` : place.city);
      }
    }

    if (filters.item) {
      const stocked = (place.inventory || []).find((entry) =>
        startsWord(`${entry.item} ${entry.category}`, filters.item));
      if (stocked) {
        score += WEIGHTS.item;
        reasons.push(`Stocks ${stocked.item.toLowerCase()}`);
      } else if (startsWord(haystack, filters.item)) {
        score += WEIGHTS.item / 2;
      }
    }

    if (filters.diet !== 'all' && (place.dietary || []).includes(filters.diet)) {
      score += WEIGHTS.diet;
      reasons.push(filters.diet);
    }

    if (filters.language !== 'all' && (place.languages || []).includes(filters.language)) {
      score += WEIGHTS.language;
      reasons.push(`${filters.language.replace(/\s*\(.*\)$/, '')} spoken`);
    }

    if (filters.eligibility !== 'all' && (place.eligibilityTags || []).includes(filters.eligibility)) {
      score += WEIGHTS.eligibility;
      reasons.push(filters.eligibility);
    }

    if (filters.produce && place.hasFreshProduce) {
      score += WEIGHTS.produce;
      reasons.push('Fresh produce');
    }

    if (filters.reservations && place.acceptsReservations) {
      score += WEIGHTS.reservations;
      reasons.push('Takes reservations');
    }

    const open = getIsOpenNow(place);
    if (filters.openNow && open.isOpen) {
      score += WEIGHTS.openNow;
      reasons.push('Open now');
    }

    /* Someone typing a place they already know by name should land on it
       before anything the rest of the sentence implies. */
    if (startsWord(place.name, text) || place.name.toLowerCase().includes(text.toLowerCase())) {
      score += WEIGHTS.name;
      if (!reasons.includes(place.city)) reasons.push(place.city);
    } else if (typing && startsWord(place.name, typing)) {
      score += WEIGHTS.typing * 2;
    } else if (typing && startsWord(haystack, typing)) {
      score += WEIGHTS.typing;
    }

    if (place.verifiedBadge) score += WEIGHTS.verified;

    const distanceMiles = origin ? haversineMiles(origin, { lat: place.lat, lng: place.lng }) : null;

    return { place, score, reasons, distanceMiles, isOpen: open.isOpen };
  });

  const matched = scored.filter((entry) => entry.score >= WEIGHTS.typing);
  if (matched.length === 0) return [];

  /* Distance never creates a match, it only orders the ones already made: two
     places that fit the sentence equally well are not equally useful, and the
     nearer one wins. Open now breaks a remaining tie for the same reason. */
  matched.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.distanceMiles != null && b.distanceMiles != null && a.distanceMiles !== b.distanceMiles) {
      return a.distanceMiles - b.distanceMiles;
    }
    if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
    return a.place.name.localeCompare(b.place.name);
  });

  return matched.slice(0, limit).map((entry) => ({
    ...entry,
    /* Distance is a reason too, and the one people check first. */
    reasons: [
      ...(entry.isOpen ? ['Open now'] : []),
      ...entry.reasons,
      ...(entry.distanceMiles != null ? [`${formatMiles(entry.distanceMiles)} away`] : []),
    ].filter((reason, index, list) => list.indexOf(reason) === index).slice(0, 3),
  }));
}

/**
 * Fold the hosted navigator's own picks into a local ranking.
 *
 * The model sees the catalog and the whole sentence, so it catches what rules
 * cannot — "my kids won't eat anything spicy", "I get paid Friday". Its picks
 * go to the top and say where they came from; anything it names that the local
 * pass already found keeps its place rather than appearing twice.
 */
export function mergeNavigatorPicks(local, placeIds, places, { origin = null, limit = 6 } = {}) {
  if (!Array.isArray(placeIds) || placeIds.length === 0) return local;

  const picks = placeIds
    .map((id) => {
      const existing = local.find((entry) => entry.place.id === id);
      if (existing) return { ...existing, fromNavigator: true };
      const place = places.find((candidate) => candidate.id === id);
      if (!place) return null;
      const distanceMiles = origin ? haversineMiles(origin, { lat: place.lat, lng: place.lng }) : null;
      const { isOpen } = getIsOpenNow(place);
      return {
        place,
        score: 0,
        fromNavigator: true,
        isOpen,
        distanceMiles,
        reasons: [
          ...(isOpen ? ['Open now'] : []),
          place.city,
          ...(distanceMiles != null ? [`${formatMiles(distanceMiles)} away`] : []),
        ].filter(Boolean).slice(0, 3),
      };
    })
    .filter(Boolean);

  const rest = local.filter((entry) => !picks.some((pick) => pick.place.id === entry.place.id));
  return [...picks, ...rest].slice(0, limit);
}
