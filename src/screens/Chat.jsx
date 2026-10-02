import React, { useEffect, useRef, useState } from 'react';
import { Link } from '../app/router.jsx';
import { useStore } from '../app/store.jsx';
import { PLACES, PRODUCTS, byId } from '../data/catalog.js';
import FoodArt from '../components/FoodArt.jsx';
import { AllergenBadge, Button, Icon, Rating, SafetyNote, Skeleton, Tag } from '../components/ui.jsx';
import AskBar from '../components/AskBar.jsx';

/* A scripted guide. Each reply names the reasoning behind its picks, and never
   states that a dish is safe — only what the provider has published. */
const SCRIPTS = [
  {
    match: /shellfish|sodium/i,
    say: 'I can help you narrow options down. Based on your profile, these nearby places offer dishes that appear compatible with your needs. Please verify preparation practices and cross-contact policies directly with the restaurant before ordering.',
    picks: ['sunrise-counter', 'hearth-table', 'green-lantern'],
    reasons: {
      'sunrise-counter': 'Lowest sodium on the menu at 410mg, peanut-free kitchen, 2.1 miles away.',
      'hearth-table': 'Dairy-free mains are prepared on a separate line and it is 0.8 miles away.',
      'green-lantern': 'Coconut-based curries avoid dairy, but fish sauce is standard — ask them to leave it out.',
    },
    follow: ['Which of these has the least sodium?', 'Can you find one without a shared fryer?', 'Save all three to my list'],
  },
  {
    match: /peanut/i,
    say: 'Your profile has peanuts marked as a serious allergy, so I am being conservative. These places publish peanut handling details. The third one uses peanuts widely — I am showing it only so you know what to avoid or ask about.',
    picks: ['sunrise-counter', 'hearth-table', 'green-lantern'],
    reasons: {
      'sunrise-counter': 'States a peanut-free kitchen, and breakfast runs all day which you said you like.',
      'hearth-table': 'No peanuts used in the kitchen per their published list, 0.8 miles away.',
      'green-lantern': 'Peanuts are crushed at the wok station. They will cook on a clean wok if you ask first.',
    },
    follow: ['What should I ask when I call?', 'Only show peanut-free kitchens', 'Find a grocery swap for peanut butter'],
  },
  {
    match: /protein|\$1[0-9]|under \$/i,
    say: 'Here is what fits a high-protein dinner inside your budget. I am ranking by protein per plate, then by distance.',
    picks: ['hearth-table', 'cedar-grill', 'lentil-pasta'],
    reasons: {
      'hearth-table': '38g of protein in the chicken bowl at $16, and dairy-free is marked on the menu.',
      'cedar-grill': '52g in the charcoal plate, but they publish no allergen details — call ahead.',
      'lentil-pasta': '23g a serving at $3.29 if you would rather cook tonight.',
    },
    follow: ['Show only places under $15', 'What can I cook with lentil pasta?', 'Which has the least sodium?'],
  },
  {
    match: /gluten/i,
    say: 'These have gluten-free options in your radius. Gluten-free labelling is better regulated than cross-contact practice, so the shared-surface question still matters.',
    picks: ['green-lantern', 'cedar-grill', 'lentil-pasta'],
    reasons: {
      'green-lantern': 'Dedicated gluten-free menu, 1.4 miles away.',
      'cedar-grill': 'Grill items are naturally gluten-free, though nothing is published about shared surfaces.',
      'lentil-pasta': 'Certified gluten-free on the label, and it is at a store you already shop.',
    },
    follow: ['Is the pasta made in a shared facility?', 'Find gluten-free breakfast', 'Save these'],
  },
  {
    match: /groceries|make|cook/i,
    say: 'Tell me what is in the kitchen and I will work from that. Based on your saved products, here is what pairs well and stays inside your goals.',
    picks: ['lentil-pasta', 'low-sodium-broth', 'oat-milk-barista'],
    reasons: {
      'lentil-pasta': '23g of protein a serving, cooks in nine minutes.',
      'low-sodium-broth': '130mg of sodium a cup against roughly 860mg in the standard version.',
      'oat-milk-barista': 'Dairy-free and peanut-free per the label, for a creamy sauce without milk.',
    },
    follow: ['Give me a 20 minute recipe', 'What else is low sodium?', 'Add these to my cart'],
  },
];

const FALLBACK = {
  say: 'I can work with that. Based on your profile — peanut allergy, lactose intolerant, within 3 miles — here is what stands out nearby. Confirm preparation with the provider before ordering.',
  picks: ['hearth-table', 'sunrise-counter', 'oat-milk-barista'],
  reasons: {},
  follow: ['What is safe for my peanut allergy?', 'Find a high-protein dinner under $15', 'Show gluten-free options near me'],
};

const reply = (text) => SCRIPTS.find((s) => s.match.test(text)) ?? FALLBACK;

const INGREDIENT = {
  title: 'Tahini',
  body: 'Ground sesame paste. Dairy-free and peanut-free, used here in place of a yogurt drizzle.',
  flags: ['Contains sesame', 'No dairy', 'No peanuts'],
};

