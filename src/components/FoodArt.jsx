import React from 'react';

/* Drawn food art. Swapping in photography later means changing only this file:
   every card and hero calls <FoodArt art="…" /> and never touches an <img>. */

const Bowl = ({ rim, base, children }) => (
  <>
    <circle cx="100" cy="100" r="74" fill={rim} />
    <circle cx="100" cy="100" r="62" fill={base} />
    <path d="M100 38a62 62 0 0 1 44 106 62 62 0 0 0-88-88 62 62 0 0 1 44-18Z" fill="#fff" opacity=".14" />
    {children}
  </>
);

const Leaf = ({ x, y, r = 0, c = '#5a9a4c', s = 1 }) => (
  <path
    d="M0 0c14-4 24 2 26 14-12 6-23 2-26-14Z"
    fill={c}
    transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}
  />
);

const ART = {
  grainbowl: (
    <Bowl rim="#e8dcc6" base="#d9c7a0">
      <circle cx="78" cy="82" r="22" fill="#5a9a4c" />
      <circle cx="68" cy="74" r="13" fill="#6fae5c" />
      <circle cx="124" cy="78" r="20" fill="#d4603c" />
      <path d="M118 112h40a8 8 0 0 1 0 16h-40a8 8 0 0 1 0-16Z" fill="#e8a33c" transform="rotate(-14 138 120)" />
      <circle cx="96" cy="124" r="15" fill="#f0d27a" />
      <circle cx="118" cy="132" r="9" fill="#b8532f" />
      <Leaf x={62} y={118} r={-30} />
    </Bowl>
  ),
  curry: (
    <Bowl rim="#dfe6d8" base="#e9b85c">
      <circle cx="86" cy="86" r="19" fill="#f2cf85" />
      <circle cx="122" cy="96" r="16" fill="#cf7a3a" />
      <circle cx="94" cy="126" r="17" fill="#8fbf5f" />
      <circle cx="126" cy="128" r="11" fill="#d4603c" />
      <Leaf x={70} y={110} r={-20} c="#3f7a38" />
      <Leaf x={120} y={70} r={40} c="#3f7a38" s={0.8} />
    </Bowl>
  ),
  breakfast: (
    <Bowl rim="#efe7d9" base="#f6efe1">
      <circle cx="100" cy="104" r="40" fill="#e9dcc2" />
      <circle cx="84" cy="88" r="14" fill="#f3c73f" />
      <circle cx="116" cy="112" r="12" fill="#d4603c" />
      <circle cx="92" cy="126" r="10" fill="#7a4fb0" opacity=".65" />
      <circle cx="118" cy="82" r="9" fill="#5a9a4c" />
      <g fill="#b98b4e" opacity=".55">
        <circle cx="72" cy="112" r="4" /><circle cx="130" cy="94" r="4" /><circle cx="104" cy="70" r="4" />
      </g>
    </Bowl>
  ),
  grill: (
    <Bowl rim="#e2ddd2" base="#cfc6b6">
      <path d="M58 96h84a10 10 0 0 1 0 20H58a10 10 0 0 1 0-20Z" fill="#9c5a32" transform="rotate(-8 100 106)" />
      <path d="M62 120h76a9 9 0 0 1 0 18H62a9 9 0 0 1 0-18Z" fill="#b06a3c" transform="rotate(6 100 129)" />
      <g stroke="#6d3c20" strokeWidth="4" strokeLinecap="round" opacity=".6">
        <path d="M74 94v22M100 92v22M126 94v22" transform="rotate(-8 100 106)" />
      </g>
      <Leaf x={64} y={74} r={-24} />
      <circle cx="132" cy="76" r="12" fill="#d4603c" />
    </Bowl>
  ),
  produce: (
    <Bowl rim="#dfe8d6" base="#eef3e6">
      <circle cx="80" cy="92" r="21" fill="#d4603c" />
      <circle cx="122" cy="88" r="18" fill="#f3c73f" />
      <circle cx="100" cy="124" r="22" fill="#5a9a4c" />
      <circle cx="66" cy="124" r="13" fill="#7a4fb0" opacity=".7" />
      <circle cx="134" cy="124" r="14" fill="#e8883c" />
      <Leaf x={92} y={96} r={-40} c="#3f7a38" />
    </Bowl>
  ),
  storefront: (
    <>
      <rect x="34" y="70" width="132" height="86" rx="10" fill="#e9e1d4" />
      <path d="M34 70h132l-10-22H44Z" fill="#2b5247" />
      <g fill="#d4603c">
        <path d="M44 48h22l-4 22H40Z" /><path d="M88 48h22l-2 22H86Z" /><path d="M132 48h22l6 22h-24Z" />
      </g>
      <rect x="52" y="92" width="42" height="36" rx="6" fill="#fffdf9" />
      <rect x="106" y="92" width="42" height="36" rx="6" fill="#fffdf9" />
      <rect x="82" y="132" width="36" height="24" rx="4" fill="#2b5247" />
      <circle cx="73" cy="110" r="9" fill="#5a9a4c" />
      <circle cx="127" cy="110" r="9" fill="#f3c73f" />
    </>
  ),
  carton: (
    <>
      <path d="M68 76h64v84a8 8 0 0 1-8 8H76a8 8 0 0 1-8-8V76Z" fill="#f4f8f8" />
      <path d="M104 76h28v84a8 8 0 0 1-8 8h-20V76Z" fill="#dfe8e9" />
      <path d="M68 76 100 36l32 40H68Z" fill="#eaf1f1" />
      <path d="M100 36l32 40h-24l-8-40Z" fill="#cedada" />
      <rect x="78" y="100" width="44" height="34" rx="6" fill="#5a9a4c" />
      <path d="M86 117h28" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  jar: (
    <>
      <rect x="62" y="76" width="76" height="92" rx="14" fill="#f0e6d2" />
      <rect x="62" y="76" width="76" height="92" rx="14" fill="#d9c7a0" opacity=".5" />
      <rect x="58" y="56" width="84" height="26" rx="9" fill="#3f7a38" />
      <rect x="72" y="104" width="56" height="42" rx="8" fill="#fffdf9" />
      <circle cx="100" cy="125" r="13" fill="#e8a33c" />
      <g fill="#b8862f">
        <circle cx="94" cy="121" r="2.5" /><circle cx="106" cy="128" r="2.5" /><circle cx="101" cy="117" r="2.5" />
      </g>
    </>
  ),
  box: (
    <>
      <path d="M62 66h76v102H62z" fill="#e8e1d4" />
      <path d="M100 66h38v102h-38z" fill="#d6cdbc" />
      <rect x="74" y="86" width="52" height="40" rx="7" fill="#d4603c" />
      <g fill="#f6efe1">
        <circle cx="88" cy="106" r="6" /><circle cx="100" cy="100" r="6" /><circle cx="112" cy="108" r="6" />
      </g>
      <rect x="74" y="136" width="52" height="7" rx="3.5" fill="#9aa39a" />
      <rect x="74" y="149" width="34" height="7" rx="3.5" fill="#b9c0b8" />
    </>
  ),
  chat: (
    <>
      <rect x="34" y="58" width="132" height="84" rx="20" fill="#fffdf9" />
      <path d="M70 142h30l-16 22Z" fill="#fffdf9" />
      <rect x="54" y="80" width="78" height="9" rx="4.5" fill="#d9e3da" />
      <rect x="54" y="98" width="56" height="9" rx="4.5" fill="#d9e3da" />
      <circle cx="140" cy="104" r="14" fill="#c9e86d" />
      <path d="M140 96v16M132 104h16" stroke="#14312a" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
};

export default function FoodArt({ art, className = '', rounded = true }) {
  const content = ART[art] ?? ART.grainbowl;
  return (
    <div className={`food-art${rounded ? ' is-rounded' : ''} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 200 200" role="presentation" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`fa-${art}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fffdf9" />
            <stop offset="1" stopColor="#f1ebe0" />
          </linearGradient>
        </defs>
        <rect width="200" height="200" fill={`url(#fa-${art})`} />
        <circle cx="152" cy="52" r="46" fill="#e4f0d6" opacity=".7" />
        <circle cx="44" cy="160" r="38" fill="#fae7dd" opacity=".7" />
        {content}
      </svg>
    </div>
  );
}
