import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { PLACES, PLACE_CATEGORIES, DIETARY_OPTIONS, LANGUAGE_OPTIONS, ELIGIBILITY_OPTIONS, getIsOpenNow } from '../data/places.js';
import MapView from '../components/MapView.jsx';
import PlaceDetailModal from '../components/PlaceDetailModal.jsx';
import ReservationModal from '../components/ReservationModal.jsx';
import { askHarvestLink, currentPosition, discoverPlaces, enrichPlaces, listLocations, listReservations } from '../lib/api.js';
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
import ExpandingSearchDock from '../components/ExpandingSearchDock.jsx';
import { useSectionContext } from '../lib/pageContext.js';
import { parseSearch, SEARCH_EXAMPLES } from '../lib/searchParser.js';
import { suggestPlaces, mergeNavigatorPicks } from '../lib/suggestPlaces.js';
import { appHash } from '../lib/routes.js';

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

function AnimatedFilterMenu({ id, label, allLabel, options, value, onChange, openMenu, setOpenMenu, reduceMotion }) {
  const isOpen = openMenu === id;
  const selectedLabel = value === 'all' ? allLabel : value;

  return (
    <div
      className={`adv-filter-group${isOpen ? ' is-open' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpenMenu(null);
      }}
    >
      <span className="adv-filter-label">{label}</span>
      <button
        type="button"
        className="adv-filter-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setOpenMenu(isOpen ? null : id)}
      >
        <span>{selectedLabel}</span>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="adv-filter-menu"
            role="listbox"
            aria-label={label}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -5, scale: 0.98 }}
            transition={reduceMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 360, damping: 28, mass: 0.7 }}
          >
            {[{ value: 'all', label: allLabel }, ...options.map((option) => ({ value: option, label: option }))].map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={value === option.value}
                className={`adv-filter-option${value === option.value ? ' is-selected' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { onChange(option.value); setOpenMenu(null); }}
              >
                {option.label}
                {value === option.value && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* The "What do you need?" row.

   Every chip reads a field the place model already has — nothing here is
   invented, and nothing new is stored. `facet` is what makes multi-select
   behave: chips in the same facet are OR'd (a place can only be one kind, so
   Groceries + Hot meal has to mean "either"), and the facets are AND'd
   together (hot meal AND open today AND delivers). Picking two chips can
   therefore never produce the dead end that a flat AND would.

   `Food today` also accepts Google's own open-now line, because a discovered
   place carries that string but no weeklyHours, and excluding a pantry that is
   open right now purely because we hold its hours in a different shape would
   be the wrong failure. The other stock-dependent chips cannot be judged for
   those places and so do not match them — see the note under the row. */
const NEED_FILTERS = [
  {
    id: 'today', label: 'Food today', facet: 'when',
    test: (place) => getIsOpenNow(place).isOpen || /open now/i.test(place.hoursSummary || ''),
  },
  {
    id: 'groceries', label: 'Groceries', facet: 'kind',
    test: (place) => place.type === 'food-bank' || place.type === 'pantry',
  },
  { id: 'hot-meal', label: 'Hot meal', facet: 'kind', test: (place) => place.type === 'hot-meal' },
  { id: 'mobile', label: 'Mobile pantry', facet: 'kind', test: (place) => place.type === 'mobile' },
  { id: 'produce', label: 'Fresh produce', facet: 'stock', test: (place) => place.hasFreshProduce === true },
  {
    id: 'baby', label: 'Baby food / formula', facet: 'stock',
    test: (place) => (place.dietary || []).includes('Baby Formula / Infant Food')
      || (place.inventory || []).some((item) => /baby|infant|formula/i.test(`${item.category} ${item.item}`)),
  },
  {
    id: 'delivery', label: 'Delivery', facet: 'access',
    test: (place) => (place.eligibilityTags || []).includes('Home Delivery Available')
      || (place.services || []).some((service) => /deliver/i.test(service)),
  },
];

const NEED_BY_ID = Object.fromEntries(NEED_FILTERS.map((need) => [need.id, need]));

/* Selected chips, grouped into their facets, then OR within / AND across. */
const matchesNeeds = (place, selected) => {
  if (selected.length === 0) return true;
  const facets = {};
  selected.forEach((id) => {
    const need = NEED_BY_ID[id];
    if (need) (facets[need.facet] ||= []).push(need);
  });
  return Object.values(facets).every((group) => group.some((need) => need.test(place)));
};

/* How long the top bar stays down once the pointer has left it. Long enough to
   cross the gap between the bar and a control just under it, short enough that
   it is gone again before anyone wonders why. */
const TOPBAR_HOLD_MS = 1400;

/* Workspace sections live in the URL hash. That keeps them linkable and
   reload-safe on static GitHub Pages hosting. */
const WORKSPACE_PATHS = {
  directory: appHash('places'),
  chat: appHash('places/navigator'),
  plan: appHash('places/plan'),
  community: appHash('places/community'),
  volunteer: appHash('places/volunteer'),
  rescue: appHash('places/rescue'),
  nonprofit: appHash('places/nonprofit'),
};

const workspaceFromPath = () => {
  const path = window.location.hash.replace(/\/+$/, '') || WORKSPACE_PATHS.directory;
  return Object.keys(WORKSPACE_PATHS).find(
    (view) => view !== 'directory' && WORKSPACE_PATHS[view] === path,
  ) || 'directory';
};

export default function Places({ onNavigateHome, initialPanel = null, onPanelOpened }) {
  const reduceMotion = useReducedMotion();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // The item someone named is matched against inventory, separately from the
  // place text above: one substring cannot be both a city and a food.
  const [itemQuery, setItemQuery] = useState('');
  // The quick-need chips, by id. Empty means the default behaviour, unchanged.
  const [needs, setNeeds] = useState([]);
  // The sentence as typed, and what the parser made of it.
  const [aiQuery, setAiQuery] = useState('');
  const [understood, setUnderstood] = useState([]);
  /* The suggestions under the bar, and which one the arrow keys are on. The
     list itself is derived from what has been typed; only its openness and the
     highlight are state, so a keystroke can never show a stale list. */
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  /* What the hosted navigator added to the local ranking, keyed by the exact
     sentence it answered, so a backspace-and-retype does not re-ask it. */
  const [navigatorPicks, setNavigatorPicks] = useState({ query: '', placeIds: [], note: '' });
  const [navigatorThinking, setNavigatorThinking] = useState(false);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [places, setPlaces] = useState(PLACES);
  const [placesTotal, setPlacesTotal] = useState(PLACES.length);
  const [userPosition, setUserPosition] = useState(null);
  const [googlePlacesConsent, setGooglePlacesConsent] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [reservationsOnly, setReservationsOnly] = useState(false);
  const [produceOnly, setProduceOnly] = useState(false);
  const [selectedDiet, setSelectedDiet] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedEligibility, setSelectedEligibility] = useState('all');
  const [openAdvancedFilter, setOpenAdvancedFilter] = useState(null);
  const [activePlace, setActivePlace] = useState(null);
  const [placeToReserve, setPlaceToReserve] = useState(null);
  const [mobileTab, setMobileTab] = useState('both');
  const [savedReservations, setSavedReservations] = useState([]);
  const [showMyPasses, setShowMyPasses] = useState(false);
  const [language, setLanguage] = useState('en'); // 'en' | 'es'

  /* The navigator, the personalized plan and the community feed are sections of
     the workspace rather than modals, so a conversation or a half-filled intake
     survives opening a place's details beside it — and each one has a URL that
     can be linked to and reloaded. */
  // 'directory' | 'chat' | 'plan' | 'community' | 'volunteer' | 'rescue' | 'nonprofit'
  const [workspaceView, setWorkspaceView] = useState(workspaceFromPath);

  const showWorkspace = useCallback((view) => {
    setWorkspaceView(view);
    const path = WORKSPACE_PATHS[view] || WORKSPACE_PATHS.directory;
    if (window.location.hash !== path) window.history.pushState(null, '', path);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Back and forward move between the workspace pages, not just off the page.
  useEffect(() => {
    const onPopState = () => setWorkspaceView(workspaceFromPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  /* The top bar is out of the way until it is wanted: it rides up off the
     screen and slides back down when the pointer reaches the top edge, then
     retracts on its own once nothing is pointing at it. Only on devices that
     can hover — on a touch screen there is no way to ask for it back, so there
     the bar stays where it has always been. */
  const [topbarHoverable, setTopbarHoverable] = useState(false);
  const [topbarOpen, setTopbarOpen] = useState(false);
  const topbarTimer = useRef(null);
  // When the hosted navigator may be asked again after it pushed back.
  const navigatorCooldown = useRef(0);
  const askBarRef = useRef(null);

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setTopbarHoverable(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => () => clearTimeout(topbarTimer.current), []);

  const holdTopbar = useCallback(() => {
    clearTimeout(topbarTimer.current);
    setTopbarOpen(true);
  }, []);

  /* Focus leaving the bar and the pointer leaving it both run this, so tabbing
     through the search dock keeps the bar down for as long as it is in use. */
  const releaseTopbar = useCallback(() => {
    clearTimeout(topbarTimer.current);
    topbarTimer.current = setTimeout(() => setTopbarOpen(false), TOPBAR_HOLD_MS);
  }, []);

  // Modals state
  const [showImpact, setShowImpact] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  /* Whichever panel is open is what the person is working in; a click inside a
     tagged region refines it further (a place card, the passes drawer). */
  const openPanel = showAdmin ? 'admin'
    : showImpact ? 'impact'
    : showMyPasses ? 'passes'
    : placeToReserve ? 'reservation'
    : activePlace ? 'place-detail'
    : workspaceView === 'nonprofit' ? 'nonprofit'
    : workspaceView === 'volunteer' ? 'volunteer'
    : workspaceView === 'community' ? 'community'
    : workspaceView === 'plan' ? 'intake'
    : WORKSPACE_PATHS[workspaceView] ? workspaceView
    : 'directory';
  const aiSection = useSectionContext(openPanel);

  /* Arriving from a search result that named a panel: open it, then tell the
     app so a later visit here does not reopen it unasked. */
  const openWorkspacePanel = useCallback((panel) => {
    ({
      directory: () => showWorkspace('directory'),
      intake: () => showWorkspace('plan'),
      community: () => showWorkspace('community'),
      volunteer: () => showWorkspace('volunteer'),
      rescue: () => showWorkspace('rescue'),
      nonprofit: () => showWorkspace('nonprofit'),
      impact: () => setShowImpact(true),
      admin: () => setShowAdmin(true),
    })[panel]?.();
  }, [showWorkspace]);

  useEffect(() => {
    if (!initialPanel) return;
    openWorkspacePanel(initialPanel);
    onPanelOpened?.();
  }, [initialPanel, onPanelOpened, openWorkspacePanel]);

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

      } catch {
        // Keep the checked-in demo snapshot visible while a local API is starting.
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!googlePlacesConsent || !userPosition) return undefined;

    // Google Places receives precise coordinates only after this dedicated
    // choice. The built-in directory remains available without it.
    discoverPlaces({ ...userPosition, radiusM: 25_000, googlePlacesConsent: true })
      .then(({ places: live }) => {
        if (cancelled || !live?.length) return;
        setPlaces((current) => {
          const seen = new Set(current.map((place) => nearKey(place)));
          const additions = live.filter((place) => !seen.has(nearKey(place)));
          if (additions.length === 0) return current;
          setPlacesTotal((total) => total + additions.length);
          return [...current, ...additions];
        });
      })
      .catch(() => {
        // No key, rate limit, or Google down — the stored directory stands.
      });
    return () => { cancelled = true; };
  }, [googlePlacesConsent, userPosition]);


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
    setNeeds([]);
  };

  /* The places the half-typed sentence already points at. Derived, not stored,
     and computed offline — it is on screen by the next frame, with or without
     a network. */
  const localSuggestions = useMemo(
    () => suggestPlaces(aiQuery, places, { origin: userPosition, limit: 6 }),
    [aiQuery, places, userPosition],
  );

  /* The hosted navigator reads the same sentence and may name places the rules
     above cannot reach. It is strictly an addition: the list is already on
     screen before this is asked, and stays if it never answers.

     It is asked sparingly and on purpose. The server allows a handful of AI
     requests a minute for the whole network, which a per-keystroke typeahead
     would spend in seconds — so it waits for a real pause, wants a sentence
     rather than a word, asks each sentence once, and stops asking for a while
     if the server pushes back. */
  useEffect(() => {
    const query = aiQuery.trim();
    if (!suggestOpen || query.length < 12 || !query.includes(' ')) return undefined;
    if (navigatorPicks.query === query) return undefined;
    if (Date.now() < navigatorCooldown.current) return undefined;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setNavigatorThinking(true);
      try {
        const answer = await askHarvestLink({
          message: query,
          history: [],
          // The navigator may only name places it was shown, so the catalog is
          // the directory as it stands — the same records on screen.
          catalog: places.slice(0, 60).map((place) => ({
            id: place.id,
            name: place.name,
            address: `${place.address}, ${place.cityStateZip}`,
            city: place.city,
            services: place.services || [],
            dietary: place.dietary || [],
            hours: place.hoursSummary,
            reservations: Boolean(place.acceptsReservations),
          })),
          memory: [],
          context: 'The resident is typing into the directory search bar and wants matching places, not a conversation.',
          residentProfile: null,
          bedrockProfileConsent: false,
        });
        if (cancelled) return;
        setNavigatorPicks({
          query,
          placeIds: (answer.placeIds || []).filter((id) => places.some((place) => place.id === id)),
          note: answer.reply || '',
        });
      } catch {
        if (cancelled) return;
        /* Out of requests, no key, or offline. The local ranking is already
           the answer; back off so a long sentence cannot keep retrying. */
        navigatorCooldown.current = Date.now() + 60_000;
        setNavigatorPicks({ query, placeIds: [], note: '' });
      } finally {
        if (!cancelled) setNavigatorThinking(false);
      }
    }, 700);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [aiQuery, suggestOpen, places, navigatorPicks.query]);

  /* What is actually offered: the local ranking, with the navigator's picks
     lifted to the top once they arrive for this exact sentence. */
  const suggestions = useMemo(() => (
    navigatorPicks.query === aiQuery.trim()
      ? mergeNavigatorPicks(localSuggestions, navigatorPicks.placeIds, places, { origin: userPosition, limit: 6 })
      : localSuggestions
  ), [localSuggestions, navigatorPicks, aiQuery, places, userPosition]);

  const typedChips = useMemo(
    () => (aiQuery.trim().length >= 3 ? parseSearch(aiQuery).understood : []),
    [aiQuery],
  );

  const closeSuggestions = useCallback(() => {
    setSuggestOpen(false);
    setActiveSuggestion(-1);
  }, []);

  /* Choosing a suggestion is choosing a place, not a search: it opens that
     place rather than rearranging the directory behind it. */
  const chooseSuggestion = useCallback((entry) => {
    if (!entry) return;
    closeSuggestions();
    setActivePlace(entry.place);
  }, [closeSuggestions]);

  const onAskBarKeyDown = (event) => {
    if (event.key === 'Escape') { closeSuggestions(); return; }
    if (!suggestOpen || suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestion((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Enter' && activeSuggestion >= 0) {
      // Enter on a highlighted suggestion opens it; Enter on the sentence
      // itself still runs the search, which is what the form does.
      event.preventDefault();
      chooseSuggestion(suggestions[activeSuggestion]);
    }
  };

  /* One sentence in, the whole filter set out. The chips it produces are the
     receipt: everything it decided is visible and individually removable, so a
     wrong guess costs one click rather than a confusing result list. */
  const runAiSearch = (text) => {
    const query = (text ?? aiQuery).trim();
    setAiQuery(query);
    closeSuggestions();
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
    || selectedEligibility !== 'all' || searchQuery || itemQuery || needs.length > 0;

  const filteredPlaces = useMemo(() => {
    return places.filter((place) => {
      // A match set handed over by the AI navigator overrides the filters,
      // so "show all on the main map" lands on exactly what it recommended.
      if (aiMatchIds && !aiMatchIds.includes(place.id)) {
        return false;
      }

      // The quick-need chips, in the same pass as every other filter so the
      // map and the list cannot disagree.
      if (!matchesNeeds(place, needs)) return false;
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
  }, [places, needs, searchQuery, itemQuery, selectedCategory, openNowOnly, reservationsOnly, produceOnly, selectedDiet, selectedLanguage, selectedEligibility, aiMatchIds]);

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
    <div className={`places-workspace ${sidebarCollapsed ? 'is-collapsed' : ''} ${mobileMenuOpen ? 'has-mobile-drawer' : ''} ${topbarHoverable ? 'has-floating-topbar' : ''}`}>
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true" 
        />
      )}

      {/* The strip of screen that calls the bar back down. */}
      {topbarHoverable && (
        <div
          className="topbar-hover-zone"
          aria-hidden="true"
          onMouseEnter={holdTopbar}
          onMouseLeave={releaseTopbar}
        />
      )}

      {/* Top Header Bar */}
      <header
        className={`places-topbar${topbarHoverable ? ' is-auto-hide' : ''}${topbarHoverable && topbarOpen ? ' is-revealed' : ''}`}
        onMouseEnter={holdTopbar}
        onMouseLeave={releaseTopbar}
        onFocus={holdTopbar}
        onBlur={releaseTopbar}
      >
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

            {/* The same search, beside the same name. Here a workspace result
                opens its panel directly; a landing section sends them home. */}
            <ExpandingSearchDock
              expandedWidth={420}
              context="workspace"
              placeholder="Search sections, places, help…"
              onScrollTo={(section) => onNavigateHome(section)}
              onOpenWorkspace={(panel) => { openWorkspacePanel(panel); setMobileMenuOpen(false); }}
            />
          </div>

          {/* The centre hub pills are gone: every one of them — Ask AI, Food
              Plan, Volunteers, Food Rescue, Impact — is already in the left
              sidebar and in the search dock, and they were taking the width
              the search bar needed. */}

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
            onClick={() => { showWorkspace('chat'); setMobileMenuOpen(false); }}
            title="Ask the Navigator"
          >
            <span className="lexis-new-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 0 1 4 4v1a2 2 0 0 1 2 2v7a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V9a2 2 0 0 1 2-2V6a4 4 0 0 1 4-4z" />
                <circle cx="9" cy="13" r="1" fill="currentColor" />
                <circle cx="15" cy="13" r="1" fill="currentColor" />
                <line x1="10" y1="17" x2="14" y2="17" />
              </svg>
            </span>
            <span className="lexis-btn-label">Ask the Navigator</span>
          </button>

          {/* Navigation Groups */}
          <nav className="lexis-nav">
            <div className="lexis-nav-group">
              <span className="lexis-rail-label">Resident Navigators</span>
              
              <button 
                type="button" 
                className={`lexis-nav-btn${workspaceView === 'directory' ? ' is-active' : ''}`}
                onClick={() => { showWorkspace('directory'); setMobileMenuOpen(false); }}
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
                className={`lexis-nav-btn${workspaceView === 'plan' ? ' is-active' : ''}`}
                onClick={() => { showWorkspace('plan'); setMobileMenuOpen(false); }}
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
                className={`lexis-nav-btn${workspaceView === 'community' ? ' is-active' : ''}`}
                onClick={() => { showWorkspace('community'); setMobileMenuOpen(false); }}
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
                className={`lexis-nav-btn${workspaceView === 'volunteer' ? ' is-active' : ''}`}
                onClick={() => { showWorkspace('volunteer'); setMobileMenuOpen(false); }}
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
                <em className="ln-badge">5 open</em>
              </button>

              <button 
                type="button" 
                className={`lexis-nav-btn${workspaceView === 'rescue' ? ' is-active' : ''}`}
                onClick={() => { showWorkspace('rescue'); setMobileMenuOpen(false); }}
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
                className={`lexis-nav-btn${workspaceView === 'nonprofit' ? ' is-active' : ''}`}
                onClick={() => { showWorkspace('nonprofit'); setMobileMenuOpen(false); }}
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

      {workspaceView === 'plan' ? (
        /* The personalized plan, as its own page of the workspace. */
        <section className="workspace-page" aria-label="Personalized food plan">
          <ResidentIntakeModal
            variant="page"
            lang={language}
            onSelectPlace={(place) => setActivePlace(place)}
          />
        </section>
      ) : workspaceView === 'community' ? (
        /* The community feed, as its own page of the workspace. */
        <section className="workspace-page" aria-label="Community feed">
          <CommunityFeed
            variant="page"
            onOpenReport={() => alert('Report submitted to directory administrators for verification.')}
          />
        </section>
      ) : workspaceView === 'volunteer' ? (
        /* The volunteer hub, as its own page of the workspace. */
        <section className="workspace-page" aria-label="Volunteer Hub">
          <VolunteerHub
            variant="page"
            onSelectPlace={(place) => {
              setActivePlace(place);
              showWorkspace('directory');
            }}
          />
        </section>
      ) : workspaceView === 'rescue' ? (
        <section className="workspace-page" aria-label="Food rescue dispatch">
          <FoodRescueHub variant="page" />
        </section>
      ) : workspaceView === 'nonprofit' ? (
        /* The nonprofit portal, as its own page of the workspace. */
        <section className="workspace-page" aria-label="Nonprofit Portal">
          <NonprofitDashboard
            variant="page"
            onSelectPlace={(place) => {
              setActivePlace(place);
              showWorkspace('directory');
            }}
          />
        </section>
      ) : workspaceView === 'chat' ? (
        /* The navigator, as a full section of the workspace rather than a
           modal, so the thread stays put while places open beside it. */
        <section className="ai-chat-section">
          <AiChat
            variant="section"
            onSelectPlace={(place) => setActivePlace(place)}
            onShowMatches={(matches) => {
              // Narrow the directory to the navigator's matches and show them.
              setAiMatchIds(matches.map((match) => match.id));
              showWorkspace('directory');
            }}
            onOpenRescue={() => showWorkspace('rescue')}
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
                <span className="places-badge">San Francisco &amp; Greater Bay Area Food Relief Network</span>
                {/* Only staff-verified records may claim verification. OSM
                    places are community-mapped, so the count is neutral and
                    the verified subset is called out separately. */}
                <span className="places-live-count">
                  {filteredPlaces.length} Location{filteredPlaces.length === 1 ? '' : 's'}
                  {userPosition && ' near you'}
                  {placesTotal > places.length && ` · ${placesTotal.toLocaleString()} in Bay Area`}
                  {verifiedCount > 0 && ` · ${verifiedCount} verified`}
                </span>
                {aiMatchIds && (
                  <button type="button" className="ai-match-banner" onClick={() => setAiMatchIds(null)}>
                    Showing {aiMatchIds.length} AI navigator matches · Clear ✕
                  </button>
                )}
              </div>
              <h1 className="places-heading">Food Assistance Directory &amp; Real-Time Map</h1>
              <p className="places-sub">
                Explore verified food banks, neighborhood pantries, hot meal sites, and mobile rescue distributions across San Francisco, Fremont, San Jose, Oakland, and surrounding Bay Area communities. 
                100% free, confidential, and zero paperwork required.
              </p>
            </div>
          </div>

          {/* One sentence replaces the search field, the city pills, the
              category pills, three dropdowns and three checkboxes. Those
              controls still exist, folded away below for anyone who would
              rather browse the options than describe what they need. */}
          <div className="places-filter-card">
            {/* The quickest way in: one tap, before anyone has to describe
                anything. Reuses the directory's own .category-pill. */}
            <div className="need-row">
              <span className="need-row-label" id="need-row-label">What do you need?</span>
              <div className="need-chips" role="group" aria-labelledby="need-row-label">
                {NEED_FILTERS.map((need) => {
                  const on = needs.includes(need.id);
                  return (
                    <button
                      key={need.id}
                      type="button"
                      className={`category-pill need-chip${on ? ' is-active' : ''}`}
                      aria-pressed={on}
                      onClick={() => setNeeds((prev) => (on
                        ? prev.filter((id) => id !== need.id)
                        : [...prev, need.id]))}
                    >
                      {need.label}
                    </button>
                  );
                })}
              </div>
              {needs.length > 0 && (
                <button type="button" className="need-clear" onClick={() => setNeeds([])}>
                  Clear
                </button>
              )}
            </div>

            <div
              className="ai-search-dock"
              ref={askBarRef}
              onBlur={(event) => {
                // Only a focus that left the bar entirely closes the panel, or
                // clicking a suggestion would dismiss it before it registered.
                if (!event.currentTarget.contains(event.relatedTarget)) closeSuggestions();
              }}
            >
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
                onChange={(e) => {
                  setAiQuery(e.target.value);
                  setSuggestOpen(true);
                  setActiveSuggestion(-1);
                }}
                onFocus={() => setSuggestOpen(true)}
                onKeyDown={onAskBarKeyDown}
                role="combobox"
                aria-expanded={suggestOpen && suggestions.length > 0}
                aria-controls="ai-search-suggestions"
                aria-autocomplete="list"
                aria-activedescendant={activeSuggestion >= 0 ? `ai-suggestion-${activeSuggestion}` : undefined}
                autoComplete="off"
              />
              {aiQuery && (
                <button type="button" className="ai-search-clear" onClick={resetFilters} aria-label="Clear search">×</button>
              )}
              <button type="submit" className="ai-search-go">Search</button>
            </form>

            {/* What the bar has made of the sentence so far: the places it can
                already name, each saying why. */}
            {suggestOpen && (suggestions.length > 0 || navigatorThinking) && (
              <div className="ai-suggest-panel" id="ai-search-suggestions" role="listbox" aria-label="Suggested places">
                <div className="ai-suggest-head">
                  <span className="ai-suggest-title">
                    {suggestions.length > 0
                      ? `${suggestions.length} place${suggestions.length === 1 ? '' : 's'} match what you typed`
                      : 'Reading what you typed…'}
                  </span>
                  {typedChips.length > 0 && (
                    <span className="ai-suggest-reading">
                      {typedChips.map((chip) => chip.label).join(' · ')}
                    </span>
                  )}
                </div>

                <ul className="ai-suggest-list">
                  {suggestions.map((entry, index) => (
                    <li key={entry.place.id}>
                      <button
                        type="button"
                        id={`ai-suggestion-${index}`}
                        role="option"
                        aria-selected={index === activeSuggestion}
                        className={`ai-suggest-item${index === activeSuggestion ? ' is-active' : ''}`}
                        onMouseEnter={() => setActiveSuggestion(index)}
                        onClick={() => chooseSuggestion(entry)}
                      >
                        <span className="asi-main">
                          <b className="asi-name">{entry.place.name}</b>
                          <span className="asi-where">{entry.place.cityStateZip}</span>
                        </span>
                        <span className="asi-reasons">
                          {entry.fromNavigator && <em className="asi-pick">Navigator pick</em>}
                          {entry.reasons.map((reason) => (
                            <em key={reason} className={reason === 'Open now' ? 'asi-reason is-open' : 'asi-reason'}>
                              {reason}
                            </em>
                          ))}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="ai-suggest-foot">
                  <button
                    type="button"
                    className="ai-suggest-all"
                    onClick={() => runAiSearch()}
                  >
                    Search the whole directory for “{aiQuery.trim()}”
                  </button>
                  {navigatorThinking && <span className="ai-suggest-thinking">Navigator is reading your sentence…</span>}
                </div>
              </div>
            )}
            </div>

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
              <AnimatedFilterMenu
                id="diet" label="🥗 Dietary Accommodations" allLabel="All Dietary Types (Vegetarian, Halal, etc.)"
                options={DIETARY_OPTIONS} value={selectedDiet} onChange={setSelectedDiet}
                openMenu={openAdvancedFilter} setOpenMenu={setOpenAdvancedFilter} reduceMotion={reduceMotion}
              />
              <AnimatedFilterMenu
                id="language" label="🗣 Languages Spoken" allLabel="All Languages Spoken"
                options={LANGUAGE_OPTIONS} value={selectedLanguage} onChange={setSelectedLanguage}
                openMenu={openAdvancedFilter} setOpenMenu={setOpenAdvancedFilter} reduceMotion={reduceMotion}
              />
              <AnimatedFilterMenu
                id="eligibility" label="🛡 Access & Eligibility" allLabel="All Eligibility Rules (No ID, Walk-in)"
                options={ELIGIBILITY_OPTIONS} value={selectedEligibility} onChange={setSelectedEligibility}
                openMenu={openAdvancedFilter} setOpenMenu={setOpenAdvancedFilter} reduceMotion={reduceMotion}
              />
            </motion.div>

            {/* Quick check toggles */}
            <motion.div className="toggle-filters-row" variants={DRAWER_ROW}>
              <label className="toggle-filter-label google-places-consent">
                <input
                  type="checkbox"
                  checked={googlePlacesConsent}
                  onChange={(event) => setGooglePlacesConsent(event.target.checked)}
                />
                <span className="toggle-text">📍 <b>Use my location with Google Places</b><small> Google receives precise coordinates to find additional nearby resources.</small></span>
              </label>

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
                <p>
                  {needs.length > 0
                    ? `Nothing nearby matches ${needs.map((id) => NEED_BY_ID[id]?.label).filter(Boolean).join(' + ')}. Clearing it will show everything again.`
                    : 'Try broadening your search term, or clear the filters to start again.'}
                </p>
                {/* resetFilters clears every filter on the page. The old inline
                    version missed the item, chip and parsed-search state, so it
                    could leave someone stuck on an empty list. */}
                <button type="button" className="btn-secondary" onClick={resetFilters}>
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
          onOpenTextBoard={() => showWorkspace('chat')}
          onSelectPlace={(place) => setActivePlace(place)}
          onShowMatches={(matches) => {
            setAiMatchIds(matches.map((match) => match.id));
            showWorkspace('directory');
          }}
          onOpenRescue={() => showWorkspace('rescue')}
        />
      </div> {/* /.places-workspace-frame */}
    </div>
  );
}
