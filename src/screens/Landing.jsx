import React from 'react';
import { motion } from 'framer-motion';
import '../styles/freshbox.css';

/* Photography comes from Unsplash, the source this project already uses for
   place imagery, so nothing here depends on another site's assets. */
const IMG = (id, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const HERO_DISH = IMG('1546069901-ba9599a7e63c', 1200);
const FLOATERS = [
  { cls: 'fb-f1', src: IMG('1565299624946-b28f40a0ae38', 400), alt: '' },
  { cls: 'fb-f2', src: IMG('1540420773420-3366772f4999', 400), alt: '' },
  { cls: 'fb-f3', src: IMG('1568901346375-23c9450c58cd', 400), alt: '' },
  { cls: 'fb-f4', src: IMG('1512621776951-a57141f2eefd', 400), alt: '' },
];

const STEPS = [
  { n: '01', title: 'Tell us where you are', body: 'A ZIP code is enough. No account, no paperwork, no eligibility quiz to get started.' },
  { n: '02', title: 'See what is open now', body: 'Live hours, current inventory and dietary notes for every pantry, kitchen and fridge nearby.' },
  { n: '03', title: 'Go, or reserve ahead', body: 'One-click directions, or hold a dignified pickup slot so your food is waiting for you.' },
];

const PLACES = [
  { name: 'Food Bank of Iowa', city: 'Des Moines, IA', img: IMG('1593113598332-cd288d649433'), pill: 'Open now', tags: ['Fresh produce', 'No ID required'] },
  { name: 'Community Fridge', city: 'Chicago, IL', img: IMG('1542838132-92c53300491e'), pill: 'Open 24/7', tags: ['Self-serve', 'Halal options'] },
  { name: "St. Mary's Hot Meals", city: 'Brooklyn, NY', img: IMG('1555396273-367ea4eb4db5'), pill: 'Serving today', tags: ['Hot meals', 'Family friendly'] },
];

const STATS = [
  { n: '2,400+', label: 'Verified locations nationwide' },
  { n: '100%', label: 'Free to use, always' },
  { n: '0', label: 'Documents required to start' },
  { n: '24/7', label: 'Community fridges listed' },
];

const MARQUEE = ['Fresh produce', 'Hot meals', 'No ID required', 'Open late', 'Halal & kosher', 'Baby formula', 'Free delivery', 'Pickup slots'];

/* One reveal used everywhere, so the whole page moves with one rhythm. */
const reveal = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 0.9, 0.3, 1] } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.11 } } };

const Reveal = ({ children, className = '', as: As = 'div' }) => {
  const M = motion[As] ?? motion.div;
  return (
    <M className={className} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }}>
      {children}
    </M>
  );
};

