import React, { useState, useMemo, useEffect } from 'react';
import { PLACES, PLACE_CATEGORIES, DIETARY_OPTIONS, LANGUAGE_OPTIONS, ELIGIBILITY_OPTIONS, getIsOpenNow } from '../data/places.js';
import MapView from '../components/MapView.jsx';
import PlaceDetailModal from '../components/PlaceDetailModal.jsx';
import ReservationModal from '../components/ReservationModal.jsx';
import { listLocations, listReservations } from '../lib/api.js';
import HarvestLinkAI from '../components/HarvestLinkAI.jsx';
import ResidentIntakeModal from '../components/ResidentIntakeModal.jsx';
import NonprofitDashboard from '../components/NonprofitDashboard.jsx';
import VolunteerHub from '../components/VolunteerHub.jsx';
import FoodRescueHub from '../components/FoodRescueHub.jsx';
import CommunityFeed from '../components/CommunityFeed.jsx';
import ImpactDashboard from '../components/ImpactDashboard.jsx';
import AdminPortal from '../components/AdminPortal.jsx';

export default function Places({ onNavigateHome }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [places, setPlaces] = useState(PLACES);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [reservationsOnly, setReservationsOnly] = useState(false);
  const [produceOnly, setProduceOnly] = useState(false);
  const [selectedDiet, setSelectedDiet] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedEligibility, setSelectedEligibility] = useState('all');
  const [lowBandwidthMode, setLowBandwidthMode] = useState(false);
  const [activePlace, setActivePlace] = useState(null);
  const [placeToReserve, setPlaceToReserve] = useState(null);
  const [mobileTab, setMobileTab] = useState('both');
  const [savedReservations, setSavedReservations] = useState([]);
  const [showMyPasses, setShowMyPasses] = useState(false);
  const [language, setLanguage] = useState('en'); // 'en' | 'es'

  // Modals state
  const [showAI, setShowAI] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [showNonprofit, setShowNonprofit] = useState(false);
  const [showVolunteer, setShowVolunteer] = useState(false);
  const [showRescue, setShowRescue] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);
  const [showImpact, setShowImpact] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

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

      // Produce filter
      if (produceOnly && !place.hasFreshProduce) {
        return false;
      }

      // Dietary filter
      if (selectedDiet !== 'all' && !place.dietary?.includes(selectedDiet)) {
        return false;
      }

      // Language filter
      if (selectedLanguage !== 'all' && !place.languages?.includes(selectedLanguage)) {
        return false;
      }

      // Eligibility filter
      if (selectedEligibility !== 'all' && !place.eligibilityTags?.includes(selectedEligibility)) {
        return false;
      }

      // Search query (matches city, state, zip, name, address, neighborhood, or inventory items)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = place.name.toLowerCase().includes(q);
        const matchesCity = place.city?.toLowerCase().includes(q) || place.state?.toLowerCase().includes(q);
        const matchesZip = place.zip?.toLowerCase().includes(q);
        const matchesAddr = place.address.toLowerCase().includes(q) || place.cityStateZip.toLowerCase().includes(q);
        const matchesNeighborhood = place.neighborhood.toLowerCase().includes(q);
        const matchesInventory = place.inventory.some((i) => i.item.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
        if (!matchesName && !matchesCity && !matchesZip && !matchesAddr && !matchesNeighborhood && !matchesInventory) {
          return false;
        }
      }

      return true;
    });
  }, [places, searchQuery, selectedCategory, openNowOnly, reservationsOnly, produceOnly, selectedDiet, selectedLanguage, selectedEligibility]);

  return (
    <div className={`places-page-shell ${sidebarOpen ? 'has-sidebar-open' : ''}`}>
      {/* Sidebar Overlay Backdrop */}
      {sidebarOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true" 
        />
      )}

      {/* Floating Side Drawer Navigation */}
      <aside className={`places-side-drawer ${sidebarOpen ? 'is-open' : ''}`} aria-label="Portal Navigation Menu">
        <div className="side-drawer-header">
          <div className="side-drawer-brand">
            <span className="places-brand-mark"><i /><b /></span>
            <div className="side-drawer-brand-copy">
              <span className="side-brand-title">neighbor<b>cart</b></span>
              <span className="side-brand-subtitle">Relief & Access Hubs</span>
            </div>
          </div>
          <button 
            type="button" 
            className="side-drawer-close-btn" 
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar menu"
          >
            ✕
          </button>
        </div>

        <div className="side-drawer-content">
          <div className="side-nav-section">
            <span className="side-section-heading">Smart Navigators</span>
            <div className="side-nav-links">
              <button 
                type="button" 
                className="side-nav-item side-item-highlight" 
                onClick={() => { setShowAI(true); setSidebarOpen(false); }}
              >
                <span className="sni-icon">🤖</span>
                <div className="sni-text">
                  <span className="sni-title">Ask HarvestLink AI</span>
                  <span className="sni-desc">Grounded answers & call-ahead advice</span>
                </div>
                <span className="sni-pill">AI</span>
              </button>

              <button 
                type="button" 
                className="side-nav-item" 
                onClick={() => { setShowIntake(true); setSidebarOpen(false); }}
              >
                <span className="sni-icon">📋</span>
                <div className="sni-text">
                  <span className="sni-title">Personalized Food Plan</span>
                  <span className="sni-desc">Custom 3-step action roadmap</span>
                </div>
              </button>
            </div>
          </div>

          <div className="side-nav-section">
            <span className="side-section-heading">Community & Volunteers</span>
            <div className="side-nav-links">
              <button 
                type="button" 
                className="side-nav-item" 
                onClick={() => { setShowCommunity(true); setSidebarOpen(false); }}
              >
                <span className="sni-icon">📣</span>
                <div className="sni-text">
                  <span className="sni-title">Community Feed</span>
                  <span className="sni-desc">Pop-ups, distributions & urgent requests</span>
                </div>
              </button>

              <button 
                type="button" 
                className="side-nav-item" 
                onClick={() => { setShowVolunteer(true); setSidebarOpen(false); }}
              >
                <span className="sni-icon">🤝</span>
                <div className="sni-text">
                  <span className="sni-title">Volunteer Network</span>
                  <span className="sni-desc">Claim shifts, delivery routes & track hours</span>
                </div>
              </button>
            </div>
          </div>

          <div className="side-nav-section">
            <span className="side-section-heading">Logistics & Partners</span>
            <div className="side-nav-links">
              <button 
                type="button" 
                className="side-nav-item" 
                onClick={() => { setShowRescue(true); setSidebarOpen(false); }}
              >
                <span className="sni-icon">🥦</span>
                <div className="sni-text">
                  <span className="sni-title">Food Rescue Dispatch</span>
                  <span className="sni-desc">Match store surplus with cold-storage pantries</span>
                </div>
              </button>

              <button 
                type="button" 
                className="side-nav-item" 
                onClick={() => { setShowNonprofit(true); setSidebarOpen(false); }}
              >
                <span className="sni-icon">🏢</span>
                <div className="sni-text">
                  <span className="sni-title">Nonprofit Portal</span>
                  <span className="sni-desc">Broadcast needs, verify listings & export CSV</span>
                </div>
              </button>
            </div>
          </div>

          <div className="side-nav-section">
            <span className="side-section-heading">Transparency & Governance</span>
            <div className="side-nav-links">
              <button 
                type="button" 
                className="side-nav-item" 
                onClick={() => { setShowImpact(true); setSidebarOpen(false); }}
              >
                <span className="sni-icon">📊</span>
                <div className="sni-text">
                  <span className="sni-title">Impact Dashboard</span>
                  <span className="sni-desc">Nationwide meals delivered & ZIP demand</span>
                </div>
              </button>

              <button 
                type="button" 
                className="side-nav-item" 
                onClick={() => { setShowAdmin(true); setSidebarOpen(false); }}
              >
                <span className="sni-icon">⚙️</span>
                <div className="sni-text">
                  <span className="sni-title">Admin Directory</span>
                  <span className="sni-desc">Review pending orgs & resolve accuracy flags</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="side-drawer-footer">
          <div className="side-quick-stats">
            <span className="sqs-dot">●</span>
            <span>Over <b>4,800+</b> verified food relief access points nationwide</span>
          </div>
        </div>
      </aside>

      {/* Top Header Bar */}
      <header className="places-topbar">
        <div className="places-topbar-inner">
          <div className="topbar-brand-group">
            {/* Side Menu Hamburger Toggle */}
            <button 
              type="button" 
              className="side-menu-trigger-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Open side menu"
              title="Open Hubs & Tools Menu"
            >
              <span className="hamburger-box">
                <span className="hamburger-line" />
                <span className="hamburger-line" />
                <span className="hamburger-line" />
              </span>
              <span className="menu-trigger-text">Hubs Menu</span>
            </button>

            <button type="button" className="places-brand-btn" onClick={onNavigateHome}>
              <span className="places-brand-mark"><i /><b /></span>
              <span>neighbor<b>cart</b></span>
            </button>
            <span className="topbar-live-tag">● Nationwide Access</span>
          </div>

          <div className="topbar-center-hubs-strip">
            <button type="button" className="quick-hub-pill ai-hub-pill" onClick={() => setShowAI(true)}>
              🤖 Ask AI
            </button>
            <button type="button" className="quick-hub-pill" onClick={() => setShowIntake(true)}>
              📋 Food Plan
            </button>
            <button type="button" className="quick-hub-pill" onClick={() => setShowVolunteer(true)}>
              🤝 Volunteers
            </button>
            <button type="button" className="quick-hub-pill" onClick={() => setShowRescue(true)}>
              🥦 Food Rescue
            </button>
            <button type="button" className="quick-hub-pill" onClick={() => setShowImpact(true)}>
              📊 Impact
            </button>
          </div>

          <nav className="places-nav">
            {/* Language Switcher */}
            <button
              type="button"
              className="lang-toggle-btn"
              onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
              title="Toggle language"
            >
              🌐 <span>{language === 'en' ? 'Español' : 'English'}</span>
            </button>

            {savedReservations.length > 0 && (
              <button 
                type="button" 
                className="my-passes-btn"
                onClick={() => setShowMyPasses(!showMyPasses)}
              >
                🎫 My Passes ({savedReservations.length})
              </button>
            )}

            <button type="button" className="nav-text-btn" onClick={onNavigateHome}>
              ← Back to Home
            </button>
          </nav>
        </div>
      </header>

      {/* Hero / Filter Section */}
      <section className="places-hero-bar">
        <div className="shell-contained">
          <div className="places-title-row">
            <div className="places-title-copy">
              <div className="badge-row">
                <span className="places-badge">National Food Access & Relief Network</span>
                <span className="places-live-count">{filteredPlaces.length} Verified Centers</span>
              </div>
              <h1 className="places-heading">Food Assistance Directory & Real-Time Map</h1>
              <p className="places-sub">
                Explore verified food banks, neighborhood pantries, hot meal sites, and mobile rescue distributions across all 50 states. 
                100% free, confidential, and zero paperwork required.
              </p>
            </div>

            <div className="places-action-pills">
              <button 
                type="button" 
                className="hero-action-pill ai-pill"
                onClick={() => setShowAI(true)}
              >
                🤖 Ask AI Navigator
              </button>
              <button 
                type="button" 
                className="hero-action-pill plan-pill"
                onClick={() => setShowIntake(true)}
              >
                📋 Build My Custom Food Plan
              </button>
              <button 
                type="button" 
                className={`hero-action-pill ${lowBandwidthMode ? 'active-bandwidth' : ''}`}
                onClick={() => setLowBandwidthMode(!lowBandwidthMode)}
              >
                ⚡ {lowBandwidthMode ? 'Standard Rich View' : 'Low-Bandwidth List Mode'}
              </button>
            </div>
          </div>

          {/* Search Input & Filter Controls */}
          <div className="places-filter-card">
            {/* Search Input Box */}
            <div className="search-bar-row">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input-field"
                placeholder="Search by city (e.g. Des Moines, NYC, LA, Chicago, Miami, Seattle), ZIP code, or food item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" className="clear-search-btn" onClick={() => setSearchQuery('')} aria-label="Clear search">×</button>
              )}
            </div>

            {/* Quick Cities Pills */}
            <div className="quick-cities-strip">
              <span className="quick-city-label">Popular Cities:</span>
              {['Des Moines, IA', 'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Seattle, WA', 'Miami, FL', 'Boston, MA'].map((cityStr) => {
                const cityName = cityStr.split(',')[0];
                const isActive = searchQuery.toLowerCase().includes(cityName.toLowerCase());
                return (
                  <button
                    key={cityStr}
                    type="button"
                    className={`quick-city-pill ${isActive ? 'is-active' : ''}`}
                    onClick={() => setSearchQuery(isActive ? '' : cityName)}
                  >
                    📍 {cityStr}
                  </button>
                );
              })}
            </div>

            {/* Category scroll pills */}
            <div className="category-scroll-strip">
              {PLACE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-pill ${selectedCategory === cat.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <span className="cat-icon">{cat.icon}</span> 
                  <span className="cat-label">{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Secondary Advanced Filters Dropdowns */}
            <div className="advanced-filter-row">
              <div className="adv-filter-group">
                <label className="adv-filter-label">🥗 Dietary Accommodations</label>
                <div className="select-wrapper">
                  <select
                    className="adv-filter-select"
                    value={selectedDiet}
                    onChange={(e) => setSelectedDiet(e.target.value)}
                  >
                    <option value="all">All Dietary Types (Vegetarian, Halal, etc.)</option>
                    {DIETARY_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="adv-filter-group">
                <label className="adv-filter-label">🗣 Languages Spoken</label>
                <div className="select-wrapper">
                  <select
                    className="adv-filter-select"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                  >
                    <option value="all">All Languages Spoken</option>
                    {LANGUAGE_OPTIONS.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="adv-filter-group">
                <label className="adv-filter-label">🛡 Access & Eligibility</label>
                <div className="select-wrapper">
                  <select
                    className="adv-filter-select"
                    value={selectedEligibility}
                    onChange={(e) => setSelectedEligibility(e.target.value)}
                  >
                    <option value="all">All Eligibility Rules (No ID, Walk-in)</option>
                    {ELIGIBILITY_OPTIONS.map((el) => (
                      <option key={el} value={el}>{el}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Quick check toggles */}
            <div className="toggle-filters-row">
              <label className="toggle-filter-label">
                <input
                  type="checkbox"
                  checked={openNowOnly}
                  onChange={(e) => setOpenNowOnly(e.target.checked)}
                />
                <span className="toggle-text">🟢 <b>Open Right Now</b></span>
              </label>

              <label className="toggle-filter-label">
                <input
                  type="checkbox"
                  checked={reservationsOnly}
                  onChange={(e) => setReservationsOnly(e.target.checked)}
                />
                <span className="toggle-text">📅 <b>Free Reservations / Express Pickup</b></span>
              </label>

              <label className="toggle-filter-label">
                <input
                  type="checkbox"
                  checked={produceOnly}
                  onChange={(e) => setProduceOnly(e.target.checked)}
                />
                <span className="toggle-text">🥬 <b>Fresh Produce In Stock</b></span>
              </label>

              {(selectedCategory !== 'all' || openNowOnly || reservationsOnly || produceOnly || selectedDiet !== 'all' || selectedLanguage !== 'all' || selectedEligibility !== 'all' || searchQuery) && (
                <button 
                  type="button" 
                  className="reset-filters-btn"
                  onClick={() => {
                    setSelectedCategory('all');
                    setOpenNowOnly(false);
                    setReservationsOnly(false);
                    setProduceOnly(false);
                    setSelectedDiet('all');
                    setSelectedLanguage('all');
                    setSelectedEligibility('all');
                    setSearchQuery('');
                  }}
                >
                  ✕ Reset filters
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Switcher (List vs Map) */}
      {!lowBandwidthMode && (
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
      )}

      {/* Main Grid: Interactive Map + Place Cards List */}
      <main className="places-main-content shell-contained">
        <div className={`places-split-layout ${lowBandwidthMode ? 'is-low-bandwidth' : ''}`}>
          {/* List Panel */}
          <div className={`places-cards-column ${mobileTab === 'map' && !lowBandwidthMode ? 'mobile-hidden' : ''}`}>
            {filteredPlaces.length === 0 ? (
              <div className="no-results-box">
                <span className="no-results-emoji">🌾</span>
                <h3>No locations match your filter</h3>
                <p>Try broadening your search term or switching to "All Places".</p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setSelectedCategory('all');
                    setOpenNowOnly(false);
                    setReservationsOnly(false);
                    setProduceOnly(false);
                    setSelectedDiet('all');
                    setSelectedLanguage('all');
                    setSelectedEligibility('all');
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
                      {!lowBandwidthMode && (
                        <div className="card-thumb-wrap">
                          <img src={place.images[0]} alt={place.name} className="card-thumb-img" />
                          <span className={`status-badge-float ${openStatus.isOpen ? 'is-open' : 'is-closed'}`}>
                            {openStatus.isOpen ? '🟢 Open Now' : '🔴 Closed'}
                          </span>
                          <span className="type-badge-float">{place.typeLabel.split(' ')[0]}</span>
                        </div>
                      )}

                      <div className="card-info-wrap">
                        <div className="card-top-row">
                          <span className="card-neighborhood">{place.city}, {place.state} ({place.neighborhood})</span>
                          <span className="card-verified">✓ {place.verifiedDate}</span>
                        </div>

                        <h3 className="card-name" onClick={() => setActivePlace(place)}>
                          {place.name}
                        </h3>

                        <p className="card-address">📍 {place.address}, {place.cityStateZip}</p>
                        <p className="card-hours">⏱ {place.hoursSummary}</p>

                        {/* Call ahead warning if present */}
                        {place.callAheadWarning && (
                          <div className="card-warning-pill">
                            ⚠️ <b>Call ahead:</b> {place.callAheadNote || 'Capacity changes rapidly.'}
                          </div>
                        )}

                        {/* Top inventory teaser */}
                        <div className="card-inventory-teasers">
                          <span className="inv-teaser-label">Available inventory:</span>
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

          {/* Interactive Map Panel (Hidden in Low Bandwidth mode) */}
          {!lowBandwidthMode && (
            <div className={`places-map-column ${mobileTab === 'list' ? 'mobile-hidden' : ''}`}>
              <div className="sticky-map-frame">
                <MapView
                  places={filteredPlaces}
                  activeId={activePlace?.id}
                  onSelectPlace={(p) => setActivePlace(p)}
                />
              </div>
            </div>
          )}
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

      {/* AI Assistant Modal */}
      {showAI && (
        <HarvestLinkAI
          onClose={() => setShowAI(false)}
          onSelectPlace={(p) => setActivePlace(p)}
        />
      )}

      {/* Intake / Recommendation Plan Modal */}
      {showIntake && (
        <ResidentIntakeModal
          lang={language}
          onClose={() => setShowIntake(false)}
          onSelectPlace={(p) => setActivePlace(p)}
        />
      )}

      {/* Nonprofit Dashboard Modal */}
      {showNonprofit && (
        <NonprofitDashboard
          onClose={() => setShowNonprofit(false)}
        />
      )}

      {/* Volunteer Hub Modal */}
      {showVolunteer && (
        <VolunteerHub
          onClose={() => setShowVolunteer(false)}
        />
      )}

      {/* Food Rescue Hub Modal */}
      {showRescue && (
        <FoodRescueHub
          onClose={() => setShowRescue(false)}
        />
      )}

      {/* Community Feed Modal */}
      {showCommunity && (
        <CommunityFeed
          onClose={() => setShowCommunity(false)}
          onOpenReport={() => alert('Report submitted to directory administrators for verification.')}
        />
      )}

      {/* Impact Dashboard Modal */}
      {showImpact && (
        <ImpactDashboard
          onClose={() => setShowImpact(false)}
        />
      )}

      {/* Admin Portal Modal */}
      {showAdmin && (
        <AdminPortal
          onClose={() => setShowAdmin(false)}
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
