import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import HarvestLinkAI from './HarvestLinkAI.jsx';
import { getSectionKnowledge } from '../lib/pageContext.js';

/* The navigator, resting in the bottom-right corner of every screen.

   It is not a generic chat bubble: the capsule names the section the person is
   actually in, and opening it hands that section's knowledge to the
   conversation, so the first question can be "what is this?" and get a real
   answer. The label changes as they move through the page, which is also the
   only hint they need that the assistant is paying attention. */

const SPRING = { type: 'spring', stiffness: 260, damping: 24, mass: 0.8 };

export default function AiLauncher({ sectionId, onSelectPlace, onShowMatches, hidden = false }) {
  const [open, setOpen] = useState(false);
  const [teased, setTeased] = useState(false);
  const section = getSectionKnowledge(sectionId);

  /* The label opens itself once, a few seconds in, so the button explains what
     it is without anyone having to hover it. After that it answers to hover
     and focus only. */
  useEffect(() => {
    const timer = setTimeout(() => setTeased(true), 2600);
    const settle = setTimeout(() => setTeased(false), 7600);
    return () => { clearTimeout(timer); clearTimeout(settle); };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <AnimatePresence>
        {!hidden && !open && (
          <motion.div
            className={`ai-launcher${teased ? ' is-teased' : ''}`}
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 20 }}
            transition={SPRING}
          >
            <button
              type="button"
              className="ai-launcher-btn"
              onClick={() => setOpen(true)}
              aria-label={`Ask the food navigator about ${section.label}`}
            >
              <span className="ai-launcher-mark" aria-hidden="true">
                <svg viewBox="0 0 32 32" width="26" height="26" fill="none" aria-hidden="true">
                  {/* A cart that is also a speech bubble: the product's two jobs in one mark. */}
                  <path
                    d="M6 9.5h18.5a1.5 1.5 0 0 1 1.46 1.85l-1.8 7.4A2.5 2.5 0 0 1 21.73 20.6H11.2a2.5 2.5 0 0 1-2.44-1.95L6 6.2H3.2"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="25.4" r="1.9" fill="currentColor" />
                  <circle cx="21.4" cy="25.4" r="1.9" fill="currentColor" />
                  {/* The spark: the assistant half of the mark. */}
                  <path
                    d="M15.6 11.4l1.15 3.05 3.05 1.15-3.05 1.15-1.15 3.05-1.15-3.05L11.4 15.6l3.05-1.15Z"
                    fill="currentColor"
                  />
                </svg>
              </span>

              <span className="ai-launcher-copy">
                <b>Ask about</b>
                <i>{section.label}</i>
              </span>

              <span className="ai-launcher-pulse" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {open && (
        <HarvestLinkAI
          sectionId={sectionId}
          onClose={() => setOpen(false)}
          onSelectPlace={(place) => { onSelectPlace?.(place); }}
          onShowMatches={(matches) => { onShowMatches?.(matches); setOpen(false); }}
        />
      )}
    </>
  );
}
