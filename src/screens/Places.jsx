import React, { useState, useMemo, useEffect } from 'react';
import { PLACES, PLACE_CATEGORIES, getIsOpenNow } from '../data/places.js';
import MapView from '../components/MapView.jsx';
import PlaceDetailModal from '../components/PlaceDetailModal.jsx';
import ReservationModal from '../components/ReservationModal.jsx';
import { listLocations, listReservations } from '../lib/api.js';

export default function Places({ onNavigateHome }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [places, setPlaces] = useState(PLACES);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [reservationsOnly, setReservationsOnly] = useState(false);
  const [activePlace, setActivePlace] = useState(null);
  const [placeToReserve, setPlaceToReserve] = useState(null);
  const [mobileTab, setMobileTab] = useState('both'); // 'list' | 'map' | 'both'
  const [savedReservations, setSavedReservations] = useState([]);
  const [showMyPasses, setShowMyPasses] = useState(false);

  useEffect(() => { refreshReservations(); }, []);

  useEffect(() => {
    listLocations().then(setPlaces).catch(() => {
      // Keep the checked-in demo snapshot visible while a local API is starting.
    });
  }, []);

  const refreshReservations = async () => {
    try {
      setSavedReservations(await listReservations());
    } catch {
      // Reservations remain unavailable rather than silently falling back to browser storage.
      setSavedReservations([]);
    }
  };

  const filteredPlaces = useMemo(() => {
    return places.filter((place) => {
      // Category filter
      if (selectedCategory !== 'all' && place.type !== selectedCategory) {
        return false;
      }

      // Open now filter
      if (openNowOnly) {
        const { isOpen } = getIsOpenNow(place);
        if (!isOpen) return false;
      }

      // Reservations filter
      if (reservationsOnly && !place.acceptsReservations) {
        return false;
      }

      // Search query (matches name, address, neighborhood, city, or inventory items)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = place.name.toLowerCase().includes(q);
        const matchesAddr = place.address.toLowerCase().includes(q) || place.cityStateZip.toLowerCase().includes(q);
        const matchesNeighborhood = place.neighborhood.toLowerCase().includes(q);
        const matchesInventory = place.inventory.some((i) => i.item.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
        if (!matchesName && !matchesAddr && !matchesNeighborhood && !matchesInventory) {
          return false;
        }
      }

      return true;
    });
  }, [places, searchQuery, selectedCategory, openNowOnly, reservationsOnly]);

  return (
    <div className="places-page-shell">
      {/* Top Header Bar */}
      <header className="places-topbar">
        <div className="places-topbar-inner">
          <button type="button" className="places-brand-btn" onClick={onNavigateHome}>
            <span className="places-brand-mark"><i /><b /></span>
            <span>Neighbor<b>Cart</b></span>
          </button>
          
          <nav className="places-nav">
            <button type="button" className="nav-text-btn" onClick={onNavigateHome}>← Back to Home</button>
            {savedReservations.length > 0 && (
              <button 
                type="button" 
                className="my-passes-btn"
                onClick={() => setShowMyPasses(!showMyPasses)}
              >
                🎫 My Passes ({savedReservations.length})
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero / Filter Section */}
      <section className="places-hero-bar">
        <div className="shell-contained">
          <div className="places-title-row">
            <div>
              <span className="places-badge">Iowa Community Food Access Network</span>
              <h1 className="places-heading">Food Banks & Pantries <em>Near You</em></h1>
              <p className="places-sub">
                Verified locations offering free groceries, fresh produce, hot meals, and 24/7 community pantries. 
                Zero judgment, zero paperwork.
              </p>
            </div>
            
            <div className="places-stats-pill">
              <b>{filteredPlaces.length}</b> verified locations found
            </div>
          </div>

          {/* Search Input & Filter Controls */}
          <div className="places-filter-card">
            <div className="search-bar-row">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input-field"
                placeholder="Search food banks, pantries, ZIP code (e.g. 50309), or items (e.g. milk, produce)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" className="clear-search-btn" onClick={() => setSearchQuery('')}>×</button>
              )}
            </div>

            <div className="category-scroll-strip">
              {PLACE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-pill ${selectedCategory === cat.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <span>{cat.icon}</span> {cat.label}
                </button>
              ))}
            </div>

            <div className="toggle-filters-row">
              <label className="toggle-filter-label">
                <input
                  type="checkbox"
                  checked={openNowOnly}
                  onChange={(e) => setOpenNowOnly(e.target.checked)}
                />
                <span>🟢 Open Right Now</span>
              </label>

              <label className="toggle-filter-label">
                <input
                  type="checkbox"
                  checked={reservationsOnly}
                  onChange={(e) => setReservationsOnly(e.target.checked)}
                />
                <span>📅 Accepts Free Reservations</span>
              </label>

              {(selectedCategory !== 'all' || openNowOnly || reservationsOnly || searchQuery) && (
                <button 
                  type="button" 
                  className="reset-filters-btn"
                  onClick={() => {
                    setSelectedCategory('all');
                    setOpenNowOnly(false);
                    setReservationsOnly(false);
                    setSearchQuery('');
                  }}
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Switcher (List vs Map) */}
      <div className="mobile-view-tabs">
        <button 
          type="button" 
          className={`mobile-tab-btn ${mobileTab !== 'map' ? 'is-active' : ''}`}
          onClick={() => setMobileTab('list')}
        >
          📋 List View ({filteredPlaces.length})
        </button>
        <button 
          type="button" 
          className={`mobile-tab-btn ${mobileTab === 'map' ? 'is-active' : ''}`}
          onClick={() => setMobileTab('map')}
        >
          🗺 Interactive Map
        </button>
      </div>

      {/* Main Grid: Interactive Map + Place Cards List */}
      <main className="places-main-content shell-contained">
        <div className="places-split-layout">
          {/* List Panel */}
          <div className={`places-cards-column ${mobileTab === 'map' ? 'mobile-hidden' : ''}`}>
            {filteredPlaces.length === 0 ? (
              <div className="no-results-box">
                <span className="no-results-emoji">🌾</span>
                <h3>No locations match your filter</h3>
                <p>Try clearing your search term or switching to "All Places".</p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setSelectedCategory('all');
                    setOpenNowOnly(false);
                    setReservationsOnly(false);
                    setSearchQuery('');
                  }}
                >
                  Show all food locations
                </button>
              </div>
            ) : (
              <div className="places-grid">
                {filteredPlaces.map((place) => {
                  const openStatus = getIsOpenNow(place);
                  const isSelected = activePlace?.id === place.id;

                  return (
                    <article 
                      key={place.id} 
                      className={`place-card-item ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => setActivePlace(place)}
                    >
                      <div className="card-thumb-wrap">
                        <img src={place.images[0]} alt={place.name} className="card-thumb-img" />
                        <span className={`status-badge-float ${openStatus.isOpen ? 'is-open' : 'is-closed'}`}>
                          {openStatus.isOpen ? '🟢 Open Now' : '🔴 Closed'}
                        </span>
                        <span className="type-badge-float">{place.typeLabel.split(' ')[0]}</span>
                      </div>

                      <div className="card-info-wrap">
                        <div className="card-top-row">
                          <span className="card-neighborhood">{place.neighborhood}</span>
                          <span className="card-verified">✓ Verified</span>
                        </div>

                        <h3 className="card-name" onClick={() => setActivePlace(place)}>
                          {place.name}
                        </h3>

                        <p className="card-address">📍 {place.address}, {place.cityStateZip}</p>
                        <p className="card-hours">⏱ {place.hoursSummary}</p>

                        {/* Top inventory teaser */}
                        <div className="card-inventory-teasers">
                          <span className="inv-teaser-label">Available now:</span>
                          <div className="inv-teaser-chips">
                            {place.inventory.slice(0, 3).map((inv, idx) => (
                              <span key={idx} className="inv-teaser-chip">
                                {inv.item.split('(')[0].trim()}
                              </span>
                            ))}
                            {place.inventory.length > 3 && (
                              <span className="inv-teaser-more">+{place.inventory.length - 3} more</span>
                            )}
                          </div>
                        </div>

                        {/* Card Action Buttons */}
                        <div className="card-actions-bar" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="card-btn-primary"
                            onClick={() => setActivePlace(place)}
                          >
                            View Details & Inventory
                          </button>
                          
                          {place.acceptsReservations ? (
                            <button
                              type="button"
                              className="card-btn-reserve"
                              onClick={() => setPlaceToReserve(place)}
                            >
                              Reserve Box
                            </button>
                          ) : (
                            <a
                              href={place.directionsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="card-btn-directions"
                            >
                              Directions
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive Map Panel */}
          <div className={`places-map-column ${mobileTab === 'list' ? 'mobile-hidden' : ''}`}>
            <div className="sticky-map-frame">
              <MapView
                places={filteredPlaces}
                activeId={activePlace?.id}
                onSelectPlace={(p) => setActivePlace(p)}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Place Detail Modal */}
      {activePlace && (
        <PlaceDetailModal
          place={activePlace}
          onClose={() => setActivePlace(null)}
          onOpenReserve={(p) => {
            setActivePlace(null);
            setPlaceToReserve(p);
          }}
        />
      )}

      {/* Reservation Modal */}
      {placeToReserve && (
        <ReservationModal
          place={placeToReserve}
          onClose={() => setPlaceToReserve(null)}
          onReservationConfirmed={() => {
            refreshReservations();
          }}
        />
      )}

      {/* Saved Passes Drawer */}
      {showMyPasses && (
        <div className="modal-backdrop" onClick={() => setShowMyPasses(false)}>
          <div className="passes-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowMyPasses(false)}>×</button>
            <div className="passes-header">
              <h2>Your Active Pickup Passes</h2>
              <p>Saved for this browser on the local Neighbor Cart service. Show upon arrival for rapid, discreet pickup.</p>
            </div>
            
            <div className="passes-list">
              {savedReservations.map((pass, idx) => (
                <div key={idx} className="saved-pass-item">
                  <div className="sp-header">
                    <span className="sp-code">{pass.code}</span>
                    <span className="sp-date">{pass.date} · {pass.timeSlot}</span>
                  </div>
                  <h4 className="sp-title">{pass.placeName}</h4>
                  <p className="sp-addr">{pass.address}</p>
                  <p className="sp-meta">Household: {pass.householdSize} · Guest: {pass.name}</p>
                  {pass.dietary.length > 0 && <p className="sp-diet">Dietary: {pass.dietary.join(', ')}</p>}
                  <button 
                    type="button" 
                    className="btn-print-sm"
                    onClick={() => window.print()}
                  >
                    🖨 Print Pass
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
