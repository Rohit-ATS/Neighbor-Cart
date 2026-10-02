import React from 'react';
import Cart from '../components/Cart.jsx';

const Arrow = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.3">
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
);

export default function Landing({ onNavigatePlaces }) {
  return (
    <>
      <section className="page-shell">
        {/* Topbar created by David */}
        <nav className="topbar">
          <a className="brand" href="#top" aria-label="Neighbor Cart home">
            <span className="brand-mark"><i /><b /></span>
            <span>neighbor<b>cart</b></span>
          </a>
          <div className="links">
            <button type="button" className="nav-link-btn" onClick={onNavigatePlaces}>Places & Map</button>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#about">About us</a>
          </div>
          <div className="nav-actions">
            <button type="button" className="button small" onClick={onNavigatePlaces}>
              Find Food Near You
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="hero" id="top">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="pulse" />Food access, with follow-through
            </div>
            <h1>
              FOOD SUPPORT<br />
              <em>THAT STAYS WITH YOU.</em>
            </h1>
            <p className="lede">
              Connecting neighbors to verified local food banks, pantries, free hot meal programs, 
              and 24/7 community fridges—with live inventory, open hours, one-click directions, 
              and dignified pickup reservations.
            </p>
            <div className="hero-actions">
              <button type="button" className="button" onClick={onNavigatePlaces}>
                Find Food Places & Map <Arrow />
              </button>
              <a href="#how" className="text-link">See how it works <span>↓</span></a>
            </div>
          </div>

          {/* David's 3D Perspective Cart with Launching Groceries */}
          <Cart />
        </div>

        {/* Trust Row */}
        <div className="trust-row" id="how">
          <p><b>Designed for real life.</b> Dignity-first support for families, neighbors, and communities.</p>
          <div className="trust-items">
            <span>Private by design</span><span>•</span>
            <span>Always 100% Free</span><span>•</span>
            <span>No paperwork or ID required</span>
          </div>
        </div>
      </section>

      {/* Support Features Strip */}
      <section className="support-strip" id="features">
        <div className="shell-contained">
          <p className="section-label">YOUR COMMUNITY, MADE STRONGER</p>
          <h2>Less searching. More <em>showing up.</em></h2>
          
          <div className="feature-grid">
            <article>
              <span className="feature-icon">⌖</span>
              <h3>Find food for today</h3>
              <p>Explore an interactive real map of open meal sites, food banks, pantries, and 24/7 mutual aid fridges near you.</p>
              <button type="button" className="feature-link-btn" onClick={onNavigatePlaces}>
                Open Interactive Map →
              </button>
            </article>
            <article>
              <span className="feature-icon">📦</span>
              <h3>Check live inventory</h3>
              <p>Know what's on the shelves before traveling. View fresh produce, dairy, protein, baby formula, and culturally familiar foods.</p>
              <button type="button" className="feature-link-btn" onClick={onNavigatePlaces}>
                View Real Inventory →
              </button>
            </article>
            <article>
              <span className="feature-icon">🤝</span>
              <h3>Reserve with dignity</h3>
              <p>Discreetly book a pickup timeslot or food box for your family with no judgment, zero proof of income, and instant confirmation passes.</p>
              <button type="button" className="feature-link-btn" onClick={onNavigatePlaces}>
                Start a Free Reservation →
              </button>
            </article>
          </div>
        </div>
      </section>

      {/* Community Impact Row */}
      <section className="community-stat-strip" id="about">
        <div className="shell-contained community-stat-inner">
          <div className="comm-col">
            <span className="comm-num">8+</span>
            <span className="comm-label">Verified Regional Locations</span>
            <p className="comm-desc">Food Bank of Iowa, DMARC Central, CISS Free Kitchen, Little Free Pantries & more.</p>
          </div>
          <div className="comm-col">
            <span className="comm-num">100%</span>
            <span className="comm-label">Free Food Access</span>
            <p className="comm-desc">Every resource listed is free of charge for anyone experiencing food insecurity.</p>
          </div>
          <div className="comm-col">
            <span className="comm-num">0</span>
            <span className="comm-label">Barriers & Paperwork</span>
            <p className="comm-desc">No social security numbers, ID checks, or humiliating intake forms.</p>
          </div>
        </div>
      </section>

      {/* Call to action closer */}
      <section className="landing-cta-banner">
        <div className="shell-contained cta-banner-inner">
          <h2>Hungry or looking to help a neighbor?</h2>
          <p>Find open locations with directions, real photos, contact details, and fresh supplies right now.</p>
          <button type="button" className="button large" onClick={onNavigatePlaces}>
            Explore Food Banks & Pantries Map <Arrow />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-site-footer">
        <div className="shell-contained footer-content-row">
          <div className="footer-brand-side">
            <span className="brand-mark"><i /><b /></span>
            <span className="brand-text">neighbor<b>cart</b></span>
            <p className="footer-motto">Dignified, open food access for real neighborhoods.</p>
          </div>
          <div className="footer-links-side">
            <button type="button" className="footer-nav-link" onClick={onNavigatePlaces}>Places & Map</button>
            <a href="#how" className="footer-nav-link">How it Works</a>
            <a href="#features" className="footer-nav-link">Features</a>
            <a href="#about" className="footer-nav-link">Community Partners</a>
          </div>
        </div>
        <div className="shell-contained footer-bottom-row">
          <p>© {new Date().getFullYear()} Neighbor Cart · Open Access Food Network. Community-verified data.</p>
        </div>
      </footer>
    </>
  );
}
