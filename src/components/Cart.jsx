import React from 'react';

/* Groceries that launch up out of the basket. */
const groceries = [
  { key: 'apple', art: (
    <>
      <path d="M20 9c5 0 9 4.3 9 10.5S24.5 33 20 33s-9-7.3-9-13.5S15 9 20 9Z" fill="#e8503c" />
      <path d="M20 9c5 0 9 4.3 9 10.5 0 4.6-2.5 9.4-5.6 12 1-3.4 1.4-7.4 1.4-11C24.8 15 22.8 10.4 20 9Z" fill="#c23a2a" />
      <path d="M20 10V5" stroke="#5d4030" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M20.5 7c3-3.4 6.6-3.6 8-2.6 1 2-1.4 5.3-5 6-2 .4-3.6-1.6-3-3.4Z" fill="#54a45c" />
    </>
  ) },
  { key: 'carrot', art: (
    <>
      <path d="M22.5 12.5 13 32.6c-.6 1.3-2.4 1.3-3 0L4.6 20.4c-.6-1.3.5-2.8 1.9-2.6l16 2.1Z" fill="#f0742f" transform="rotate(-24 16 22)" />
      <g stroke="#cf5b1d" strokeWidth="1.4" strokeLinecap="round" transform="rotate(-24 16 22)">
        <path d="M9.2 22.2l4.4.6M8.9 26.3l3.6.5M10.2 30l2.4.3" />
      </g>
      <path d="M21 14c1-4.4 4.2-7 7.4-7.4-.6 3-2.2 5.6-4.4 7.2M23 13.6c2.8-2.6 6.2-3 8.6-2-1.6 2.8-4.6 4.4-7.4 4.6" fill="#4f9b55" />
    </>
  ) },
  { key: 'broccoli', art: (
    <>
      <path d="M17 20h6v12a3 3 0 0 1-6 0V20Z" fill="#9ccb6a" />
      <circle cx="13" cy="15" r="6.5" fill="#4f9b55" />
      <circle cx="27" cy="15" r="6.5" fill="#4f9b55" />
      <circle cx="20" cy="11" r="7.5" fill="#5daf61" />
      <circle cx="20" cy="18" r="6.5" fill="#44894b" />
    </>
  ) },
  { key: 'bread', art: (
    <>
      <path d="M6 20c0-6 4-10 14-10s14 4 14 10v9a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-9Z" fill="#e8b36b" />
      <path d="M6 21c1-5 5-8 14-8s13 3 14 8c-3-3-7-4.5-14-4.5S9 18 6 21Z" fill="#f3cb93" />
      <g stroke="#c2873f" strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 24v5M20 24v5M28 24v5" />
      </g>
    </>
  ) },
  { key: 'milk', art: (
    <>
      <path d="M11 15h18v19a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V15Z" fill="#f2f6f8" />
      <path d="M22 15h7v19a2 2 0 0 1-2 2h-5V15Z" fill="#d8e3e8" />
      <path d="M11 15 20 5l9 10H11Z" fill="#e9eff2" />
      <path d="M20 5l9 10h-7l-2-10Z" fill="#cfdbe1" />
      <rect x="14" y="20" width="12" height="8" rx="1.5" fill="#6aa8d8" />
    </>
  ) },
  { key: 'tomato', art: (
    <>
      <circle cx="20" cy="22" r="11" fill="#e04a3c" />
      <path d="M20 11a11 11 0 0 1 7.8 18.8c1.6-3 2.2-6.4 1.4-9.8-1-4.4-4.6-7.6-9.2-9Z" fill="#bd3528" />
      <path d="M20 12c-2.4-2.6-5.4-2.4-7 -1.4 1.2 1.6 3 2.6 5 3-1.6-2.8-.6-4.6 2-1.6Zm0 0c2.4-2.6 5.4-2.4 7-1.4-1.2 1.6-3 2.6-5 3" fill="#4f9b55" />
      <path d="M20 13V8" stroke="#4f9b55" strokeWidth="2.4" strokeLinecap="round" />
    </>
  ) },
  { key: 'eggs', art: (
    <>
      <rect x="5" y="16" width="30" height="16" rx="4" fill="#d9c7a8" />
      <ellipse cx="13" cy="16" rx="6" ry="7.5" fill="#fdf6ea" />
      <ellipse cx="27" cy="16" rx="6" ry="7.5" fill="#f4e9d6" />
      <path d="M5 26h30" stroke="#c0ab8a" strokeWidth="1.6" />
    </>
  ) },
  { key: 'lemon', art: (
    <>
      <ellipse cx="20" cy="21" rx="12" ry="9" fill="#f3c73f" transform="rotate(-18 20 21)" />
      <path d="M31 16c1.6 1.4 2 3.4.6 4.6" stroke="#dca81f" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="16" cy="17" rx="4.5" ry="2.6" fill="#f8dd82" transform="rotate(-18 16 17)" />
    </>
  ) },
];

