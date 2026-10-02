/* Deciding what is worth remembering.

   The navigator used to keep every message a person sent, which meant a
   mistyped "f" became a standing requirement and travelled into every later
   search. The fix is not a longer blocklist — it is to stop storing raw text
   at all.

   A message is read for *recognized facts*: a diet, an ID or transport
   constraint, children at home, a language, a schedule, a place. Those facts
   are what gets remembered, normalized, so the same requirement said three
   different ways is stored once. Anything that carries no fact is classified
   rather than kept: a greeting, a question, an unreadable keyboard slip, or a
   plain statement that may still matter and is held as a short note.

   Nothing here decides eligibility or diagnoses anyone; it only decides what
   goes on the list the customer can see and clear. */

/* Short words that are real, so the gibberish test does not reject a message
   made of them. Longer words are judged by shape instead. */
const SHORT_WORDS = new Set([
  'id', 'no', 'not', 'car', 'bus', 'kid', 'van', 'now', 'can', 'get', 'any', 'eat',
  'hi', 'hey', 'yes', 'yep', 'nope', 'ok', 'okay', 'me', 'my', 'im', 'i', 'a', 'an',
  'we', 'us', 'he', 'she', 'it', 'is', 'am', 'are', 'do', 'go', 'be', 'by', 'up',
  'of', 'or', 'so', 'if', 'to', 'in', 'on', 'at', 'the', 'for', 'and', 'but', 'you',
  'need', 'help', 'food', 'kids', 'open', 'near', 'ill', 'gf', 'nyc', 'la', 'zip',
]);

/* Repeated letters are emphasis, not noise: "pleeease" is a word, "aaaaa" is
   not, and collapsing the run to two tells them apart. */
const collapse = (word) => word.replace(/(.)\1{2,}/g, '$1$1');

const looksLikeWord = (raw) => {
  const word = collapse(raw);
  if (SHORT_WORDS.has(word)) return true;
  if (word.length < 3) return false;
  if (!/[aeiouy]/.test(word)) return false;          // "ksdjf"
  if (/[^aeiouy]{5,}/.test(word)) return false;      // an unpronounceable run
  if (/^(asdf|qwer|zxcv|hjkl|jkl|wasd|qaz|fjfj)/.test(word)) return false;
  return true;
};

/* Unreadable only if nothing in it reads. One real word is enough to take the
   message seriously, and any digit could be a ZIP code or a household size. */