const Arrow = () => (
  <svg className="fb-arrow" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

export default function Landing({ onNavigatePlaces }) {
  return (
    <div className="fb">
      <div className="fb-nav-wrap">
        <div className="fb-shell">
          <nav className="fb-nav" aria-label="Main">
            <a className="fb-logo" href="#top">NeighborCart</a>
            <div className="fb-nav-links">
              <button type="button" className="is-on" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Home</button>
              <button type="button" onClick={onNavigatePlaces}>Find food</button>
              <button type="button" onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>How it works</button>
              <button type="button" onClick={() => document.getElementById('places')?.scrollIntoView({ behavior: 'smooth' })}>Places</button>
              <button type="button" onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}>About</button>
            </div>
            <button type="button" className="fb-btn" onClick={onNavigatePlaces}>Find food near you <Arrow /></button>
          </nav>
        </div>
      </div>

      {/* ------------------------------------------------------------ hero */}
      <header className="fb-hero" id="top">
        {FLOATERS.map((f) => (
          <span key={f.cls} className={`fb-float ${f.cls}`} aria-hidden="true">
            <img src={f.src} alt="" loading="lazy" />
          </span>
        ))}

        <div className="fb-shell fb-hero-inner">
          <motion.p className="fb-eyebrow" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <i />Fresh <i />Free <i />Nearby
          </motion.p>

          <motion.h1
            className="fb-display"
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.08, ease: [0.22, 0.9, 0.3, 1] }}
          >
            Good food, close by, free for everyone
          </motion.h1>

          <motion.p className="fb-hero-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.26 }}>
            Neighbor Cart maps verified food banks, pantries, hot meal programs and 24/7 community
            fridges — with live inventory, real open hours and zero paperwork.
          </motion.p>

          <motion.div className="fb-hero-actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.36 }}>
            <button type="button" className="fb-btn fb-btn-amber" onClick={onNavigatePlaces}>Find food near you <Arrow /></button>
            <button type="button" className="fb-btn fb-btn-ghost" onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>
              How it works
            </button>
          </motion.div>
        </div>

        <motion.div
          className="fb-dish-wrap"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 0.9, 0.3, 1] }}
        >
          <span className="fb-dish-ring" aria-hidden="true" />
          <div className="fb-dish">
            <img src={HERO_DISH} alt="A prepared meal, photographed from above" />
          </div>
        </motion.div>

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
            <span key={dup} className="fb-display">
              {MARQUEE.map((m) => <React.Fragment key={m}>{m}<i /></React.Fragment>)}
            </span>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------ how it works */}
      <section className="fb-section" id="how">
        <div className="fb-shell">
          <Reveal className="fb-section-head">
            <span className="fb-kicker">How it works</span>
            <h2 className="fb-display">Three steps to a <em>full table</em></h2>
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

      {/* ----------------------------------------------------------- places */}
      <section className="fb-section" id="places" style={{ paddingTop: 0 }}>
        <div className="fb-shell">
          <Reveal className="fb-section-head">
            <span className="fb-kicker">Near you</span>
            <h2 className="fb-display">Open <em>right now</em></h2>
            <p className="fb-section-sub">A sample of verified locations. The live map has thousands more.</p>
          </Reveal>

          <motion.div className="fb-places" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
            {PLACES.map((p) => (
              <motion.article key={p.name} className="fb-place" variants={reveal}>
                <div className="fb-place-media">
                  <img src={p.img} alt={p.name} loading="lazy" />
                  <span className="fb-pill">{p.pill}</span>
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
            <button type="button" className="fb-btn" onClick={onNavigatePlaces}>Open the full map <Arrow /></button>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ stats */}
      <section className="fb-stats" id="about">
        <div className="fb-shell">
          <motion.div className="fb-stats-grid" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}>
            {STATS.map((s) => (
              <motion.div key={s.label} className="fb-stat" variants={reveal}>
                <b>{s.n}</b>
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
        <div className="fb-shell">
          <Reveal>
            <h2 className="fb-display">Nobody should have to search for dinner</h2>
            <p>Find a verified place near you in under a minute. Free, private, and open to everyone.</p>
            <div className="fb-cta-actions">
              <button type="button" className="fb-btn fb-btn-cream" onClick={onNavigatePlaces}>Find food near you <Arrow /></button>
              <button type="button" className="fb-btn fb-btn-ghost" onClick={onNavigatePlaces}>Browse the map</button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------------- footer */}
      <footer className="fb-footer">
        <div className="fb-shell">
          <div className="fb-footer-grid">
            <div>
              <span className="fb-logo" style={{ color: 'var(--fb-amber)', WebkitTextStroke: '0' }}>NeighborCart</span>
              <p style={{ marginTop: 14, maxWidth: '30ch' }}>
                A free, nationwide directory of food assistance. Built so a meal is never more than a search away.
              </p>
            </div>
            <div>
              <h4>Find food</h4>
              <ul>
                <li><button type="button" onClick={onNavigatePlaces}>Places &amp; map</button></li>
                <li><button type="button" onClick={onNavigatePlaces}>Open right now</button></li>
                <li><button type="button" onClick={onNavigatePlaces}>Community fridges</button></li>
              </ul>
            </div>
            <div>
              <h4>Get involved</h4>
              <ul>
                <li><button type="button" onClick={onNavigatePlaces}>Volunteer</button></li>
                <li><button type="button" onClick={onNavigatePlaces}>Food rescue</button></li>
                <li><button type="button" onClick={onNavigatePlaces}>For nonprofits</button></li>
              </ul>
            </div>
            <div>
              <h4>About</h4>
              <ul>
                <li><button type="button" onClick={onNavigatePlaces}>Our data</button></li>
                <li><button type="button" onClick={onNavigatePlaces}>Privacy</button></li>
                <li><button type="button" onClick={onNavigatePlaces}>Contact</button></li>
              </ul>
            </div>
          </div>
          <div className="fb-footer-note">
            <span>© 2026 Neighbor Cart. Free to use, always.</span>
            <span>Listings are community-verified. Call ahead to confirm hours.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
