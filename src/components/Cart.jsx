import React from 'react';

/* Groceries that orbit the cart. Each gets its own float path in the CSS. */
const groceries = [
  { key: 'apple', label: 'Apple', art: (
    <>
      <path d="M20 9c5 0 9 4.3 9 10.5S24.5 33 20 33s-9-7.3-9-13.5S15 9 20 9Z" fill="#e8503c" />
      <path d="M20 9c5 0 9 4.3 9 10.5 0 4.6-2.5 9.4-5.6 12 1-3.4 1.4-7.4 1.4-11C24.8 15 22.8 10.4 20 9Z" fill="#c23a2a" />
      <path d="M20 10V5" stroke="#5d4030" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M20.5 7c3-3.4 6.6-3.6 8-2.6 1 2-1.4 5.3-5 6-2 .4-3.6-1.6-3-3.4Z" fill="#54a45c" />
    </>
  ) },
  { key: 'carrot', label: 'Carrot', art: (
    <>
      <path d="M22.5 12.5 13 32.6c-.6 1.3-2.4 1.3-3 0L4.6 20.4c-.6-1.3.5-2.8 1.9-2.6l16 2.1Z" fill="#f0742f" transform="rotate(-24 16 22)" />
      <g stroke="#cf5b1d" strokeWidth="1.4" strokeLinecap="round" transform="rotate(-24 16 22)">
        <path d="M9.2 22.2l4.4.6M8.9 26.3l3.6.5M10.2 30l2.4.3" />
      </g>
      <path d="M21 14c1-4.4 4.2-7 7.4-7.4-.6 3-2.2 5.6-4.4 7.2M23 13.6c2.8-2.6 6.2-3 8.6-2-1.6 2.8-4.6 4.4-7.4 4.6" fill="#4f9b55" />
    </>
  ) },
  { key: 'broccoli', label: 'Broccoli', art: (
    <>
      <path d="M17 20h6v12a3 3 0 0 1-6 0V20Z" fill="#9ccb6a" />
      <circle cx="13" cy="15" r="6.5" fill="#4f9b55" />
      <circle cx="27" cy="15" r="6.5" fill="#4f9b55" />
      <circle cx="20" cy="11" r="7.5" fill="#5daf61" />
      <circle cx="20" cy="18" r="6.5" fill="#44894b" />
    </>
  ) },
  { key: 'bread', label: 'Bread', art: (
    <>
      <path d="M6 20c0-6 4-10 14-10s14 4 14 10v9a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-9Z" fill="#e8b36b" />
      <path d="M6 21c1-5 5-8 14-8s13 3 14 8c-3-3-7-4.5-14-4.5S9 18 6 21Z" fill="#f3cb93" />
      <g stroke="#c2873f" strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 24v5M20 24v5M28 24v5" />
      </g>
    </>
  ) },
  { key: 'milk', label: 'Milk', art: (
    <>
      <path d="M11 15h18v19a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V15Z" fill="#f2f6f8" />
      <path d="M22 15h7v19a2 2 0 0 1-2 2h-5V15Z" fill="#d8e3e8" />
      <path d="M11 15 20 5l9 10H11Z" fill="#e9eff2" />
      <path d="M20 5l9 10h-7l-2-10Z" fill="#cfdbe1" />
      <rect x="14" y="20" width="12" height="8" rx="1.5" fill="#6aa8d8" />
    </>
  ) },
  { key: 'tomato', label: 'Tomato', art: (
    <>
      <circle cx="20" cy="22" r="11" fill="#e04a3c" />
      <path d="M20 11a11 11 0 0 1 7.8 18.8c1.6-3 2.2-6.4 1.4-9.8-1-4.4-4.6-7.6-9.2-9Z" fill="#bd3528" />
      <path d="M20 12c-2.4-2.6-5.4-2.4-7 -1.4 1.2 1.6 3 2.6 5 3-1.6-2.8-.6-4.6 2-1.6Zm0 0c2.4-2.6 5.4-2.4 7-1.4-1.2 1.6-3 2.6-5 3" fill="#4f9b55" />
      <path d="M20 13V8" stroke="#4f9b55" strokeWidth="2.4" strokeLinecap="round" />
    </>
  ) },
  { key: 'eggs', label: 'Eggs', art: (
    <>
      <rect x="5" y="16" width="30" height="16" rx="4" fill="#d9c7a8" />
      <ellipse cx="13" cy="16" rx="6" ry="7.5" fill="#fdf6ea" />
      <ellipse cx="27" cy="16" rx="6" ry="7.5" fill="#f4e9d6" />
      <path d="M5 26h30" stroke="#c0ab8a" strokeWidth="1.6" />
    </>
  ) },
  { key: 'lemon', label: 'Lemon', art: (
    <>
      <ellipse cx="20" cy="21" rx="12" ry="9" fill="#f3c73f" transform="rotate(-18 20 21)" />
      <path d="M31 16c1.6 1.4 2 3.4.6 4.6" stroke="#dca81f" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="16" cy="17" rx="4.5" ry="2.6" fill="#f8dd82" transform="rotate(-18 16 17)" />
    </>
  ) },
];

