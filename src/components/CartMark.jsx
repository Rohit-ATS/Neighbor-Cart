import React from 'react';

export default function CartMark({ size = 32 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className="brand-mark">
      <rect width="32" height="32" rx="9" fill="#1b1c14" />
      <path d="M7 9.5h2.4l2.6 10.4h9.6" stroke="#bcd9a8" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M10.4 12.4h12.4l-1.6 5.6H11.8" stroke="#bcd9a8" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="13.4" cy="23.2" r="1.7" fill="#b4412f" />
      <circle cx="20.4" cy="23.2" r="1.7" fill="#b4412f" />
    </svg>
  );
}
