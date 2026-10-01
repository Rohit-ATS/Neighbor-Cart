import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const Arrow = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>;

function Cart() {
  return <div className="cart-scene" aria-label="Animated grocery cart illustration">
    <span className="spark sparkle-one">✦</span><span className="spark sparkle-two">✦</span><span className="spark sparkle-three">✦</span>
    <div className="leaf leaf-a">●</div><div className="leaf leaf-b">●</div><div className="leaf leaf-c">●</div>
    <div className="cart-bag bag-one"><span>fresh</span></div>
    <div className="cart-bag bag-two"><span>care</span></div>
    <div className="carrot"><i></i></div><div className="apple"></div><div className="bread"></div>
    <div className="cart">
      <div className="cart-handle"></div>
      <div className="cart-basket"><div className="basket-lines"></div></div>
      <div className="cart-base"></div><div className="wheel left"></div><div className="wheel right"></div>
    </div>
    <div className="route route-a"></div><div className="route route-b"></div>
    <div className="location-pin"><span></span></div>
  </div>;
}

function App() {
  return <main>
    <section className="page-shell">
      <nav>
        <a className="brand" href="#top" aria-label="Nourish Passport home"><span className="brand-mark"><i></i><b></b></span>nourish<span>passport</span></a>
        <div className="links"><a href="#how">How it works</a><a href="#navigator">For organizations</a><a href="#about">About us</a></div>
        <div className="nav-actions"><a href="#login">Log in</a><a className="button small" href="#start">Get started</a></div>
      </nav>

      <div className="hero" id="top">
        <div className="eyebrow"><span className="pulse"></span>Food access, with follow-through</div>
        <h1>FOOD SUPPORT<br /><em>THAT STAYS WITH YOU.</em></h1>
        <p className="lede">One secure profile turns the food resources you qualify for into a clear, personalized plan—built around your life, not more paperwork.</p>
        <div className="hero-actions"><a href="#start" className="button">Build my food plan <Arrow /></a><a href="#how" className="text-link">See how it works <span>↓</span></a></div>
        <Cart />
      </div>

      <div className="trust-row" id="how">
        <p><b>Designed for real life.</b> Dignity-first support for families, neighbors, and communities.</p>
        <div className="trust-items"><span>Private by design</span><span>•</span><span>Available in Spanish</span><span>•</span><span>Free to use</span></div>
      </div>
    </section>

    <section className="support-strip" id="navigator">
      <p className="section-label">YOUR WEEK, MADE CLEARER</p>
      <h2>Less searching. More <em>showing up.</em></h2>
      <div className="feature-grid">
        <article><span className="feature-icon">⌖</span><h3>Find food for today</h3><p>Open meal sites and pantries that fit your route, schedule, and dietary needs.</p></article>
        <article><span className="feature-icon">✓</span><h3>Make a lasting plan</h3><p>See benefits, school meals, and local support arranged one step at a time.</p></article>
        <article><span className="feature-icon">✦</span><h3>Prepare with confidence</h3><p>Our AI navigator explains options in plain language—never making decisions for you.</p></article>
      </div>
    </section>
  </main>
}

createRoot(document.getElementById('root')).render(<App />);
