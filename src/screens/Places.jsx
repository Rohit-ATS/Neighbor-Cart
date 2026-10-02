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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const [aiMatchIds, setAiMatchIds] = useState(null);

  const filteredPlaces = useMemo(() => {
    return places.filter((place) => {
      // A match set handed over by the AI navigator overrides the filters,
      // so "show all on the main map" lands on exactly what it recommended.
      if (aiMatchIds && !aiMatchIds.includes(place.id)) {
        return false;
      }
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
  }, [places, searchQuery, selectedCategory, openNowOnly, reservationsOnly, produceOnly, selectedDiet, selectedLanguage, selectedEligibility, aiMatchIds]);

  return (
    <div className={`places-workspace ${sidebarCollapsed ? 'is-collapsed' : ''} ${mobileMenuOpen ? 'has-mobile-drawer' : ''}`}>
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true" 
        />
      )}

      {/* Top Header Bar */}
      <header className="places-topbar">
        <div className="places-topbar-inner">
          <div className="topbar-brand-group">
            {/* Retractable Sidebar Toggle (Desktop) */}
            <button 
              type="button" 
              className="lexis-rail-toggle-btn desktop-only"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                {sidebarCollapsed ? (
                  <polyline points="13 9 16 12 13 15" />
                ) : (
                  <polyline points="15 9 12 12 15 15" />
                )}
              </svg>
            </button>

            {/* Mobile Drawer Trigger (Mobile only) */}
            <button 
              type="button" 
              className="lexis-rail-toggle-btn mobile-only"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Open navigation menu"
              title="Open menu"
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <button type="button" className="places-brand-btn" onClick={onNavigateHome}>
              <span className="places-brand-mark"><i /><b /></span>
              <span>neighbor<b>cart</b></span>
            </button>
            <span className="topbar-live-tag">● Nationwide Access</span>
          </div>

          <div className="topbar-center-hubs-strip">
            <button type="button" className="quick-hub-pill ai-hub-pill" onClick={() => setShowAI(true)}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              <span>Ask AI</span>
            </button>
            <button type="button" className="quick-hub-pill" onClick={() => setShowIntake(true)}>
              <span>Food Plan</span>
            </button>
            <button type="button" className="quick-hub-pill" onClick={() => setShowVolunteer(true)}>
              <span>Volunteers</span>
            </button>
            <button type="button" className="quick-hub-pill" onClick={() => setShowRescue(true)}>
              <span>Food Rescue</span>
            </button>
            <button type="button" className="quick-hub-pill" onClick={() => setShowImpact(true)}>
              <span>Impact</span>
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

      {/* Main Workspace Frame: Side Menu + Main Page Content */}
      <div className="places-workspace-frame">
        {/* Retractable LexisGuide Side Rail */}
        <aside 
          className={`lexis-workspace-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''} ${mobileMenuOpen ? 'is-mobile-open' : ''}`}
          aria-label="Workspace & Hubs Navigation"
        >
          {/* Header Row in Sidebar */}
          <div className="lexis-side-header">
            <div className="lexis-brand-text">
              <span className="lexis-brand-name">Navigation</span>
              <span className="lexis-brand-sub">Hubs & Relief Tools</span>
            </div>

            <button 
              type="button" 
              className="lexis-collapse-toggle-btn"
              onClick={() => {
                if (window.innerWidth <= 840) {
                  setMobileMenuOpen(false);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {sidebarCollapsed ? (
                  <polyline points="9 18 15 12 9 6" />
                ) : (
                  <polyline points="15 18 9 12 15 6" />
                )}
              </svg>
            </button>
          </div>

          {/* Primary Action Button (Matches LexisGuide 'Add document') */}
          <button 
            type="button" 
            className="lexis-new-btn"
            onClick={() => { setShowAI(true); setMobileMenuOpen(false); }}
            title="Ask HarvestLink AI"
          >
            <span className="lexis-new-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 0 1 4 4v1a2 2 0 0 1 2 2v7a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V9a2 2 0 0 1 2-2V6a4 4 0 0 1 4-4z" />
                <circle cx="9" cy="13" r="1" fill="currentColor" />
                <circle cx="15" cy="13" r="1" fill="currentColor" />
                <line x1="10" y1="17" x2="14" y2="17" />
              </svg>
            </span>
            <span className="lexis-btn-label">Ask HarvestLink AI</span>
          </button>

          {/* Navigation Groups */}
          <nav className="lexis-nav">
            <div className="lexis-nav-group">
              <span className="lexis-rail-label">Resident Navigators</span>
              
              <button 
                type="button" 
                className="lexis-nav-btn is-active" 
                onClick={() => setMobileMenuOpen(false)}
                title="Map & Directory"
              >
                <span className="ln-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                    <line x1="8" y1="2" x2="8" y2="18" />
                    <line x1="16" y1="6" x2="16" y2="22" />
                  </svg>
                </span>
                <span className="ln-label">Map & Directory</span>
                <em className="ln-badge">{filteredPlaces.length}</em>
              </button>

              <button 
                type="button" 
                className="lexis-nav-btn" 
                onClick={() => { setShowIntake(true); setMobileMenuOpen(false); }}
                title="Personalized Food Plan"
              >
                <span className="ln-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </span>
                <span className="ln-label">Personalized Plan</span>
              </button>

              <button 
                type="button" 
                className="lexis-nav-btn" 
                onClick={() => { setShowCommunity(true); setMobileMenuOpen(false); }}
                title="Community Feed & Updates"
              >
                <span className="ln-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </span>
                <span className="ln-label">Community Feed</span>
                <span className="ln-dot" />
              </button>
            </div>

            <div className="lexis-nav-group">
              <span className="lexis-rail-label">Relief Network</span>
              
              <button 
                type="button" 
                className="lexis-nav-btn" 
                onClick={() => { setShowVolunteer(true); setMobileMenuOpen(false); }}
                title="Volunteer Hub & Shifts"
              >
                <span className="ln-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <span className="ln-label">Volunteer Shifts</span>
                <em className="ln-badge">4 open</em>
              </button>

              <button 
                type="button" 
                className="lexis-nav-btn" 
                onClick={() => { setShowRescue(true); setMobileMenuOpen(false); }}
                title="Food Rescue Dispatch"
              >
                <span className="ln-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13" />
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                </span>
                <span className="ln-label">Food Rescue Dispatch</span>
              </button>

              <button 
                type="button" 
                className="lexis-nav-btn" 
                onClick={() => { setShowNonprofit(true); setMobileMenuOpen(false); }}
                title="Nonprofit Portal"
              >
                <span className="ln-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                    <line x1="9" y1="22" x2="9" y2="22.01" />
                    <line x1="15" y1="22" x2="15" y2="22.01" />
                    <line x1="9" y1="18" x2="9" y2="18.01" />
                    <line x1="15" y1="18" x2="15" y2="18.01" />
                    <line x1="9" y1="14" x2="9" y2="14.01" />
                    <line x1="15" y1="14" x2="15" y2="14.01" />
                    <line x1="9" y1="10" x2="9" y2="10.01" />
                    <line x1="15" y1="10" x2="15" y2="10.01" />
                    <line x1="9" y1="6" x2="9" y2="6.01" />
                    <line x1="15" y1="6" x2="15" y2="6.01" />
                  </svg>
                </span>
                <span className="ln-label">Nonprofit Portal</span>
              </button>
            </div>

            <div className="lexis-nav-group">
              <span className="lexis-rail-label">Governance & Data</span>
              
              <button 
                type="button" 
                className="lexis-nav-btn" 
                onClick={() => { setShowImpact(true); setMobileMenuOpen(false); }}
                title="Impact Dashboard"
              >
                <span className="ln-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </span>
                <span className="ln-label">Impact Dashboard</span>
              </button>

              <button 
                type="button" 
                className="lexis-nav-btn" 
                onClick={() => { setShowAdmin(true); setMobileMenuOpen(false); }}
                title="Admin Verification Portal"
              >
                <span className="ln-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </span>
                <span className="ln-label">Admin Verification</span>
              </button>
            </div>
          </nav>

          {/* Recent Centers (LexisGuide 'Recent documents') */}
          <div className="lexis-recent-box">
            <span className="lexis-rail-label">Featured Centers</span>
            <div className="lexis-recent-list">
              {PLACES.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="lexis-recent-item"
                  onClick={() => {
                    setActivePlace(p);
                    setMobileMenuOpen(false);
                  }}
                  title={p.name}
                >
                  <span className="lri-icon">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <span className="lri-title">{p.name}</span>
                  <em className="lri-status">✓</em>
                </button>
              ))}
            </div>
          </div>

          {/* Footer Settings & Language */}
          <div className="lexis-side-foot">
            <button 
              type="button" 
              className="lexis-foot-btn"
              onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
              title={`Switch language (${language === 'en' ? 'Español' : 'English'})`}
            >
              <span className="lfb-icon">🌐</span>
              <span className="lfb-label"><b>{language === 'en' ? 'English' : 'Español'}</b></span>
            </button>
            <button 
              type="button" 
              className="lexis-foot-btn"
              onClick={onNavigateHome}
              title="Return to Landing Page"
            >
              <span className="lfb-icon">←</span>
              <span className="lfb-label">Return to Home</span>
            </button>
          </div>
        </aside>

        {/* Workspace Main View Area */}
        <div className="places-workspace-main">

      {/* Hero / Filter Section */}
      <section className="places-hero-bar">
        <div className="shell-contained">
          <div className="places-title-row">
            <div className="places-title-copy">
              <div className="badge-row">
                <span className="places-badge">National Food Access & Relief Network</span>
                <span className="places-live-count">{filteredPlaces.length} Verified Centers</span>
                {aiMatchIds && (
                  <button type="button" className="ai-match-banner" onClick={() => setAiMatchIds(null)}>
                    Showing {aiMatchIds.length} AI navigator matches · Clear ✕
                  </button>
                )}
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
          onShowMatches={(matches) => {
            // Narrow the list and map to the navigator's matches. Opening one
            // place's detail here would hide the very thing we just revealed.
            setAiMatchIds(matches.map((m) => m.id));
          }}
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
        </div> {/* /.places-workspace-main */}
      </div> {/* /.places-workspace-frame */}
    </div>
  );
}
