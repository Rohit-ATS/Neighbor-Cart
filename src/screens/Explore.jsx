import React, { useMemo, useState } from 'react';
import { ALL, SERVICE_AREA } from '../data/catalog.js';
import { useStore } from '../app/store.jsx';
import PlaceCard from '../components/PlaceCard.jsx';
import MapView from '../components/MapView.jsx';
import { Button, Chip, EmptyState, Icon, SafetyNote } from '../components/ui.jsx';

const KINDS = [
  { id: 'all', label: 'Everything' },
  { id: 'restaurant', label: 'Restaurants' },
  { id: 'grocery', label: 'Supermarkets' },
  { id: 'product', label: 'Products' },
];

const FILTERS = ['Dairy-free', 'High protein', 'Lower sodium', 'Vegan', 'Gluten-free', 'Halal'];

export default function Explore() {
  const { profile } = useStore();
  const [kind, setKind] = useState('all');
  const [tags, setTags] = useState([]);
  const [maxDistance, setMaxDistance] = useState(profile.distance);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(null);

  const results = useMemo(
    () =>
      ALL.filter((item) => {
        if (kind !== 'all' && item.type !== kind) return false;
        if (item.distance > maxDistance) return false;
        if (query && !`${item.name} ${item.tags.join(' ')} ${item.cuisine ?? item.brand}`.toLowerCase().includes(query.toLowerCase())) return false;
        if (tags.length && !tags.every((t) => item.tags.some((x) => x.toLowerCase().includes(t.toLowerCase())))) return false;
        return true;
      }),
    [kind, tags, maxDistance, query],
  );

  const toggleTag = (t) => setTags((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]));
  const reset = () => { setKind('all'); setTags([]); setMaxDistance(profile.distance); setQuery(''); };

  return (
    <main className="explore" id="main">
      <div className="shell">
        <header className="explore-head">
          <div>
            <p className="mono">Explore</p>
            <h1>Food near <em className="serif">{profile.city}</em></h1>
          </div>
          <form className="explore-search" role="search" onSubmit={(e) => e.preventDefault()}>
            <Icon name="search" size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a dish, store or tag"
              aria-label="Search places and products"
            />
          </form>
        </header>

        <div className="filter-bar">
          <ul className="chip-row" role="tablist" aria-label="Result type">
            {KINDS.map((k) => (
              <li key={k.id}>
                <Chip selected={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</Chip>
              </li>
            ))}
          </ul>
          <ul className="chip-row">
            {FILTERS.map((f) => (
              <li key={f}><Chip selected={tags.includes(f)} onClick={() => toggleTag(f)}>{f}</Chip></li>
            ))}
          </ul>
          <label className="distance-field">
            <span>Within <b>{maxDistance} mi</b></span>
            <input type="range" min={1} max={15} value={maxDistance} onChange={(e) => setMaxDistance(Number(e.target.value))} />
          </label>
        </div>

        <MapView
          label="Map of results"
          boundary={SERVICE_AREA}
          points={results}
          activeId={activeId}
          radiusM={800}
          onSelect={setActiveId}
          className="explore-map"
        />

        <p className="result-count" aria-live="polite">
          {results.length} {results.length === 1 ? 'result' : 'results'} within {maxDistance} miles
        </p>

        {results.length ? (
          <div className="card-grid">
            {results.map((item) => <PlaceCard key={item.id} item={item} />)}
          </div>
        ) : (
          <EmptyState
            title="Nothing matches those filters"
            body="Try widening the distance or clearing a tag — your profile still applies to everything we show."
            action={<Button variant="primary" size="md" onClick={reset}>Reset filters</Button>}
          />
        )}

        <SafetyNote>
          Allergen labels reflect what each provider publishes. Where nothing is published we say so,
          rather than guessing. Always confirm directly before eating.
        </SafetyNote>
      </div>
    </main>
  );
}