function RecCard({ id, reason, onSave, saved }) {
  const item = byId(id);
  if (!item) return null;
  const uncertain = item.allergens.some((a) => a.status !== 'ok');

  return (
    <article className="rec-card">
      <Link to={`/place/${item.id}`} className="rec-media" tabIndex={-1} aria-hidden="true">
        <FoodArt art={item.art} />
      </Link>
      <div className="rec-body">
        <div className="rec-top">
          <h4><Link to={`/place/${item.id}`}>{item.name}</Link></h4>
          <Rating value={item.rating} />
        </div>
        <p className="rec-meta">
          {item.type === 'product' ? item.brand : item.cuisine} · {item.distance} mi · {item.price}
        </p>
        <p className="rec-reason"><Icon name="spark" size={14} />{reason || item.why}</p>
        <ul className="allergen-row">
          {item.allergens.slice(0, 2).map((a) => <li key={a.name}><AllergenBadge allergen={a} /></li>)}
        </ul>
        {uncertain && (
          <a className="verify-btn" href={`tel:+15105550142`} onClick={(e) => e.preventDefault()}>
            <Icon name="alert" size={15} /> Verify with {item.type === 'product' ? 'manufacturer' : 'restaurant'}
          </a>
        )}
        <div className="rec-actions">
          <Button as={Link} to={`/place/${item.id}`} variant="quiet" size="sm">View details</Button>
          <button type="button" className={`ghost-btn${saved ? ' is-on' : ''}`} onClick={onSave} aria-pressed={saved}>
            <Icon name="heart" size={15} />{saved ? 'Saved' : 'Save to list'}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Chat({ query }) {
  const { profile, isSaved, toggleSaved } = useStore();
  const [turns, setTurns] = useState([]);
  const [pending, setPending] = useState(false);
  const feed = useRef(null);
  const started = useRef(false);

  const send = (text) => {
    const q = text.trim();
    if (!q || pending) return;
    setTurns((t) => [...t, { role: 'user', text: q }]);
    setPending(true);
    setTimeout(() => {
      setTurns((t) => [...t, { role: 'ai', ...reply(q) }]);
      setPending(false);
    }, 900);
  };

  /* A prompt handed over from the dashboard starts the conversation. */
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (query) send(query);
  }, [query]);

  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: 'smooth' });
  }, [turns, pending]);

  return (
    <main className="chat" id="main">
      <div className="shell chat-shell">
        <header className="chat-head">
          <div>
            <p className="mono">AI Food Guide</p>
            <h1>Ask anything about food, <em className="serif">in plain language.</em></h1>
          </div>
          <ul className="tag-row chat-profile">
            {profile.allergies.map((a) => <li key={a}><Tag tone="warn">{a}</Tag></li>)}
            <li><Tag>{profile.distance} mi</Tag></li>
          </ul>
        </header>

        <div className="chat-feed" ref={feed}>
          {turns.length === 0 && !pending && (
            <div className="chat-intro">
              <FoodArt art="chat" className="chat-intro-art" />
              <h2>What are you in the mood for?</h2>
              <p>I know your allergies and your radius. Ask me about a dish, an ingredient, or just say you are hungry.</p>
            </div>
          )}

          {turns.map((turn, i) =>
            turn.role === 'user' ? (
              <p key={i} className="bubble bubble-user">{turn.text}</p>
            ) : (
              <div key={i} className="ai-turn">
                <p className="bubble bubble-ai">{turn.say}</p>

                {i === 1 && (
                  <aside className="ingredient-card">
                    <h4><Icon name="info" size={15} /> {INGREDIENT.title}</h4>
                    <p>{INGREDIENT.body}</p>
                    <ul className="tag-row">{INGREDIENT.flags.map((f) => <li key={f}><Tag tone="green">{f}</Tag></li>)}</ul>
                  </aside>
                )}

                <ul className="rec-list">
                  {turn.picks.map((id) => (
                    <li key={id}>
                      <RecCard
                        id={id}
                        reason={turn.reasons?.[id]}
                        saved={isSaved(id)}
                        onSave={() => toggleSaved(id)}
                      />
                    </li>
                  ))}
                </ul>

                {byId(turn.picks[0])?.nutrition && (
                  <aside className="nutrition-card">
                    <h4>Nutrition, {byId(turn.picks[0]).name}</h4>
                    <ul>
                      {Object.entries(byId(turn.picks[0]).nutrition).map(([k, v]) => (
                        <li key={k}><b>{v}{k === 'calories' ? '' : k === 'protein' || k === 'fiber' ? 'g' : 'mg'}</b><span>{k}</span></li>
                      ))}
                    </ul>
                    <p className="nutrition-note">Per the provider's published figures, for one serving.</p>
                  </aside>
                )}

                <SafetyNote compact>
                  These are suggestions from published information, not a safety guarantee. Ask the
                  provider about cross-contact before you order.
                </SafetyNote>

                <ul className="follow-row">
                  {turn.follow.map((f) => (
                    <li key={f}><button type="button" className="prompt-chip" onClick={() => send(f)}>{f}</button></li>
                  ))}
                </ul>
              </div>
            ),
          )}

          {pending && (
            <div className="bubble bubble-ai is-thinking" aria-live="polite" aria-label="Thinking">
              <Skeleton lines={2} />
            </div>
          )}
        </div>

        <AskBar
          chips={['What should I ask when I call?', 'Only peanut-free kitchens', 'Something under $15']}
          onSubmit={send}
        />
        <p className="chat-foot">
          Neighbor Cart provides food information, not medical advice. Always verify allergens with the provider.
        </p>
      </div>
    </main>
  );
}
