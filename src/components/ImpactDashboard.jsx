import React from 'react';
import { IMPACT_METRICS } from '../data/communityData.js';

export default function ImpactDashboard({ onClose }) {
  const m = IMPACT_METRICS;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="impact-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="impact-header">
          <div>
            <span className="np-badge">📊 Transparent Impact</span>
            <h2 className="np-title">Nationwide Food Access Impact Report</h2>
            <p className="np-sub">Real-time metrics tracking hunger relief, volunteer mobilization, and food rescue across the US.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close impact dashboard">×</button>
        </div>

        {/* Big Counter Stat Cards */}
        <div className="impact-counters-grid">
          <div className="ic-card">
            <span className="ic-val">{m.residentsHelped.toLocaleString('en-US')}</span>
            <span className="ic-label">Residents Connected to Food</span>
            <span className="ic-note">Zero paperwork or ID barriers</span>
          </div>
          <div className="ic-card">
            <span className="ic-val">{m.poundsRescued.toLocaleString('en-US')} lbs</span>
            <span className="ic-label">Pounds of Surplus Rescued</span>
            <span className="ic-note">Diverted from food waste</span>
          </div>
          <div className="ic-card">
            <span className="ic-val">{m.estimatedMeals.toLocaleString('en-US')}</span>
            <span className="ic-label">Nutritious Meals Delivered</span>
            <span className="ic-note">1.2 lbs per meal USDA standard</span>
          </div>
          <div className="ic-card">
            <span className="ic-val">{m.volunteerHours.toLocaleString('en-US')} hrs</span>
            <span className="ic-label">Community Volunteer Hours</span>
            <span className="ic-note">{m.volunteerShiftsFilled.toLocaleString('en-US')} shifts filled</span>
          </div>
        </div>

        {/* Secondary Grid */}
        <div className="impact-secondary-grid">
          {/* Demand by ZIP code */}
          <div className="impact-section-panel">
            <h3>Community Demand by ZIP Code</h3>
            <p className="np-desc">Top metropolitan & regional areas searching for food access.</p>
            <div className="zip-table">
              {m.demandByZip.map((z, idx) => (
                <div key={idx} className="zip-row">
                  <span className="zip-num">ZIP {z.zip}</span>
                  <span className="zip-city">{z.city}</span>
                  <div className="zip-bar-track">
                    <div className="zip-bar-fill" style={{ width: `${(z.requests / 8000) * 100}%` }} />
                  </div>
                  <span className="zip-reqs">{z.requests.toLocaleString('en-US')} searches</span>
                </div>
              ))}
            </div>
          </div>

          {/* Category breakdown */}
          <div className="impact-section-panel">
            <h3>Most Requested Food Categories</h3>
            <p className="np-desc">Resident needs expressed in dietary intakes and search terms.</p>
            <div className="category-metric-list">
              {m.categoryBreakdown.map((cat, idx) => (
                <div key={idx} className="cat-metric-item">
                  <div className="cmi-top">
                    <span className="cmi-name">{cat.category}</span>
                    <span className="cmi-pct">{cat.percent}% of demand</span>
                  </div>
                  <div className="cmi-bar-track">
                    <div className="cmi-bar-fill" style={{ width: `${cat.percent * 2.4}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="performance-stat-box">
              <div className="psb-item">
                <span className="psb-val">{m.organizationsPartnered}</span>
                <span className="psb-label">Partner Pantries & Food Banks</span>
              </div>
              <div className="psb-item">
                <span className="psb-val">{m.avgResponseSeconds}s</span>
                <span className="psb-label">Avg. Request to Recommendation</span>
              </div>
              <div className="psb-item">
                <span className="psb-val">{m.successfulReferrals.toLocaleString('en-US')}</span>
                <span className="psb-label">Successful Partner Referrals</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
