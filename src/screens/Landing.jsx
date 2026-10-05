import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import AiLauncher from '../components/AiLauncher.jsx';
import { useSectionContext } from '../lib/pageContext.js';
import '../styles/freshbox.css';

/* Photography comes from Unsplash, the source this project already uses for
   place imagery. The motion loop in public/media was generated with
   Higgsfield (Cinema Studio Video 3.0) and boomeranged locally so it cycles
   without a visible seam. */
const IMG = (id, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const LOOP = '/media/food-loop.mp4';
const LOOP_POSTER = '/media/food-poster.jpg';

const FLOATERS = [
  { cls: 'fb-f1', src: IMG('1565299624946-b28f40a0ae38', 400), depth: 26 },
  { cls: 'fb-f2', src: IMG('1540420773420-3366772f4999', 400), depth: -18 },
  { cls: 'fb-f3', src: IMG('1568901346375-23c9450c58cd', 400), depth: -30 },
  { cls: 'fb-f4', src: IMG('1512621776951-a57141f2eefd', 400), depth: 22 },
];

const STEPS = [
  { n: '01', title: 'Tell us where you are', body: 'A ZIP code is enough. No account, no paperwork, no eligibility quiz to get started.' },
  { n: '02', title: 'See what is open now', body: 'Live hours, current inventory and dietary notes for every pantry, kitchen and fridge nearby.' },
  { n: '03', title: 'Go, or reserve ahead', body: 'One-click directions, or hold a dignified pickup slot so your food is waiting for you.' },
];

/* The reel reuses the one generated loop, but each tile starts at a different
   point in the 8s cycle and runs at its own rate, so the band reads as three
   separate shots rather than the same frame printed three times. */
const REEL = [
  { title: 'Fresh produce', body: 'Picked up from farms and grocers the same morning.', rate: 1, start: 0, pos: '50% 50%' },
  { title: 'Hot meals', body: 'Kitchens serving a plate, no questions asked.', rate: 0.65, start: 2.7, pos: '32% 22%' },
  { title: '24/7 fridges', body: 'Community fridges you can open at any hour.', rate: 1.35, start: 5.4, pos: '70% 78%' },
];

const PLACES = [
  { name: 'SF-Marin Food Bank', city: 'San Francisco, CA', img: IMG('1593113598332-cd288d649433'), pill: 'Open now', live: true, tags: ['Fresh produce', 'No ID required'] },
  { name: 'TCV Food Bank & Mobile Pantry', city: 'Fremont, CA', img: IMG('1542838132-92c53300491e'), pill: 'Takes reservations', live: true, tags: ['Halal options', 'Drive-thru'] },
  { name: 'Second Harvest Curtner Center', city: 'San Jose, CA', img: IMG('1555396273-367ea4eb4db5'), pill: 'Open today', live: false, tags: ['Fresh produce', 'Walk-ins'] },
  { name: 'Alameda County Community Food Bank', city: 'Oakland, CA', img: IMG('1588964895597-cfccd6e2dbf9'), pill: 'Open now', live: true, tags: ['East Bay hub', 'Free pickup'] },
];

const STATS = [
  { to: 50, suffix: '+', label: 'Verified Bay Area locations' },
  { to: 100, suffix: '%', label: 'Free to use, always' },
  { to: 0, suffix: '', label: 'Documents required to start' },
  { to: 24, suffix: '/7', label: 'Community fridges listed' },
];

const MARQUEE = ['Fresh produce', 'Hot meals', 'No ID required', 'Open late', 'Halal & kosher', 'Baby formula', 'Free delivery', 'Pickup slots'];

const SECTIONS = [
  { id: 'top', label: 'Home' },
  { id: 'how', label: 'How it works' },
  { id: 'reel', label: 'What you find' },
  { id: 'places', label: 'Places' },
  { id: 'about', label: 'About' },
];

const FOOTER_COLS = [
  { head: 'Find food', links: ['Places & map', 'Open right now', 'Community fridges'] },
  { head: 'Get involved', links: ['Volunteer', 'Food rescue', 'For nonprofits'] },
  { head: 'About', links: ['Our data', 'Privacy', 'Contact'] },
];

/* One reveal used everywhere, so the whole page moves with one rhythm. */
const reveal = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 0.9, 0.3, 1] } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.11 } } };

const Reveal = ({ children, className = '', as: As = 'div', ...rest }) => {
  const M = motion[As] ?? motion.div;
  return (
    <M className={className} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }} {...rest}>
      {children}
    </M>
  );
};

