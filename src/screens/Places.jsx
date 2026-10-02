import React, { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { PLACES, PLACE_CATEGORIES, DIETARY_OPTIONS, LANGUAGE_OPTIONS, ELIGIBILITY_OPTIONS, getIsOpenNow } from '../data/places.js';
import MapView from '../components/MapView.jsx';
import PlaceDetailModal from '../components/PlaceDetailModal.jsx';
import ReservationModal from '../components/ReservationModal.jsx';
import { currentPosition, discoverPlaces, enrichPlaces, listLocations, listReservations } from '../lib/api.js';
import { isStockImage, placeImage } from '../lib/placeImages.js';
import AiChat from '../components/AiChat.jsx';
import ResidentIntakeModal from '../components/ResidentIntakeModal.jsx';
import NonprofitDashboard from '../components/NonprofitDashboard.jsx';
import VolunteerHub from '../components/VolunteerHub.jsx';
import FoodRescueHub from '../components/FoodRescueHub.jsx';
import CommunityFeed from '../components/CommunityFeed.jsx';
import ImpactDashboard from '../components/ImpactDashboard.jsx';
import AdminPortal from '../components/AdminPortal.jsx';
import AiLauncher from '../components/AiLauncher.jsx';
import { useSectionContext } from '../lib/pageContext.js';
import { parseSearch, SEARCH_EXAMPLES } from '../lib/searchParser.js';

/* Two catalogues describe the same pantry differently, so matching is by
   normalised name plus a ~150m coordinate bucket rather than exact equality. */
const nearKey = (place) => {
  const name = String(place.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${name}@${place.lat.toFixed(3)},${place.lng.toFixed(3)}`;
};

/* The filter drawer opens as one movement: the panel grows to its own height
   while the three groups inside arrive in sequence, so the options read as
   unfolding rather than appearing all at once. */
const DRAWER = { type: 'spring', stiffness: 260, damping: 30, mass: 0.8 };
const DRAWER_ROWS = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };
const DRAWER_ROW = {
  hidden: { opacity: 0, y: -10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 0.9, 0.3, 1] } },
};

export default function Places({ onNavigateHome }) {
  const reduceMotion = useReducedMotion();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // The item someone named is matched against inventory, separately from the
  // place text above: one substring cannot be both a city and a food.
  const [itemQuery, setItemQuery] = useState('');
  // The sentence as typed, and what the parser made of it.
  const [aiQuery, setAiQuery] = useState('');
  const [understood, setUnderstood] = useState([]);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [places, setPlaces] = useState(PLACES);
  const [placesTotal, setPlacesTotal] = useState(PLACES.length);
  const [userPosition, setUserPosition] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [reservationsOnly, setReservationsOnly] = useState(false);
  const [produceOnly, setProduceOnly] = useState(false);
  const [selectedDiet, setSelectedDiet] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedEligibility, setSelectedEligibility] = useState('all');
  const [activePlace, setActivePlace] = useState(null);
  const [placeToReserve, setPlaceToReserve] = useState(null);
  const [mobileTab, setMobileTab] = useState('both');
  const [savedReservations, setSavedReservations] = useState([]);
  const [showMyPasses, setShowMyPasses] = useState(false);
  const [language, setLanguage] = useState('en'); // 'en' | 'es'

  // The navigator is a section of the workspace, not a modal, so a
  // conversation survives opening a place's details beside it.
  const [workspaceView, setWorkspaceView] = useState('directory'); // 'directory' | 'chat'

  // Modals state
  const [showIntake, setShowIntake] = useState(false);
  const [showNonprofit, setShowNonprofit] = useState(false);
  const [showVolunteer, setShowVolunteer] = useState(false);
  const [showRescue, setShowRescue] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);
  const [showImpact, setShowImpact] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  /* Whichever panel is open is what the person is working in; a click inside a
     tagged region refines it further (a place card, the passes drawer). */
  const openPanel = showAdmin ? 'admin'
    : showImpact ? 'impact'
    : showCommunity ? 'community'
    : showRescue ? 'rescue'
    : showVolunteer ? 'volunteer'
    : showNonprofit ? 'nonprofit'
    : showIntake ? 'intake'
    : showMyPasses ? 'passes'
    : placeToReserve ? 'reservation'
    : activePlace ? 'place-detail'
    : 'directory';
  const aiSection = useSectionContext(openPanel);

  useEffect(() => { refreshReservations(); }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Ask for coordinates first: the directory is nationwide, so without a
      // centre the server can only send an arbitrary alphabetical slice. A
      // denied or unavailable position just falls back to that slice.
      const position = await currentPosition();
      if (cancelled) return;

      try {
        const near = position
          ? { ...position, radiusKm: 80, limit: 300 }
          : { limit: 300 };
        const { places: found, total } = await listLocations(near);
        if (cancelled) return;

        // An empty radius is worse than a wider net, so retry nationwide.
        if (position && found.length === 0) {
          const fallback = await listLocations({ limit: 300 });
          if (cancelled) return;
          setPlaces(fallback.places);
          setPlacesTotal(fallback.total);
          setUserPosition(null);
          return;
        }

        setPlaces(found);
        setPlacesTotal(total);
        setUserPosition(position);

        // Then widen to everything Google lists around the visitor. This is
        // fetched live rather than stored, so coverage is near-complete
        // without keeping a copy of Google's catalogue.
        if (position) {
          try {
            const { places: live } = await discoverPlaces({ ...position, radiusM: 25_000 });
            if (cancelled || !live?.length) return;

            // Our own records win on a collision: they carry inventory,
            // languages and reservation windows that a Google pin has not.
            const seen = new Set(found.map((p) => nearKey(p)));
            const additions = live.filter((p) => !seen.has(nearKey(p)));
            if (additions.length) {
              setPlaces([...found, ...additions]);
              setPlacesTotal(total + additions.length);
            }
          } catch {
            // No key, rate limit, or Google down — the stored directory stands.
          }
        }
      } catch {
        // Keep the checked-in demo snapshot visible while a local API is starting.
      }
    })();

    return () => { cancelled = true; };
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

  const resetFilters = () => {
    setSelectedCategory('all');
    setOpenNowOnly(false);
    setReservationsOnly(false);
    setProduceOnly(false);
    setSelectedDiet('all');
    setSelectedLanguage('all');
    setSelectedEligibility('all');
    setSearchQuery('');
    setItemQuery('');
    setUnderstood([]);
    setAiQuery('');
  };

  /* One sentence in, the whole filter set out. The chips it produces are the
     receipt: everything it decided is visible and individually removable, so a
     wrong guess costs one click rather than a confusing result list. */
  const runAiSearch = (text) => {
    const query = (text ?? aiQuery).trim();
    setAiQuery(query);
    if (!query) { resetFilters(); return; }

    const { filters, understood: chips } = parseSearch(query);
    setSelectedCategory(filters.category);
    setOpenNowOnly(filters.openNow);
    setReservationsOnly(filters.reservations);
    setProduceOnly(filters.produce);
    setSelectedDiet(filters.diet);
    setSelectedLanguage(filters.language);
    setSelectedEligibility(filters.eligibility);
    setSearchQuery(filters.where);
    setItemQuery(filters.item);
    setUnderstood(chips);
    setAiMatchIds(null);
  };

  const dropChip = (chip) => {
    ({
      category: () => setSelectedCategory('all'),
      openNow: () => setOpenNowOnly(false),
      reservations: () => setReservationsOnly(false),
      produce: () => setProduceOnly(false),
      diet: () => setSelectedDiet('all'),
      language: () => setSelectedLanguage('all'),
      eligibility: () => setSelectedEligibility('all'),
      where: () => setSearchQuery(''),
      item: () => setItemQuery(''),
    })[chip.key]?.();
    setUnderstood((prev) => prev.filter((item) => item.id !== chip.id));
  };

  const hasAnyFilter = selectedCategory !== 'all' || openNowOnly || reservationsOnly
    || produceOnly || selectedDiet !== 'all' || selectedLanguage !== 'all'
    || selectedEligibility !== 'all' || searchQuery || itemQuery;

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

      // A named item is matched against stock only. Any one of the words is
      // enough: someone asking for "rice and beans" is better served a pantry
      // with one of them than an empty list.
      if (itemQuery.trim()) {
        const words = itemQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const stocked = place.inventory.some((i) => {
          const hay = `${i.item} ${i.category}`.toLowerCase();
          return words.some((word) => hay.includes(word));
        });
        if (!stocked) return false;
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
  }, [places, searchQuery, itemQuery, selectedCategory, openNowOnly, reservationsOnly, produceOnly, selectedDiet, selectedLanguage, selectedEligibility, aiMatchIds]);

  const verifiedCount = useMemo(
    () => filteredPlaces.filter((place) => place.verifiedBadge).length,
    [filteredPlaces],
  );

  /* Real photographs, pulled live from Google for the places actually on
     screen. Google's terms forbid copying their images into our own storage,
     so each one is proxied per request through the API (which also keeps the
     key server-side). Without a key nothing happens and the stock stand-ins
     remain. Only the first screenful is enriched — every lookup is billed. */
  useEffect(() => {
    let cancelled = false;
    const needPhotos = filteredPlaces
      .filter((place) => !place.images?.length && !place.photoUrl)
      .slice(0, 12);
    if (needPhotos.length === 0) return undefined;

    enrichPlaces({
      places: needPhotos.map((place) => ({
        id: place.id,
        name: place.name,
        address: [place.address, place.cityStateZip].filter(Boolean).join(', '),
        lat: place.lat,
        lng: place.lng,
      })),
    })
      .then((body) => {
        if (cancelled || body?.provider === 'none') return;
        const photos = new Map(
          Object.entries(body.enrichment || {})
            .filter(([, info]) => info?.photoUrl)
            .map(([id, info]) => [id, info.photoUrl]),
        );
        if (photos.size === 0) return;
        setPlaces((current) =>
          current.map((place) =>
            photos.has(place.id) ? { ...place, photoUrl: photos.get(place.id) } : place,
          ),
        );
      })
      .catch(() => {
        // No key, rate limit, or Google down — stand-in images stay.
      });

    return () => { cancelled = true; };
  }, [filteredPlaces]);

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
            <button
              type="button"
              className={`quick-hub-pill ai-hub-pill${workspaceView === 'chat' ? ' is-active' : ''}`}
              onClick={() => setWorkspaceView('chat')}
            >
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
            className={`lexis-new-btn${workspaceView === 'chat' ? ' is-active' : ''}`}
            onClick={() => { setWorkspaceView('chat'); setMobileMenuOpen(false); }}
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
                className={`lexis-nav-btn${workspaceView === 'directory' ? ' is-active' : ''}`}
                onClick={() => { setWorkspaceView('directory'); setMobileMenuOpen(false); }}
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

      {workspaceView === 'chat' ? (
        /* The navigator, as a full section of the workspace rather than a
           modal, so the thread stays put while places open beside it. */
        <section className="ai-chat-section">
          <AiChat
            variant="section"
            onSelectPlace={(place) => setActivePlace(place)}
            onShowMatches={(matches) => {
              // Narrow the directory to the navigator's matches and show them.
              setAiMatchIds(matches.map((match) => match.id));
              setWorkspaceView('directory');
            }}
          />
        </section>
      ) : (
      <>
      {/* Hero / Filter Section */}
      <section className="places-hero-bar" data-ai-section="directory">
        <div className="shell-contained">
          <div className="places-title-row">
            <div className="places-title-copy">
              <div className="badge-row">
                <span className="places-badge">National Food Access & Relief Network</span>
                {/* Only staff-verified records may claim verification. OSM
                    places are community-mapped, so the count is neutral and
                    the verified subset is called out separately. */}
                <span className="places-live-count">
                  {filteredPlaces.length} Location{filteredPlaces.length === 1 ? '' : 's'}
                  {userPosition && ' near you'}
                  {placesTotal > places.length && ` · ${placesTotal.toLocaleString()} nationwide`}
                  {verifiedCount > 0 && ` · ${verifiedCount} verified`}
                </span>
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
                onClick={() => setWorkspaceView('chat')}
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
            </div>
          </div>

          {/* One sentence replaces the search field, the city pills, the
              category pills, three dropdowns and three checkboxes. Those
              controls still exist, folded away below for anyone who would
              rather browse the options than describe what they need. */}
          <div className="places-filter-card">
            <form
              className="ai-search-row"
              onSubmit={(e) => { e.preventDefault(); runAiSearch(); }}
            >
              <span className="ai-search-spark" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9Z" />
                  <path d="M19 15l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9Z" opacity=".55" />
                </svg>
              </span>
              <input
                type="text"
                className="ai-search-field"
                placeholder="Describe what you need — “hot meals near me tonight, no ID”"
                aria-label="Describe what food help you need"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
              />
              {aiQuery && (
                <button type="button" className="ai-search-clear" onClick={resetFilters} aria-label="Clear search">×</button>
              )}
              <button type="submit" className="ai-search-go">Search</button>
            </form>

            {understood.length > 0 ? (
              <div className="ai-search-understood">
                <span className="ai-understood-label">Searching for</span>
                <ul>
                  {understood.map((chip) => (
                    <li key={chip.id}>
                      <button
                        type="button"
                        className="ai-understood-chip"
                        onClick={() => dropChip(chip)}
                        title={`Remove ${chip.label}`}
                        aria-label={`Remove ${chip.label}`}
                      >
                        {chip.label}<i aria-hidden="true">×</i>
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="ai-understood-reset" onClick={resetFilters}>Clear all</button>
              </div>
            ) : (
              <div className="ai-search-examples">
                <span className="ai-understood-label">Try</span>
                {SEARCH_EXAMPLES.slice(0, 3).map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="ai-example-chip"
                    onClick={() => runAiSearch(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              className={`ai-filters-toggle${showAllFilters ? ' is-open' : ''}`}
              aria-expanded={showAllFilters}
              onClick={() => setShowAllFilters((open) => !open)}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
              {showAllFilters ? 'Hide all filters' : 'Browse all filters'}
            </button>

            <AnimatePresence initial={false}>
            {showAllFilters && (
            <motion.div
              className="ai-filters-panel"
              key="all-filters"
              initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={reduceMotion ? { duration: 0.12 } : DRAWER}
            >
            <motion.div
              className="ai-filters-inner"
              variants={DRAWER_ROWS}
              initial={reduceMotion ? false : 'hidden'}
              animate="show"
            >
            {/* Category scroll pills */}
            <motion.div className="category-scroll-strip" variants={DRAWER_ROW}>
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
            </motion.div>

            {/* Secondary Advanced Filters Dropdowns */}
            <motion.div className="advanced-filter-row" variants={DRAWER_ROW}>
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
            </motion.div>

            {/* Quick check toggles */}
            <motion.div className="toggle-filters-row" variants={DRAWER_ROW}>
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

              {hasAnyFilter && (
                <button type="button" className="reset-filters-btn" onClick={resetFilters}>
                  ✕ Reset filters
                </button>
              )}
            </motion.div>
            </motion.div>
            </motion.div>
            )}
            </AnimatePresence>
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
      <main className="places-main-content shell-contained" data-ai-section="directory">
        <div className="places-split-layout">
          {/* List Panel */}
          <div className={`places-cards-column ${mobileTab === 'map' ? 'mobile-hidden' : ''}`}>
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
                      <div className="card-thumb-wrap">
                        {/* Google photo when the listing has one, otherwise a
                            stable stock image that is labelled as such — a
                            photo of a different building would mislead. */}
                        <img
                          src={placeImage(place, 640)}
                          alt=""
                          className="card-thumb-img"
                          loading="lazy"
                        />
                        {isStockImage(place) && (
                          <span className="card-stock-note" title="Generic photo — this location has no photo of its own">
                            Stock photo
                          </span>
                        )}
                        {/* Without hours we cannot claim open or closed. */}
                        {place.hoursKnown !== false && (
                          <span className={`status-badge-float ${openStatus.isOpen ? 'is-open' : 'is-closed'}`}>
                            {openStatus.isOpen ? '🟢 Open Now' : '🔴 Closed'}
                          </span>
                        )}
                        <span className="type-badge-float">{place.typeLabel.split(' ')[0]}</span>
                      </div>

                      <div className="card-info-wrap">
                        <div className="card-top-row">
                          <span className="card-neighborhood">
                            {[place.city, place.state].filter(Boolean).join(', ')}
                            {place.neighborhood ? ` (${place.neighborhood})` : ''}
                            {typeof place.distanceMiles === 'number' && ` · ${place.distanceMiles} mi`}
                          </span>
                          {place.verifiedBadge ? (
                            <span className="card-verified">✓ {place.verifiedDate}</span>
                          ) : (
                            <span className="card-unverified" title="Community-mapped from OpenStreetMap, not staff-verified">
                              Community listing
                            </span>
                          )}
                        </div>

                        <h3 className="card-name" onClick={() => setActivePlace(place)}>
                          {place.name}
                        </h3>

                        <p className="card-address">
                          📍 {[place.address, place.cityStateZip].filter(Boolean).join(', ') || 'Address not listed'}
                        </p>
                        <p className="card-hours">⏱ {place.hoursSummary}</p>

                        {/* Call ahead warning if present */}
                        {place.callAheadWarning && (
                          <div className="card-warning-pill">
                            ⚠️ <b>Call ahead:</b> {place.callAheadNote || 'Capacity changes rapidly.'}
                          </div>
                        )}

                        {/* Only shown when stock is actually reported — an
                            empty "Available inventory" reads as "nothing here". */}
                        {place.inventory?.length > 0 && (
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
                        )}

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

        {/* ODbL requires attribution wherever the data is shown, and saying
            where a listing came from is also how someone judges it. */}
        {places.some((place) => place.dataSource === 'openstreetmap') && (
          <p className="places-attribution">
            Community listings come from{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">
              OpenStreetMap
            </a>{' '}
            contributors, licensed under ODbL. They are mapped by volunteers rather than
            confirmed by staff — call ahead before you travel.
          </p>
        )}
      </main>
      </>
      )}

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
        <div className="modal-backdrop" data-ai-section="passes" onClick={() => setShowMyPasses(false)}>
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

        {/* The navigator, floating over whichever panel is open. Hidden while
            the workspace is already showing the full conversation. */}
        <AiLauncher
          sectionId={aiSection}
          hidden={workspaceView === 'chat'}
          onSelectPlace={(place) => setActivePlace(place)}
          onShowMatches={(matches) => {
            setAiMatchIds(matches.map((match) => match.id));
            setWorkspaceView('directory');
          }}
        />
      </div> {/* /.places-workspace-frame */}
    </div>
  );
}
