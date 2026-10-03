import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SECTION_KNOWLEDGE } from '../lib/pageContext.js';

/* The search dock beside the wordmark.

   Collapsed it is a single round button; pressing it springs open into a field
   and drops a panel of every section of the site. The panel is not an empty
   state waiting to be typed into — it opens showing all of them, because
   someone who presses search on a food-assistance site usually does not know
   what this site calls the thing they need.

   The list is built from SECTION_KNOWLEDGE, the same registry the navigator
   uses to answer "what is this page?", so a section can never appear in search
   and be unknown to the assistant, or the reverse.

   Adapted from the shadcn/Tailwind original: this project is JavaScript with
   its own stylesheet, so the classes are plain CSS and the two icons are
   inline SVG, matching every other icon in the codebase. The motion design —
   the spring, the icon-to-field swap, the width travel — is unchanged. */

const SPRING = { type: 'spring', stiffness: 300, damping: 30 };

/* Which sections a visitor can actually be sent to, and how. Landing sections
   scroll; the rest live in the workspace and are opened there. */
const ROUTES = [
  { id: 'top', kind: 'scroll', group: 'This page' },
  { id: 'how', kind: 'scroll', group: 'This page' },
  { id: 'reel', kind: 'scroll', group: 'This page' },
  { id: 'places', kind: 'scroll', group: 'This page' },
  { id: 'about', kind: 'scroll', group: 'This page' },
  { id: 'directory', kind: 'workspace', group: 'Find food' },
  { id: 'intake', kind: 'workspace', group: 'Find food' },
  { id: 'community', kind: 'workspace', group: 'Find food' },
  { id: 'volunteer', kind: 'workspace', group: 'Get involved' },
  { id: 'rescue', kind: 'workspace', group: 'Get involved' },
  { id: 'nonprofit', kind: 'workspace', group: 'Get involved' },
  { id: 'impact', kind: 'workspace', group: 'About the network' },
  { id: 'admin', kind: 'workspace', group: 'About the network' },
];

const ENTRIES = ROUTES.map((route) => {
  const section = SECTION_KNOWLEDGE[route.id];
  return {
    ...route,
    label: section.label,
    /* The explainer's first sentence is the summary line, so the wording a
       person reads here is the wording the navigator would give them. */
    blurb: section.explainer.split(/(?<=\.)\s/)[0],
    haystack: `${section.label} ${section.explainer} ${section.starters.map((s) => s.label).join(' ')}`.toLowerCase(),
  };
});

const SearchIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const CloseIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export default function ExpandingSearchDock({
  placeholder = 'Search the site…',
  onScrollTo,
  onOpenWorkspace,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const dock = useRef(null);
  const field = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ENTRIES;
    const words = q.split(/\s+/);
    return ENTRIES.filter((entry) => words.every((word) => entry.haystack.includes(word)));
  }, [query]);

  useEffect(() => { setActive(0); }, [query]);

  const collapse = () => { setIsExpanded(false); setQuery(''); };

  // Clicking anywhere else, or pressing Escape, puts it away.
  useEffect(() => {
    if (!isExpanded) return undefined;
    const onDown = (event) => { if (!dock.current?.contains(event.target)) collapse(); };
    const onKey = (event) => { if (event.key === 'Escape') { collapse(); field.current?.blur(); } };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [isExpanded]);

  const choose = (entry) => {
    collapse();
    if (entry.kind === 'scroll') onScrollTo?.(entry.id);
    else onOpenWorkspace?.(entry.id);
  };

  // Arrow keys move through the list; Enter takes the highlighted one.
  const onKeyDown = (event) => {
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + results.length) % results.length);
    }
  };

  const grouped = results.reduce((groups, entry) => {
    (groups[entry.group] ||= []).push(entry);
    return groups;
  }, {});

  return (
    <div className="search-dock" ref={dock}>
      <AnimatePresence mode="wait" initial={false}>
        {!isExpanded ? (
          <motion.button
            key="icon"
            type="button"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={SPRING}
            onClick={() => setIsExpanded(true)}
            className="search-dock-btn"
            aria-label="Search the site"
          >
            <SearchIcon width="18" height="18" />
          </motion.button>
        ) : (
          <motion.form
            key="field"
            initial={{ width: 44, opacity: 0 }}
            animate={{ width: 268, opacity: 1 }}
            exit={{ width: 44, opacity: 0 }}
            transition={SPRING}
            onSubmit={(event) => {
              event.preventDefault();
              if (results[active]) choose(results[active]);
            }}
            className="search-dock-form"
          >
            <div className="search-dock-field">
              <SearchIcon className="search-dock-lead" width="15" height="15" />
              <input
                ref={field}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                aria-label="Search sections of this site"
                autoFocus
              />
              <motion.button
                type="button"
                onClick={collapse}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="search-dock-close"
                aria-label="Close search"
              >
                <CloseIcon width="14" height="14" />
              </motion.button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="search-dock-panel"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 0.9, 0.3, 1] }}
          >
            <p className="search-dock-hint">
              {query.trim()
                ? `${results.length} ${results.length === 1 ? 'section' : 'sections'} match “${query.trim()}”`
                : 'Everywhere you can go'}
            </p>

            {results.length === 0 ? (
              <p className="search-dock-empty">
                Nothing here matches that. Try “pantry”, “volunteer”, “formula” or “reserve”.
              </p>
            ) : (
              Object.entries(grouped).map(([group, items]) => (
                <div key={group} className="search-dock-group">
                  <span className="search-dock-group-label">{group}</span>
                  {items.map((entry) => {
                    const index = results.indexOf(entry);
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={`search-dock-item${index === active ? ' is-active' : ''}`}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => choose(entry)}
                      >
                        <span className="search-dock-item-copy">
                          <b>{entry.label}</b>
                          <small>{entry.blurb}</small>
                        </span>
                        <i className="search-dock-item-go" aria-hidden="true">
                          {entry.kind === 'scroll' ? '↓' : '→'}
                        </i>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
