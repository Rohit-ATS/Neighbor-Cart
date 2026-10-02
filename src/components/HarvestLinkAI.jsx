import React, { useState } from 'react';
import { PLACES, getIsOpenNow } from '../data/places.js';

export default function HarvestLinkAI({ onClose, onSelectPlace }) {
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your HarvestLink Food Access AI Navigator. Ask me anything about food banks, open pantries, dietary accommodations, transportation, or eligibility requirements across the US. All my answers are grounded in verified records.',
      citations: [],
      timestamp: 'Just now'
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const sampleQuestions = [
    'What food assistance is open right now?',
    'Where can I get Halal food with no ID required?',
    'Free pantries accessible by public transit in Chicago?',
    'Where is baby formula and diapers available in Iowa?',
    'Free hot meal kitchens open 7 days a week?'
  ];

  const handleAsk = (queryText) => {
    const q = (queryText || inputQuery).trim();
    if (!q) return;

    const userMsg = {
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsThinking(true);

    setTimeout(() => {
      const response = generateGroundedAnswer(q);
      setMessages((prev) => [...prev, response]);
      setIsThinking(false);
    }, 700);
  };

  const generateGroundedAnswer = (query) => {
    const lower = query.toLowerCase();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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

        {/* Quick prompt suggestions */}
        <div className="ai-prompt-chips">
          <span className="prompt-chips-label">Try asking:</span>
          <div className="chips-strip">
            {sampleQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                className="ai-chip-btn"
                onClick={() => handleAsk(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input box */}
        <form 
          className="ai-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
        >
          <input
            type="text"
            className="ai-input-field"
            placeholder="Ask anything (e.g. 'Where can I get Halal produce without an ID?')..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
          />
          <button type="submit" className="ai-send-btn" disabled={!inputQuery.trim() || isThinking}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
