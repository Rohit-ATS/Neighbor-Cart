import React from 'react';
import { Link } from '../app/router.jsx';
import { useStore } from '../app/store.jsx';
import { byId } from '../data/catalog.js';
import PlaceCard from '../components/PlaceCard.jsx';
import { Button, EmptyState, SectionHead } from '../components/ui.jsx';

export default function Saved() {
  const { saved } = useStore();
  const items = saved.map(byId).filter(Boolean);
  const places = items.filter((i) => i.type !== 'product');
  const products = items.filter((i) => i.type === 'product');

  return (
    <main className="saved" id="main">
      <div className="shell">
        <header className="page-head">
          <p className="mono">Saved</p>
          <h1>Your shortlist, <em className="serif">ready when you are.</em></h1>
        </header>

        {items.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            body="Tap the heart on any place or product and it lands here, with its allergen notes intact."
            action={<Button as={Link} to="/explore" variant="primary" size="md">Explore nearby food</Button>}
          />
        ) : (
          <>
            {places.length > 0 && (
              <section className="block">
                <SectionHead eyebrow={`${places.length} saved`} title="Places" />
                <div className="card-grid">{places.map((p) => <PlaceCard key={p.id} item={p} />)}</div>
              </section>
            )}
            {products.length > 0 && (
              <section className="block">
                <SectionHead eyebrow={`${products.length} saved`} title="Products" />
                <div className="card-grid">{products.map((p) => <PlaceCard key={p.id} item={p} />)}</div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
