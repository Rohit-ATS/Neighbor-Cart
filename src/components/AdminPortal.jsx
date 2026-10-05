import React, { useState } from 'react';
import { PLACES } from '../data/places.js';

export default function AdminPortal({ onClose, variant = 'modal' }) {
  const isPage = variant === 'page';
  const [activeAdminTab, setActiveAdminTab] = useState('approvals'); // 'approvals' | 'flags' | 'stale'
  const [pendingApprovals, setPendingApprovals] = useState([
    { id: 'app-1', name: 'Mission Community Food Hub', city: 'San Francisco, CA', submitted: 'Yesterday', status: 'Pending Review' },
    { id: 'app-2', name: 'East Oakland Bread & Produce Collective', city: 'Oakland, CA', submitted: '2 days ago', status: 'Pending Review' },
    { id: 'app-3', name: 'South Bay Mutual Aid Pantry', city: 'San Jose, CA', submitted: 'Today', status: 'Pending Review' }
  ]);
  const [flaggedReports, setFlaggedReports] = useState([
    { id: 'flag-1', placeName: 'San Francisco-Marin Food Bank', issue: 'Holiday weekend hours schedule change', reportedBy: 'Pantry Lead', date: 'Today' },
    { id: 'flag-2', placeName: 'Second Harvest Silicon Valley (Fremont Hub)', issue: 'Updated drive-thru entrance location', reportedBy: 'Driver', date: 'Yesterday' }
  ]);

  const handleApprove = (id) => {
    setPendingApprovals(pendingApprovals.filter((a) => a.id !== id));
  };

  const handleResolveFlag = (id) => {
    setFlaggedReports(flaggedReports.filter((f) => f.id !== id));
  };

  return (
    <div
      className={`modal-backdrop${isPage ? ' is-page' : ''}`}
      onClick={isPage ? undefined : onClose}
      role={isPage ? undefined : 'dialog'}
      aria-modal={isPage ? undefined : 'true'}
      data-ai-section={isPage ? 'admin' : undefined}
    >
      <div className="admin-modal-card" onClick={isPage ? undefined : (e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-header">
          <div>
            <span className="np-badge">⚙️ Directory Verification &amp; Admin</span>
            <h2 className="np-title">Verification &amp; Resource Governance</h2>
            <p className="np-sub">Audit resource submissions, review community flags, and monitor directory staleness.</p>
          </div>
          {!isPage && (
            <button className="modal-close" onClick={onClose} aria-label="Close admin">×</button>
          )}
        </div>

        {/* Tab Controls */}
        <div className="admin-tabs-strip">
          <button
            type="button"
            className={`admin-tab-btn ${activeAdminTab === 'approvals' ? 'is-active' : ''}`}
            onClick={() => setActiveAdminTab('approvals')}
          >
            📋 Pending Partner Approvals ({pendingApprovals.length})
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeAdminTab === 'flags' ? 'is-active' : ''}`}
            onClick={() => setActiveAdminTab('flags')}
          >
            ⚠️ Accuracy Reports ({flaggedReports.length})
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeAdminTab === 'stale' ? 'is-active' : ''}`}
            onClick={() => setActiveAdminTab('stale')}
          >
            🔄 Automated Data Quality Monitor
          </button>
        </div>

        {/* Approvals tab */}
        {activeAdminTab === 'approvals' && (
          <div className="admin-content-pane">
            <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>Bay Area Nonprofit &amp; Pantry Partner Applications</h3>
            <div className="admin-items-list">
              {pendingApprovals.length === 0 ? (
                <p className="admin-empty" style={{ padding: '32px 0', textAlign: 'center', color: 'var(--d-ok)' }}>
                  ✓ All partner submissions have been reviewed and approved!
                </p>
              ) : (
                pendingApprovals.map((org) => (
                  <div key={org.id} className="admin-item-card">
                    <div>
                      <h4 className="aic-title">{org.name}</h4>
                      <p className="aic-sub">📍 {org.city} · Submitted {org.submitted}</p>
                    </div>
                    <div className="aic-actions">
                      <button
                        type="button"
                        className="btn-primary small"
                        onClick={() => handleApprove(org.id)}
                      >
                        ✓ Approve &amp; Issue Verified Badge
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Flagged Reports tab */}
        {activeAdminTab === 'flags' && (
          <div className="admin-content-pane">
            <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>Community Accuracy &amp; Hours Reports</h3>
            <div className="admin-items-list">
              {flaggedReports.length === 0 ? (
                <p className="admin-empty" style={{ padding: '32px 0', textAlign: 'center', color: 'var(--d-ok)' }}>
                  ✓ Zero unresolved accuracy reports.
                </p>
              ) : (
                flaggedReports.map((flag) => (
                  <div key={flag.id} className="admin-item-card">
                    <div>
                      <h4 className="aic-title">{flag.placeName}</h4>
                      <p className="aic-sub">Report: <b>{flag.issue}</b> ({flag.reportedBy} · {flag.date})</p>
                    </div>
                    <div className="aic-actions">
                      <button
                        type="button"
                        className="btn-secondary small"
                        onClick={() => handleResolveFlag(flag.id)}
                      >
                        Mark Investigated &amp; Resolved
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Stale data tab */}
        {activeAdminTab === 'stale' && (
          <div className="admin-content-pane">
            <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Automated Verification Health</h3>
            <p className="np-desc" style={{ margin: '0 0 20px' }}>
              Locations unverified for over 30 days trigger automated ping notifications to pantry leads.
            </p>
            <div className="stale-summary-box">
              <div className="ssb-row">
                <span>Verified Bay Area Locations:</span>
                <b>100% of flagship directory</b>
              </div>
              <div className="ssb-row">
                <span>Stale records flagged:</span>
                <b style={{ color: '#176834' }}>0 records overdue</b>
              </div>
              <div className="ssb-row">
                <span>Last automated audit run:</span>
                <b>Today · 6:00 AM PST</b>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
