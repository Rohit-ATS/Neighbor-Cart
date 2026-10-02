import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import HarvestLinkAI from './HarvestLinkAI.jsx';
import { getSectionKnowledge } from '../lib/pageContext.js';

/* The navigator, resting in the bottom-right corner of every screen.

   It is not a generic chat bubble: the capsule names the section the person is
   actually in, and opening it hands that section's knowledge to the
   conversation, so the first question can be "what is this?" and get a real
   answer. The label changes as they move through the page, which is also the
   only hint they need that the assistant is paying attention.

   It wears two appearances, because it is doing two jobs. On the landing page
   it is a guide: a pale capsule with a question mark in a speech bubble, there
   to explain the page and the service to someone still deciding. Once they
   press "Find food near you" and reach the workspace, it becomes the product's
   own cart mark in solid crimson — the same assistant, now helping with the
   search itself rather than with the pitch. The mark animates in on arrival so
   the change is something you see happen. */

const SPRING = { type: 'spring', stiffness: 260, damping: 24, mass: 0.8 };

export default function AiLauncher({
  sectionId,
  appearance = 'cart',   // 'guide' on the landing page, 'cart' in the workspace
  onSelectPlace,
  onShowMatches,
  hidden = false,
}) {
  const [open, setOpen] = useState(false);
  const [teased, setTeased] = useState(false);
  const section = getSectionKnowledge(sectionId);
  const isGuide = appearance === 'guide';

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
            className={`ai-launcher ai-launcher--${appearance}${teased ? ' is-teased' : ''}`}
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 20 }}
            transition={SPRING}
          >
            <button
              type="button"
              className="ai-launcher-btn"
              onClick={() => setOpen(true)}
              aria-label={isGuide
                ? `Ask a question about ${section.label}`
                : `Ask the food navigator about ${section.label}`}
            >
              <motion.span
                className="ai-launcher-mark"
                aria-hidden="true"
                /* The mark turns in as it arrives, so moving between the two
                   screens reads as the assistant changing rather than two
                   different buttons happening to sit in the same corner. */
                initial={{ rotate: -120, scale: 0.4, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                transition={{ ...SPRING, delay: 0.08 }}
              >
                {isGuide ? (
                  <svg viewBox="0 0 32 32" width="25" height="25" fill="none" aria-hidden="true">
                    {/* A question inside a speech bubble: this one is here to
                        be asked things, not to carry anything home. */}
                    <path
                      d="M26.8 15.4c0 5.3-4.8 9.6-10.8 9.6a12.7 12.7 0 0 1-3.2-.4L6.6 27l1.7-4.6a9 9 0 0 1-3.1-7c0-5.3 4.8-9.6 10.8-9.6s10.8 4.3 10.8 9.6Z"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13.5 12.6a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1 1-1.1 1.8v.5"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="16" cy="20.2" r="1.35" fill="currentColor" />
                  </svg>
                ) : (
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
                )}
              </motion.span>

              <span className="ai-launcher-copy">
                <b>{isGuide ? 'Ask about' : 'Ask the navigator'}</b>
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
