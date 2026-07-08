import { useState } from 'react';
import { API_URL } from '../../../config';
import addBtnIcon from '../../../assets/icons/Add.svg';
import deleteIcon from '../../../assets/icons/delete.svg';

// Custom icons inline SVGs
const TrashIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

const PlusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

// 1. Combo Offer circular badge
const ComboOfferBadge = ({ type }) => (
  <div className={`combo-offer-badge ${type === 'veg' ? 'veg-combo' : ''}`}>
    <div className="badge-inner">
      <span className="badge-text-top">COMBO</span>
      <span className="badge-text-bottom">OFFER</span>
    </div>
  </div>
);

// 2. Red Tag Badge with % symbol
const PercentTagBadge = () => (
  <div className="percent-tag-badge-wrapper">
    <svg width="44" height="44" viewBox="0 0 48 48" fill="none" style={{ transform: 'rotate(-5deg)' }}>
      <path d="M22 6 C18 6 12 12 18 18" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M15 15 L28 15 L38 25 L25 38 L15 28 Z" fill="#e11d48" stroke="#fff" strokeWidth="1.2" />
      <circle cx="19" cy="19" r="2.2" fill="#fff" />
      <text x="22" y="30" fill="#fff" fontSize="12" fontWeight="900" fontFamily="sans-serif">%</text>
    </svg>
  </div>
);

// 3. Weekend Vibe rectangular badge
const WeekendOfferBadge = () => (
  <div className="weekend-offer-badge">
    <span className="weekend-offer-title">WEEKEND</span>
    <span className="weekend-offer-subtitle">OFFER</span>
  </div>
);