export const isGibberish = (text) => {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/\d/.test(trimmed)) return false;
  const words = trimmed.toLowerCase().match(/[a-zà-ÿ']+/g) || [];
  if (words.length === 0) return true;               // punctuation or emoji alone
  return words.every((word) => !looksLikeWord(word));
};

export const isGreeting = (text) => /^(hi|hello|hey|yo|thanks|thank you|ty|bye|good (morning|afternoon|evening|night))[!.,\s]*$/i.test(text.trim());

export const isQuestion = (text) => /\?\s*$/.test(text.trim())
  || /^\s*(what|where|when|which|who|why|how|can|could|do|does|did|is|are|am|will|would|should|any)\b/i.test(text);

/* The vocabulary. Each rule turns however the requirement was phrased into one
   stable label, so "no papers", "I don't have an ID" and "undocumented" all
   land on the same entry instead of three. */
const NEED_RULES = [
  { id: 'halal', label: 'Halal', test: /\bhalal\b/i },
  { id: 'kosher', label: 'Kosher', test: /\bkosher\b/i },
  { id: 'vegan', label: 'Vegan', test: /\bvegan\b/i },
  { id: 'vegetarian', label: 'Vegetarian', test: /\bvegetarian\b/i },
  { id: 'gluten-free', label: 'Gluten-free', test: /\bgluten|celiac\b/i },
  { id: 'dairy-free', label: 'Dairy-free', test: /\bdairy[- ]?free|lactose\b/i },
  { id: 'nut-allergy', label: 'Nut allergy', test: /\b(nut|peanut)s?\s*(allerg|free)/i },
  { id: 'shellfish-allergy', label: 'Shellfish allergy', test: /\bshellfish|shrimp\s*allerg/i },
  { id: 'diabetic', label: 'Diabetic-friendly', test: /\bdiabet/i },
  { id: 'low-sodium', label: 'Low sodium', test: /\blow[- ]sodium|low[- ]salt\b/i },

  { id: 'no-id', label: 'No ID required', test: /\bno\s*(photo\s*)?id\b|without (an )?id\b|don'?t have (an )?id|no papers|undocumented\b/i },
  { id: 'no-proof-of-address', label: 'No proof of address', test: /no (proof of )?address|no mail|no lease/i },
  { id: 'no-car', label: 'No car — transit or walking', test: /\bno car|without a car|don'?t (have a car|drive)|can'?t drive|public transit|take the (bus|train|subway)|walking distance\b/i },
  { id: 'wheelchair', label: 'Wheelchair accessible', test: /\bwheelchair|mobility (issue|aid)|can'?t stand|use a (walker|cane)\b/i },
  { id: 'homeless', label: 'No kitchen — ready to eat', test: /\bhomeless|sleeping (rough|outside)|in a shelter|no (kitchen|stove|fridge)|can'?t cook|shelf[- ]stable|ready[- ]to[- ]eat\b/i },

  { id: 'children', label: 'Children at home', test: /\bkids?\b|\bchildren\b|\btoddler/i },
  { id: 'baby-supplies', label: 'Baby formula or diapers', test: /\bformula\b|\bdiaper|\binfant\b|\bbaby\b/i },
  { id: 'senior', label: 'Senior household', test: /\bsenior|elderly|retired|on social security\b/i },
  { id: 'pregnant', label: 'Pregnant or nursing', test: /\bpregnan|nursing|breastfeed/i },

  { id: 'spanish', label: 'Spanish spoken', test: /\bspanish|espa(ñ|n)ol|hablo\b/i },
  { id: 'mandarin', label: 'Mandarin spoken', test: /\bmandarin|chinese\b/i },
  { id: 'arabic', label: 'Arabic spoken', test: /\barabic\b/i },

  { id: 'evenings', label: 'Evenings only', test: /\bevening|after (work|5|6|7|8)|at night|nights\b/i },
  { id: 'weekends', label: 'Weekends only', test: /\bweekend|saturday|sunday\b/i },
  { id: 'urgent', label: 'Needs food today', test: /\btoday|right now|tonight|urgent|emergency|haven'?t eaten\b/i },
];

/* Household size and ZIP code carry a number, so they are captured rather than
   matched: the figure itself is the fact. */
const CAPTURE_RULES = [
  {
    id: 'household',
    test: /\b(?:household|family)\s*of\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:people|persons|adults|in (?:my|the) (?:house|household|family))\b/i,
    label: (match) => `Household of ${match[1] || match[2]}`,
  },
  {
    id: 'children-count',
    test: /\b(\d{1,2})\s*(?:kids?|children)\b/i,
    label: (match) => `${match[1]} ${Number(match[1]) === 1 ? 'child' : 'children'} at home`,
  },
  {
    id: 'zip',
    test: /\b(\d{5})(?:-\d{4})?\b/,
    label: (match) => `Near ZIP ${match[1]}`,
  },
];

const CITIES = [
  ['chicago', 'Chicago, IL'], ['pilsen', 'Pilsen, Chicago'], ['cook county', 'Cook County, IL'],
  ['new york', 'New York, NY'], ['nyc', 'New York, NY'], ['bronx', 'The Bronx, NY'],
  ['brooklyn', 'Brooklyn, NY'], ['manhattan', 'Manhattan, NY'],
  ['los angeles', 'Los Angeles, CA'], ['des moines', 'Des Moines, IA'],
  ['houston', 'Houston, TX'], ['atlanta', 'Atlanta, GA'], ['seattle', 'Seattle, WA'],
  ['denver', 'Denver, CO'],
];

export function extractNeeds(text) {
  const found = [];
  const add = (id, label) => { if (!found.some((item) => item.id === id)) found.push({ id, label }); };

  NEED_RULES.forEach((rule) => { if (rule.test.test(text)) add(rule.id, rule.label); });

  CAPTURE_RULES.forEach((rule) => {
    const match = text.match(rule.test);
    if (match) add(rule.id, rule.label(match));
  });

  const lower = text.toLowerCase();
  const city = CITIES.find(([token]) => lower.includes(token));
  if (city) add('city', `Near ${city[1]}`);

  // Baby supplies imply children at home; an exact count states it better than
  // the generic fact, so the count replaces it rather than sitting beside it.
  if (found.some((item) => item.id === 'baby-supplies')) add('children', 'Children at home');
  if (found.some((item) => item.id === 'children-count')) {
    return found.filter((item) => item.id !== 'children');
  }
  return found;
}

/* A plain sentence with no recognized fact may still be a real requirement the
   vocabulary has not learned yet, so it is held as a short note — but only if
   it reads as a statement about the person's own situation. */
const looksLikePersonalStatement = (text) => {
  const words = text.trim().match(/[a-zà-ÿ']+/gi) || [];
  if (words.length < 3) return false;
  return /\b(i|i'?m|im|my|we|our|me|us)\b/i.test(text)
    || /\b(need|needs|want|looking for|can'?t|cannot|don'?t|have|has)\b/i.test(text);
};

/* The one decision the rest of the app asks for.

   kind:
     'greeting'  — say hello back, remember nothing
     'gibberish' — unreadable; ask for it again, remember nothing
     'need'      — carries facts worth keeping; `facts` holds them
     'question'  — a question, answered rather than filed
     'note'      — a statement with no known fact; kept as one short note
     'unclear'   — readable but says nothing to act on
*/
export function classifyMessage(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return { kind: 'gibberish', facts: [] };
  if (isGreeting(trimmed)) return { kind: 'greeting', facts: [] };
  if (isGibberish(trimmed)) return { kind: 'gibberish', facts: [] };

  const facts = extractNeeds(trimmed);
  if (facts.length > 0) return { kind: 'need', facts };
  if (isQuestion(trimmed)) return { kind: 'question', facts: [] };
  if (looksLikePersonalStatement(trimmed)) {
    const label = trimmed.length > 72 ? `${trimmed.slice(0, 69).trimEnd()}…` : trimmed;
    return { kind: 'note', facts: [{ id: `note:${label.toLowerCase()}`, label }] };
  }
  return { kind: 'unclear', facts: [] };
}

/* Newest wins on a repeat, and the list stays short enough to read. */
export function mergeNeeds(existing, facts, limit = 12) {
  const next = existing.filter((item) => !facts.some((fact) => fact.id === item.id));
  return [...next, ...facts].slice(-limit);
}
