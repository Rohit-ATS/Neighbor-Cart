/* Turning a sentence into a filter set.

   The directory used to ask people to assemble their own query out of a search
   field, eight city pills, six category pills, three dropdowns and three
   checkboxes — twenty controls to say "a halal pantry near me that's open now
   and doesn't need ID". This reads that sentence instead and sets the same
   filters underneath.

   Every match it makes is reported back as a chip the person can see and
   remove, because a search that silently guesses wrong is worse than one that
   made you click. Nothing here is hidden: the filters it sets are the same
   ones the full controls still edit. */

/* Each rule owns one filter. `test` matches however the thing is said; `label`
   is what the chip reads; `key` and `value` are what the screen applies. */
const RULES = [
  // --- what kind of place ---
  { key: 'category', value: 'food-bank', label: 'Food banks', test: /\bfood ?bank/i },
  { key: 'category', value: 'pantry', label: 'Food pantries', test: /\bpantr(y|ies)\b/i },
  { key: 'category', value: 'hot-meal', label: 'Hot meals & kitchens', test: /\bhot meal|soup kitchen|\bkitchen|\bmeal site|hot food|\bdinner\b|\blunch\b|\bbreakfast\b/i },
  { key: 'category', value: 'community-fridge', label: 'Community fridges', test: /\bfridge|refrigerator/i },
  { key: 'category', value: 'mobile', label: 'Mobile distributions', test: /\bmobile\b|food truck|\bdistribution\b|pop[- ]?up/i },

  // --- the quick toggles ---
  { key: 'openNow', value: true, label: 'Open right now', test: /\bopen (right )?now|open today|open at this hour|right now\b|\btonight\b|currently open/i },
  { key: 'reservations', value: true, label: 'Takes reservations', test: /\breserv|\bbook\b|pickup slot|appointment|express pickup/i },
  { key: 'produce', value: true, label: 'Fresh produce in stock', test: /\bproduce\b|fresh fruit|\bvegetable|\bveggies\b|fresh food/i },

  // --- dietary, matching DIETARY_OPTIONS exactly ---
  { key: 'diet', value: 'Halal', label: 'Halal', test: /\bhalal\b/i },
  { key: 'diet', value: 'Kosher', label: 'Kosher', test: /\bkosher\b/i },
  { key: 'diet', value: 'Vegan', label: 'Vegan', test: /\bvegan\b/i },
  { key: 'diet', value: 'Vegetarian', label: 'Vegetarian', test: /\bvegetarian\b/i },
  { key: 'diet', value: 'Gluten-Free', label: 'Gluten-free', test: /\bgluten|celiac\b/i },
  { key: 'diet', value: 'Diabetic-Friendly', label: 'Diabetic-friendly', test: /\bdiabet/i },
  { key: 'diet', value: 'Dairy-Free', label: 'Dairy-free', test: /\bdairy[- ]?free|lactose/i },
  { key: 'diet', value: 'No-Cook / Pull-Tab Cans', label: 'No cooking needed', test: /\bno[- ]cook|pull[- ]?tab|ready[- ]to[- ]eat|no (kitchen|stove)|can'?t cook|shelf[- ]stable/i },
  { key: 'diet', value: 'Baby Formula / Infant Food', label: 'Baby formula & infant food', test: /\bformula\b|\binfant\b|\bbaby\b|\bdiaper/i },

  // --- languages, matching LANGUAGE_OPTIONS exactly ---
  { key: 'language', value: 'Spanish (Español)', label: 'Spanish spoken', test: /\bspanish|espa(ñ|n)ol|hablo\b/i },
  { key: 'language', value: 'Mandarin (中文)', label: 'Mandarin spoken', test: /\bmandarin|chinese\b/i },
  { key: 'language', value: 'Cantonese', label: 'Cantonese spoken', test: /\bcantonese\b/i },
  { key: 'language', value: 'Vietnamese (Tiếng Việt)', label: 'Vietnamese spoken', test: /\bvietnamese\b/i },
  { key: 'language', value: 'Arabic (العربية)', label: 'Arabic spoken', test: /\barabic\b/i },
  { key: 'language', value: 'Somali (Soomaali)', label: 'Somali spoken', test: /\bsomali\b/i },
  { key: 'language', value: 'Haitian Creole', label: 'Haitian Creole spoken', test: /\bhaitian|creole\b/i },

  // --- access rules, matching ELIGIBILITY_OPTIONS exactly ---
  { key: 'eligibility', value: 'No ID Required', label: 'No ID required', test: /\bno (photo )?id\b|without (an )?id|don'?t have (an )?id|no papers|undocumented/i },
  { key: 'eligibility', value: 'No Proof of Income', label: 'No proof of income', test: /\bproof of income|no income|income proof|no paperwork\b/i },
  { key: 'eligibility', value: 'Walk-ins Welcome', label: 'Walk-ins welcome', test: /\bwalk[- ]?in/i },
  { key: 'eligibility', value: 'Drive-Thru Available', label: 'Drive-thru', test: /\bdrive[- ]?(thru|through)/i },
  { key: 'eligibility', value: 'Home Delivery Available', label: 'Home delivery', test: /\bdeliver(y|ed|s)?\b|brought to me|can'?t leave( the)? (house|home)/i },
  { key: 'eligibility', value: 'Client-Choice Market', label: 'Client-choice market', test: /\bclient[- ]choice|choice market|shop for myself|pick my own/i },
];

/* Cities the directory actually covers. Matching them explicitly keeps a place
   name out of the leftover keyword search, where "New York" would otherwise be
   hunted for in inventory listings. */
const CITIES = [
  'Des Moines', 'New York', 'Brooklyn', 'Bronx', 'Manhattan', 'Los Angeles',
  'Chicago', 'Pilsen', 'Houston', 'Seattle', 'Miami', 'Boston', 'Atlanta',
  'Denver', 'Philadelphia', 'Phoenix', 'Detroit', 'Oakland', 'San Francisco',
];

/* Words that carry no filter and should not survive into the keyword search. */
const FILLER = /\b(i|i'?m|im|me|my|we|our|us|a|an|the|is|are|am|do|does|can|could|would|should|please|need|needs|needed|needing|want|wanted|looking|look|for|find|show|get|some|any|near|nearby|close|around|by|in|at|on|to|with|without|and|or|of|that|this|there|here|place|places|somewhere|food|help|assistance|thanks|hi|hello|fresh|free|open|available|welcome|spoken|required|require|requires|accepted|allowed|serving|serves|site|sites|hours|today|now|community|home|walk|walking|only|where|what|which|who|how|no|not|don'?t|cannot|can'?t|just|really|very|maybe)\b/gi;

export function parseSearch(input) {
  const text = (input || '').trim();
  if (!text) return { filters: emptyFilters(), understood: [], leftover: '' };

  const filters = emptyFilters();
  const understood = [];
  let remainder = ` ${text} `;

  const claim = (rule) => {
    /* Consume the whole word the rule matched, not just the part its pattern
       spelled out: "walk-in" has to take the "s" in "walk-ins" with it, or the
       orphan lands in the keyword search. */
    remainder = remainder.replace(new RegExp(`(?:${rule.test.source})\\w*`, 'gi'), ' ');

    /* The underlying filters hold one value each, so the first rule to claim a
       key wins. The phrase is still consumed above — it was understood, it just
       lost — and the chips show which constraint actually applied. */
    if (understood.some((chip) => chip.key === rule.key)) return;

    understood.push({
      id: `${rule.key}:${rule.value}`,
      key: rule.key,
      value: rule.value,
      label: rule.label,
    });
    filters[rule.key] = rule.value;
  };

  RULES.forEach((rule) => { if (rule.test.test(text)) claim(rule); });

  /* A place name or ZIP goes to the text filter, which already searches city,
     neighborhood and address. */
  const zip = text.match(/\b(\d{5})(?:-\d{4})?\b/);
  const city = CITIES.find((name) => new RegExp(`\\b${name}\\b`, 'i').test(text));
  if (zip) {
    filters.where = zip[1];
    understood.push({ id: `where:${zip[1]}`, key: 'where', value: zip[1], label: `Near ${zip[1]}` });
    remainder = remainder.replace(zip[0], ' ');
  } else if (city) {
    filters.where = city;
    understood.push({ id: `where:${city}`, key: 'where', value: city, label: `In ${city}` });
    remainder = remainder.replace(new RegExp(`\\b${city}\\b`, 'gi'), ' ');
  }

  /* Whatever is left that is not filler is a thing someone is looking for —
     "rice", "bread", "formula" — and belongs in the keyword search. */
  const leftover = remainder
    .replace(FILLER, ' ')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    // Bare numbers left over from "24/7" or "open 'til 8" are not inventory.
    .replace(/\b\d{1,4}\b/g, ' ')
    // A one-letter orphan is debris, never a search term.
    .replace(/\b\p{L}\b/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  /* The place and the thing being looked for are matched against different
     fields, so "rice and beans in Chicago" keeps both rather than making one
     substring that matches nothing. */
  if (leftover) {
    filters.item = leftover;
    understood.push({ id: `item:${leftover}`, key: 'item', value: leftover, label: `Stocking “${leftover}”` });
  }

  return { filters, understood, leftover };
}

function emptyFilters() {
  return {
    category: 'all',
    openNow: false,
    reservations: false,
    produce: false,
    diet: 'all',
    language: 'all',
    eligibility: 'all',
    where: '',
    item: '',
  };
}

/* Shown under the field until someone types, as a demonstration of what the
   field will accept rather than a list of what it supports. */
export const SEARCH_EXAMPLES = [
  'Hot meals where no ID is needed',
  'Baby formula and diapers in Des Moines',
  'Fresh produce in Chicago, walk-ins welcome',
  'Halal pantry near 60632 that takes reservations',
];
