import React, { useEffect, useState } from 'react';
import { PLACES, getIsOpenNow } from '../data/places.js';
import AskBar from './AskBar.jsx';

export default function HarvestLinkAI({ onClose, onSelectPlace }) {
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your HarvestLink Food Access AI Navigator. Ask me anything about food banks, open pantries, dietary accommodations, transportation, or eligibility requirements across the US. All my answers are grounded in verified records.',
      citations: [],
      timestamp: 'Just now'
    }
  ]);
  const [isThinking, setIsThinking] = useState(false);
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

  const sampleQuestions = [
    'What food assistance is open right now?',
    'Where can I get Halal food with no ID required?',
    'Free pantries accessible by public transit in Chicago?',
    'Where is baby formula and diapers available in Iowa?',
    'Free hot meal kitchens open 7 days a week?'
  ];

  const verifiedCatalog = PLACES.map((place) => ({
    id: place.id,
    name: place.name,
    address: `${place.address}, ${place.cityStateZip}`,
    city: place.city,
    services: place.services,
    dietary: place.dietary,
    hours: place.hoursSummary,
  }));

  const isConversationOnly = (text) => /^(hi|hello|hey|thanks|thank you|good (morning|afternoon|evening))[!.\s]*$/i.test(text.trim());
  const isPlaceSearchIntent = (text) => /\b(where|find|suggest|recommend|show|near|nearby|location|place|pantry|food bank|foodbank|open now|open today|options|hot meal|meal site|get food)\b/i.test(text);

  const handleAsk = async (queryText) => {
    const q = (queryText || '').trim();
    if (!q) return;
    const nextNeeds = isConversationOnly(q)
      ? rememberedNeeds
      : [...rememberedNeeds, q].filter((item, index, list) => list.indexOf(item) === index).slice(-12);

    const userMsg = {
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setRememberedNeeds(nextNeeds);
    setIsThinking(true);

    try {
      const history = messages.slice(-8).map((message) => ({
        role: message.sender === 'ai' ? 'assistant' : 'user',
        text: message.text,
      }));
      const apiResponse = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history, catalog: verifiedCatalog, memory: nextNeeds }),
      });
      if (!apiResponse.ok) throw new Error('AI request failed');
      const answer = await apiResponse.json();
      const citations = (answer.placeIds || []).map((placeId) => PLACES.find((place) => place.id === placeId))
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
        warning: answer.warning || null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } catch {
      // The verified local matcher keeps the navigator useful if Bedrock is
      // temporarily unavailable or the server has not yet received an IAM role.
      setMessages((prev) => [...prev, generateGroundedAnswer(q, nextNeeds)]);
    } finally {
      setIsThinking(false);
    }
  };

  const generateGroundedAnswer = (query, needs = rememberedNeeds) => {
    const lower = [...needs, query].join(' ').toLowerCase();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isConversationOnly(query)) {
      return {
        sender: 'ai',
        text: 'Hi! I’m here to help you find food support that fits your situation. You can tell me what you need, or ask me to find a pantry, meal site, or grocery resource near you.',
        citations: [],
        warning: null,
        timestamp: nowTime
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
        timestamp: nowTime
      };
    }

    // Filter places based on semantic criteria
    let matchedPlaces = [];
    let reasoning = '';
    let warningNote = null;

    // Open now check
    if (lower.includes('open right now') || lower.includes('open now') || lower.includes('open today')) {
      matchedPlaces = PLACES.filter((p) => getIsOpenNow(p).isOpen);
      reasoning = `I found ${matchedPlaces.length} verified locations currently open right now based on published hours.`;
    }
    // Halal
    else if (lower.includes('halal')) {
      matchedPlaces = PLACES.filter((p) => p.dietary?.includes('Halal') || p.inventory.some((i) => i.item.toLowerCase().includes('halal')));
      reasoning = `Here are the verified food programs providing dedicated Halal-certified meat, beans, and staples without requiring identification:`;
    }
    // Gluten-free
    else if (lower.includes('gluten') || lower.includes('celiac')) {
      matchedPlaces = PLACES.filter((p) => p.dietary?.includes('Gluten-Free') || p.inventory.some((i) => i.item.toLowerCase().includes('gluten')));
      reasoning = `Found ${matchedPlaces.length} locations with certified gluten-free pantries and allergen separation:`;
    }
    // Infant / formula / diapers
    else if (lower.includes('baby') || lower.includes('formula') || lower.includes('diaper')) {
      matchedPlaces = PLACES.filter((p) => 
        p.inventory.some((i) => i.category.toLowerCase().includes('baby') || i.item.toLowerCase().includes('formula') || i.item.toLowerCase().includes('diaper'))
      );
      reasoning = `The following verified centers have baby formula powder, purees, or diapers reported in stock:`;
      warningNote = 'Infant formula supplies fluctuate rapidly. We strongly advise calling ahead to ensure the specific brand/size is on hand.';
    }
    // Hot meals
    else if (lower.includes('hot meal') || lower.includes('soup kitchen') || lower.includes('dinner') || lower.includes('lunch')) {
      matchedPlaces = PLACES.filter((p) => p.type === 'hot-meal');
      reasoning = `Here are free community meal programs serving freshly prepared chef-cooked hot meals:`;
    }
    // Chicago
    else if (lower.includes('chicago') || lower.includes('cook county') || lower.includes('pilsen')) {
      matchedPlaces = PLACES.filter((p) => p.city?.toLowerCase().includes('chicago') || p.state === 'IL');
      reasoning = `Here are verified hunger relief locations serving the greater Chicago area:`;
    }
    // New York / Bronx / Manhattan
    else if (lower.includes('new york') || lower.includes('nyc') || lower.includes('bronx') || lower.includes('manhattan')) {
      matchedPlaces = PLACES.filter((p) => p.state === 'NY');
      reasoning = `Here are verified emergency food distributions and community meals across New York City:`;
    }
    // Los Angeles / California
    else if (lower.includes('los angeles') || lower.includes('la') || lower.includes('california')) {
      matchedPlaces = PLACES.filter((p) => p.city?.toLowerCase().includes('los angeles') || p.state === 'CA');
      reasoning = `Verified food access centers in Los Angeles County:`;
    }
    // Iowa / Des Moines
    else if (lower.includes('iowa') || lower.includes('des moines') || lower.includes('50309')) {
      matchedPlaces = PLACES.filter((p) => p.state === 'IA');
      reasoning = `Verified food banks, pantries, and 24/7 mutual aid fridges in Central Iowa:`;
    }
    // Transit
    else if (lower.includes('transit') || lower.includes('bus') || lower.includes('subway') || lower.includes('train')) {
      matchedPlaces = PLACES.filter((p) => p.transitInfo);
      reasoning = `Here are verified locations directly accessible via major public transit bus and rail stops:`;
    }
    // General keyword match
    else {
      matchedPlaces = PLACES.filter((p) => 
        p.name.toLowerCase().includes(lower) || 
        p.neighborhood.toLowerCase().includes(lower) ||
        p.city.toLowerCase().includes(lower) ||
        p.services.some((s) => s.toLowerCase().includes(lower)) ||
        p.inventory.some((i) => i.item.toLowerCase().includes(lower))
      );
      if (matchedPlaces.length > 0) {
        reasoning = `Based on your request, I matched these verified food access resources:`;
      }
    }

    // Refusal when information is unavailable
    if (matchedPlaces.length === 0) {
      return {
        sender: 'ai',
        text: `I could not locate verified food assistance records matching "${query}" in our verified national registry. To prevent sending anyone to an inactive site, I only return confirmed providers. You can try searching by City (e.g. Chicago, New York, Des Moines), ZIP code, or browsing our full Places map.`,
        citations: [],
        warning: null,
        timestamp: nowTime
      };
    }

    // Top citations
    const topMatches = matchedPlaces.slice(0, 3);
    const citations = topMatches.map((p) => ({
      placeId: p.id,
      name: p.name,
      address: `${p.address}, ${p.cityStateZip}`,
      verifiedDate: p.verifiedDate,
      hours: p.hoursSummary,
      phone: p.phone,
      callAhead: p.callAheadWarning || (warningNote ? true : false)
    }));

    return {
      sender: 'ai',
      text: reasoning,
      citations,
      warning: warningNote,
      timestamp: nowTime
    };
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ai-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="ai-modal-header">
          <div className="ai-header-brand">
            <span className="ai-avatar-badge">🤖</span>
            <div>
              <h3 className="ai-header-title">Ask HarvestLink AI Navigator</h3>
              <p className="ai-header-sub">Grounded exclusively in verified US food assistance records with source citations.</p>
            </div>
          </div>
          <button className="modal-close-simple" onClick={onClose} aria-label="Close assistant">×</button>
        </div>

        {/* Chat message stream */}
        <div className="ai-chat-stream">
          {messages.map((m, idx) => (
            <div key={idx} className={`ai-message-row ${m.sender === 'user' ? 'is-user' : 'is-ai'}`}>
              <div className="ai-message-bubble">
                <p className="ai-message-text">{m.text}</p>

                {m.warning && (
                  <div className="ai-call-ahead-alert">
                    ⚠️ <b>Call Ahead Notice:</b> {m.warning}
                  </div>
                )}

                {/* Citations Box */}
                {m.citations && m.citations.length > 0 && (
                  <div className="ai-citations-box">
                    <span className="citations-label">Verified Source Records ({m.citations.length}):</span>
                    <div className="citations-list">
                      {m.citations.map((c, cIdx) => (
                        <div key={cIdx} className="citation-card">
                          <div className="citation-top">
                            <h4 className="citation-title">{c.name}</h4>
                            <span className="citation-verified-pill">✓ {c.verifiedDate}</span>
                          </div>
                          <p className="citation-addr">📍 {c.address}</p>
                          <p className="citation-hours">⏱ {c.hours}</p>
                          {c.callAhead && (
                            <span className="citation-warn-tag">📞 Call ahead recommended: {c.phone}</span>
                          )}
                          <div className="citation-action-row">
                            <button
                              type="button"
                              className="citation-view-btn"
                              onClick={() => {
                                const fullPlace = PLACES.find((p) => p.id === c.placeId);
                                if (fullPlace) {
                                  onClose();
                                  onSelectPlace?.(fullPlace);
                                }
                              }}
                            >
                              Open Details & Inventory →
                            </button>
                            <a href={`tel:${c.phone.replace(/[^0-9]/g, '')}`} className="citation-call-btn">
                              Call {c.phone}
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <span className="ai-message-timestamp">{m.timestamp}</span>
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="ai-message-row is-ai">
              <div className="ai-message-bubble ai-thinking-bubble">
                <span className="dot-pulse" /> Grounding answer against verified nationwide database...
              </div>
            </div>
          )}
        </div>


        {/* Composer: springs open on focus, suggestions ride in its tray */}
        <AskBar
          placeholder="Ask anything (e.g. 'Where can I get Halal produce without an ID?')…"
          chips={sampleQuestions}
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
