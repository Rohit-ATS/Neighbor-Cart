import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './ui.jsx';

/* The composer. Collapsed it is a single calm line; on focus it springs open
   into a taller field with its own toolbar, and the textarea keeps growing with
   the text. It settles back down on blur, but only while it is still empty, so
   a half-written question is never thrown away. */

const SPRING = { type: 'spring', stiffness: 220, damping: 26, mass: 0.7 };
const MAX_ROWS = 6;

export default function AskBar({
  placeholder = 'Ask about a food, ingredient, craving, or nearby option…',
  chips = [],
  onSubmit,
  autoFocus = false,
  submitLabel = 'Ask',
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
    if (!q) return;
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
      role="search"
    >
      <div className="askbar-main">
        <span className="askbar-mark" aria-hidden="true"><Icon name="spark" size={19} /></span>

        <textarea
          ref={field}
          rows={1}
          value={value}
          placeholder={placeholder}
          aria-label="Ask the AI Food Guide"
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (!value.trim()) setOpen(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
            if (e.key === 'Escape') { e.currentTarget.blur(); }
          }}
        />

        <button type="submit" className="askbar-send" disabled={!value.trim()} aria-label={submitLabel}>
          <Icon name="arrow" size={18} />
        </button>
      </div>

      {/* The toolbar only exists once the field is live, so the resting state stays quiet. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="askbar-tray"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING}
          >
            <ul className="askbar-chips">
              {chips.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    className="prompt-chip"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => submit(c)}
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
            <p className="askbar-hint">
              <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form>
  );
}
