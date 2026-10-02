import React, { useState } from 'react';
import { PLACES } from '../data/places.js';

export default function AdminPortal({ onClose }) {
  const [activeAdminTab, setActiveAdminTab] = useState('approvals'); // 'approvals' | 'stale' | 'flags' | 'categories'
  const [pendingApprovals, setPendingApprovals] = useState([
    { id: 'app-1', name: 'South Bronx Mutual Fridge Alliance', city: 'Bronx, NY', submitted: '2 days ago', status: 'Pending Review' },
    { id: 'app-2', name: 'Oakland Community Bread Project', city: 'Oakland, CA', submitted: 'Yesterday', status: 'Pending Review' },
    { id: 'app-3', name: 'Austin Mobile Food Ministry', city: 'Austin, TX', submitted: 'Today', status: 'Pending Review' }
  ]);
  const [flaggedReports, setFlaggedReports] = useState([
    { id: 'flag-1', placeName: 'Food Bank of Iowa', issue: 'Holiday hours schedule change reported', reportedBy: 'Resident', date: 'Today' },
    { id: 'flag-2', placeName: 'City Harvest Mobile', issue: 'New entrance location for wheelchair access', reportedBy: 'Volunteer', date: 'Yesterday' }
  ]);

  const handleApprove = (id) => {
    setPendingApprovals(pendingApprovals.filter((a) => a.id !== id));
    alert('Organization approved and published to verified live directory!');
  };

  const handleResolveFlag = (id) => {
    setFlaggedReports(flaggedReports.filter((f) => f.id !== id));
    alert('Report marked as investigated and verified updated.');
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-header">
          <div>
            <span className="np-badge">⚙️ National Directory Admin</span>
            <h2 className="np-title">Verification & Resource Governance</h2>
            <p className="np-sub">Audit resource submissions, resolve community flags, and monitor stale data alerts.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close admin">×</button>
        </div>

        {/* Tab Controls */}
        <div className="admin-tabs-strip">
          <button
            type="button"
            className={`admin-tab-btn ${activeAdminTab === 'approvals' ? 'is-active' : ''}`}
            onClick={() => setActiveAdminTab('approvals')}
          >
            📋 Pending Org Approvals ({pendingApprovals.length})
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeAdminTab === 'flags' ? 'is-active' : ''}`}
            onClick={() => setActiveAdminTab('flags')}
          >
            ⚠️ Flagged Reports ({flaggedReports.length})
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeAdminTab === 'stale' ? 'is-active' : ''}`}
            onClick={() => setActiveAdminTab('stale')}
          >
            🔄 Stale Data Monitor (0 Critical)
          </button>
        </div>

        {/* Approvals tab */}
        {activeAdminTab === 'approvals' && (
          <div className="admin-content-pane">
            <h3>Nonprofit & Pantry Partner Submissions</h3>
            <div className="admin-items-list">
              {pendingApprovals.length === 0 ? (
                <p className="admin-empty">✓ All organization submissions have been reviewed.</p>
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
                        ✓ Approve & Issue Verified Badge
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
            <h3>Community Accuracy Reports</h3>
            <div className="admin-items-list">
              {flaggedReports.length === 0 ? (
                <p className="admin-empty">✓ Zero unresolved accuracy reports.</p>
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
                        Resolve & Mark Verified
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
            <h3>Stale-Data Automated Auditor</h3>
            <p className="np-desc">Resources older than 30 days trigger automated ping notifications to organization staff.</p>
            <div className="stale-summary-box">
              <div className="ssb-row">
                <span>Verified in last 7 days:</span>
                <b>100% of live directory (12/12 flagship locations)</b>
              </div>
              <div className="ssb-row">
                <span>Stale records flagged:</span>
                <b style={{ color: '#176834' }}>0 records out of date</b>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
