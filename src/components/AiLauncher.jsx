import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion';
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

/* ---- the fan ----

   The choices leave the button rather than appearing beside it: each one
   travels out along an arc from under the mark to its own place, one slightly
   after the last, so the set reads as unfolding from the thing that was
   pressed. Closing reverses it, and the button gives a short pulse as the last
   one lands back inside — the whole point of the gesture is that the options
   are understood to live in the button.

   The arc is a quarter, not a full circle, because this button sits in the
   bottom-right corner of the screen: a ring would put half its items past the
   edge. Everything opens up and to the left, into the page. */
const FAN = {
  radius: 112,
  from: 188,   // degrees, just past due left
  to: 268,     // just short of straight up
  openStagger: 0.05,
  closeStagger: 0.04,
};

const pointOnArc = (index, total, radius) => {
  const span = FAN.to - FAN.from;
  const degrees = total <= 1 ? FAN.from + span / 2 : FAN.from + (span * index) / (total - 1);
  const theta = (degrees * Math.PI) / 180;
  return { x: radius * Math.cos(theta), y: radius * Math.sin(theta) };
};

export default function AiLauncher({
  sectionId,
  appearance = 'cart',   // 'guide' on the landing page, 'cart' in the workspace
  onSelectPlace,
  onShowMatches,
  onOpenRescue,
  onOpenTextBoard,
  hidden = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [teased, setTeased] = useState(false);
  const section = getSectionKnowledge(sectionId);
  const isGuide = appearance === 'guide';
  const reduceMotion = useReducedMotion();
  const pulse = useAnimationControls();

  /* The two ways to get help, in the order they leave the button. */
  const choices = [
    {
      id: 'board',
      label: 'Text board',
      hint: 'Chat with the food navigator',
      icon: (
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="5" width="20" height="14" rx="2.5" />
          <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M8 16.5h8" />
        </svg>
      ),
      run: () => onOpenTextBoard?.(),
    },
    {
      id: 'page',
      label: 'This page',
      hint: `Explains ${section.label}`,
      icon: (
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9.2" />
          <path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1.1 1-1.1 1.7v.4" />
          <circle cx="12" cy="16.8" r="1.15" fill="currentColor" stroke="none" />
        </svg>
      ),
      run: () => setAssistantOpen(true),
    },
  ];

  /* Closing is its own small event: the mark takes a beat of recoil as the
     choices arrive back inside it. Skipped entirely for reduced motion. */
  const closeMenu = async () => {
    setMenuOpen(false);
    if (reduceMotion) return;
    await pulse.start({
      scale: [1, 1.14, 0.94, 1],
      transition: { duration: 0.34, ease: 'easeOut', delay: choices.length * FAN.closeStagger },
    });
  };

  const runChoice = (choice) => {
    closeMenu();
    choice.run();
  };

  /* The label opens itself once, a few seconds in, so the button explains what
     it is without anyone having to hover it. After that it answers to hover
     and focus only. */
  useEffect(() => {
    const timer = setTimeout(() => setTeased(true), 2600);
    const settle = setTimeout(() => setTeased(false), 7600);
    return () => { clearTimeout(timer); clearTimeout(settle); };
  }, []);

  useEffect(() => {
    if (!menuOpen && !assistantOpen) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      if (menuOpen) closeMenu();
      setAssistantOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, assistantOpen]);

  return (
    <>
      <AnimatePresence>
        {!hidden && !assistantOpen && (
          <motion.div
            className={`ai-launcher ai-launcher--${appearance}${teased ? ' is-teased' : ''}${menuOpen ? ' is-fanned' : ''}`}
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 20 }}
            transition={SPRING}
          >
            <motion.div className="ai-launcher-recoil" animate={pulse}>
            <button
              type="button"
              className="ai-launcher-btn"
              onClick={() => {
                if (isGuide) { setAssistantOpen(true); return; }
                if (menuOpen) closeMenu(); else setMenuOpen(true);
              }}
              aria-expanded={isGuide ? undefined : menuOpen}
              aria-haspopup={isGuide ? undefined : 'menu'}
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
                {/* While the fan is open the mark becomes the way to close it.
                    The two swap through a blur rather than a cut, so neither
                    one pops. */}
                <AnimatePresence mode="popLayout" initial={false}>
                  {menuOpen && !isGuide && (
                    <motion.span
                      key="close"
                      className="ai-launcher-glyph"
                      initial={{ opacity: 0, filter: 'blur(7px)', rotate: -60 }}
                      animate={{ opacity: 1, filter: 'blur(0px)', rotate: 0 }}
                      exit={{ opacity: 0, filter: 'blur(7px)', rotate: 60 }}
                      transition={{ duration: 0.2 }}
                    >
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </motion.span>
                  )}
                </AnimatePresence>

                <motion.span
                  className="ai-launcher-glyph"
                  animate={menuOpen && !isGuide
                    ? { opacity: 0, filter: 'blur(7px)', scale: 0.7 }
                    : { opacity: 1, filter: 'blur(0px)', scale: 1 }}
                  transition={{ duration: 0.2 }}
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
              </motion.span>

              <span className="ai-launcher-copy">
                <b>{isGuide ? 'Ask about' : 'Ask the navigator'}</b>
                <i>{section.label}</i>
              </span>

              <span className="ai-launcher-pulse" aria-hidden="true" />
            </button>
            </motion.div>

            {/* The fan. It is always mounted so the choices can travel back
                into the button on close rather than vanishing where they
                stand; `inert` while closed keeps them off the tab order and
                out of a screen reader's way. */}
            {!isGuide && (
              <div
                className="ai-launcher-fan"
                role="menu"
                aria-label="How would you like help?"
                aria-hidden={!menuOpen}
                inert={menuOpen ? undefined : true}
              >
                {choices.map((choice, index) => {
                  const { x, y } = pointOnArc(index, choices.length, FAN.radius);
                  return (
                    <motion.button
                      key={choice.id}
                      type="button"
                      role="menuitem"
                      className="ai-fan-item"
                      tabIndex={menuOpen ? 0 : -1}
                      onClick={() => runChoice(choice)}
                      initial={false}
                      animate={menuOpen
                        ? { x, y, opacity: 1, scale: 1 }
                        : { x: 0, y: 0, opacity: 0, scale: 0.5 }}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.95 }}
                      transition={reduceMotion ? { duration: 0 } : {
                        ...SPRING,
                        delay: index * (menuOpen ? FAN.openStagger : FAN.closeStagger),
                      }}
                    >
                      <span className="ai-fan-icon">{choice.icon}</span>
                      {/* The label rides alongside rather than under: there is
                          page to the left of this button and none below it. */}
                      <span className="ai-fan-label">
                        <b>{choice.label}</b>
                        <small>{choice.hint}</small>
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>

      {assistantOpen && (
        <HarvestLinkAI
          sectionId={sectionId}
          onClose={() => setAssistantOpen(false)}
          onSelectPlace={(place) => { onSelectPlace?.(place); }}
          onShowMatches={(matches) => { onShowMatches?.(matches); setOpen(false); }}
          onOpenRescue={onOpenRescue}
        />
      )}
    </>
  );
}
