import React from 'react';
import { Link, navigate } from '../app/router.jsx';
import { useStore } from '../app/store.jsx';
import { byId } from '../data/catalog.js';
import FoodArt from '../components/FoodArt.jsx';
import MapView from '../components/MapView.jsx';
import { AllergenBadge, Button, EmptyState, Icon, Rating, SafetyNote, Tag } from '../components/ui.jsx';

const QUESTIONS = [
  'Is shared fryer oil used for this dish?',
  'Can this be prepared without dairy?',
  'Are peanuts handled anywhere in the kitchen?',
  'Can you change gloves and use a clean pan?',
];

/* A status, never a medical verdict: it describes how complete the published
   information is, not whether the food is safe for a given person. */
function fitStatus(item) {
  const states = item.allergens.map((a) => a.status);
  if (states.includes('unknown')) {
    return { label: 'Not enough information', tone: 'unknown', body: 'This provider has not published allergen details. Treat every item as unverified and call before you go.' };
  }
  if (states.includes('caution')) {
    return { label: 'Worth asking about', tone: 'warn', body: 'Ingredients are published, but there is a known cross-contact risk. The questions below are the ones to ask.' };
  }
  return { label: 'Matches your profile', tone: 'ok', body: 'Published ingredients line up with your profile. Confirm preparation if your allergy is serious.' };
}

export default function PlaceDetail({ id }) {
  const item = byId(id);
  const { isSaved, toggleSaved, profile } = useStore();

  if (!item) {
    return (
      <main className="detail" id="main">
        <div className="shell">
          <EmptyState
            title="We couldn't find that one"
            body="It may have been removed from the demo catalog."
            action={<Button as={Link} to="/explore" variant="primary" size="md">Back to Explore</Button>}
          />
        </div>
      </main>
    );
  }

  const fit = fitStatus(item);
  const savedNow = isSaved(item.id);
  const isProduct = item.type === 'product';

  return (
    <main className="detail" id="main">
      <div className="shell">
        <button type="button" className="back-link" onClick={() => window.history.back()}>
          <Icon name="back" size={16} /> Back
        </button>

        <header className="detail-hero">
          <FoodArt art={item.art} className="detail-art" />
          <div className="detail-intro">
            <p className="mono">{isProduct ? `${item.brand} · ${item.store}` : `${item.cuisine} · ${item.neighborhood}`}</p>
            <h1>{item.name}</h1>
            <div className="detail-meta">
              <Rating value={item.rating} count={item.reviews} />
              <span>{item.distance} mi away</span>
              <span>{item.price} · {item.priceNote}</span>
              {item.hours && <span>{item.hours}</span>}
            </div>
            <ul className="tag-row">{item.tags.map((t) => <li key={t}><Tag tone="green">{t}</Tag></li>)}</ul>

            <div className={`fit-banner is-${fit.tone}`}>
              <span className="fit-top">
                <Icon name={fit.tone === 'ok' ? 'check' : fit.tone === 'warn' ? 'alert' : 'info'} size={17} />
                <b>Fit for you: {fit.label}</b>
              </span>
              <p>{fit.body}</p>
            </div>

            <div className="detail-actions">
              <Button variant="primary" size="md" icon="arrow">
                {isProduct ? 'Add to cart' : 'Start an order'}
              </Button>
              <button type="button" className={`ghost-btn${savedNow ? ' is-on' : ''}`} onClick={() => toggleSaved(item.id)} aria-pressed={savedNow}>
                <Icon name="heart" size={16} />{savedNow ? 'Saved' : 'Save'}
              </button>
              <a
                className="ghost-btn"
                href={`https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lng}#map=17/${item.lat}/${item.lng}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                <Icon name="pin" size={16} /> Directions
              </a>
            </div>
          </div>
        </header>

        <div className="detail-grid">
          <div className="detail-main">
            <section className="panel">
              <h2>Why this fits you</h2>
              <p className="lead-text">{item.why}</p>
              <ul className="allergen-list">
                {item.allergens.map((a) => (
                  <li key={a.name}>
                    <AllergenBadge allergen={a} />
                    <p>{a.note}</p>
                  </li>
                ))}
              </ul>
            </section>

            {item.menu?.length > 0 && (
              <section className="panel">
                <h2>{isProduct ? 'Suggested uses' : 'Menu items that match'}</h2>
                <ul className="menu-list">
                  {item.menu.map((m) => (
                    <li key={m.name}>
                      <div>
                        <b>{m.name}</b>
                        <ul className="tag-row">{m.tags.map((t) => <li key={t}><Tag>{t}</Tag></li>)}</ul>
                      </div>
                      <span className="menu-right">
                        <span className={`menu-status is-${m.status}`}>
                          {m.status === 'ok' ? 'Ingredients published' : m.status === 'caution' ? 'Ask about prep' : 'Not published'}
                        </span>
                        <b>{m.price}</b>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {item.nutrition && (
              <section className="panel">
                <h2>Nutrition, typical serving</h2>
                <ul className="nutrition-grid">
                  {Object.entries(item.nutrition).map(([k, v]) => (
                    <li key={k}>
                      <b>{v}{k === 'calories' ? '' : k === 'protein' || k === 'fiber' ? 'g' : 'mg'}</b>
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
                <p className="quiet-note">Published by the provider. Figures vary with preparation and portion.</p>
              </section>
            )}

            <section className="panel panel-accent">
              <h2>Cross-contact and verification</h2>
              <p>{item.crossContact}</p>
              {profile.seriousAllergy && (
                <SafetyNote tone="dark" compact>
                  Your profile marks a serious allergy. Ask these questions before ordering, every visit —
                  kitchens and suppliers change.
                </SafetyNote>
              )}
              <h3 className="ask-head">Questions to ask</h3>
              <ul className="ask-list">
                {QUESTIONS.map((q) => <li key={q}><Icon name="arrow" size={15} />{q}</li>)}
              </ul>
              <Button variant="light" size="md">
                {isProduct ? 'Contact the manufacturer' : 'Call to verify'}
              </Button>
            </section>

            <section className="panel">
              <h2>Community notes</h2>
              {item.notes.length ? (
                <ul className="note-list">
                  {item.notes.map((n) => (
                    <li key={n.who}>
                      <span className="avatar" aria-hidden="true">{n.who.slice(0, 1)}</span>
                      <div><b>{n.who}</b><p>{n.text}</p></div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No notes yet"
                  body="Be the first to share what the staff told you about preparation."
                  action={<Button variant="quiet" size="sm">Add a note</Button>}
                />
              )}
            </section>
          </div>

          <aside className="detail-side">
            <section className="panel">
              <h2>Where it is</h2>
              <MapView
                label={`Map of ${item.name}`}
                points={[item]}
                activeId={item.id}
                radiusM={500}
                className="detail-map"
              />
              <p className="address">{item.address ?? item.store}</p>
              {item.hours && <p className="quiet-note">{item.hours}</p>}
              <Button
                as="a"
                href={`https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lng}#map=17/${item.lat}/${item.lng}`}
                target="_blank"
                rel="noreferrer noopener"
                variant="quiet"
                size="md"
              >
                Get directions
              </Button>
            </section>
          </aside>
        </div>

        <SafetyNote>
          Neighbor Cart provides food information, not medical advice. Always verify allergens and
          ingredients directly with the provider.
        </SafetyNote>
      </div>
    </main>
  );
}