function Offers({ offers, setOffers }) {

  // Modal open state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New offer form states
  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getFutureDateString = (monthsAhead = 1) => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthsAhead);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [endDate, setEndDate] = useState(getFutureDateString(1));
  const [timing, setTiming] = useState('B/L/D');
  const [pricePercent, setPricePercent] = useState('');
  const [badgeType, setBadgeType] = useState('combo-biriyani');

  // Toggle active/inactive state of offer
  const handleToggleActive = async (id) => {
    const offer = offers.find(o => o.id === id);
    if (!offer) return;
    const nextActive = !offer.isActive;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/offers/${id}/toggle`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: nextActive })
      });
      if (response.ok) {
        setOffers(prev => prev.map(o => {
          if (o.id === id) {
            return {
              ...o,
              isActive: nextActive,
              status: nextActive ? 'Active' : 'Inactive'
            };
          }
          return o;
        }));
      } else {
        alert('Failed to toggle offer status');
      }
    } catch (err) {
      console.error('Error toggling offer:', err);
      alert('Failed to toggle offer status');
    }
  };

  // Toggle checked status for delete
  const handleToggleChecked = (id) => {
    setOffers(prev => prev.map(offer => {
      if (offer.id === id) {
        return {
          ...offer,
          checked: !offer.checked
        };
      }
      return offer;
    }));
  };

  // Delete checked offers
  const handleDeleteSelected = async () => {
    const checkedIds = offers.filter(o => o.checked).map(o => o.id);
    if (checkedIds.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/offers/delete-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: checkedIds })
      });
      if (response.ok) {
        setOffers(prev => prev.filter(offer => !offer.checked));
      } else {
        alert('Failed to delete selected offers');
      }
    } catch (err) {
      console.error('Error deleting offers:', err);
      alert('Failed to delete selected offers');
    }
  };

  // Create new offer
  const handleCreateOffer = async (e) => {
    e.preventDefault();
    if (!name || !pricePercent || !startDate || !endDate) return;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const formattedDuration = `${months[start.getMonth()]} ${String(start.getDate()).padStart(2, '0')}-${months[end.getMonth()]} ${String(end.getDate()).padStart(2, '0')}`;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          badgeType,
          duration: formattedDuration,
          timing,
          pricePercent
        })
      });
      const data = await response.json();
      if (response.ok) {
        setOffers(prev => [...prev, data.offer]);

        // Reset fields
        setName('');
        setStartDate(getTodayDateString());
        setEndDate(getFutureDateString(1));
        setTiming('B/L/D');
        setPricePercent('');
        setBadgeType('combo-biriyani');
        setIsModalOpen(false);
      } else {
        alert(data.message || 'Failed to create offer');
      }
    } catch (err) {
      console.error('Error creating offer:', err);
      alert('Failed to create offer');
    }
  };

  return (
    <div className="offers-page-container" style={{ position: 'relative', minHeight: '80vh', paddingBottom: '80px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 24px 0' }}>Offer</h2>

      <div className="offers-list">
        {offers.length > 0 ? (
          offers.map(offer => (
            <div key={offer.id} className={`offer-row-card ${!offer.isActive ? 'inactive-row' : ''}`}>
              {/* Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input 
                  type="checkbox" 
                  className="offer-row-checkbox"
                  checked={offer.checked}
                  onChange={() => handleToggleChecked(offer.id)}
                />
              </div>

              {/* Toggle Switch */}
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: '12px' }}>
                <label className="offer-toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={offer.isActive}
                    onChange={() => handleToggleActive(offer.id)}
                  />
                  <span className="offer-toggle-slider"></span>
                </label>
              </div>

              {/* Badge Icon */}
              <div className="offer-badge-col" style={{ marginLeft: '16px', width: '56px', display: 'flex', justifyContent: 'center' }}>
                {offer.badgeType === 'combo-biriyani' && <ComboOfferBadge type="biriyani" />}
                {offer.badgeType === 'combo-veg' && <ComboOfferBadge type="veg" />}
                {offer.badgeType === 'percent-paneer' && <PercentTagBadge />}
                {offer.badgeType === 'weekend-vibe' && <WeekendOfferBadge />}
              </div>

              {/* Columns Details */}
              <div className="offer-details-grid">
                <div className="offer-detail-col">
                  <span className="offer-col-label">Offer name</span>
                  <span className="offer-col-value">{offer.name}</span>
                </div>

                <div className="offer-detail-col">
                  <span className="offer-col-label">Duration</span>
                  <span className="offer-col-value">{offer.duration}</span>
                </div>

                <div className="offer-detail-col">
                  <span className="offer-col-label">Status</span>
                  <span className={`offer-col-value status-badge ${offer.isActive ? 'active' : 'inactive'}`}>
                    {offer.status}
                  </span>
                </div>

                <div className="offer-detail-col">
                  <span className="offer-col-label">Timing</span>
                  <span className="offer-col-value">{offer.timing}</span>
                </div>

                <div className="offer-detail-col">
                  <span className="offer-col-label">Price/percentage</span>
                  <span className="offer-col-value">{offer.pricePercent}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state" style={{ background: '#fff', borderRadius: '8px', padding: '40px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '600' }}>No offers active</h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Click the plus button to add a new marketing promotion.</p>
          </div>
        )}
      </div>

      {/* Floating Action Buttons */}
      {offers.some(o => o.checked) && (
        <button 
          className="fab-action-btn delete-btn-img-btn" 
          onClick={handleDeleteSelected}
          title="Delete Selected Offers"
          style={{
            position: 'fixed',
            bottom: '25px',
            right: '86px',
            zIndex: 100,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
        >
          <img src={deleteIcon} alt="Delete Selected" style={{ width: '50px', height: '56px', display: 'block' }} />
        </button>
      )}

      <button 
        className="fab-action-btn add-btn-img-btn" 
        onClick={() => setIsModalOpen(true)}
        title="Add New Offer"
        style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          zIndex: 100,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          transition: 'transform 0.2s'
        }}
      >
        <img src={addBtnIcon} alt="Add New Offer" style={{ width: '50px', height: '50px', display: 'block' }} />
      </button>

      {/* Add Offer Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Offer</h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleCreateOffer}>
              <div className="form-group">
                <label className="form-label">Offer Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Monsoon Special Combo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required 
                />
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: '1.5' }}>
                  <label className="form-label">Duration</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required 
                      style={{ padding: '8px 10px', fontSize: '13px' }}
                    />
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>to</span>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required 
                      style={{ padding: '8px 10px', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Price/percentage</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. 150 Rs or 15%"
                    value={pricePercent}
                    onChange={(e) => setPricePercent(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Timing</label>
                  <select 
                    className="form-select"
                    value={timing}
                    onChange={(e) => setTiming(e.target.value)}
                  >
                    <option value="B/L/D">B/L/D (Breakfast/Lunch/Dinner)</option>
                    <option value="L/D">L/D (Lunch/Dinner)</option>
                    <option value="B/L">B/L (Breakfast/Lunch)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Badge Style</label>
                  <select 
                    className="form-select"
                    value={badgeType}
                    onChange={(e) => setBadgeType(e.target.value)}
                  >
                    <option value="combo-biriyani">Blue Combo Offer (Biriyani)</option>
                    <option value="combo-veg">Blue Combo Offer (Veg)</option>
                    <option value="percent-paneer">Red Percent Tag (%)</option>
                    <option value="weekend-vibe">Red Weekend Offer</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Offer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Offers;
