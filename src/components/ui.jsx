import React from 'react';
import { STATUS } from '../data/catalog.js';

export function Icon({ name, size = 18 }) {
  const paths = {
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM16 16l4.5 4.5',
    pin: 'M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z M12 10.5v.01',
    heart: 'M12 20s-7.5-4.6-7.5-9.5A4.5 4.5 0 0 1 12 7.8 4.5 4.5 0 0 1 19.5 10.5C19.5 15.4 12 20 12 20Z',
    spark: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4Z',
    check: 'M4.5 12.5l5 5 10-11',
    alert: 'M12 4.5 2.8 20h18.4Z M12 10v4.5 M12 17.2v.01',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 11v5 M12 8v.01',
    arrow: 'M4.5 12h14 M13 6.5l6 5.5-6 5.5',
    back: 'M19.5 12h-14 M11 6.5 5 12l6 5.5',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4.5 20a7.5 7.5 0 0 1 15 0',
    compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5Z',
    home: 'M4 11 12 4l8 7 M6.5 9.5V20h11V9.5',
    bookmark: 'M6.5 4h11v16l-5.5-4-5.5 4Z',
    cart: 'M3.5 4.5h2.2l2.3 10.4h9.2l2.1-7.4H7 M9.5 20a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z M17 20a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z',
    send: 'M4.5 12 20 4.5 15 20l-3.5-6Z',
    star: 'M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8Z',
    close: 'M6 6l12 12M18 6 6 18',
  };
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {(paths[name] ?? '').split(' M').map((d, i) => <path key={i} d={i ? `M${d}` : d} />)}
    </svg>
  );
}

export function Button({ as: As = 'button', variant = 'primary', size = 'md', icon, children, className = '', ...rest }) {
  return (
    <As className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {children}
      {icon && <Icon name={icon} size={17} />}
    </As>
  );
}

export function Tag({ children, tone = 'neutral' }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

/* One consistent read on allergen data, everywhere it appears. */
export function AllergenBadge({ allergen }) {
  const { tone, label } = STATUS[allergen.status] ?? STATUS.unknown;
  const icon = { ok: 'check', warn: 'alert', unknown: 'info' }[tone];
  return (
    <span className={`allergen allergen-${tone}`} title={allergen.note}>
      <Icon name={icon} size={14} />
      <b>{allergen.name}</b>
      <span>{label}</span>
    </span>
  );
}

export function Rating({ value, count }) {
  return (
    <span className="rating">
      <Icon name="star" size={14} />
      <b>{value.toFixed(1)}</b>
      {count != null && <span className="rating-count">({count})</span>}
    </span>
  );
}

/* Calm, visible safety guidance. Never alarming, never hidden. */
export function SafetyNote({ children, tone = 'soft', compact = false }) {
  return (
    <aside className={`safety safety-${tone}${compact ? ' is-compact' : ''}`}>
      <Icon name="info" size={compact ? 15 : 17} />
      <p>{children}</p>
    </aside>
  );
}

export function Chip({ selected, children, onClick, ...rest }) {
  return (
    <button
      type="button"
      className={`chip${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Skeleton({ lines = 3, media = false }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {media && <div className="sk-media" />}
      <div className="sk-lines">
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className="sk-line" style={{ width: `${92 - i * 16}%` }} />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="empty">
      <span className="empty-mark" aria-hidden="true"><Icon name="search" size={22} /></span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function SectionHead({ eyebrow, title, action }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <p className="mono section-eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
