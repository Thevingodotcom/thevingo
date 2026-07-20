import { useState } from 'react';
import { API_URL } from '../../../config';
import editIcon from '../../../assets/icons/Vector.svg';

function Settings({ currentUser, setCurrentUser, restaurantName, setRestaurantName, tagline, setTagline, hotelAddress, setHotelAddress, hotelCity, setHotelCity, hotelState, setHotelState }) {
  const [activeModal, setActiveModal] = useState(null); // 'brand', 'hotel', 'user', or null
  const [tempName, setTempName] = useState('');
  const [tempTagline, setTempTagline] = useState('');
  const [tempAddress, setTempAddress] = useState('');
  const [tempCity, setTempCity] = useState('');
  const [tempState, setTempState] = useState('');
  const [tempUsername, setTempUsername] = useState('');

  const handleOpenModal = (type) => {
    setTempName(restaurantName || 'thevingo.com');
    setTempTagline(tagline || 'Menu Card every restaurant need');
    setTempAddress(hotelAddress || '');
    setTempCity(hotelCity || '');
    setTempState(hotelState || '');
    setTempUsername(currentUser ? currentUser.username : 'Krishna Ram');
    setActiveModal(type);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    let body = {};
    if (activeModal === 'brand') {
      body = { restaurant_name: tempName, tagline: tempTagline };
    } else if (activeModal === 'hotel') {
      body = { hotel_address: tempAddress, hotel_city: tempCity, hotel_state: tempState };
    } else if (activeModal === 'user') {
      body = { username: tempUsername };
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update settings.');
      }

      if (data.user.restaurant_name !== undefined) setRestaurantName(data.user.restaurant_name);
      if (data.user.tagline !== undefined) setTagline(data.user.tagline);
      if (data.user.hotel_address !== undefined) setHotelAddress(data.user.hotel_address);
      if (data.user.hotel_city !== undefined) setHotelCity(data.user.hotel_city);
      if (data.user.hotel_state !== undefined) setHotelState(data.user.hotel_state);
      
      if (setCurrentUser) {
        setCurrentUser(data.user);
      }

      localStorage.setItem('user', JSON.stringify(data.user));
      
      setActiveModal(null);
    } catch (err) {
      alert(err.message || 'Could not update settings.');
    }
  };

  return (
    <div className="settings-page-container">
      <h2 style={{ fontSize: 'var(--section-subtitle-size)', fontWeight: 'var(--weight-bold)', color: 'var(--text-dark)', margin: '0 0 24px 0' }}>Setting</h2>

      {/* Card 1: Brand Customization */}
      <div className="settings-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="settings-card-title" style={{ margin: 0 }}>Brand Customization</h3>
          <button 
            onClick={() => handleOpenModal('brand')} 
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px'
            }}
          >
            <img src={editIcon} alt="Edit" style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
        
        <div className="settings-row">
          <span className="settings-label" style={{ minWidth: '180px' }}>Restaurant Name</span>
          <span className="settings-value">{restaurantName || 'thevingo.com'}</span>
        </div>

        <div className="settings-row" style={{ marginTop: '12px' }}>
          <span className="settings-label" style={{ minWidth: '180px' }}>Restaurant tagline</span>
          <span className="settings-value">{tagline || 'Menu Card every restaurant need'}</span>
        </div>
      </div>

      {/* Card 2: Hotel details */}
      <div className="settings-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="settings-card-title" style={{ margin: 0 }}>Hotel details</h3>
          <button 
            onClick={() => handleOpenModal('hotel')} 
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px'
            }}
          >
            <img src={editIcon} alt="Edit" style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
        
        <div className="settings-row">
          <span className="settings-label" style={{ minWidth: '180px' }}>Restaurant City</span>
          <span className="settings-value">{hotelCity || 'Not set'}</span>
        </div>

        <div className="settings-row" style={{ marginTop: '12px' }}>
          <span className="settings-label" style={{ minWidth: '180px' }}>Restaurant State</span>
          <span className="settings-value">{hotelState || 'Not set'}</span>
        </div>

        <div className="settings-row" style={{ marginTop: '12px' }}>
          <span className="settings-label" style={{ minWidth: '180px' }}>Restaurant Address</span>
          <span className="settings-value">{hotelAddress || 'Not set'}</span>
        </div>
      </div>

      {/* Card 3: User details */}
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="settings-card-title" style={{ margin: 0 }}>User details</h3>
          <button 
            onClick={() => handleOpenModal('user')} 
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px'
            }}
          >
            <img src={editIcon} alt="Edit" style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
        
        <div className="settings-row">
          <span className="settings-label" style={{ minWidth: '180px' }}>User name</span>
          <span className="settings-value">{currentUser ? currentUser.username : 'Krishna Ram'}</span>
        </div>
      </div>

      {/* Settings Edit Modal */}
      {activeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                {activeModal === 'brand' && 'Edit Brand Customization'}
                {activeModal === 'hotel' && 'Edit Hotel details'}
                {activeModal === 'user' && 'Edit User details'}
              </h3>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>×</button>
            </div>

            <form onSubmit={handleSave}>
              {activeModal === 'brand' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Restaurant Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. thevingo.com"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Restaurant tagline</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Menu Card every restaurant need"
                      value={tempTagline}
                      onChange={(e) => setTempTagline(e.target.value)}
                      required 
                    />
                  </div>
                </>
              )}

              {activeModal === 'hotel' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Restaurant City</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Coimbatore"
                      value={tempCity}
                      onChange={(e) => setTempCity(e.target.value)}
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Restaurant State</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Tamilnadu"
                      value={tempState}
                      onChange={(e) => setTempState(e.target.value)}
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Restaurant Address</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Coimbatore"
                      value={tempAddress}
                      onChange={(e) => setTempAddress(e.target.value)}
                      required 
                    />
                  </div>
                </>
              )}

              {activeModal === 'user' && (
                <div className="form-group">
                  <label className="form-label">User name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Kuppusamy"
                    value={tempUsername}
                    onChange={(e) => setTempUsername(e.target.value)}
                    required 
                  />
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
