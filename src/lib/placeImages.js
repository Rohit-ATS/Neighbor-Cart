/**
 * Stand-in photography for places that have none of their own.
 *
 * Real directory records (OpenStreetMap, and Google listings without a photo)
 * arrive with no image. A stock photo is chosen by hashing the place id, so a
 * given place always shows the same picture instead of reshuffling on every
 * render.
 *
 * These are deliberately generic food-assistance scenes. They are never
 * presented as a photograph *of* the location — `isStockImage` lets the UI
 * label them, because showing a stranger a building that is not the one they
 * are about to walk to is worse than showing nothing.
 */

const STOCK = [
  '1593113598332-cd288d649433', // boxes being packed
  '1542838132-92c53300491e', // produce shelves
  '1534723452862-4c874018d66d', // volunteers sorting
  '1488459716781-31db52582fe9', // fresh vegetables
  '1507919909716-c8262e491cde', // crates of produce
  '1518843875459-f738682238a6', // bread and staples
  '1559181567-c3190ca9959b', // mixed groceries
  '1506617420156-8e4536971650', // canned goods
];

const url = (id, w) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

/** Stable 32-bit hash so the same id always picks the same photo. */
function hash(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** The place's own photo when it has one, otherwise a stable stand-in. */
export function placeImage(place, width = 640) {
  // A real photograph of this location, once Google enrichment has found one.
  if (place?.photoUrl) return place.photoUrl;
  if (place?.images?.length) return place.images[0];
  const key = place?.id || place?.name || 'neighbor-cart';
  return url(STOCK[hash(String(key)) % STOCK.length], width);
}

/** True when the image is a stand-in rather than a photo of this place. */
export function isStockImage(place) {
  return !place?.photoUrl && !place?.images?.length;
}
