import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MapView from './MapView.jsx';
import { enrichPlaces } from '../lib/api.js';
import { formatMiles, haversineMiles } from '../lib/geo.js';

/* The navigator's own mini map.

   Once it knows enough to name places it draws them rather than leaving the
   person to picture a list of addresses. When more than one place fits, the
   map is a chooser: every candidate is ranked by how far it is, and picking
   one answers the navigator in the thread instead of ending the conversation. */

const SPRING = { type: 'spring', stiffness: 230, damping: 28, mass: 0.75 };

function Stars({ rating }) {
  if (!rating) return null;
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className="ai-pick-stars" title={`${rating} out of 5 on Google`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <i key={step} className={rounded >= step ? 'is-full' : rounded >= step - 0.5 ? 'is-half' : ''} aria-hidden="true">★</i>
      ))}
      <b>{rating.toFixed(1)}</b>
    </span>
  );
}

export default function AiMiniMap({
  places,
  matchedOn = [],
  origin = null,
  googleRoutesConsent = false,
  onOpenPlace,
  onShowAll,
  onChoose,
  chosenId = null,
}) {
  /* Nothing is pre-selected: MapView only frames the whole match set while
     no marker is active, and implying a pick before the person makes one
     would be wrong anyway. */
  const [activeId, setActiveId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [enrichment, setEnrichment] = useState({});
  const [provider, setProvider] = useState(null);

  /* Google ratings/reviews work when configured. Precise route time is
     separate and requires the resident's feature-specific consent. */
  useEffect(() => {
    let cancelled = false;
    if (places.length === 0) return undefined;
    enrichPlaces({
      places: places.map((p) => ({ id: p.id, name: p.name, address: `${p.address}, ${p.cityStateZip}`, lat: p.lat, lng: p.lng })),
      origin: googleRoutesConsent ? origin : null,
      googleRoutesConsent,
    })
      .then((result) => {
        if (cancelled) return;
        setEnrichment(result.enrichment || {});
        setProvider(result.provider);
      })
      .catch(() => {
        if (!cancelled) setProvider('none');
      });
    return () => { cancelled = true; };
  }, [places, origin, googleRoutesConsent]);

  /* Nearest first when we know where the person is, so the first card in the
     list is the one they can actually reach. */
  const ranked = useMemo(() => {
    const withDistance = places.map((place) => {
      const extra = enrichment[place.id] || {};
      const straightLine = origin ? haversineMiles(origin, { lat: place.lat, lng: place.lng }) : null;
      return {
        place,
        extra,
        straightLine,
        sortKey: extra.distanceMeters ?? (straightLine == null ? Number.POSITIVE_INFINITY : straightLine * 1609.34),
      };
    });
    return origin ? withDistance.sort((a, b) => a.sortKey - b.sortKey) : withDistance;
  }, [places, enrichment, origin]);

  const multiple = places.length > 1;

  return (
    <div className="ai-map-panel">
      <div className="ai-map-head">
        <div>
          <span className="ai-map-count">
            {places.length} {places.length === 1 ? 'place matches' : 'places match'} what you told me
          </span>
          {matchedOn.length > 0 && (
            <ul className="ai-map-criteria">
              {matchedOn.slice(-4).map((need, index) => <li key={index}>{need}</li>)}
            </ul>
          )}
        </div>
        {onShowAll && (
          <button type="button" className="ai-map-expand" onClick={() => onShowAll(places)}>
            Open on the full map →
          </button>
        )}
      </div>

      <MapView
        places={places}
        activeId={activeId}
        onSelectPlace={(place) => setActiveId(place.id)}
        className="ai-inline-map"
      />

      {multiple && (
        <p className="ai-pick-prompt">
          {chosenId
            ? 'You picked one of these. Ask me anything else about it, or choose a different one.'
            : `Pick the one that works for you${origin ? ' — closest first' : ''}, and I’ll keep helping from there.`}
        </p>
      )}

      <div className="ai-pick-list">
        {ranked.map(({ place, extra, straightLine }, index) => {
          const isActive = place.id === activeId;
          const isChosen = place.id === chosenId;
          const isExpanded = place.id === expandedId;
          const travel = extra.distanceText
            ? `${extra.distanceText}${extra.durationText ? ` · ${extra.durationText} drive` : ''}`
            : formatMiles(straightLine) && `${formatMiles(straightLine)} away as the crow flies`;

          return (
            <div key={place.id} className={`ai-pick-card${isActive ? ' is-active' : ''}${isChosen ? ' is-chosen' : ''}`}>
              <button
                type="button"
                className="ai-pick-main"
                onClick={() => { setActiveId(place.id); setExpandedId(isExpanded ? null : place.id); }}
                aria-expanded={isExpanded}
              >
                <span className="ai-pick-rank">{index + 1}</span>
                <span className="ai-pick-body">
                  <b>{place.name}{isChosen && <em className="ai-pick-chosen-tag">Your pick</em>}</b>
                  <span className="ai-pick-meta">{place.typeLabel.split(' ')[0]} · {place.city}, {place.state}</span>
                  <span className="ai-pick-meta">⏱ {place.hoursSummary}</span>
                  <span className="ai-pick-signals">
                    {travel && <em className="ai-pick-distance">📍 {travel}</em>}
                    <Stars rating={extra.rating} />
                    {extra.ratingCount > 0 && <em className="ai-pick-count">{extra.ratingCount} Google reviews</em>}
                  </span>
                </span>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    className="ai-pick-detail"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={SPRING}
                  >
                    <p className="ai-pick-addr">
                      <span>📍 {place.address}, {place.cityStateZip}</span>
                      <em className="citation-verified-pill">✓ Verified {place.verifiedDate}</em>
                    </p>

                    {place.callAheadWarning && (
                      <p className="ai-pick-callahead">
                        📞 Call ahead — {place.callAheadNote || 'capacity changes quickly.'}
                      </p>
                    )}

                    {extra.reviews?.length > 0 && (
                      <ul className="ai-pick-reviews">
                        {extra.reviews.map((review, reviewIndex) => (
                          <li key={reviewIndex}>
                            <span className="ai-review-head">
                              <b>{review.author || 'Google reviewer'}</b>
                              {review.rating && <em>{'★'.repeat(Math.round(review.rating))}</em>}
                              {review.when && <i>{review.when}</i>}
                            </span>
                            <p>{review.text}</p>
                          </li>
                        ))}
                      </ul>
                    )}

                    {provider === 'none' && (
                      <p className="ai-pick-note">
                        Reviews and driving times switch on once a Google Maps key is configured. Distances shown are straight-line.
                      </p>
                    )}

                    <div className="ai-pick-actions">
                      {onChoose && multiple && (
                        <button type="button" className="ai-pick-choose" onClick={() => onChoose(place)}>
                          {isChosen ? 'Keep this one' : 'Choose this place'}
                        </button>
                      )}
                      <button type="button" className="citation-view-btn" onClick={() => onOpenPlace?.(place)}>
                        Details & inventory →
                      </button>
                      <a
                        className="ai-pick-directions"
                        href={extra.mapsUrl || place.directionsUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Directions
                      </a>
                      <a className="ai-pick-directions" href={`tel:${place.phone.replace(/[^0-9]/g, '')}`}>
                        Call {place.phone}
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
