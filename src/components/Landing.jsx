import React from 'react';
import Cart from './Cart.jsx';

const Arrow = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
);

export default function Landing({ onStart }) {
  return (
    <>
      <section className="page-shell">
        <nav className="topbar">
          <a className="brand" href="#top" aria-label="Nourish Passport home">
            <span className="brand-mark"><i /><b /></span>
            nourish<span>passport</span>
          </a>
          <div className="links">
            <a href="#how">How it works</a>
            <a href="#navigator">For organizations</a>
            <a href="#about">About us</a>
          </div>
          <div className="nav-actions">
            <a href="#login">Log in</a>
            <button type="button" className="button small" onClick={onStart}>Get started</button>
          </div>
        </nav>

        <div className="hero" id="top">
          <div className="hero-copy">
            <div className="eyebrow"><span className="pulse" />Food access, with follow-through</div>
            <h1>FOOD SUPPORT<br /><em>THAT STAYS WITH YOU.</em></h1>
            <p className="lede">
              One secure profile turns the food resources you qualify for into a clear, personalized
              plan—built around your life, not more paperwork.
            </p>
            <div className="hero-actions">
              <button type="button" className="button" onClick={onStart}>
                Build my food plan <Arrow />
              </button>
              <a href="#how" className="text-link">See how it works <span>↓</span></a>
            </div>
          </div>

          <Cart />
        </div>

        <div className="trust-row" id="how">
          <p><b>Designed for real life.</b> Dignity-first support for families, neighbors, and communities.</p>
          <div className="trust-items">
            <span>Private by design</span><span>•</span>
            <span>Available in Spanish</span><span>•</span>
            <span>Free to use</span>
          </div>
        </div>
      </section>

      <section className="support-strip" id="navigator">
        <p className="section-label">YOUR WEEK, MADE CLEARER</p>
        <h2>Less searching. More <em>showing up.</em></h2>
        <div className="feature-grid">
          <article>
            <span className="feature-icon">⌖</span>
            <h3>Find food for today</h3>
            <p>Open meal sites and pantries that fit your route, schedule, and dietary needs.</p>
          </article>
          <article>
            <span className="feature-icon">✓</span>
            <h3>Make a lasting plan</h3>
            <p>See benefits, school meals, and local support arranged one step at a time.</p>
          </article>
          <article>
            <span className="feature-icon">✦</span>
            <h3>Prepare with confidence</h3>
            <p>Our AI navigator explains options in plain language—never making decisions for you.</p>
          </article>
        </div>
      </section>
    </>
  );
}
