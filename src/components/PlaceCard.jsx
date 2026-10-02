import React from 'react';
import FoodArt from './FoodArt.jsx';
import { AllergenBadge, Button, Icon, Rating, Tag } from './ui.jsx';
import { Link } from '../app/router.jsx';
import { useStore } from '../app/store.jsx';

const worst = (allergens = []) => {
  if (allergens.some((a) => a.status === 'unknown')) return 'unknown';
  if (allergens.some((a) => a.status === 'caution')) return 'caution';
  return 'ok';
};

const CAUTION_COPY = {
  caution: 'Known cross-contact risk — ask before ordering.',
  unknown: 'Allergen details are not published for this one.',
};

export default function PlaceCard({ item, compact = false }) {
  const { isSaved, toggleSaved } = useStore();
  const savedNow = isSaved(item.id);
  const level = worst(item.allergens);
  const where = item.type === 'product' ? item.store : item.neighborhood;

  return (
    <article className={`place-card${compact ? ' is-compact' : ''}`}>
      <Link to={`/place/${item.id}`} className="place-media" tabIndex={-1} aria-hidden="true">
        <FoodArt art={item.art} />
        {item.type === 'product' && item.swapFor && (
          <span className="swap-flag">Swap for {item.swapFor}</span>
        )}
      </Link>

      <div className="place-body">
        <div className="place-top">
          <h3 className="place-name">
            <Link to={`/place/${item.id}`}>{item.name}</Link>
          </h3>
          <Rating value={item.rating} count={compact ? null : item.reviews} />
        </div>

        <p className="place-meta">
          {item.type === 'product' ? item.brand : item.cuisine}
          <span aria-hidden="true"> · </span>
          {item.distance} mi
          <span aria-hidden="true"> · </span>
          {item.price}
          {!compact && <><span aria-hidden="true"> · </span>{where}</>}
        </p>

        <ul className="tag-row">
          {item.tags.slice(0, compact ? 2 : 3).map((t) => <li key={t}><Tag>{t}</Tag></li>)}
        </ul>

        {!compact && (
          <div className="why">
            <span className="why-head"><Icon name="spark" size={15} /> Why this fits you</span>
            <p>{item.why}</p>
          </div>
        )}

        <ul className="allergen-row">
          {item.allergens.slice(0, compact ? 2 : 3).map((a) => (
            <li key={a.name}><AllergenBadge allergen={a} /></li>
          ))}
        </ul>

        {level !== 'ok' && (
          <p className={`card-caution is-${level}`}>
            <Icon name="alert" size={15} />
            {CAUTION_COPY[level]}
          </p>
        )}

        <div className="place-actions">
          <Button as={Link} to={`/place/${item.id}`} variant="primary" size="sm">View details</Button>
          <button
            type="button"
            className={`ghost-btn${savedNow ? ' is-on' : ''}`}
            onClick={() => toggleSaved(item.id)}
            aria-pressed={savedNow}
          >
            <Icon name="heart" size={16} />
            {savedNow ? 'Saved' : 'Save'}
          </button>
          <a
            className="ghost-btn"
            href={`https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lng}#map=17/${item.lat}/${item.lng}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            <Icon name="pin" size={16} />
            Directions
          </a>
          {item.type === 'product' && (
            <button type="button" className="ghost-btn"><Icon name="cart" size={16} />Add to cart</button>
          )}
        </div>
      </div>
    </article>
  );
}