export default function Cart() {
  return (
    <div className="cart-stage" aria-label="Grocery cart with fresh food floating around it" role="img">
      <div className="cart-glow" aria-hidden="true" />

      <ul className="orbit" aria-hidden="true">
        {groceries.map((item, i) => (
          <li key={item.key} className={`orbit-item orbit-${i + 1}`}>
            <span className="orbit-spin">
              <svg viewBox="0 0 40 40">{item.art}</svg>
            </span>
          </li>
        ))}
      </ul>

      <svg className="cart-svg" viewBox="0 0 460 400" aria-hidden="true">
        <defs>
          <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fbfdfd" />
            <stop offset=".38" stopColor="#cfd9dd" />
            <stop offset=".62" stopColor="#95a4aa" />
            <stop offset="1" stopColor="#6e7e85" />
          </linearGradient>
          <linearGradient id="chrome-h" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#9fadb3" />
            <stop offset=".3" stopColor="#f4f8f9" />
            <stop offset=".7" stopColor="#b6c2c7" />
            <stop offset="1" stopColor="#77868d" />
          </linearGradient>
          <linearGradient id="basket-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cdd8db" />
            <stop offset="1" stopColor="#9aa8ad" />
          </linearGradient>
          <linearGradient id="tyre" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#44514f" />
            <stop offset="1" stopColor="#202c2a" />
          </linearGradient>
          <radialGradient id="shadow" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#18352d" stopOpacity=".3" />
            <stop offset="1" stopColor="#18352d" stopOpacity="0" />
          </radialGradient>

          {/* Perspective mesh: verticals lean with the basket, horizontals follow the rim. */}
          <clipPath id="basket-clip">
            <path d="M104 126 L404 104 L372 250 L150 258 Z" />
          </clipPath>
          <clipPath id="tray-clip">
            <path d="M176 286 L382 272 L372 300 L188 310 Z" />
          </clipPath>
        </defs>

        {/* contact shadow */}
        <ellipse cx="248" cy="366" rx="176" ry="22" fill="url(#shadow)" />

        {/* far side of the basket, a touch darker for depth */}
        <path
          d="M118 112 L418 92 L388 238 L164 246 Z"
          fill="url(#basket-far)"
          stroke="#7d8c92"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* legs + axle forks behind the basket */}
        <g stroke="url(#chrome)" strokeWidth="11" strokeLinecap="round" fill="none">
          <path d="M168 240 L196 318" />
          <path d="M376 236 L352 318" />
          <path d="M186 296 L366 282" />
        </g>

        {/* lower tray */}
        <g>
          <path d="M176 286 L382 272 L372 300 L188 310 Z" fill="#b9c5ca" stroke="#7d8c92" strokeWidth="3" strokeLinejoin="round" />
          <g clipPath="url(#tray-clip)" stroke="#8d9ba1" strokeWidth="2.4" opacity=".85">
            <path d="M206 270v44M236 268v44M266 266v44M296 264v44M326 262v44M356 260v44" />
          </g>
        </g>

        {/* near side of the basket */}
        <path
          d="M104 126 L404 104 L372 250 L150 258 Z"
          fill="#e4ebee"
          fillOpacity=".55"
          stroke="url(#chrome-h)"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <g clipPath="url(#basket-clip)">
          <g stroke="#9bacb2" strokeWidth="3.2" opacity=".9">
            {/* verticals, leaning to follow the taper */}
            <path d="M130 118 L160 266" />
            <path d="M160 116 L186 264" />
            <path d="M190 114 L212 262" />
            <path d="M220 112 L238 260" />
            <path d="M250 110 L264 258" />
            <path d="M280 108 L290 256" />
            <path d="M310 106 L316 254" />
            <path d="M340 104 L342 252" />
            <path d="M370 102 L368 250" />
            {/* horizontals, following the rim slope */}
            <path d="M100 160 L400 139" />
            <path d="M100 194 L398 174" />
            <path d="M100 228 L396 209" />
          </g>
        </g>

        {/* front lip + rim highlight along the top edge */}
        <path d="M404 104 L372 250" stroke="#7d8c92" strokeWidth="3" strokeLinecap="round" opacity=".55" />
        <path d="M104 126 L404 104" stroke="#fdfefe" strokeWidth="8" strokeLinecap="round" opacity=".95" />
        <path d="M104 126 L404 104" stroke="#8d9ba1" strokeWidth="2" strokeLinecap="round" opacity=".5" />

        {/* handle */}
        <g fill="none" strokeLinecap="round">
          <path d="M112 128 C72 120 50 104 48 80" stroke="url(#chrome)" strokeWidth="12" />
          <path d="M22 76 H74" stroke="#e8503c" strokeWidth="18" />
          <path d="M26 71 H70" stroke="#fb8e6e" strokeWidth="5" opacity=".7" />
        </g>

        {/* wheels */}
        {['rear', 'front'].map((pos) => {
          const cx = pos === 'rear' ? 198 : 350;
          return (
            <g key={pos} className={`wheel wheel-${pos}`} style={{ transformOrigin: `${cx}px 330px` }}>
              <circle cx={cx} cy="332" r="26" fill="url(#tyre)" />
              <circle cx={cx} cy="332" r="12" fill="#cfd9dd" stroke="#7d8c92" strokeWidth="2.5" />
              <circle cx={cx} cy="332" r="4" fill="#7d8c92" />
              <g stroke="#9bacb2" strokeWidth="2.6" className="wheel-spokes" style={{ transformOrigin: `${cx}px 332px` }}>
                <path d={`M${cx} 322 v20M${cx - 10} 332 h20`} />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