/* Basket corners. The near and far walls are separate quads so the rim,
   floor and mesh all converge the way a real cart does in a side view. */
const NEAR = { tl: [112, 136], tr: [424, 114], br: [396, 266], bl: [158, 276] };
const FAR = { tl: [148, 112], tr: [452, 92], br: [424, 244], bl: [190, 254] };

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const line = (a, b) => `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
const quad = (c) => `M${c.tl}L${c.tr}L${c.br}L${c.bl}Z`;

/* Wire mesh that follows the wall's taper instead of a flat grid. */
function mesh(c, cols, rows) {
  const out = [];
  for (let i = 1; i < cols; i++) {
    const t = i / cols;
    out.push(line(lerp(c.tl, c.tr, t), lerp(c.bl, c.br, t)));
  }
  for (let j = 1; j < rows; j++) {
    const t = j / rows;
    out.push(line(lerp(c.tl, c.bl, t), lerp(c.tr, c.br, t)));
  }
  return out;
}

function Wheel({ cx, cy, r, className }) {
  return (
    <g className={className}>
      {/* swivel fork */}
      <path
        d={`M${cx - r * .62} ${cy - r * 1.5}h${r * 1.24}a${r * .3} ${r * .3} 0 0 1 ${r * .3} ${r * .3}v${r * .9}h-${r * 1.84}v-${r * .9}a${r * .3} ${r * .3} 0 0 1 ${r * .3} -${r * .3}Z`}
        fill="url(#chrome)"
        stroke="#7b8b92"
        strokeWidth="1.6"
      />
      <g style={{ transformOrigin: `${cx}px ${cy}px` }} className="wheel-spin">
        <circle cx={cx} cy={cy} r={r} fill="url(#tyre)" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#121b1a" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r={r * .46} fill="url(#hub)" stroke="#78888f" strokeWidth="1.6" />
        <circle cx={cx} cy={cy} r={r * .15} fill="#8a989e" />
        <g stroke="#b4c1c6" strokeWidth={r * .1} strokeLinecap="round">
          <path d={`M${cx} ${cy - r * .34}v${r * .68}M${cx - r * .34} ${cy}h${r * .68}`} />
        </g>
      </g>
      {/* highlight on the tyre shoulder */}
      <path
        d={`M${cx - r * .72} ${cy - r * .5}a${r * .9} ${r * .9} 0 0 1 ${r * .5} -${r * .34}`}
        stroke="#6d7b7a"
        strokeWidth={r * .14}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

export default function Cart() {
  return (
    <div className="cart-stage" aria-label="Grocery cart with fresh food flying out of it" role="img">
      <div className="cart-glow" aria-hidden="true" />

      {/* groceries sit behind the cart so they read as coming up out of the basket */}
      <ul className="orbit" aria-hidden="true">
        {groceries.map((item, i) => (
          <li key={item.key} className={`fly fly-${i + 1}`}>
            <span className="fly-arc">
              <svg viewBox="0 0 40 40">{item.art}</svg>
            </span>
          </li>
        ))}
      </ul>

      <svg className="cart-svg" viewBox="0 0 480 420" aria-hidden="true">
        <defs>
          <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fdfefe" />
            <stop offset=".3" stopColor="#dbe4e7" />
            <stop offset=".58" stopColor="#a6b5bb" />
            <stop offset="1" stopColor="#718188" />
          </linearGradient>
          <linearGradient id="rail" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8fa0a7" />
            <stop offset=".18" stopColor="#f7fafb" />
            <stop offset=".55" stopColor="#c2cdd2" />
            <stop offset=".85" stopColor="#93a3aa" />
            <stop offset="1" stopColor="#6f7f86" />
          </linearGradient>
          <linearGradient id="far-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c3ced3" />
            <stop offset="1" stopColor="#97a6ac" />
          </linearGradient>
          <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7f9098" />
            <stop offset="1" stopColor="#b3c0c6" />
          </linearGradient>
          <linearGradient id="hub" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eef3f5" />
            <stop offset="1" stopColor="#9eaeb5" />
          </linearGradient>
          <linearGradient id="tyre" x1=".25" y1="0" x2=".75" y2="1">
            <stop offset="0" stopColor="#3d4a49" />
            <stop offset=".55" stopColor="#242f2e" />
            <stop offset="1" stopColor="#151e1d" />
          </linearGradient>
          <linearGradient id="grip" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fb8f6f" />
            <stop offset=".45" stopColor="#e8503c" />
            <stop offset="1" stopColor="#b93626" />
          </linearGradient>
          <radialGradient id="shadow" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#18352d" stopOpacity=".32" />
            <stop offset="1" stopColor="#18352d" stopOpacity="0" />
          </radialGradient>
          {/* darkens the bottom of the basket interior */}
          <linearGradient id="depth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6d7f87" stopOpacity="0" />
            <stop offset="1" stopColor="#5d7079" stopOpacity=".5" />
          </linearGradient>

          <clipPath id="clip-near"><path d={quad(NEAR)} /></clipPath>
          <clipPath id="clip-far"><path d={quad(FAR)} /></clipPath>
          <clipPath id="clip-tray"><path d="M196 300L406 286L396 316L208 326Z" /></clipPath>
        </defs>

        <ellipse cx="268" cy="386" rx="186" ry="20" fill="url(#shadow)" />

        {/* far wall, seen through the near mesh */}
        <g>
          <path d={quad(FAR)} fill="url(#far-wall)" />
          <g clipPath="url(#clip-far)" stroke="#7f8f96" strokeWidth="2.6" opacity=".8" fill="none">
            {mesh(FAR, 11, 4).map((d, i) => <path key={i} d={d} />)}
          </g>
          <path d={quad(FAR)} fill="url(#depth)" />
          <path d={quad(FAR)} fill="none" stroke="#7b8b92" strokeWidth="3" strokeLinejoin="round" />
        </g>

        {/* basket floor, the quad between the two walls' bottom edges */}
        <path
          d={`M${NEAR.bl}L${FAR.bl}L${FAR.br}L${NEAR.br}Z`}
          fill="url(#floor)"
          stroke="#6f8087"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* frame: rear and front leg pairs, with the nesting slope */}
        <g stroke="url(#chrome)" strokeWidth="10" strokeLinecap="round" fill="none">
          <path d="M176 268L206 340" />
          <path d="M402 252L372 340" />
          <path d="M200 312L400 296" />
          <path d="M186 272L212 300" opacity=".85" />
        </g>

        {/* lower tray */}
        <g>
          <path d="M196 300L406 286L396 316L208 326Z" fill="#b6c3c9" stroke="#79898f" strokeWidth="2.6" strokeLinejoin="round" />
          <g clipPath="url(#clip-tray)" stroke="#8a989e" strokeWidth="2.2" opacity=".8">
            {Array.from({ length: 8 }, (_, i) => {
              const t = (i + 1) / 9;
              return <path key={i} d={line(lerp([196, 300], [406, 286], t), lerp([208, 326], [396, 316], t))} />;
            })}
          </g>
        </g>

        {/* near wall: translucent so the far mesh and the floor read through it */}
        <path d={quad(NEAR)} fill="#dfe8eb" fillOpacity=".4" />
        <g clipPath="url(#clip-near)" stroke="#93a3aa" strokeWidth="3" opacity=".95" fill="none">
          {mesh(NEAR, 11, 4).map((d, i) => <path key={i} d={d} />)}
        </g>
        <g clipPath="url(#clip-near)" stroke="#fbfdfd" strokeWidth="1" opacity=".55" fill="none">
          {mesh(NEAR, 11, 4).map((d, i) => <path key={i} d={d} transform="translate(-1 -1)" />)}
        </g>
        <path d={quad(NEAR)} fill="none" stroke="url(#rail)" strokeWidth="6" strokeLinejoin="round" />

        {/* top rim: the strip between the near and far top edges gives it thickness */}
        <path
          d={`M${NEAR.tl}L${FAR.tl}L${FAR.tr}L${NEAR.tr}Z`}
          fill="url(#rail)"
          stroke="#7b8b92"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d={line(NEAR.tl, NEAR.tr)} stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity=".9" />

        {/* rear nesting flap / child seat */}
        <path d="M118 140L150 118L160 206L126 220Z" fill="#aebcc2" stroke="#7b8b92" strokeWidth="2.4" strokeLinejoin="round" opacity=".95" />

        {/* handle: tube up from the rear rail into a moulded grip */}
        <g fill="none" strokeLinecap="round">
          <path d="M124 138C82 128 58 110 56 84" stroke="#7b8b92" strokeWidth="13" />
          <path d="M124 138C82 128 58 110 56 84" stroke="url(#chrome)" strokeWidth="9" />
          <path d="M150 118C110 108 86 90 84 66" stroke="url(#chrome)" strokeWidth="8" opacity=".8" />
        </g>
        <g>
          <rect x="22" y="56" width="74" height="22" rx="11" fill="url(#grip)" />
          <rect x="28" y="60" width="54" height="6" rx="3" fill="#ffb59c" opacity=".55" />
          <rect x="88" y="56" width="10" height="22" rx="5" fill="#a62f20" />
        </g>

        <Wheel cx={212} cy={350} r={27} className="wheel wheel-rear" />
        <Wheel cx={366} cy={350} r={27} className="wheel wheel-front" />
      </svg>
    </div>
  );
}
