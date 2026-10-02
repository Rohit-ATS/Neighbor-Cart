import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/* The "Use my location" control.

   Sharing a location is a request that takes a moment and can be refused, so
   the button is really four states wearing one shape. It used to swap its text
   instantly, which made the slowest part of the interaction — waiting on the
   browser's permission prompt — look like nothing had happened.

   Now the shape travels between states: the capsule resizes to its new label
   instead of snapping, the old words leave upward as the new ones arrive from
   below, and the mark changes to match. While the browser is deciding, rings
   pulse out of the pin so the wait is visibly a wait. */

const SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 };

const STATES = {
  idle: { label: 'Use my location', mark: 'pin' },
  asking: { label: 'Finding you…', mark: 'searching' },
  ready: { label: 'Sorting by distance from you', mark: 'check' },
  denied: { label: 'Location blocked — tell me a ZIP instead', mark: 'blocked' },
  unsupported: { label: 'Location unavailable on this device', mark: 'blocked' },
};

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Mark({ kind }) {
  if (kind === 'check') {
    return <polyline points="4 12.5 9.5 18 20 6.5" {...STROKE} />;
  }
  if (kind === 'blocked') {
    return (
      <>
        <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" {...STROKE} />
        <line x1="8.5" y1="13.5" x2="15.5" y2="6.5" {...STROKE} />
      </>
    );
  }
  return (
    <>
      <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" {...STROKE} />
      <circle cx="12" cy="10" r="3" {...STROKE} />
    </>
  );
}

export default function LocationButton({ status = 'idle', onRequest, onClear }) {
  const reduce = useReducedMotion();
  const state = STATES[status] || STATES.idle;
  const isReady = status === 'ready';
  const isBusy = status === 'asking';
  const disabled = isBusy || status === 'unsupported';

  const transition = reduce ? { duration: 0 } : SPRING;

  return (
    <motion.button
      type="button"
      layout
      transition={transition}
      className={`ai-location-btn${isReady ? ' is-on' : ''}${isBusy ? ' is-busy' : ''}${status === 'denied' ? ' is-denied' : ''}`}
      onClick={() => (isReady ? onClear?.() : onRequest?.())}
      disabled={disabled}
      whileTap={reduce || disabled ? undefined : { scale: 0.955 }}
    >
      <span className="ai-location-mark">
        {/* The rings only exist while the browser is deciding, so the wait
            reads as activity rather than a frozen control. */}
        {isBusy && !reduce && (
          <>
            <span className="ai-location-ping" />
            <span className="ai-location-ping is-delayed" />
          </>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.svg
            key={state.mark}
            viewBox="0 0 24 24"
            width="14"
            height="14"
            aria-hidden="true"
            initial={reduce ? false : { scale: 0.4, opacity: 0, rotate: -35 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0, rotate: 35 }}
            transition={reduce ? { duration: 0 } : { ...SPRING, damping: 26 }}
          >
            <Mark kind={state.mark} />
          </motion.svg>
        </AnimatePresence>
      </span>

      {/* The label is the part that actually changes, so it is announced. */}
      <span className="ai-location-label" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={state.label}
            initial={reduce ? false : { y: 11, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: -11, opacity: 0 }}
            transition={reduce ? { duration: 0 } : { ...SPRING, damping: 30 }}
          >
            {state.label}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.button>
  );
}
