import React, { useEffect, useRef, useState } from 'react';
import { PLACES } from '../data/places.js';

export default function NonprofitDashboard({ onClose, onSelectPlace, variant = 'modal' }) {
  const isPage = variant === 'page';
  const defaultOrgId = PLACES[0]?.id || 'sf-marin-food-bank';
  const [selectedOrgId, setSelectedOrgId] = useState(defaultOrgId);
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const orgMenuRef = useRef(null);
  
  // Clean operational tabs: inventory, urgent needs, referrals
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'urgent' | 'referrals'
  const [isServiceActive, setIsServiceActive] = useState(true);
  const [lastVerifiedDate, setLastVerifiedDate] = useState('Today · Oct 1, 2026');
  const [verifiedSuccessToast, setVerifiedSuccessToast] = useState(false);

  // Urgent needs state
  const [urgentNeedInput, setUrgentNeedInput] = useState('');
  const [urgentNeedsList, setUrgentNeedsList] = useState([
    'Infant formula (Enfamil / Similac)',
    'Canned tuna & protein staples',
    'Toddler diapers (Sizes 4, 5, 6)',
    'Fresh California produce & greens'
  ]);

  // Current organization
  const currentOrg = PLACES.find((p) => p.id === selectedOrgId) || PLACES[0];

  // Dynamic inventory for current organization
  const [orgInventory, setOrgInventory] = useState(currentOrg?.inventory || []);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Fresh Produce');
  const [newItemNote, setNewItemNote] = useState('');

  // Update local inventory when switching organization
  useEffect(() => {
    if (currentOrg?.inventory) {
      setOrgInventory(currentOrg.inventory);
    }
  }, [currentOrg]);

  // Referrals list
  const [incomingReferrals, setIncomingReferrals] = useState([
    { 
      id: 'ref-1', 
      resident: 'Family of 4 (Potrero Hill, SF · 94107)', 
      need: 'Emergency box with Halal & Dairy-Free staples', 
      date: 'Today 11:20 AM', 
      status: 'Pending Contact' 
    },
    { 
      id: 'ref-2', 
      resident: 'Senior resident (Oakland · 94621)', 
      need: 'Home delivery requested - mobility limited', 
      date: 'Today 9:45 AM', 
      status: 'Assigned Driver' 
    },
    { 
      id: 'ref-3', 
      resident: 'Single parent (Fremont · 94538)', 
      need: 'Infant formula & size 5 diapers', 
      date: 'Yesterday 3:10 PM', 
      status: 'Completed' 
    },
    { 
      id: 'ref-4', 
      resident: 'Family of 3 (Mission District, SF · 94110)', 
      need: 'Gluten-free pantry goods & fresh vegetables', 
      date: 'Today 8:30 AM', 
      status: 'Pending Contact' 
    }
  ]);

  useEffect(() => {
    if (!isOrgMenuOpen) return undefined;

    const closeMenu = (event) => {
      if (!orgMenuRef.current?.contains(event.target)) setIsOrgMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOrgMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOrgMenuOpen]);

  const handleVerifyNow = () => {
    const todayStr = 'Verified today · ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    setLastVerifiedDate(todayStr);
    setVerifiedSuccessToast(true);
    setTimeout(() => setVerifiedSuccessToast(false), 3000);
  };

  const handleCycleStock = (index) => {
    const nextMap = {
      high: 'medium',
      medium: 'low',
      low: 'high',
      limited: 'high'
    };
    setOrgInventory((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, stock: nextMap[item.stock] || 'high' } : item))
    );
  };

  const handleAddInventory = (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const newItem = {
      item: newItemName.trim(),
      category: newItemCategory,
      stock: 'high',
      note: newItemNote.trim() || 'Available now'
    };
    setOrgInventory([newItem, ...orgInventory]);
    setNewItemName('');
    setNewItemNote('');
  };

  const handleAddUrgentNeed = (e) => {
    e.preventDefault();
    if (!urgentNeedInput.trim()) return;
    setUrgentNeedsList([urgentNeedInput.trim(), ...urgentNeedsList]);
    setUrgentNeedInput('');
  };

  const handleUpdateReferralStatus = (refId, nextStatus) => {
    setIncomingReferrals((prev) =>
      prev.map((r) => (r.id === refId ? { ...r, status: nextStatus } : r))
    );
  };

  const handleExportCSV = () => {
    const headers = 'Organization,City,State,ServiceStatus,LastVerified,Item,Category,StockLevel\n';
    const rows = orgInventory
      .map(
        (inv) =>
          `"${currentOrg.name}","${currentOrg.city}","${currentOrg.state}","${isServiceActive ? 'Active' : 'Paused'}","${lastVerifiedDate}","${inv.item}","${inv.category}","${inv.stock}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${currentOrg.id}_inventory_summary.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className={`modal-backdrop${isPage ? ' is-page' : ''}`}
      onClick={isPage ? undefined : onClose}
      role={isPage ? undefined : 'dialog'}
      aria-modal={isPage ? undefined : 'true'}
      data-ai-section={isPage ? 'nonprofit' : undefined}
    >
      <div className="nonprofit-modal-card" onClick={isPage ? undefined : (e) => e.stopPropagation()}>
        {/* Header */}
        <div className="np-header">
          <div className="np-header-left">
            <span className="np-badge">🏢 Nonprofit &amp; Pantry Portal</span>
            <div className="np-title-row">
              <h2 className="np-title">{currentOrg.name}</h2>
              <div className="np-org-picker" ref={orgMenuRef}>
                <button
                  type="button"
                  className="np-org-select"
                  aria-haspopup="listbox"
                  aria-expanded={isOrgMenuOpen}
                  onClick={() => setIsOrgMenuOpen((open) => !open)}
                  title="Switch organization"
                >
                  <span className="np-org-select-label">
                    {currentOrg.name} · {currentOrg.city}, {currentOrg.state}
                  </span>
                  <span className="np-org-chevron" aria-hidden="true">⌄</span>
                </button>
                {isOrgMenuOpen && (
                  <div className="np-org-options" role="listbox" aria-label="Choose organization">
                    {PLACES.slice(0, 30).map((place, index) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={place.id === selectedOrgId}
                        className={`np-org-option${place.id === selectedOrgId ? ' is-selected' : ''}`}
                        key={place.id}
                        style={{ '--option-index': index }}
                        onClick={() => {
                          setSelectedOrgId(place.id);
                          setIsOrgMenuOpen(false);
                        }}
                      >
                        <span>{place.name}</span>
                        <small>{place.city}, {place.state} ({place.typeLabel?.split(' ')[0] || 'Relief'})</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="np-sub">
              📍 {currentOrg.address}, {currentOrg.cityStateZip} · Last verified: <b>{lastVerifiedDate}</b>
            </p>
          </div>
          {!isPage && (
            <button className="modal-close" onClick={onClose} aria-label="Close portal">
              ×
            </button>
          )}
        </div>

        {/* Action Top Bar */}
        <div className="np-top-controls">
          <div className="np-status-toggle-wrap">
            <span className="np-status-label">Distribution Status:</span>
            <button
              type="button"
              className={`np-status-btn ${isServiceActive ? 'is-active' : 'is-paused'}`}
              onClick={() => setIsServiceActive(!isServiceActive)}
              title="Click to toggle distribution status"
            >
              {isServiceActive ? '🟢 Live & Accepting Residents' : '🔴 Temporarily Paused / At Capacity'}
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="button" className="btn-verify-stamp" onClick={handleVerifyNow}>
              ✓ Stamp Verified Today
            </button>
            <button type="button" className="btn-export-rep" onClick={handleExportCSV}>
              📥 Export CSV Report
            </button>
          </div>
        </div>

        {verifiedSuccessToast && (
          <div style={{
            background: 'rgba(29, 122, 68, 0.12)',
            color: 'var(--d-ok, #1d7a44)',
            padding: '8px 24px',
            fontSize: '13px',
            fontWeight: '600',
            borderBottom: '1px solid rgba(29, 122, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            ✓ Stamped {currentOrg.name} as verified and accurate for today!
          </div>
        )}

        {/* Clean Operational Tabs */}
        <div className="np-tabs-nav">
          <button 
            type="button" 
            className={`np-tab-btn ${activeTab === 'inventory' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            📦 Live Food Inventory ({orgInventory.length})
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
            📥 Resident Referrals ({incomingReferrals.length})
          </button>
        </div>

        {/* Tab 1: Live Food Inventory */}
        {activeTab === 'inventory' && (
          <div className="np-tab-content">
            <div className="np-inv-head">
              <div>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Manage Published Inventory &amp; Stock</h3>
                <p className="np-desc" style={{ margin: '4px 0 0' }}>
                  Update item stock in real time so neighbors and volunteers see what supplies are available.
                </p>
              </div>
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleAddInventory} style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              margin: '16px 0 20px',
              padding: '16px',
              background: 'var(--d-surface, #fff)',
              border: '1px solid var(--d-line-soft, #ece3cd)',
              borderRadius: '12px'
            }}>
              <input
                type="text"
                placeholder="Item name (e.g. Fresh Apples, Brown Rice)"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                style={{
                  flex: '2 1 200px',
                  padding: '9px 14px',
                  border: '1px solid #d4c8b2',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}
              />
              <select
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
                style={{
                  flex: '1 1 140px',
                  padding: '9px 12px',
                  border: '1px solid #d4c8b2',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}
              >
                <option value="Fresh Produce">Fresh Produce</option>
                <option value="Protein & Meat">Protein &amp; Meat</option>
                <option value="Dairy & Eggs">Dairy &amp; Eggs</option>
                <option value="Pantry Staples">Pantry Staples</option>
                <option value="Baby & Infant">Baby &amp; Infant</option>
                <option value="Prepared Meals">Prepared Meals</option>
              </select>
              <input
                type="text"
                placeholder="Note / limit (e.g. 2 bags per family)"
                value={newItemNote}
                onChange={(e) => setNewItemNote(e.target.value)}
                style={{
                  flex: '2 1 180px',
                  padding: '9px 14px',
                  border: '1px solid #d4c8b2',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '9px 20px', fontSize: '13px' }}>
                + Add Item
              </button>
            </form>

            <div className="np-inventory-table">
              {orgInventory.map((inv, idx) => (
                <div key={idx} className="np-inv-row">
                  <div className="np-inv-info">
                    <span className="np-inv-cat">{inv.category}</span>
                    <h4 className="np-inv-title">{inv.item}</h4>
                    <span className="np-inv-note">{inv.note}</span>
                  </div>
                  <div className="np-inv-actions">
                    <span className={`stock-tag stock-${inv.stock}`}>
                      {inv.stock === 'high' ? 'High Supply' : inv.stock === 'medium' ? 'Moderate' : 'Low Stock'}
                    </span>
                    <button
                      type="button"
                      className="btn-stock-toggle"
                      onClick={() => handleCycleStock(idx)}
                      title="Click to cycle stock status (High → Medium → Low)"
                    >
                      Cycle Status ↻
                    </button>
                  </div>
                </div>
              ))}

              {orgInventory.length === 0 && (
                <div style={{ textAlign: 'center', padding: '36px', color: 'var(--d-muted)' }}>
                  <p>No inventory items listed for this location yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Urgent Needs Manager */}
        {activeTab === 'urgent' && (
          <div className="np-tab-content">
            <div className="np-urgent-manager">
              <h3 style={{ margin: 0, fontSize: '16px' }}>Broadcast Urgent Shortages</h3>
              <p className="np-desc" style={{ margin: '4px 0 16px' }}>
                Broadcast critical shortages directly to donors, volunteers, and food rescue partners.
              </p>

              <form onSubmit={handleAddUrgentNeed} className="urgent-form">
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Critical need: Infant formula and cooking oil..."
                  value={urgentNeedInput}
                  onChange={(e) => setUrgentNeedInput(e.target.value)}
                />
                <button type="submit" className="btn-primary">
                  Post Urgent Need
                </button>
              </form>

              <div className="urgent-active-list" style={{ marginTop: '24px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--d-brown)' }}>
                  Active Broadcasted Needs ({urgentNeedsList.length}):
                </h4>
                {urgentNeedsList.map((need, idx) => (
                  <div key={idx} className="urgent-item-badge">
                    <span>🚨 {need}</span>
                    <button
                      type="button"
                      className="urgent-del-btn"
                      onClick={() => setUrgentNeedsList(urgentNeedsList.filter((_, i) => i !== idx))}
                      title="Mark resolved and remove"
                    >
                      Resolve / Remove ✕
                    </button>
                  </div>
                ))}

                {urgentNeedsList.length === 0 && (
                  <p style={{ color: 'var(--d-muted)', fontStyle: 'italic', padding: '16px 0' }}>
                    No urgent shortages broadcasted. All shelves currently stocked!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Referrals & Intakes */}
        {activeTab === 'referrals' && (
          <div className="np-tab-content">
            <div className="np-referrals-head">
              <h3 style={{ margin: 0, fontSize: '16px' }}>Incoming Resident Assistance Requests</h3>
              <p className="np-desc" style={{ margin: '4px 0 16px' }}>
                Review and coordinate confidential client intakes and requests submitted through the Navigator.
              </p>
            </div>

            <div className="referrals-table">
              {incomingReferrals.map((ref) => (
                <div key={ref.id} className="referral-row-card">
                  <div className="ref-top">
                    <span className="ref-client">{ref.resident}</span>
                    <span className={`ref-status-tag ${ref.status === 'Completed' ? 'is-completed' : ''}`}>
                      {ref.status}
                    </span>
                  </div>
                  <p className="ref-need"><b>Request:</b> {ref.need}</p>
                  <p className="ref-time">⏱ Submitted: {ref.date}</p>
                  <div className="ref-action-bar">
                    <button 
                      type="button" 
                      className="btn-primary small"
                      onClick={() => handleUpdateReferralStatus(ref.id, 'Contacted')}
                    >
                      {ref.status === 'Pending Contact' ? 'Contact Resident' : 'Follow Up'}
                    </button>
                    <button 
                      type="button" 
                      className="btn-secondary small"
                      onClick={() => handleUpdateReferralStatus(ref.id, 'Completed')}
                    >
                      Mark Completed
                    </button>
                    <button 
                      type="button" 
                      className="btn-secondary small"
                      onClick={() => handleUpdateReferralStatus(ref.id, 'Referred')}
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