const Arrow = () => (
  <svg className="fb-arrow" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

const scrollToId = (id) => {
  if (id === 'top') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
};

/* ---------------------------------------------------------------- pieces */

/* The headline rises word by word, each word masked by its own clip box. */
function Headline({ text }) {
  const reduce = useReducedMotion();
  return (
    <h1>
      {text.split(' ').map((word, i) => (
        <span className="fb-word" key={`${word}-${i}`}>
          <motion.span
            initial={reduce ? { y: 0 } : { y: '110%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.85, delay: 0.1 + i * 0.07, ease: [0.22, 0.9, 0.3, 1] }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

/* Stats tick up the first time the band scrolls into view. */
function Counter({ to, suffix }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return undefined;
    if (reduce || to === 0) {
      setN(to);
      return undefined;
    }
    const start = performance.now();
    const ms = 1500;
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [inView, to, reduce]);

  return <b ref={ref}>{n.toLocaleString('en-US')}{suffix}</b>;
}

/* A muted, looping decorative clip. Kept out of the a11y tree, and skipped
   entirely when the visitor has asked for reduced motion — they get the
   poster frame instead, which is the same image without the movement. */
function Loop({ className, rate = 1, start = 0, objectPosition, poster = LOOP_POSTER }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (rate !== 1) el.playbackRate = rate;

    /* Seeking before metadata lands throws, so wait for a duration. */
    const seek = () => { el.currentTime = Math.min(start, el.duration || start); };
    if (start) {
      if (el.readyState >= 1) seek();
      else el.addEventListener('loadedmetadata', seek, { once: true });
    }

    /* The page runs six copies of this loop. Decoding all of them at once is
       wasted work on a laptop and real battery on a phone, so each one only
       runs while it is near the viewport. */
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { rootMargin: '200px' },
    );
    io.observe(el);

    return () => {
      el.removeEventListener('loadedmetadata', seek);
      io.disconnect();
    };
  }, [rate, start]);

  if (reduce) {
    return <img className={className} src={poster} alt="" style={{ objectPosition }} aria-hidden="true" />;
  }
  return (
    <video
      ref={ref}
      className={className}
      style={{ objectPosition }}
      src={LOOP}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}

/* ----------------------------------------------------------------- page */

export default function Landing({ onNavigatePlaces, initialScrollTo = null, onScrolled }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [active, setActive] = useState('top');
  const heroRef = useRef(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll();
  const rail = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Scroll-spy: the nav underline follows the section actually on screen
     instead of being pinned to "Home" forever. */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  /* Parallax on the hero cut-outs, driven by pointer position. Pointer-only,
     so touch devices are untouched and nothing fires for reduced motion. */
  useEffect(() => {
    if (reduce) return undefined;
    const hero = heroRef.current;
    if (!hero || !window.matchMedia('(pointer: fine)').matches) return undefined;

    let raf = 0;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const { width, height, top } = hero.getBoundingClientRect();
        const x = (e.clientX / width - 0.5) * 2;
        const y = ((e.clientY - top) / height - 0.5) * 2;
        hero.style.setProperty('--mx', x.toFixed(3));
        hero.style.setProperty('--my', y.toFixed(3));
      });
    };
    hero.addEventListener('pointermove', onMove);
    return () => {
      hero.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduce]);

  /* Close the drawer on Escape and whenever the viewport grows past the
     breakpoint that hides it. */
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    const mq = window.matchMedia('(min-width: 861px)');
    const onChange = () => { if (mq.matches) setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    mq.addEventListener('change', onChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', onChange);
    };
  }, [menuOpen]);

  /* Scroll position says which section they are in; a click inside one says
     it louder. The launcher carries whichever is newer. */
  const aiSection = useSectionContext(active);

  /* Arrived from a search result picked over in the workspace: go to the
     section it named, once the page has laid out. */
  useEffect(() => {
    if (!initialScrollTo) return undefined;
    const timer = setTimeout(() => { scrollToId(initialScrollTo); onScrolled?.(); }, 80);
    return () => clearTimeout(timer);
  }, [initialScrollTo, onScrolled]);

  const go = (id) => { setMenuOpen(false); scrollToId(id); };
  const findFood = () => { setMenuOpen(false); onNavigatePlaces(); };

  return (
    <div className="fb">
      <a className="fb-skip" href="#how">Skip to content</a>
      <motion.div className="fb-rail" style={{ scaleX: rail }} aria-hidden="true" />

      <div className={`fb-nav-wrap${stuck ? ' is-stuck' : ''}`}>
        <div className="fb-shell">
          <nav className="fb-nav" aria-label="Main">
            <a className="fb-logo" href="#top" onClick={(e) => { e.preventDefault(); go('top'); }}>
              <span className="fb-logo-dot" aria-hidden="true" />NeighborCart
            </a>

            <div className="fb-nav-links">
              {SECTIONS.map(({ id, label }) => (
                <button key={id} type="button" aria-current={active === id} onClick={() => go(id)}>{label}</button>
              ))}
            </div>

            <button type="button" className="fb-btn" onClick={findFood}>Find food near you <Arrow /></button>

            <button
              type="button"
              className="fb-burger"
              aria-expanded={menuOpen}
              aria-controls="fb-drawer"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span /><span /><span />
            </button>
          </nav>

          {menuOpen && (
            <motion.div
              className="fb-drawer"
              id="fb-drawer"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3, ease: [0.22, 0.9, 0.3, 1] }}
            >
              {SECTIONS.map(({ id, label }) => (
                <button key={id} type="button" onClick={() => go(id)}>{label}</button>
              ))}
              <button type="button" className="fb-btn" onClick={findFood}>Find food near you <Arrow /></button>
            </motion.div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ hero */}
      <header className="fb-hero" id="top" data-ai-section="top" ref={heroRef}>
        <Loop className="fb-hero-video" />
        <div className="fb-hero-scrim" aria-hidden="true" />
        <div className="fb-hero-grain" aria-hidden="true" />

        {FLOATERS.map((f) => (
          <span
            key={f.cls}
            className={`fb-float ${f.cls}`}
            aria-hidden="true"
            style={{ translate: `calc(var(--mx, 0) * ${f.depth}px) calc(var(--my, 0) * ${f.depth}px)` }}
          >
            <img src={f.src} alt="" loading="lazy" />
          </span>
        ))}

        <div className="fb-shell fb-hero-inner">
          <motion.p className="fb-eyebrow" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <i />Fresh <i />Free <i />Nearby
          </motion.p>

          <Headline text="Good food, close by, free for everyone" />

          <motion.p className="fb-hero-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.5 }}>
            Neighbor Cart maps verified food banks, pantries, hot meal programs and 24/7 community
            fridges — with live inventory, real open hours and zero paperwork.
          </motion.p>

          <motion.div className="fb-hero-actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.6 }}>
            <button type="button" className="fb-btn fb-btn-amber" onClick={findFood}>Find food near you <Arrow /></button>
            <button type="button" className="fb-btn fb-btn-ghost" onClick={() => go('how')}>How it works</button>
          </motion.div>

          <motion.div className="fb-hero-trust" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.75 }}>
            <span><i className="fb-live" aria-hidden="true" />Live hours, updated daily</span>
            <span>No account needed</span>
            <span>Always free</span>
          </motion.div>
        </div>

        <div className="fb-dish-wrap">
          <span className="fb-dish-ring" aria-hidden="true" />
          <motion.div
            className="fb-dish"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.45, ease: [0.22, 0.9, 0.3, 1] }}
          >
            <Loop rate={0.75} start={3.4} />
          </motion.div>
          <span className="fb-dish-badge" aria-hidden="true">Open<br />right<br />now</span>
        </div>

        <div className="fb-cue" aria-hidden="true"><i />Scroll</div>

        <div className="fb-wave" aria-hidden="true">
          <svg viewBox="0 0 1440 140" preserveAspectRatio="none">
            <path d="M0 70C180 10 340 0 520 32c180 32 320 92 520 92 140 0 280-34 400-74v90H0Z" fill="#fff7e8" />
          </svg>
        </div>
      </header>

      {/* --------------------------------------------------------- marquee */}
      <div className="fb-marquee" aria-hidden="true">
        <div className="fb-marquee-track">
          {[0, 1].map((dup) => (
            <span key={dup}>
              {MARQUEE.map((m) => <React.Fragment key={m}>{m}<i /></React.Fragment>)}
            </span>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------ how it works */}
      <section className="fb-section" id="how" data-ai-section="how">
        <div className="fb-shell">
          <Reveal className="fb-section-head">
            <span className="fb-kicker">How it works</span>
            <h2>Three steps to a <em>full table</em></h2>
            <p className="fb-section-sub">
              No eligibility maze, no judgement. Everything below works whether you need food once or every week.
            </p>
          </Reveal>

          <motion.div className="fb-grid" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
            {STEPS.map((s) => (
              <motion.article key={s.n} className="fb-card" variants={reveal}>
                <span className="fb-card-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------- video reel */}
      <section className="fb-reel" id="reel" data-ai-section="reel">
        <div className="fb-shell">
          <Reveal className="fb-section-head">
            <span className="fb-kicker">What you find</span>
            <h2>Real food, <em>real portions</em></h2>
            <p className="fb-section-sub">
              Not a shelf of dented cans. Produce, protein, bread and prepared meals, listed with what is actually in stock.
            </p>
          </Reveal>

          <motion.div className="fb-reel-grid" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
            {REEL.map((r) => (
              <motion.figure key={r.title} className="fb-reel-item" variants={reveal}>
                <Loop rate={r.rate} start={r.start} objectPosition={r.pos} />
                <figcaption>{r.title}<small>{r.body}</small></figcaption>
              </motion.figure>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ----------------------------------------------------------- places */}
      <section className="fb-section" id="places" data-ai-section="places">
        <div className="fb-shell">
          <Reveal className="fb-section-head">
            <span className="fb-kicker">Near you</span>
            <h2>Open <em>right now</em></h2>
            <p className="fb-section-sub">A sample of verified locations. The live map has thousands more.</p>
          </Reveal>

          <motion.div className="fb-places" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
            {PLACES.map((p) => (
              <motion.article key={p.name} className="fb-place" data-ai-section="places" variants={reveal}>
                <div className="fb-place-media">
                  <img src={p.img} alt="" loading="lazy" />
                  <span className="fb-pill">
                    {p.live && <i className="fb-live" aria-hidden="true" />}{p.pill}
                  </span>
                </div>
                <div className="fb-place-body">
                  <h3>{p.name}</h3>
                  <p className="fb-place-meta">{p.city}</p>
                  <div className="fb-tags">{p.tags.map((t) => <span key={t} className="fb-tag">{t}</span>)}</div>
                </div>
              </motion.article>
            ))}
          </motion.div>

          <Reveal className="fb-more">
            <button type="button" className="fb-btn" onClick={findFood}>Open the full map <Arrow /></button>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ stats */}
      <section className="fb-stats" id="about" data-ai-section="about">
        <div className="fb-shell">
          <motion.div className="fb-stats-grid" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}>
            {STATS.map((s) => (
              <motion.div key={s.label} className="fb-stat" variants={reveal}>
                <Counter to={s.to} suffix={s.suffix} />
                <span>{s.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------ quote */}
      <section className="fb-section">
        <div className="fb-shell">
          <Reveal>
            <figure className="fb-quote">
              <blockquote>“I stopped guessing which pantry was open. I check once, and I go.”</blockquote>
              <figcaption>Maya K., Fremont CA — illustrative example</figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------------- cta */}
      <section className="fb-cta">
        <Loop className="fb-cta-video" rate={0.5} start={1.8} />
        <div className="fb-cta-scrim" aria-hidden="true" />
        <div className="fb-shell">
          <Reveal>
            <h2>Nobody should have to <em>search for dinner</em></h2>
            <p>Find a verified place near you in under a minute. Free, private, and open to everyone.</p>
            <div className="fb-cta-actions">
              <button type="button" className="fb-btn fb-btn-cream" onClick={findFood}>Find food near you <Arrow /></button>
              <button type="button" className="fb-btn fb-btn-ghost" onClick={findFood}>Browse the map</button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------------- footer */}
      <footer className="fb-footer" data-ai-section="about">
        <div className="fb-shell">
          <div className="fb-footer-grid">
            <div>
              <span className="fb-logo"><span className="fb-logo-dot" aria-hidden="true" />NeighborCart</span>
              <p className="fb-footer-blurb">
                A free, nationwide directory of food assistance. Built so a meal is never more than a search away.
              </p>
            </div>
            {FOOTER_COLS.map((col) => (
              <div key={col.head}>
                <h4>{col.head}</h4>
                <ul>
                  {col.links.map((l) => (
                    <li key={l}><button type="button" onClick={findFood}>{l}</button></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="fb-footer-note">
            <span>© 2026 Neighbor Cart. Free to use, always.</span>
            <span>Listings are community-verified. Call ahead to confirm hours.</span>
          </div>
        </div>
      </footer>

      {/* The navigator rides along, knowing whichever section is in view. Here
          it wears the guide appearance: this visitor is still reading, not yet
          searching. It becomes the cart mark in the workspace. */}
      <AiLauncher sectionId={aiSection} appearance="guide" />
    </div>
  );
}
