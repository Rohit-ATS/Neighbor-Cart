import React, { useState } from 'react';
import { COMMUNITY_ANNOUNCEMENTS } from '../data/communityData.js';

export default function CommunityFeed({ onClose, onSelectPlace, variant = 'modal' }) {
  const isPage = variant === 'page';
  const [announcements] = useState(COMMUNITY_ANNOUNCEMENTS);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'urgent' | 'events'
  const [copiedId, setCopiedId] = useState(null);

  const filtered = announcements.filter((a) => {
    if (filterType === 'urgent') return /urgent|need|shortage/i.test(`${a.badge} ${a.type} ${a.title}`);
    if (filterType === 'events') return /pop-up|distribution|market|meal/i.test(`${a.badge} ${a.type} ${a.title}`);
    return true;
  });

  const handleShare = (item) => {
    const textToCopy = `${item.title} — ${item.orgName}\nWhen: ${item.date}\nWhere: ${item.location}\n${item.body}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

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
            <span className="np-badge">📣 Community Relief Feed</span>
            <h2 className="np-title">Food Distribution Events &amp; Urgent Alerts</h2>
            <p className="np-sub">
              Live updates published directly by verified hunger relief partners across San Francisco, Oakland, San Jose, and Fremont.
            </p>
          </div>
          {!isPage && (
            <button className="modal-close" onClick={onClose} aria-label="Close community feed">×</button>
          )}
        </div>

        {/* Clean Filter Strip: Only 3 Important Options */}
        <div className="comm-filter-strip">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className={`comm-filter-btn ${filterType === 'all' ? 'is-active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              All Live Updates ({announcements.length})
            </button>
            <button
              type="button"
              className={`comm-filter-btn ${filterType === 'urgent' ? 'is-active' : ''}`}
              onClick={() => setFilterType('urgent')}
            >
              🚨 Urgent Needs
            </button>
            <button
              type="button"
              className={`comm-filter-btn ${filterType === 'events' ? 'is-active' : ''}`}
              onClick={() => setFilterType('events')}
            >
              🚐 Food Distributions &amp; Pop-ups
            </button>
          </div>
        </div>

        {/* Feed Items */}
        <div className="comm-feed-list">
          {filtered.map((item) => (
            <article key={item.id} className="comm-feed-card">
              <div className="cfc-top">
                <span className="cfc-badge">{item.badge}</span>
                <span className="cfc-org">🏢 <b>{item.orgName}</b></span>
                {item.verified && <span className="cfc-verified">✓ Verified Partner</span>}
              </div>

              <h3 className="cfc-title">{item.title}</h3>
              <p className="cfc-body">{item.body}</p>

              <div className="cfc-meta-row">
                <span>⏱ <b>{item.date}</b></span>
                <span>📍 <b>{item.location}</b></span>
              </div>

              <div className="cfc-feedback-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-useful"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  📍 Open Map &amp; Directions
                </a>

                <button
                  type="button"
                  className="btn-share"
                  onClick={() => handleShare(item)}
                  title="Copy details to share with neighbors"
                >
                  {copiedId === item.id ? '✓ Copied Details!' : '🔗 Share Update'}
                </button>
              </div>
            </article>
          ))}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--d-muted)' }}>
              <p>No community updates found under this filter.</p>
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: '12px' }}
                onClick={() => setFilterType('all')}
              >
                Show All Updates
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
