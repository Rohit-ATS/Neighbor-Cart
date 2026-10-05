import React, { useState } from 'react';
import { COMMUNITY_ANNOUNCEMENTS } from '../data/communityData.js';

/* The feed is a workspace page by default (`variant="page"`), and the same
   markup still works inside a modal — the page wrapper only drops the
   backdrop's dismiss behaviour and its close button. */
export default function CommunityFeed({ onClose, onOpenReport, variant = 'modal' }) {
  const isPage = variant === 'page';
  const [announcements, setAnnouncements] = useState(COMMUNITY_ANNOUNCEMENTS);
  const [filterType, setFilterType] = useState('all');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const filtered = announcements.filter((a) => {
    if (filterType === 'all') return true;
    return a.type.toLowerCase().includes(filterType);
  });

  return (
    <div
      className={`modal-backdrop${isPage ? ' is-page' : ''}`}
      onClick={isPage ? undefined : onClose}
      role={isPage ? undefined : 'dialog'}
      aria-modal={isPage ? undefined : 'true'}
      data-ai-section={isPage ? 'community' : undefined}
    >
      <div className="community-modal-card" onClick={isPage ? undefined : (e) => e.stopPropagation()}>
        {/* Header */}
        <div className="comm-header">
          <div>
            <span className="np-badge">📣 Community Feed</span>
            <h2 className="np-title">Food Distribution Events & Urgent Needs</h2>
            <p className="np-sub">Live updates published directly by verified hunger relief partners across the network.</p>
          </div>
          {!isPage && (
            <button className="modal-close" onClick={onClose} aria-label="Close community feed">×</button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="comm-filter-strip">
          {['all', 'urgent', 'pop-up', 'volunteer', 'program'].map((f) => (
            <button
              key={f}
              type="button"
              className={`comm-filter-btn ${filterType === f ? 'is-active' : ''}`}
              onClick={() => setFilterType(f)}
            >
              {f === 'all' ? 'All Updates' : f === 'urgent' ? '🚨 Urgent Needs' : f === 'pop-up' ? '🚐 Pop-Up Events' : f === 'volunteer' ? '🤝 Volunteer Calls' : '📢 Program Updates'}
            </button>
          ))}
          <button
            type="button"
            className="btn-report-info"
            onClick={onOpenReport}
          >
            ⚠️ Report Outdated Info
          </button>
        </div>

        {/* Feed Items */}
        <div className="comm-feed-list">
          {filtered.map((item) => (
            <article key={item.id} className="comm-feed-card">
              <div className="cfc-top">
                <span className="cfc-badge">{item.badge}</span>
                <span className="cfc-org">🏢 {item.orgName}</span>
                {item.verified && <span className="cfc-verified">✓ Verified Partner</span>}
              </div>
              <h3 className="cfc-title">{item.title}</h3>
              <p className="cfc-body">{item.body}</p>
              <div className="cfc-meta-row">
                <span>⏱ {item.date}</span>
                <span>📍 {item.location}</span>
              </div>
              <div className="cfc-feedback-row">
                <button
                  type="button"
                  className="btn-useful"
                  onClick={() => alert('Thank you for your feedback! This helps prioritize high-impact community events.')}
                >
                  👍 Helpful Resource
                </button>
                <button
                  type="button"
                  className="btn-share"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    alert('Event link copied to clipboard!');
                  }}
                >
                  🔗 Share with Neighbor
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
