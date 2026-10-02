import React, { useState } from 'react';
import { PLACES } from '../data/places.js';
import { IMPACT_METRICS } from '../data/communityData.js';

export default function NonprofitDashboard({ onClose }) {
  const [selectedOrgId, setSelectedOrgId] = useState('food-bank-iowa');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'services' | 'inventory' | 'urgent' | 'referrals' | 'export'
  const [isServiceActive, setIsServiceActive] = useState(true);
  const [urgentNeedInput, setUrgentNeedInput] = useState('');
  const [urgentNeedsList, setUrgentNeedsList] = useState([
    'Infant formula (Enfamil / Similac)',
    'Canned tuna & chicken',
    'Diapers (Sizes 4, 5, 6)'
  ]);
  const [lastVerifiedDate, setLastVerifiedDate] = useState('Today · Oct 1, 2026');
  const [incomingReferrals, setIncomingReferrals] = useState([
    { id: 'ref-1', resident: 'Family of 4 (ZIP 50316)', need: 'Emergency box with Halal & Dairy-Free items', date: 'Today 11:20 AM', status: 'Pending Contact' },
    { id: 'ref-2', resident: 'Senior resident (ZIP 50309)', need: 'Home delivery requested - limited mobility', date: 'Today 9:45 AM', status: 'Assigned Driver' },
    { id: 'ref-3', resident: 'Single parent (ZIP 50314)', need: 'Infant formula & diaper box', date: 'Yesterday', status: 'Completed' }
  ]);

  const currentOrg = PLACES.find((p) => p.id === selectedOrgId) || PLACES[0];

  const handleVerifyNow = () => {
    const todayStr = 'Verified today · ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    setLastVerifiedDate(todayStr);
    alert(`Resource information for ${currentOrg.name} has been verified and stamped as accurate!`);
  };

  const handleAddUrgentNeed = (e) => {
    e.preventDefault();
    if (!urgentNeedInput.trim()) return;
    setUrgentNeedsList([urgentNeedInput.trim(), ...urgentNeedsList]);
    setUrgentNeedInput('');
    alert('Urgent need posted to community feed and resident alerts!');
  };

  const handleExportCSV = () => {
    const headers = 'Organization,Date,ResidentsHelped,PoundsDistributed,ActiveVolunteers,VerifiedStatus\n';
    const rows = `"${currentOrg.name}","Oct 1 2026",412,4850,18,"Verified"\n"${currentOrg.name}","Sep 30 2026",390,4600,16,"Verified"\n"${currentOrg.name}","Sep 29 2026",435,5100,20,"Verified"`;
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${currentOrg.id}_impact_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="nonprofit-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="np-header">
          <div className="np-header-left">
            <span className="np-badge">🏢 Nonprofit Portal</span>
            <div className="np-title-row">
              <h2 className="np-title">{currentOrg.name}</h2>
              <select 
                className="np-org-select"
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
              >
                {PLACES.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.city}, {p.state})</option>
                ))}
              </select>
            </div>
            <p className="np-sub">{currentOrg.address}, {currentOrg.cityStateZip} · Last verified: <b>{lastVerifiedDate}</b></p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close portal">×</button>
        </div>

        {/* Action Top Bar */}
        <div className="np-top-controls">
          <div className="np-status-toggle-wrap">
            <span className="np-status-label">Service Distribution Status:</span>
            <button
              type="button"
              className={`np-status-btn ${isServiceActive ? 'is-active' : 'is-paused'}`}
              onClick={() => setIsServiceActive(!isServiceActive)}
            >
              {isServiceActive ? '🟢 Live & Accepting Residents' : '🔴 Marked Temporarily Unavailable'}
            </button>
          </div>
          <button type="button" className="btn-verify-stamp" onClick={handleVerifyNow}>
            ✓ Stamp Verified Today
          </button>
          <button type="button" className="btn-export-rep" onClick={handleExportCSV}>
            📥 Export CSV Report
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="np-tabs-nav">
          <button 
            type="button" 
            className={`np-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Community Demand
          </button>
          <button 
            type="button" 
            className={`np-tab-btn ${activeTab === 'inventory' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            📦 Live Food Inventory ({currentOrg.inventory.length})
          </button>
          <button 
            type="button" 
            className={`np-tab-btn ${activeTab === 'urgent' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('urgent')}
          >
            🚨 Urgent Needs ({urgentNeedsList.length})
          </button>
          <button 
            type="button" 
            className={`np-tab-btn ${activeTab === 'referrals' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('referrals')}
          >
            📥 Referrals & Intakes ({incomingReferrals.length})
          </button>
        </div>

        {/* Tab 1: Overview & Community Demand */}
        {activeTab === 'overview' && (
          <div className="np-tab-content">
            <div className="np-stat-grid">
              <div className="np-stat-card">
                <span className="np-sc-val">412</span>
                <span className="np-sc-label">Residents Served This Week</span>
                <span className="np-sc-sub">+14% vs previous week</span>
              </div>
              <div className="np-stat-card">
                <span className="np-sc-val">4,850 lbs</span>
                <span className="np-sc-label">Food Distributed</span>
                <span className="np-sc-sub">~4,040 nutritious meals</span>
              </div>
              <div className="np-stat-card">
                <span className="np-sc-val">18</span>
                <span className="np-sc-label">Active Volunteers</span>
                <span className="np-sc-sub">6 open shifts remaining</span>
              </div>
              <div className="np-stat-card">
                <span className="np-sc-val">99.2%</span>
                <span className="np-sc-label">Fulfillment Rate</span>
                <span className="np-sc-sub">Zero resident turnaways</span>
              </div>
            </div>

            <div className="np-demand-section">
              <h3>Anonymized Local Demand Breakdown (ZIP {currentOrg.zip})</h3>
              <p className="np-desc">Based on resident searches, intakes, and chat inquiries in your service radius.</p>
              <div className="demand-bars-list">
                {IMPACT_METRICS.categoryBreakdown.map((item, idx) => (
                  <div key={idx} className="demand-bar-row">
                    <span className="demand-bar-title">{item.category}</span>
                    <div className="demand-bar-track">
                      <div className="demand-bar-fill" style={{ width: `${item.percent * 2.2}%` }} />
                    </div>
                    <span className="demand-bar-pct">{item.percent}% requests</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Inventory Manager */}
        {activeTab === 'inventory' && (
          <div className="np-tab-content">
            <div className="np-inv-head">
              <h3>Manage Published Food Categories & Stock</h3>
              <p className="np-desc">Update availability in real-time so residents and volunteers see accurate supplies.</p>
            </div>

            <div className="np-inventory-table">
              {currentOrg.inventory.map((inv, idx) => (
                <div key={idx} className="np-inv-row">
                  <div className="np-inv-info">
                    <span className="np-inv-cat">{inv.category}</span>
                    <h4 className="np-inv-title">{inv.item}</h4>
                    <span className="np-inv-note">{inv.note}</span>
                  </div>
                  <div className="np-inv-actions">
                    <span className={`stock-tag stock-${inv.stock}`}>
                      {inv.stock === 'high' ? 'High Supply' : inv.stock === 'medium' ? 'Moderate' : 'Limited'}
                    </span>
                    <button
                      type="button"
                      className="btn-stock-toggle"
                      onClick={() => alert(`Updated stock status for ${inv.item}`)}
                    >
                      Cycle Status
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Urgent Needs Manager */}
        {activeTab === 'urgent' && (
          <div className="np-tab-content">
            <div className="np-urgent-manager">
              <h3>Broadcast Urgent Needs to Community & Donors</h3>
              <p className="np-desc">Post critical shortages so food rescue partners and local donors can mobilize immediately.</p>

              <form onSubmit={handleAddUrgentNeed} className="urgent-form">
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Critical need: Infant formula and cooking oil..."
                  value={urgentNeedInput}
                  onChange={(e) => setUrgentNeedInput(e.target.value)}
                />
                <button type="submit" className="btn-primary">Post Urgent Need</button>
              </form>

              <div className="urgent-active-list">
                <h4>Active Broadcasted Needs:</h4>
                {urgentNeedsList.map((need, idx) => (
                  <div key={idx} className="urgent-item-badge">
                    <span>🚨 {need}</span>
                    <button
                      type="button"
                      className="urgent-del-btn"
                      onClick={() => setUrgentNeedsList(urgentNeedsList.filter((_, i) => i !== idx))}
                    >
                      Resolve / Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Referrals & Intakes */}
        {activeTab === 'referrals' && (
          <div className="np-tab-content">
            <div className="np-referrals-head">
              <h3>Incoming Resident Referrals & Assistance Requests</h3>
              <p className="np-desc">Manage confidential intakes and refer residents to partner organizations.</p>
            </div>

            <div className="referrals-table">
              {incomingReferrals.map((ref) => (
                <div key={ref.id} className="referral-row-card">
                  <div className="ref-top">
                    <span className="ref-client">{ref.resident}</span>
                    <span className="ref-status-tag">{ref.status}</span>
                  </div>
                  <p className="ref-need"><b>Request:</b> {ref.need}</p>
                  <p className="ref-time">⏱ Submitted: {ref.date}</p>
                  <div className="ref-action-bar">
                    <button 
                      type="button" 
                      className="btn-primary small"
                      onClick={() => alert(`Marked referral ${ref.id} as contacted!`)}
                    >
                      Contact Resident
                    </button>
                    <button 
                      type="button" 
                      className="btn-secondary small"
                      onClick={() => alert(`Resident referred to regional partner pantry!`)}
                    >
                      Refer to Partner Org
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
