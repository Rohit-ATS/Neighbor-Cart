import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PLACES, getIsOpenNow } from '../data/places.js';
import { askHarvestLink } from '../lib/api.js';
import { formatMiles, haversineMiles, useUserLocation } from '../lib/geo.js';
import AskBar from './AskBar.jsx';
import AiMiniMap from './AiMiniMap.jsx';
import LocationButton from './LocationButton.jsx';
import { getSectionKnowledge } from '../lib/pageContext.js';
import { classifyMessage, mergeNeeds } from '../lib/needs.js';
import { getResidentProfile, RESIDENT_PROFILE_EVENT, residentProfileFacts } from '../lib/residentProfile.js';
import { buildRescuePlan, isFoodRescueIntent, rescueMessage } from '../lib/foodRescue.js';

/* The conversation itself.

   It renders as a full section of the workspace, the way any messaging app
   does: a quiet header, the thread, and the composer resting at the bottom
   until it is spoken to. The same component also fits inside a modal shell,
   so the two entry points never drift apart. */

const GREETING = {
  sender: 'ai',
  text: 'Hi, I’m the Neighbor Navigator. Tell me what you need — a diet, a neighborhood, no car, no ID, kids at home — and I’ll find verified food help that fits, and put it on a map for you.',
  citations: [],
  timestamp: 'Just now',
};

// Three starters, no more: a short label to scan and the full question it
// actually asks, so the tray stays one calm row instead of a wall of text.
const SAMPLE_QUESTIONS = [
  { label: 'Open right now', prompt: 'What food assistance is open right now?' },
  { label: 'Halal, no ID', prompt: 'Where can I get Halal food with no ID required?' },
  { label: 'No car needed', prompt: 'Free pantries reachable by public transit near me?' },
];

/* Opening on a section: name where they are, say what it is, then get out of
   the way. The explainer is the same knowledge the model is given, so the
   first thing they read matches whatever they ask next. */
const sectionGreeting = (section) => ({
  sender: 'ai',
  text: `${section.explainer}\n\nAsk me anything about this, or tell me what you need — a diet, a neighborhood, no car, no ID, kids at home — and I’ll find verified food help that fits.`,
  citations: [],
  sectionLabel: section.label,
  timestamp: 'Just now',
});

/* Unreadable input gets a short, unembarrassed ask — never "I've noted that",
   which is what made a stray keystroke look like a recorded requirement. */
const unreadableReply = (text, kind) => ({
  sender: 'ai',
  text: kind === 'gibberish'
    ? `I couldn’t read “${text.length > 24 ? `${text.slice(0, 24)}…` : text}” — it may have been a slip of the keyboard. Tell me what you need in a few words: a diet, a neighborhood, no car, no ID, kids at home.`
    : 'I’m not sure what to do with that one. Tell me what you need — a diet, a neighborhood, no car, no ID, kids at home — or ask me to find food near you.',
  citations: [],
  warning: null,
  timestamp: clockTime(),
});

// "What is open right now?" is a request for places, not a stray detail to
// remember; the phrasings people actually use all have to land here.
/* Asking for places, however it is phrased. The plural forms matter: `\bplace\b`
   never matched "places", so "can you provide me places…" fell through to the
   "tell me when you're ready" reply while plainly being a request for places. */
const asksNearMe = (text) => /\b(near( ?by)?|nearest|closest|close to me|close by|around me|my area|walking distance|within \d+ ?(mi|miles|minutes))\b/i.test(text);

/* Asking to be sent somewhere counts however it is worded, so a question that
   names no category — "what's closest to me?" — is still a request for places. */
const isPlaceSearchIntent = (text) => asksNearMe(text) || /\b(where|find|finding|suggest|recommend|show|provide|give|list|get me|take me|point me|look(ing)? for|need|want|any(where|thing)?|somewhere|near|nearby|close by|around me|location|locations|place|places|spot|spots|site|sites|pantry|pantries|food ?bank|food ?banks|fridge|fridges|kitchen|kitchens|open\s+(right\s+)?now|open\s+today|option|options|hot meal|hot meals|meal site|get food|assistance|grocery|groceries|distribution|distributions)\b/i.test(text);

/* "Places that do not sell beans" is a request for places, with a thing to
   leave out. Reading only the noun would return exactly the places the person
   asked to avoid, so the negation has to be lifted out before matching. */
