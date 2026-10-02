import React, { useState } from 'react';
import { Link, navigate } from '../app/router.jsx';
import { BUDGETS, useStore } from '../app/store.jsx';
import { PLACES, PRODUCTS, SERVICE_AREA, byId } from '../data/catalog.js';
import PlaceCard from '../components/PlaceCard.jsx';
import MapView from '../components/MapView.jsx';
import FoodArt from '../components/FoodArt.jsx';
import { Icon, SafetyNote, SectionHead, Tag } from '../components/ui.jsx';

const PROMPTS = [
  'What is safe for my peanut allergy?',
  'Find a high-protein dinner under $15',
  'What can I make with these groceries?',
  'Show gluten-free options near me',
];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const RESTAURANTS = PLACES.filter((p) => p.type === 'restaurant');
const STORES = PLACES.filter((p) => p.type === 'grocery');

export default function Dashboard() {
  const { profile, saved } = useStore();
  const [ask, setAsk] = useState('');
  const [activeId, setActiveId] = useState(RESTAURANTS[0].id);

  const submit = (text) => {
    const q = (text ?? ask).trim();
    if (!q) return;
    navigate(`/chat?q=${encodeURIComponent(q)}`);
  };

  const savedItems = saved.map(byId).filter(Boolean);
  const tonight = [...RESTAURANTS].sort((a, b) => a.distance - b.distance);

  return (
    <main className="dashboard" id="main">
      <div className="shell">
        <section className="command">
          <p className="mono command-eyebrow">{profile.city} · within {profile.distance} miles</p>
          <h1>{greeting()}, {profile.name}. <em className="serif">What sounds good?</em></h1>

          <form
            className="ask"
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            role="search"
          >
            <Icon name="search" size={28} />
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="Search a dish, store or tag"
              aria-label="Search for a dish, store, or tag"
            />
            <button className="sr-only" type="submit">Search</button>
          </form>

          <ul className="prompt-chips">
            {PROMPTS.map((p) => (
              <li key={p}>
                <button type="button" className="prompt-chip" onClick={() => submit(p)}>{p}</button>
              </li>
            ))}
          </ul>
        </section>

        <section className="insight-row">
          <article className="insight">
            <span className="insight-mark"><Icon name="spark" size={17} /></span>
            <p><b>3 new dairy-free options</b> were added near you this week.</p>
          </article>
          <article className="insight">
            <span className="insight-mark"><Icon name="check" size={17} /></span>
            <p><b>5 of 6 places</b> in your radius publish ingredient details.</p>
          </article>
          <article className="insight">
            <span className="insight-mark is-warn"><Icon name="alert" size={17} /></span>
            <p><b>1 place</b> has no allergen data. We flag it on every card.</p>
          </article>
        </section>

        <section className="block">
          <SectionHead
            eyebrow="Recommended for you"
            title="Places that fit tonight"
            action={<Link to="/explore" className="text-link">Explore all <Icon name="arrow" size={15} /></Link>}
          />
          <div className="card-grid">
            {RESTAURANTS.slice(0, 3).map((p) => <PlaceCard key={p.id} item={p} />)}
          </div>
        </section>

        <section className="block two-col">
          <div>
            <SectionHead eyebrow="Tonight near you" title="On your map" />
            <div className="map-split">
              <MapView
                label="Map of food places near you"
                boundary={SERVICE_AREA}
                points={tonight}
                activeId={activeId}
                radiusM={900}
                onSelect={setActiveId}
                className="dash-map"
              />
              <ul className="map-list">
                {tonight.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`map-row${p.id === activeId ? ' is-active' : ''}`}
                      onClick={() => setActiveId(p.id)}
                    >
                      <span className="map-dot" aria-hidden="true" />
                      <span className="map-row-body">
                        <b>{p.name}</b>
                        <span>{p.cuisine} · {p.hours}</span>
                      </span>
                      <span className="map-dist">{p.distance} mi</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="profile-card">
            <SectionHead eyebrow="Your food profile" title="At a glance" />
            <div className="profile-block">
              <h4>Allergies</h4>
              <ul className="tag-row">
                {profile.allergies.map((a) => <li key={a}><Tag tone="warn">{a}</Tag></li>)}
                {profile.seriousAllergy && <li><Tag tone="warn">Serious allergy mode on</Tag></li>}
              </ul>
            </div>
            <div className="profile-block">
              <h4>Preferences</h4>
              <ul className="tag-row">
                {[...profile.diets, ...profile.goals].map((a) => <li key={a}><Tag tone="green">{a}</Tag></li>)}
              </ul>
            </div>
            <div className="profile-block">
              <h4>Practical</h4>
              <ul className="tag-row">
                <li><Tag>{BUDGETS[profile.budget]}</Tag></li>
                <li><Tag>{profile.distance} mi radius</Tag></li>
                <li><Tag>Household of {profile.household}</Tag></li>
              </ul>
            </div>
            <Button as={Link} to="/profile" variant="quiet" size="sm">Edit profile</Button>
          </aside>
        </section>

        <section className="block">
          <SectionHead eyebrow="Safe swaps" title="Alternatives for what you avoid" />
          <ul className="swap-grid">
            {PRODUCTS.map((p) => (
              <li key={p.id}>
                <Link to={`/place/${p.id}`} className="swap-card">
                  <FoodArt art={p.art} className="swap-art" />
                  <span className="swap-body">
                    <span className="swap-from">Instead of {p.swapFor}</span>
                    <b>{p.name}</b>
                    <span className="swap-meta">{p.price} · {p.store}</span>
                  </span>
                  <Icon name="arrow" size={17} />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="block">
          <SectionHead
            eyebrow="Nearby grocery finds"
            title="Stores and products in range"
            action={<Link to="/explore" className="text-link">See all <Icon name="arrow" size={15} /></Link>}
          />
          <div className="card-grid">
            {[...STORES, PRODUCTS[0]].map((p) => <PlaceCard key={p.id} item={p} />)}
          </div>
        </section>

        <section className="block two-col">
          <div>
            <SectionHead
              eyebrow="Saved places and products"
              title="Your shortlist"
              action={<Link to="/saved" className="text-link">Open saved <Icon name="arrow" size={15} /></Link>}
            />
            {savedItems.length ? (
              <div className="card-grid card-grid-2">
                {savedItems.slice(0, 2).map((p) => <PlaceCard key={p.id} item={p} compact />)}
              </div>
            ) : (
              <p className="quiet-note">Nothing saved yet. Tap the heart on any card to keep it here.</p>
            )}
          </div>

          <aside className="recent">
            <SectionHead eyebrow="Recent AI conversations" title="Pick up where you left off" />
            <ul className="recent-list">
              {[
                { q: 'What can I order with a peanut allergy tonight?', when: 'Yesterday' },
                { q: 'Is oat milk lower in sodium than soy?', when: '3 days ago' },
                { q: 'High-protein lunches under $12', when: 'Last week' },
              ].map((c) => (
                <li key={c.q}>
                  <button type="button" className="recent-row" onClick={() => submit(c.q)}>
                    <Icon name="spark" size={16} />
                    <span><b>{c.q}</b><span>{c.when}</span></span>
                    <Icon name="arrow" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </section>

        <SafetyNote>
          Neighbor Cart provides food information, not medical advice. For a serious allergy, confirm
          ingredients and preparation with the restaurant or manufacturer before eating.
        </SafetyNote>
      </div>
    </main>
  );
}
