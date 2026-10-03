import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/* The curtain between the two pages.

   Landing and the workspace used to swap in a single frame, which read as the
   site breaking rather than moving: a dark hero replaced by a cream directory
   with nothing in between. A curtain gives the swap somewhere to happen. It
   rises over the old page, holds long enough to cover the exchange, then keeps
   travelling upward to reveal the new one — so the page is never caught
   half-built.

   It wears the brand's own colours: the crimson of the nav and the cart
   button, an amber leading edge, cream type. The rounded corner is the same
   radius the cards use, so the curtain reads as part of the same system rather
   than a loading screen borrowed from somewhere else. */

const EASE = [0.76, 0, 0.24, 1];   // a firm in-out, so the cover lands rather than drifts

export default function PageTransition({ active, label }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div className="page-curtain" aria-hidden="true">
          <motion.div
            className="page-curtain-panel"
            initial={{ y: '100%' }}
            animate={{ y: '0%' }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.46, ease: EASE }}
          >
            <motion.div
              className="page-curtain-brand"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.26, delay: 0.16 } }}
              exit={{ opacity: 0, y: -10, transition: { duration: 0.16 } }}
            >
              <span className="page-curtain-mark">
                <svg viewBox="0 0 32 32" width="30" height="30" fill="none">
                  <path
                    d="M6 9.5h18.5a1.5 1.5 0 0 1 1.46 1.85l-1.8 7.4A2.5 2.5 0 0 1 21.73 20.6H11.2a2.5 2.5 0 0 1-2.44-1.95L6 6.2H3.2"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="25.4" r="1.9" fill="currentColor" />
                  <circle cx="21.4" cy="25.4" r="1.9" fill="currentColor" />
                  <path
                    d="M15.6 11.4l1.15 3.05 3.05 1.15-3.05 1.15-1.15 3.05-1.15-3.05L11.4 15.6l3.05-1.15Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <b className="page-curtain-word">NeighborCart</b>
              {label && <span className="page-curtain-label">{label}</span>}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
