import React, { useEffect, useState } from 'react';
import { Link } from '../app/router.jsx';
import { PLACES } from '../data/catalog.js';
import FoodArt from '../components/FoodArt.jsx';
import CartMark from '../components/CartMark.jsx';
import { Button, Icon, Rating, SafetyNote, SectionHead, Skeleton, Tag } from '../components/ui.jsx';

const PREVIEW = PLACES.slice(0, 3);

/* The hero preview types itself out, then "thinks", then answers. It restarts
   on click so a demo can replay it on demand. */
function SearchPreview() {
  const prompt = "I'm allergic to peanuts and lactose intolerant. What can I eat near me tonight?";
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState('typing');
  const [run, setRun] = useState(0);

  useEffect(() => {
    setTyped('');
    setPhase('typing');
    let i = 0;
    const type = setInterval(() => {
      i += 1;
      setTyped(prompt.slice(0, i));
      if (i >= prompt.length) {
        clearInterval(type);
        setPhase('thinking');
      }
    }, 34);
    return () => clearInterval(type);
  }, [run]);

  useEffect(() => {
    if (phase !== 'thinking') return;
    const t = setTimeout(() => setPhase('answered'), 1100);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className="preview">
      <div className="preview-bar">
        <span className="preview-dot" /><span className="preview-dot" /><span className="preview-dot" />
        <span className="mono preview-title">Neighbor Cart · AI Food Guide</span>
        <button type="button" className="preview-replay" onClick={() => setRun((n) => n + 1)}>Replay</button>
      </div>

      <div className="preview-body">
        <p className="bubble bubble-user">
          {typed}
          {phase === 'typing' && <i className="caret" aria-hidden="true" />}
        </p>

        {phase === 'thinking' && (
          <div className="bubble bubble-ai is-thinking" aria-label="Thinking">
            <Skeleton lines={2} />
          </div>
        )}

        {phase === 'answered' && (
          <>
            <p className="bubble bubble-ai">
              Three places near you list peanut-free and dairy-free dishes tonight. Please confirm
              preparation and cross-contact directly with the restaurant before you order.
            </p>
            <ul className="preview-results">
              {PREVIEW.map((p, i) => (
                <li key={p.id} style={{ '--i': i }}>
                  <Link to={`/place/${p.id}`} className="mini-card">
                    <FoodArt art={p.art} className="mini-art" />
                    <span className="mini-body">
                      <b>{p.name}</b>
                      <span className="mini-meta">{p.distance} mi · {p.price} · {p.cuisine}</span>
                      <span className="mini-tags">
                        {p.allergens.slice(0, 2).map((a) => (
                          <i key={a.name} className={`dot dot-${a.status}`}>{a.name}</i>
                        ))}
                      </span>
                    </span>
                    <Rating value={p.rating} />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="preview-foot">
              <Icon name="info" size={14} />
              Confidence reflects published ingredient data, not a medical guarantee.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const TRUST = [
  { icon: 'spark', title: 'Personalized guidance', body: 'Answers shaped by your profile, not a generic search index.' },
  { icon: 'pin', title: 'Local food discovery', body: 'Restaurants, supermarkets and products inside your own radius.' },
  { icon: 'check', title: 'Ingredient-aware', body: 'Suggestions reference published ingredients and flag what is missing.' },
  { icon: 'user', title: 'Privacy-first', body: 'You decide what to share. Your profile stays yours.' },
];

const STEPS = [
  { n: '01', title: 'Tell us about yourself', body: 'Allergies, dietary goals, budget and how far you are willing to go. Takes about two minutes.', art: 'produce' },
  { n: '02', title: 'Chat with your food AI', body: 'Ask in plain language. Get ingredients explained without the jargon.', art: 'chat' },
  { n: '03', title: 'Discover food you feel good about', body: 'Nearby meals and groceries that match, each one explaining why it fits.', art: 'grainbowl' },
];

const FEATURES = [
  { title: 'AI food chat', body: 'Ingredients and nutrition explained in plain language, with the reasoning shown.' },
  { title: 'Allergy and diet profiles', body: 'Set it once. Every recommendation respects it, including a serious-allergy mode.' },
  { title: 'Restaurant and supermarket matching', body: 'Menus and aisles matched against what you can actually eat.' },
  { title: 'Grocery item alternatives', body: 'Safe swaps for the things you cannot have, at a comparable price.' },
  { title: 'Favorites and your food map', body: 'Save what works and build a personal map of your neighborhood.' },
  { title: 'Budget and distance filters', body: 'Keep results inside what you want to spend and how far you will travel.' },
];

const LIFESTYLE = ['Halal', 'Vegetarian', 'Vegan', 'Gluten-free', 'Low sodium', 'High protein', 'Family-friendly', 'Kosher', 'Pescatarian'];

export default function Landing() {
  return (
    <>
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><span className="pulse" aria-hidden="true" />Food discovery, built around you</p>
            <h1>Food that fits <em className="serif">your life.</em></h1>
            <p className="lede">
              Tell Neighbor Cart about your allergies, dietary goals, and food preferences. Our personal
              AI helps you discover nearby meals and groceries that work for you.
            </p>
            <div className="hero-actions">
              <Button as={Link} to="/onboarding" variant="primary" size="lg" icon="spark">Find food for me</Button>
              <a href="#how" className="text-link">See how it works <Icon name="arrow" size={16} /></a>
            </div>
            <ul className="meta-row">
              <li><Icon name="check" size={16} />Every suggestion says why it fits</li>
              <li><Icon name="alert" size={16} />Missing allergen data is flagged</li>
              <li><Icon name="user" size={16} />Private to your profile</li>
              <li><Icon name="info" size={16} />Food information, not medical advice</li>
            </ul>
          </div>

          <div className="hero-preview">
            <SearchPreview />
          </div>
        </div>
      </section>

      <section className="trust">
        <div className="shell">
          <p className="trust-line">
            Built for real life: <em className="serif">allergies, dietary restrictions, busy schedules,</em> and
            everyday food questions.
          </p>
          <ul className="trust-grid">
            {TRUST.map((t) => (
              <li key={t.title}>
                <span className="trust-icon" aria-hidden="true"><Icon name={t.icon} size={19} /></span>
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="how" id="how">
        <div className="shell">
          <SectionHead eyebrow="How it works" title="Three steps to a confident meal." />
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.n}>
                <FoodArt art={s.art} className="step-art" />
                <span className="mono step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="features">
        <div className="shell">
          <SectionHead eyebrow="Features" title="Your food profile, finally useful." />
          <ul className="feature-grid">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </li>
            ))}
          </ul>
          <div className="lifestyle">
            <p className="mono">Optional cultural and lifestyle preferences</p>
            <ul className="tag-row">
              {LIFESTYLE.map((l) => <li key={l}><Tag tone="green">{l}</Tag></li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="impact">
        <div className="shell impact-grid">
          <div>
            <h2>Less second-guessing. <em className="serif">More confident meals.</em></h2>
            <ul className="stat-row">
              <li><b>2 min</b><span>to set up a full food profile</span></li>
              <li><b>4 in 5</b><span>results explain exactly why they fit</span></li>
              <li><b>Every card</b><span>shows when allergen data is missing</span></li>
            </ul>
            <p className="impact-foot">Illustrative figures from our demo dataset.</p>
          </div>
          <figure className="testimonial">
            <p className="mono">Example story</p>
            <blockquote>
              “I stopped calling three restaurants before dinner. I ask once, I see what is actually safe
              to ask about, and I go.”
            </blockquote>
            <figcaption>
              <span className="avatar avatar-lg" aria-hidden="true">M</span>
              <span><b>Maya K.</b><span>Fremont, CA · peanut allergy, lactose intolerant</span></span>
            </figcaption>
            <p className="testimonial-label">Fictional user, shown as an example.</p>
          </figure>
        </div>
      </section>

      <section className="closer">
        <div className="shell closer-inner">
          <h2>Know what works for your body, then know exactly where to get it.</h2>
          <div className="hero-actions">
            <Button as={Link} to="/onboarding" variant="light" size="lg" icon="arrow">Find food for me</Button>
            <Link to="/chat" className="text-link on-dark">Try the AI Food Guide <Icon name="arrow" size={16} /></Link>
          </div>
          <SafetyNote tone="dark">
            Neighbor Cart provides food information, not medical advice. For a serious allergy, always
            verify ingredients and preparation directly with the restaurant or manufacturer.
          </SafetyNote>
        </div>
      </section>

      <footer className="site-footer">
        <div className="shell footer-grid">
          <div>
            <Link to="/" className="brand"><CartMark /><span className="brand-word">Neighbor<span>Cart</span></span></Link>
            <p className="footer-tag">Food information for real neighborhoods.</p>
          </div>
          <nav aria-label="Footer" className="footer-nav">
            <div>
              <h4>Product</h4>
              <ul>
                <li><Link to="/app">Dashboard</Link></li>
                <li><Link to="/explore">Explore</Link></li>
                <li><Link to="/chat">AI Food Guide</Link></li>
                <li><Link to="/saved">Saved</Link></li>
              </ul>
            </div>
            <div>
              <h4>Safety</h4>
              <ul>
                <li><Link to="/safety">How we handle allergens</Link></li>
                <li><Link to="/safety">Questions to ask a provider</Link></li>
                <li><Link to="/safety">Report wrong information</Link></li>
              </ul>
            </div>
            <div>
              <h4>Privacy &amp; help</h4>
              <ul>
                <li><Link to="/profile">Your data</Link></li>
                <li><Link to="/safety">Privacy</Link></li>
                <li><Link to="/safety">Help centre</Link></li>
                <li><Link to="/safety">Contact</Link></li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="shell footer-note">
          <p>
            Neighbor Cart provides food information, not medical advice. Always verify allergens and
            ingredients directly with the provider. Restaurants, products and reviews shown here are
            illustrative demo data.
          </p>
        </div>
      </footer>
    </>
  );
}
