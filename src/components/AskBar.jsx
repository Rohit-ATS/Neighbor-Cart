import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/* The composer.

   At rest it is a single calm line, sized to the reading width rather than
   stretched across the panel. Clicking in springs it open: the field grows,
   the suggested prompts slide out beneath it, and the textarea keeps growing
   with the text up to six lines. It settles back down on blur, but only while
   it is still empty, so a half-written question is never thrown away.

   The tray keeps to one line of starters: a caption and the keyboard hint
   share a row, and the chips sit under them in a single even band. */

const SPRING = { type: 'spring', stiffness: 220, damping: 26, mass: 0.7 };
const MAX_ROWS = 6;

export default function AskBar({
  placeholder = 'Ask anything…',
  chips = [],
  onSubmit,
  disabled = false,
  autoFocus = false,
}) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const field = useRef(null);

  /* Grow with the content instead of scrolling inside a fixed box. */
  const resize = () => {
    const el = field.current;
    if (!el) return;
    el.style.height = 'auto';
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
    el.style.height = `${Math.min(el.scrollHeight, line * MAX_ROWS)}px`;
  };

  useEffect(resize, [value, open]);
  useEffect(() => { if (autoFocus) field.current?.focus(); }, [autoFocus]);

  const submit = (text) => {
    const q = (text ?? value).trim();
    if (!q || disabled) return;
    onSubmit?.(q);
    setValue('');
    requestAnimationFrame(resize);
  };

  return (
    <motion.form
      className={`askbar${open ? ' is-open' : ''}`}
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      animate={{ paddingTop: open ? 18 : 10, paddingBottom: open ? 14 : 10 }}
      transition={SPRING}
    >
      <div className="askbar-main">
        <span className="askbar-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4Z" />
          </svg>
        </span>

        <textarea
          ref={field}
          rows={1}
          value={value}
          placeholder={placeholder}
          aria-label="Ask the food access navigator"
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (!value.trim()) setOpen(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
            if (e.key === 'Escape') e.currentTarget.blur();
          }}
        />

        <button type="submit" className="askbar-send" disabled={disabled || !value.trim()} aria-label="Send">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 12h14M13 6.5l6 5.5-6 5.5" />
          </svg>
        </button>
      </div>

      {/* The tray only exists once the field is live, so the resting state stays quiet. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="askbar-tray"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING}
          >
            <div className="askbar-tray-head">
              {chips.length > 0 && <span className="askbar-tray-label">Try asking</span>}
              <p className="askbar-hint">
                <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line
              </p>
            </div>
            {chips.length > 0 && (
              <ul className="askbar-chips">
                {chips.map((chip) => {
                  const { label, prompt } = typeof chip === 'string' ? { label: chip, prompt: chip } : chip;
                  return (
                    <li key={prompt}>
                      <button
                        type="button"
                        className="askbar-chip"
                        title={prompt}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => submit(prompt)}
                      >
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form>
  );
}
