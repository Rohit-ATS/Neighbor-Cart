import React, { useEffect, useRef, useState } from 'react';
import { PLACES, getIsOpenNow } from '../data/places.js';
import { askHarvestLink } from '../lib/api.js';
import { useUserLocation } from '../lib/geo.js';
import AskBar from './AskBar.jsx';
import AiMiniMap from './AiMiniMap.jsx';

/* The conversation itself.

   It renders as a full section of the workspace, the way any messaging app
   does: a quiet header, the thread, and the composer resting at the bottom
   until it is spoken to. The same component also fits inside a modal shell,
   so the two entry points never drift apart. */

const GREETING = {
  sender: 'ai',
  text: 'Hi, I’m the HarvestLink navigator. Tell me what you need — a diet, a neighborhood, no car, no ID, kids at home — and I’ll find verified food help that fits, and put it on a map for you.',
  citations: [],
  timestamp: 'Just now',
};

const SAMPLE_QUESTIONS = [
  'What food assistance is open right now?',
  'Where can I get Halal food with no ID required?',
  'Free pantries reachable by public transit in Chicago?',
  'Where is baby formula and diapers available in Iowa?',
  'Free hot meal kitchens open 7 days a week?',
];

const isConversationOnly = (text) => /^(hi|hello|hey|thanks|thank you|good (morning|afternoon|evening))[!.\s]*$/i.test(text.trim());
// "What is open right now?" is a request for places, not a stray detail to
// remember; the phrasings people actually use all have to land here.
const isPlaceSearchIntent = (text) => /\b(where|find|suggest|recommend|show|near|nearby|location|place|pantry|food bank|foodbank|open\s+(right\s+)?now|open\s+today|options|hot meal|meal site|get food|assistance|grocery|groceries)\b/i.test(text);
const hasLocation = (text) => /\b(chicago|cook county|pilsen|new york|nyc|bronx|manhattan|los angeles|california|iowa|des moines)\b|\b\d{5}(?:-\d{4})?\b/i.test(text);
const clockTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function AiChat({ variant = 'section', onClose, onSelectPlace, onShowMatches }) {
  const [messages, setMessages] = useState([GREETING]);
  const [isThinking, setIsThinking] = useState(false);
  const [chosenId, setChosenId] = useState(null);
  const streamRef = useRef(null);
  const { origin, status: locationStatus, request: requestLocation, clear: clearLocation } = useUserLocation();

  const [rememberedNeeds, setRememberedNeeds] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('harvestlink-ai-needs') || '[]');
      return Array.isArray(saved) ? saved.filter((item) => typeof item === 'string').slice(-12) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    sessionStorage.setItem('harvestlink-ai-needs', JSON.stringify(rememberedNeeds));
  }, [rememberedNeeds]);

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

  const verifiedCatalog = PLACES.map((place) => ({
    id: place.id,
    name: place.name,
    address: `${place.address}, ${place.cityStateZip}`,
    city: place.city,
    services: place.services,
    dietary: place.dietary,
    hours: place.hoursSummary,
  }));

  const handleAsk = async (queryText) => {
    const question = (queryText || '').trim();
    if (!question) return;

    const nextNeeds = isConversationOnly(question)
      ? rememberedNeeds
      : [...rememberedNeeds, question].filter((item, index, list) => list.indexOf(item) === index).slice(-12);

    setMessages((prev) => [...prev, { sender: 'user', text: question, timestamp: clockTime() }]);
    setRememberedNeeds(nextNeeds);
    setIsThinking(true);

    try {
      const history = messages.slice(-8).map((message) => ({
        role: message.sender === 'ai' ? 'assistant' : 'user',
        text: message.text,
      }));
      const answer = await askHarvestLink({ message: question, history, catalog: verifiedCatalog, memory: nextNeeds });
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
        matchedOn: nextNeeds.filter((need) => !isConversationOnly(need)),
        warning: answer.warning || null,
        timestamp: clockTime(),
      }]);
    } catch {
      // The verified local matcher keeps the navigator useful if Bedrock is
      // temporarily unavailable or the server has not yet received an IAM role.
      setMessages((prev) => [...prev, groundedAnswer(question, nextNeeds)]);
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

  const groundedAnswer = (query, needs = rememberedNeeds) => {
    const lower = [...needs, query].join(' ').toLowerCase();  // everything we know so far
    const nowTime = clockTime();

    if (isConversationOnly(query)) {
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
      return {
        sender: 'ai',
        text: 'I’ve noted that. When you’re ready, ask me to find or suggest nearby food options and I’ll use everything you’ve shared so far to narrow them down.',
        citations: [],
        warning: null,
        timestamp: nowTime,
      };
    }

    /* Branch on one body of text. The newest question gets first refusal: a
       requirement shared three messages ago should narrow an answer, never
       decide which question is being answered. */
    const matchFor = (text) => {
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

    const fromQuery = matchFor(query.toLowerCase());
    const match = fromQuery.places.length > 0 ? fromQuery : matchFor(lower);
    let matchedPlaces = match.places;
    const reasoning = match.reasoning;
    const warningNote = match.warning || null;

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

    if (matchedPlaces.length === 0) {
      if (!hasLocation(query)) {
        return {
          sender: 'ai',
          text: 'I can help with that. I’ve noted what you told me, and I’ll look for places with published accommodation information. What city or ZIP code should I search near? You can also share your location and I’ll sort everything by how far it is.',
          citations: [],
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
      matchedOn: needs.filter((need) => !isConversationOnly(need)),
      warning: warningNote,
      timestamp: nowTime,
    };
  };

  const locationLabel = {
    idle: 'Use my location',
    asking: 'Finding you…',
    ready: 'Sorting by distance from you',
    denied: 'Location blocked — tell me a ZIP instead',
    unsupported: 'Location unavailable on this device',
  }[locationStatus];

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
          <div>
            <h3 className="ai-header-title">HarvestLink AI Navigator</h3>
            <p className="ai-header-sub">Grounded in verified US food assistance records, with sources on every answer.</p>
          </div>
        </div>

        <div className="ai-header-tools">
          <button
            type="button"
            className={`ai-location-btn${locationStatus === 'ready' ? ' is-on' : ''}`}
            onClick={() => (locationStatus === 'ready' ? clearLocation() : requestLocation())}
            disabled={locationStatus === 'asking' || locationStatus === 'unsupported'}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {locationLabel}
          </button>
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

              {message.matchIds?.length > 0 && (
                <AiMiniMap
                  places={message.matchIds.map((id) => PLACES.find((place) => place.id === id)).filter(Boolean)}
                  matchedOn={message.matchedOn}
                  origin={origin}
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
        {/* Composer: springs open on focus, suggestions ride in its tray */}
        <AskBar
          placeholder="Ask anything about food help near you…"
          chips={SAMPLE_QUESTIONS}
          onSubmit={handleAsk}
          disabled={isThinking}
        />
        {rememberedNeeds.length > 0 && (
          <div className="ai-memory-strip" aria-label="Remembered food access needs">
            <span>Remembering your needs</span>
            <p>{rememberedNeeds.slice(-3).join(' · ')}</p>
            <button type="button" onClick={() => setRememberedNeeds([])}>Clear context</button>
          </div>
        )}
      </div>
    </div>
  );
}
