/* Food-rescue decisions stay deterministic and inspectable. The assistant may
   explain a match, but it never invents a recipient's capacity or pickup.
   Every handoff still requires the recipient to confirm food safety, space,
   and a pickup window. */

const RESCUE_TERMS = /\b(donat(?:e|ing|ion)|surplus|leftover|extra food|food waste|rescu(?:e|ing)|redistribut(?:e|ion)|unsold|overstock|end[- ]of[- ]day|food recovery|give away|give food|food to give|food to share)\b/i;

export const isFoodRescueIntent = (text = '') => RESCUE_TERMS.test(text);

const cityFromText = (text = '') => {
  const found = text.match(/\b(san francisco|oakland|san jose|fremont|berkeley|marin|chicago|des moines|los angeles)\b/i);
  return found?.[1]?.toLowerCase() || null;
};

const storageFromText = (text = '') => {
  if (/\b(frozen|freezer)\b/i.test(text)) return 'Frozen';
  if (/\b(refrigerat|chill|dairy|meat|prepared|perishable|produce|fruit|vegetable)\b/i.test(text)) return 'Refrigerated';
  return 'Dry Shelf-Stable';
};

const foodFromText = (text = '') => {
  const found = text.match(/\b(produce|fruit|vegetables?|bakery|bread|prepared meals?|meals?|dairy|meat|groceries|shelf[- ]stable|canned goods?|beverages?)\b/i);
  return found?.[0] || 'surplus food';
};

const quantityFromText = (text = '') => {
  const match = text.match(/\b(\d{1,5})\s*(?:lb|lbs|pounds?)\b/i);
  return match ? Number(match[1]) : null;
};

const urgencyFromText = (text = '') => {
  if (/\b(today|tonight|asap|urgent|within \d+ hours?|expires? (today|tonight))\b/i.test(text)) return 'Same-day pickup needed';
  if (/\b(tomorrow|next day)\b/i.test(text)) return 'Pickup needed by tomorrow';
  return 'Confirm a pickup window with the recipient';
};

export const buildRescuePlan = (text, places) => {
  const city = cityFromText(text);
  const storage = storageFromText(text);
  const food = foodFromText(text);
  const quantityLbs = quantityFromText(text);
  const recipientTypes = storage === 'Refrigerated'
    ? new Set(['food-bank', 'pantry', 'hot-meal'])
    : new Set(['food-bank', 'pantry', 'community-fridge', 'hot-meal']);
  const candidates = places
    .filter((place) => recipientTypes.has(place.type))
    .map((place) => ({ place, sameCity: city ? place.city?.toLowerCase().includes(city) : false }))
    .sort((a, b) => Number(b.sameCity) - Number(a.sameCity))
    .slice(0, 3)
    .map(({ place }) => place);

  return {
    food,
    storage,
    quantityLbs,
    urgency: urgencyFromText(text),
    city,
    candidates,
    needsDetails: !quantityLbs || !city,
  };
};

export const rescueMessage = (plan) => {
  const amount = plan.quantityLbs ? `${plan.quantityLbs.toLocaleString()} lbs of ` : '';
  const where = plan.city ? ` near ${plan.city.replace(/\b\w/g, (letter) => letter.toUpperCase())}` : '';
  const details = plan.needsDetails
    ? ' To create a dispatch, tell me the pickup city or ZIP, approximate pounds, and the latest safe pickup time.'
    : '';
  return `I can start a surplus-food rescue handoff for ${amount}${plan.food}${where}. I’ll prioritize recipients that can handle ${plan.storage.toLowerCase()} food. ${plan.urgency}. Contact the recipient before loading—capacity, accepted items, and food-safety handling must be confirmed for every pickup.${details}`;
};