const EXCLUSION_STOPWORDS = new Set([
  // these follow "no" as a requirement about access, never about stock
  'id', 'ids', 'identification', 'car', 'cost', 'costs', 'money', 'fee', 'fees',
  'papers', 'paperwork', 'appointment', 'appointments', 'kitchen', 'questions',
  'income', 'proof', 'address', 'account', 'registration', 'longer', 'one',
  // verbs and filler that ride along after the negation
  'sell', 'sells', 'selling', 'have', 'has', 'carry', 'carries', 'stock',
  'stocks', 'give', 'gives', 'offer', 'offers', 'serve', 'serves', 'any', 'the',
  'a', 'an', 'that', 'with', 'of', 'me', 'please', 'it', 'them',
]);

export const parseExclusions = (text) => {
  const found = [];
  const pattern = /\b(?:not|no|without|don'?t|doesn'?t|dont|avoid|exclude|except|other than|besides|allergic to)\b([^.,;?!]*)/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    (match[1] || '')
      .toLowerCase()
      .split(/[^a-zà-ÿ'-]+/)
      .filter((word) => word.length > 2 && !EXCLUSION_STOPWORDS.has(word))
      .slice(0, 3)
      .forEach((word) => { if (!found.includes(word)) found.push(word); });
  }
  return found;
};
/* The two optional services, each described by what it buys rather than by the
   data it takes — and with the cost of declining spelled out, so leaving one
   off is a decision rather than the path of least resistance. */
const CONSENT_CHOICES = [
  {
    id: 'bedrock',
    title: 'Tailor answers to my saved details',
    onHint: 'Your ZIP, household size, timing, transport and food needs go to Amazon Bedrock with each question.',
    offHint: 'Answers stay general. Your saved intake details are not sent anywhere.',
  },
  {
    id: 'google',
    title: 'Use real travel times',
    onHint: 'Your precise location goes to Google Maps to time the journey door to door.',
    offHint: 'Distances are measured in a straight line on this device, so they read shorter than the trip.',
  },
];

const hasLocation = (text) => /\b(chicago|cook county|pilsen|new york|nyc|bronx|manhattan|los angeles|california|iowa|des moines)\b|\b\d{5}(?:-\d{4})?\b/i.test(text);
const clockTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function AiChat({ variant = 'section', sectionId = null, onClose, onSelectPlace, onShowMatches, onOpenRescue }) {
  // What the person was looking at when they opened the navigator. It shapes
  // the opener, the starters, and the context the model is given.
  const section = sectionId ? getSectionKnowledge(sectionId) : null;

  const [messages, setMessages] = useState(() => (section ? [sectionGreeting(section)] : [GREETING]));
  const [isThinking, setIsThinking] = useState(false);
  const [chosenId, setChosenId] = useState(null);
  const streamRef = useRef(null);
  const { origin, status: locationStatus, request: requestLocation, clear: clearLocation } = useUserLocation();

  /* Memory holds recognized facts — {id, label} — never the raw message, so a
     mistyped line can no longer become a standing requirement. The key is
     versioned because older sessions stored raw text under the previous one. */
  const [rememberedNeeds, setRememberedNeeds] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('harvestlink-ai-needs-v3') || '[]');
      return Array.isArray(saved)
        ? saved.filter((item) => item && typeof item.id === 'string' && typeof item.label === 'string').slice(-12)
        : [];
    } catch {
      return [];
    }
  });
  const [residentProfile, setResidentProfile] = useState(() => getResidentProfile());
  const [bedrockProfileConsent, setBedrockProfileConsent] = useState(false);
  const [googleRoutesConsent, setGoogleRoutesConsent] = useState(false);
  /* Reopened by hand after folding. It is not reset when a consent is
     withdrawn — the panel is already open in that case. */
  const [consentOpen, setConsentOpen] = useState(false);
  const allConsentGiven = bedrockProfileConsent && googleRoutesConsent;

  /* Granting the second consent folds the panel away; withdrawing either one
     brings it back, so the controls are always where the state is. */
  useEffect(() => {
    if (allConsentGiven) setConsentOpen(false);
  }, [allConsentGiven]);

  useEffect(() => {
    sessionStorage.setItem('harvestlink-ai-needs-v3', JSON.stringify(rememberedNeeds));
  }, [rememberedNeeds]);

  // The intake can remain open beside the navigator. Listen for its save event
  // so the next message immediately uses the newly completed profile.
  useEffect(() => {
    const updateProfile = (event) => setResidentProfile(event.detail || getResidentProfile());
    window.addEventListener(RESIDENT_PROFILE_EVENT, updateProfile);
    return () => window.removeEventListener(RESIDENT_PROFILE_EVENT, updateProfile);
  }, []);


  // Land on the top of the newest answer rather than the bottom of the thread,
  // so the reply and the map it brings are both in view.
  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    const last = el.lastElementChild;
    if (isThinking || !last) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      return;
    }
    el.scrollTo({ top: Math.max(0, last.offsetTop - el.offsetTop - 8), behavior: 'smooth' });
  }, [messages, isThinking]);

  /* The hosted model receives a catalog with local, straight-line distances.
     Precise coordinates stay in the browser unless the resident separately
     opts into Google Routes for real travel times below. */
  const verifiedCatalog = PLACES.map((place) => {
    const miles = origin ? haversineMiles(origin, { lat: place.lat, lng: place.lng }) : null;
    return {
      id: place.id,
      name: place.name,
      address: `${place.address}, ${place.cityStateZip}`,
      city: place.city,
      services: place.services,
      dietary: place.dietary,
      hours: place.hoursSummary,
      reservations: Boolean(place.acceptsReservations),
      ...(miles == null ? {} : { milesAway: Math.round(miles * 10) / 10 }),
    };
  });

  const handleAsk = async (queryText) => {
    const question = (queryText || '').trim();
    if (!question) return;

    /* Read the message before answering it: only recognized facts are kept,
       and an unreadable line is handled here rather than filed and forwarded. */
    const reading = classifyMessage(question);
    const profileFacts = residentProfileFacts(residentProfile);
    const memoryWithProfile = mergeNeeds(rememberedNeeds, profileFacts);
    const nextNeeds = reading.facts.length > 0 ? mergeNeeds(memoryWithProfile, reading.facts) : memoryWithProfile;
    // Keep saved intake facts out of provider-bound memory. The resident's
    // own chat facts remain eligible because they submitted that message.
    const nextRememberedNeeds = reading.facts.length > 0
      ? mergeNeeds(rememberedNeeds, reading.facts)
      : rememberedNeeds;
    const providerLabels = nextRememberedNeeds.map((need) => need.label);
    const nextLabels = nextNeeds.map((need) => need.label);

    setMessages((prev) => [...prev, { sender: 'user', text: question, timestamp: clockTime() }]);
    setRememberedNeeds(nextRememberedNeeds);

    // Nothing readable to send anywhere: ask for it again and keep the memory
    // untouched, rather than spending a model call on a keyboard slip.
    if (reading.kind === 'gibberish' || reading.kind === 'unclear') {
      setMessages((prev) => [...prev, unreadableReply(question, reading.kind)]);
      return;
    }

    // Surplus food needs a logistics handoff, not the resident-facing search
    // flow. Keep it local and explicit: matches are candidates to confirm,
    // never a claim that a recipient has already accepted the food.
    if (isFoodRescueIntent(question)) {
      const rescuePlan = buildRescuePlan(question, PLACES);
      setMessages((prev) => [...prev, {
        sender: 'ai',
        text: rescueMessage(rescuePlan),
        rescuePlan,
        citations: rescuePlan.candidates.map((place) => ({
          placeId: place.id,
          name: place.name,
          address: `${place.address}, ${place.cityStateZip}`,
          verifiedDate: place.verifiedDate,
          hours: place.hoursSummary,
          phone: place.phone,
          callAhead: true,
        })),
        warning: 'Recipient capacity and safe-handling requirements must be confirmed before a pickup is assigned.',
        timestamp: clockTime(),
      }]);
      return;
    }

    setIsThinking(true);

    try {
      const history = messages.slice(-8).map((message) => ({
        role: message.sender === 'ai' ? 'assistant' : 'user',
        text: message.text,
      }));
      const answer = await askHarvestLink({
        message: question,
        history,
        catalog: verifiedCatalog,
        memory: providerLabels,
        context: section?.summary || '',
        // Street address is never sent. The remaining saved details are only
        // included after the resident explicitly opts into Bedrock tailoring.
        residentProfile: bedrockProfileConsent ? residentProfile : null,
        bedrockProfileConsent,
      });
      const citations = (answer.placeIds || [])
        .map((placeId) => PLACES.find((place) => place.id === placeId))
        .filter(Boolean)
        .map((place) => ({
          placeId: place.id,
          name: place.name,
          address: `${place.address}, ${place.cityStateZip}`,
          verifiedDate: place.verifiedDate,
          hours: place.hoursSummary,
          phone: place.phone,
          callAhead: Boolean(answer.warning) || place.callAheadWarning,
        }));

      setMessages((prev) => [...prev, {
        sender: 'ai',
        text: answer.reply,
        citations,
        // every match drives the map; citations stay the top few for reading
        matchIds: (answer.placeIds || []).filter((id) => PLACES.some((place) => place.id === id)),
        matchedOn: nextLabels,
        warning: answer.warning || null,
        timestamp: clockTime(),
      }]);
    } catch {
      // The verified local matcher keeps the navigator useful if Bedrock is
      // temporarily unavailable or the server has not yet received an IAM role.
      setMessages((prev) => [...prev, groundedAnswer(question, nextNeeds, reading, residentProfile)]);
    } finally {
      setIsThinking(false);
    }
  };

  /* Choosing from the map is a turn in the conversation, not an exit from it. */
  const handleChoose = (place) => {
    setChosenId(place.id);
    setMessages((prev) => [...prev, {
      sender: 'user',
      text: `Let’s go with ${place.name}.`,
      timestamp: clockTime(),
    }, {
      sender: 'ai',
      text: `Good choice. ${place.name} is at ${place.address}, ${place.cityStateZip} — ${place.hoursSummary}. ${place.callAheadWarning ? `Call ${place.phone} before you set out; their stock changes quickly. ` : ''}Open the details for what they have in stock, or ask me about getting there, what to bring, or anything else you need.`,
      citations: [{
        placeId: place.id,
        name: place.name,
        address: `${place.address}, ${place.cityStateZip}`,
        verifiedDate: place.verifiedDate,
        hours: place.hoursSummary,
        phone: place.phone,
        callAhead: place.callAheadWarning,
      }],
      matchIds: [place.id],
      matchedOn: [],
      warning: null,
      timestamp: clockTime(),
    }]);
  };

  const groundedAnswer = (query, needs = rememberedNeeds, reading = classifyMessage(query), profile = residentProfile) => {
    const lower = [...needs.map((need) => need.label), query].join(' ').toLowerCase();  // everything we know so far
    const nowTime = clockTime();

    if (reading.kind === 'gibberish' || reading.kind === 'unclear') {
      return unreadableReply(query, reading.kind);
    }

    if (reading.kind === 'greeting') {
      return {
        sender: 'ai',
        text: 'Hi! I’m here to help you find food support that fits your situation. You can tell me what you need, or ask me to find a pantry, meal site, or grocery resource near you.',
        citations: [],
        warning: null,
        timestamp: nowTime,
      };
    }

    // A customer may share needs across several messages. Keep those details
    // without prematurely sending a location list; the next explicit request
    // for places will use the combined remembered context above.
    if (!isPlaceSearchIntent(query)) {
      // A question about the section they opened this from deserves the
      // section's own answer, not a note that it was remembered.
      const aboutThisSection = section && /\b(what|how|why|who|explain|tell me about|is this|does this)\b/i.test(query);
      // Naming the recorded facts back is the only way the person can tell
      // what was understood — and correct it when it was not.
      const recorded = reading.facts.map((fact) => fact.label).join(', ');
      return {
        sender: 'ai',
        text: aboutThisSection
          ? `${section.explainer} If you want, tell me your city or ZIP and I’ll find verified places that fit.`
          : recorded
            ? `Noted: ${recorded}. I’ll apply that to every search from here. When you’re ready, ask me to find food near you.`
            : 'Got it. When you’re ready, ask me to find or suggest nearby food options and I’ll use everything you’ve shared so far to narrow them down.',
        citations: [],
        warning: null,
        timestamp: nowTime,
      };
    }

    /* Branch on one body of text. The newest question gets first refusal: a
       requirement shared three messages ago should narrow an answer, never
       decide which question is being answered. */
    const matchFor = (text) => {
      const zipMatch = text.match(/\b(\d{5})(?:-\d{4})?\b/);
      if (zipMatch) {
        const places = PLACES.filter((place) => place.zip === zipMatch[1]);
        if (places.length > 0) {
          return { places, reasoning: `Here are verified food-access locations serving ZIP ${zipMatch[1]}:` };
        }
      }
      if (text.includes('open right now') || text.includes('open now') || text.includes('open today')) {
        const places = PLACES.filter((place) => getIsOpenNow(place).isOpen);
        return { places, reasoning: `I found ${places.length} verified ${places.length === 1 ? 'location' : 'locations'} open right now based on published hours.` };
      }
      if (text.includes('halal')) {
        return {
          places: PLACES.filter((place) => place.dietary?.includes('Halal') || place.inventory.some((item) => item.item.toLowerCase().includes('halal'))),
          reasoning: 'Here are the verified food programs providing dedicated Halal-certified meat, beans, and staples without requiring identification:',
        };
      }
      if (text.includes('gluten') || text.includes('celiac')) {
        const places = PLACES.filter((place) => place.dietary?.includes('Gluten-Free') || place.inventory.some((item) => item.item.toLowerCase().includes('gluten')));
        return { places, reasoning: `Found ${places.length} ${places.length === 1 ? 'location' : 'locations'} with certified gluten-free pantries and allergen separation:` };
      }
      if (text.includes('baby') || text.includes('formula') || text.includes('diaper')) {
        return {
          places: PLACES.filter((place) => place.inventory.some((item) =>
            item.category.toLowerCase().includes('baby') || item.item.toLowerCase().includes('formula') || item.item.toLowerCase().includes('diaper'))),
          reasoning: 'The following verified centers have baby formula powder, purees, or diapers reported in stock:',
          warning: 'Infant formula supplies fluctuate rapidly. We strongly advise calling ahead to ensure the specific brand and size is on hand.',
        };
      }
      if (text.includes('reserv') || text.includes('pickup slot') || text.includes('pick-up slot')
        || text.includes('book a') || text.includes('appointment') || text.includes('express pickup')) {
        const places = PLACES.filter((place) => place.acceptsReservations);
        return {
          places,
          reasoning: `${places.length} verified ${places.length === 1 ? 'location lets' : 'locations let'} you hold a pickup slot ahead of time, so your food is set aside before you arrive.`,
        };
      }
      if (text.includes('hot meal') || text.includes('soup kitchen') || text.includes('dinner') || text.includes('lunch') || text.includes('kitchen')) {
        return {
          places: PLACES.filter((place) => place.type === 'hot-meal'),
          reasoning: 'Here are free community meal programs serving freshly prepared chef-cooked hot meals:',
        };
      }
      if (text.includes('chicago') || text.includes('cook county') || text.includes('pilsen')) {
        return {
          places: PLACES.filter((place) => place.city?.toLowerCase().includes('chicago') || place.state === 'IL'),
          reasoning: 'Here are verified hunger relief locations serving the greater Chicago area:',
        };
      }
      if (text.includes('new york') || text.includes('nyc') || text.includes('bronx') || text.includes('manhattan')) {
        return {
          places: PLACES.filter((place) => place.state === 'NY'),
          reasoning: 'Here are verified emergency food distributions and community meals across New York City:',
        };
      }
      if (text.includes('los angeles') || text.includes('california')) {
        return {
          places: PLACES.filter((place) => place.city?.toLowerCase().includes('los angeles') || place.state === 'CA'),
          reasoning: 'Verified food access centers in Los Angeles County:',
        };
      }
      if (text.includes('iowa') || text.includes('des moines')) {
        return {
          places: PLACES.filter((place) => place.state === 'IA'),
          reasoning: 'Verified food banks, pantries, and 24/7 mutual aid fridges in Central Iowa:',
        };
      }
      if (text.includes('transit') || text.includes('bus') || text.includes('subway') || text.includes('train')) {
        return {
          places: PLACES.filter((place) => place.transitInfo),
          reasoning: 'Here are verified locations directly accessible via major public transit bus and rail stops:',
        };
      }
      const keyword = PLACES.filter((place) =>
        place.name.toLowerCase().includes(text)
        || place.neighborhood.toLowerCase().includes(text)
        || place.city.toLowerCase().includes(text)
        || place.services.some((service) => service.toLowerCase().includes(text))
        || place.inventory.some((item) => item.item.toLowerCase().includes(text)));
      return { places: keyword, reasoning: 'Based on your request, I matched these verified food access resources:' };
    };

    /* Anything the person asked to leave out is pulled before matching, so the
       words naming it cannot be read as a request for it. */
    const exclusions = parseExclusions(query);
    const positive = exclusions.reduce(
      (text, word) => text.replace(new RegExp(`\\b${word}\\w*`, 'gi'), ' '),
      query.toLowerCase(),
    ).replace(/\s+/g, ' ').trim();

    const fromQuery = matchFor(positive || query.toLowerCase());
    const match = fromQuery.places.length > 0 ? fromQuery : matchFor(lower);
    let matchedPlaces = match.places;
    let reasoning = match.reasoning;
    const warningNote = match.warning || null;

    /* "Somewhere that doesn't stock beans" names no place to look for, so the
       whole verified directory is the starting point and the exclusion does
       the narrowing. */
    if (exclusions.length > 0) {
      if (matchedPlaces.length === 0) matchedPlaces = PLACES;
      const stocks = (place, word) => `${place.inventory.map((i) => `${i.item} ${i.category}`).join(' ')} ${place.services.join(' ')}`
        .toLowerCase()
        .includes(word);
      const kept = matchedPlaces.filter((place) => !exclusions.some((word) => stocks(place, word)));
      const listed = exclusions.join(' or ');
      if (kept.length > 0) {
        matchedPlaces = kept;
        reasoning = `Here are verified places that do not list ${listed}:`;
      } else {
        reasoning = `Every verified place I have lists ${listed}, so I could not rule it out. These are the closest options — their stock changes often, so it is worth calling ahead:`;
      }
    }

    /* Everything the person has told us still has to hold. A Halal
       requirement from an earlier message survives a later "what's open?". */
    const dietaryNeeds = [
      ['halal', 'Halal'],
      ['kosher', 'Kosher'],
      ['vegan', 'Vegan'],
      ['vegetarian', 'Vegetarian'],
      ['gluten', 'Gluten-Free'],
      ['diabetic', 'Diabetic-Friendly'],
      ['dairy', 'Dairy-Free'],
    ].filter(([token]) => lower.includes(token)).map(([, label]) => label);

    if (dietaryNeeds.length > 0 && matchedPlaces.length > 1) {
      const narrowed = matchedPlaces.filter((place) => dietaryNeeds.every((need) => place.dietary?.includes(need)));
      if (narrowed.length > 0) matchedPlaces = narrowed;
    }

    /* A shared location is an answer to "where are you", so the matcher has to
       hold it. Without this the navigator kept asking for a ZIP code someone
       had already supplied by pressing "Use my location", and "nearby" meant
       nothing to it. */
    const distanceTo = (place) => haversineMiles(origin, { lat: place.lat, lng: place.lng });

    if (origin) {
      // "Which nearby places…" is a real constraint once coordinates exist, so
      // an empty match becomes the whole directory, ordered by how far it is.
      if (matchedPlaces.length === 0 && asksNearMe(query)) matchedPlaces = PLACES;
      matchedPlaces = [...matchedPlaces].sort((a, b) => (distanceTo(a) ?? Infinity) - (distanceTo(b) ?? Infinity));

      const nearest = matchedPlaces[0] ? formatMiles(distanceTo(matchedPlaces[0])) : null;
      if (nearest) {
        matchedPlaces = matchedPlaces.slice(0, 6);
        reasoning = `${reasoning} Sorted by distance from you — the closest is ${nearest}.`;
      }
    }

    if (matchedPlaces.length === 0) {
      if (!hasLocation(query) && !profile?.location && !origin) {
        /* Returning nothing and asking for a ZIP leaves someone who needs food
           with an empty screen. Show what the directory has and let the ZIP
           narrow it, rather than making the question a toll gate. */
        const sample = PLACES.slice(0, 3);
        return {
          sender: 'ai',
          text: 'I don’t have your area yet, so here are verified places from across the directory. Tell me a city or ZIP code — or share your location — and I’ll narrow this to what you can actually reach.',
          citations: sample.map((place) => ({
            placeId: place.id,
            name: place.name,
            address: `${place.address}, ${place.cityStateZip}`,
            verifiedDate: place.verifiedDate,
            hours: place.hoursSummary,
            phone: place.phone,
            callAhead: place.callAheadWarning,
          })),
          matchIds: sample.map((place) => place.id),
          matchedOn: needs.map((need) => need.label),
          warning: null,
          timestamp: nowTime,
        };
      }
      if (origin) {
        const nearest = [...PLACES]
          .sort((a, b) => (distanceTo(a) ?? Infinity) - (distanceTo(b) ?? Infinity))
          .slice(0, 3);
        return {
          sender: 'ai',
          text: `I could not find a verified match for “${query}”, but I do have your location. These are the closest verified places to you — the nearest is ${formatMiles(distanceTo(nearest[0]))}.`,
          citations: nearest.map((place) => ({
            placeId: place.id,
            name: place.name,
            address: `${place.address}, ${place.cityStateZip}`,
            verifiedDate: place.verifiedDate,
            hours: place.hoursSummary,
            phone: place.phone,
            callAhead: place.callAheadWarning,
          })),
          matchIds: nearest.map((place) => place.id),
          matchedOn: needs.map((need) => need.label),
          warning: null,
          timestamp: nowTime,
        };
      }
      return {
        sender: 'ai',
        text: `I could not locate verified food assistance records matching "${query}" in our verified national registry. To prevent sending anyone to an inactive site, I only return confirmed providers. You can try searching by city (for example Chicago, New York, Des Moines), ZIP code, or browsing the full map.`,
        citations: [],
        warning: null,
        timestamp: nowTime,
      };
    }

    const citations = matchedPlaces.slice(0, 3).map((place) => ({
      placeId: place.id,
      name: place.name,
      address: `${place.address}, ${place.cityStateZip}`,
      verifiedDate: place.verifiedDate,
      hours: place.hoursSummary,
      phone: place.phone,
      callAhead: place.callAheadWarning || Boolean(warningNote),
    }));

    return {
      sender: 'ai',
      text: matchedPlaces.length > 1 ? `${reasoning} Pick whichever suits you and I’ll take it from there.` : reasoning,
      citations,
      // every match drives the map; citations stay the top few for reading
      matchIds: matchedPlaces.map((place) => place.id),
      matchedOn: needs.map((need) => need.label),
      warning: warningNote,
      timestamp: nowTime,
    };
  };

  return (
    <div className={`ai-chat ai-chat--${variant}`}>
      <header className="ai-chat-header">
        <div className="ai-header-brand">
          <span className="ai-avatar-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4v1a2 2 0 0 1 2 2v7a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V9a2 2 0 0 1 2-2V6a4 4 0 0 1 4-4z" />
              <circle cx="9" cy="13" r="1" fill="currentColor" />
              <circle cx="15" cy="13" r="1" fill="currentColor" />
              <line x1="10" y1="17" x2="14" y2="17" />
            </svg>
          </span>
          {/* Name, then two short facts about this conversation — where it is
              reading from and what it is grounded in. The long sentence that
              used to sit here wrapped onto a second line and collided with the
              context chip; it survives as the trust chip's tooltip. */}
          <div className="ai-header-id">
            <h3 className="ai-header-title">Neighbor Navigator</h3>
            <div className="ai-header-meta">
              {section && (
                <span className="ai-header-context" title={`Answering about: ${section.label}`}>
                  {section.label}
                </span>
              )}
              <span
                className="ai-header-trust"
                title="Grounded in verified US food assistance records, with sources on every answer."
              >
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="4 12.5 9.5 18 20 6.5" />
                </svg>
                Verified sources
              </span>
            </div>
          </div>
        </div>

        <div className="ai-header-tools">
          <LocationButton
            status={locationStatus}
            onRequest={requestLocation}
            onClear={clearLocation}
          />
          {onClose && (
            <button className="modal-close-simple" onClick={onClose} aria-label="Close assistant">×</button>
          )}
        </div>
      </header>

      <div className="ai-chat-stream" ref={streamRef}>
        {messages.map((message, index) => (
          <div key={index} className={`ai-message-row ${message.sender === 'user' ? 'is-user' : 'is-ai'}`}>
            <div className="ai-message-bubble">
              <p className="ai-message-text">{message.text}</p>

              {message.warning && (
                <div className="ai-call-ahead-alert">
                  ⚠️ <b>Call ahead notice:</b> {message.warning}
                </div>
              )}

              {message.rescuePlan && (
                <div className="ai-rescue-plan" aria-label="Surplus food rescue plan">
                  <div className="ai-rescue-plan-head">
                    <span aria-hidden="true">♻️</span>
                    <b>Food rescue handoff</b>
                    <em>{message.rescuePlan.urgency}</em>
                  </div>
                  <div className="ai-rescue-plan-details">
                    <span><b>Food:</b> {message.rescuePlan.food}</span>
                    <span><b>Handling:</b> {message.rescuePlan.storage}</span>
                    <span><b>Amount:</b> {message.rescuePlan.quantityLbs ? `${message.rescuePlan.quantityLbs.toLocaleString()} lbs` : 'Need estimate'}</span>
                  </div>
                  <button
                    type="button"
                    className="ai-rescue-plan-action"
                    onClick={() => { onOpenRescue?.(); onClose?.(); }}
                  >
                    Open rescue dispatch →
                  </button>
                </div>
              )}

              {message.matchIds?.length > 0 && (
                <AiMiniMap
                  places={message.matchIds.map((id) => PLACES.find((place) => place.id === id)).filter(Boolean)}
                  matchedOn={message.matchedOn}
                  origin={origin}
                  googleRoutesConsent={googleRoutesConsent}
                  chosenId={chosenId}
                  onChoose={handleChoose}
                  onOpenPlace={(place) => { onSelectPlace?.(place); onClose?.(); }}
                  onShowAll={onShowMatches ? (places) => { onShowMatches(places); onClose?.(); } : null}
                />
              )}

              {/* The map already lists every match in full; citations are
                  for answers that name places without drawing them. */}
              {message.citations?.length > 0 && !message.matchIds?.length && (
                <div className="ai-citations-box">
                  <span className="citations-label">Verified source records ({message.citations.length}):</span>
                  <div className="citations-list">
                    {message.citations.map((citation, citationIndex) => (
                      <div key={citationIndex} className="citation-card">
                        <div className="citation-top">
                          <h4 className="citation-title">{citation.name}</h4>
                          <span className="citation-verified-pill">✓ {citation.verifiedDate}</span>
                        </div>
                        <p className="citation-addr">📍 {citation.address}</p>
                        <p className="citation-hours">⏱ {citation.hours}</p>
                        {citation.callAhead && (
                          <span className="citation-warn-tag">📞 Call ahead recommended: {citation.phone}</span>
                        )}
                        <div className="citation-action-row">
                          <button
                            type="button"
                            className="citation-view-btn"
                            onClick={() => {
                              const place = PLACES.find((candidate) => candidate.id === citation.placeId);
                              if (place) { onSelectPlace?.(place); onClose?.(); }
                            }}
                          >
                            Open details & inventory →
                          </button>
                          <a href={`tel:${citation.phone.replace(/[^0-9]/g, '')}`} className="citation-call-btn">
                            Call {citation.phone}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <span className="ai-message-timestamp">{message.timestamp}</span>
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="ai-message-row is-ai">
            <div className="ai-message-bubble ai-thinking-bubble">
              <span className="dot-pulse" /> Grounding your answer against verified records…
            </div>
          </div>
        )}
      </div>

      <div className="ai-chat-composer">
        {/* Two choices, each stated as what it buys and what it costs. Once
            both are made there is nothing left to decide, so the panel folds
            down to a single line — but it stays on screen, because consent you
            cannot find again is consent you cannot withdraw. */}
        <div className={`ai-consent${allConsentGiven && !consentOpen ? ' is-folded' : ''}`}>
          <AnimatePresence initial={false} mode="wait">
            {allConsentGiven && !consentOpen ? (
              <motion.button
                key="folded"
                type="button"
                className="ai-consent-summary"
                onClick={() => setConsentOpen(true)}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                <span className="acs-tick" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span>Sharing with Bedrock and Google Maps</span>
                <em>Change</em>
              </motion.button>
            ) : (
              <motion.fieldset
                key="open"
                className="ai-consent-panel"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                <legend>Privacy choices</legend>
                <p className="ai-consent-base">
                  Asking a question sends it, and the recent chat, to Amazon Bedrock. Your street address never leaves this device.
                </p>

                {CONSENT_CHOICES.map((choice) => {
                  const on = choice.id === 'bedrock' ? bedrockProfileConsent : googleRoutesConsent;
                  const set = choice.id === 'bedrock' ? setBedrockProfileConsent : setGoogleRoutesConsent;
                  return (
                    <label key={choice.id} className={`ai-consent-row${on ? ' is-on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(event) => set(event.target.checked)}
                      />
                      <span className="acr-switch" aria-hidden="true"><i /></span>
                      <span className="acr-copy">
                        <b>{choice.title}</b>
                        {/* What you give up by leaving it off, so "no" is an
                            informed answer and not just the quiet default. */}
                        <small>{on ? choice.onHint : choice.offHint}</small>
                      </span>
                    </label>
                  );
                })}
              </motion.fieldset>
            )}
          </AnimatePresence>
        </div>
        {/* Composer: springs open on focus, suggestions ride in its tray */}
        <AskBar
          placeholder="Ask anything about food help near you…"
          chips={section?.starters || SAMPLE_QUESTIONS}
          onSubmit={handleAsk}
          disabled={isThinking}
        />
        {rememberedNeeds.length > 0 && (
          <div className="ai-memory-strip" aria-label="Remembered food access needs">
            <span>Remembering your needs</span>
            {/* Each fact is removable on its own: the list is only trustworthy
                if a wrong entry can be taken off without wiping the rest. */}
            <ul className="ai-need-chips">
              {rememberedNeeds.map((need) => (
                <li key={need.id}>
                  <button
                    type="button"
                    className="ai-need-chip"
                    onClick={() => setRememberedNeeds((prev) => prev.filter((item) => item.id !== need.id))}
                    aria-label={`Forget ${need.label}`}
                    title={`Forget ${need.label}`}
                  >
                    {need.label}<i aria-hidden="true">×</i>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setRememberedNeeds([])}>Clear all</button>
          </div>
        )}
      </div>
    </div>
  );
}
