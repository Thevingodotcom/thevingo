import React, { useRef, useState } from 'react';
import { API_URL } from '../../../config';
import authStorage from '../../../app/authStorage';
import UserAvatar from '../../../app/UserAvatar';
import { useAvatarActions } from '../../../app/useAvatarActions';
import { AVATAR_ACCEPT } from '../../../app/avatarApi';
import { getDisplayName } from '../../../app/userDisplay';
import ThemeToggleSwitch from '../../../app/ThemeToggle';
import { downloadMenu, hasExportableDishes } from '../../../utils/menuExport';
import editIcon from '../../../assets/icons/Vector.svg';
import './Settings.css';

const MENU_DOWNLOAD_OPTIONS = [
  { format: 'excel', label: 'Excel' },
  { format: 'pdf', label: 'PDF' },
  { format: 'image', label: 'Image' }
];

function Settings({ categories, currentUser, setCurrentUser, restaurantName, setRestaurantName, tagline, setTagline, hotelAddress, setHotelAddress, hotelCity, setHotelCity, hotelState, setHotelState }) {
  const [activeModal, setActiveModal] = useState(null); // 'brand', 'hotel', 'user', or null
  const [tempName, setTempName] = useState('');
  const [tempTagline, setTempTagline] = useState('');
  const [tempAddress, setTempAddress] = useState('');
  const [tempCity, setTempCity] = useState('');
  const [tempState, setTempState] = useState('');
  const [tempUsername, setTempUsername] = useState('');
  const avatarInputRef = useRef(null);
  const { upload: uploadAvatar, remove: removeAvatar, isBusy: isAvatarBusy, error: avatarError } = useAvatarActions();
  const displayName = getDisplayName(currentUser);
  const avatar = currentUser ? currentUser.avatar : null;
  const [downloadingFormat, setDownloadingFormat] = useState(null);
  const [downloadError, setDownloadError] = useState('');
  const canDownloadMenu = hasExportableDishes(categories);

  const handleDownloadMenu = async (format) => {
    setDownloadError('');
    setDownloadingFormat(format);
    try {
      await downloadMenu(format, {
        categories,
        restaurantName,
        tagline,
        address: [hotelAddress, hotelCity, hotelState].filter(Boolean).join(', ')
      });
    } catch (err) {
      console.error('Menu download error:', err);
      setDownloadError('Could not prepare the download. Please try again.');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleAvatarFileChange = (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (file) uploadAvatar(file);
  };

  const handleOpenModal = (type) => {
    setTempName(restaurantName || 'thevingo.com');
    setTempTagline(tagline || 'Menu Card every restaurant need');
    setTempAddress(hotelAddress || '');
    setTempCity(hotelCity || '');
    setTempState(hotelState || '');
    setTempUsername(currentUser && currentUser.username ? currentUser.username : '');
    setActiveModal(type);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const token = authStorage.getToken();
    
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
      
      // Merge so fields the endpoint doesn't return (e.g. avatar on older servers) are kept
      const mergedUser = { ...(currentUser || {}), ...data.user };

      if (setCurrentUser) {
        setCurrentUser(mergedUser);
      }

      authStorage.setUser(mergedUser);
      
      setActiveModal(null);
    } catch (err) {
      alert(err.message || 'Could not update settings.');
    }
  };

  return (
    <div className="settings-page-container">
      <h2 className="landing_heading2" style={{ color: 'var(--text-dark)', margin: '0 0 24px 0' }}>Setting</h2>

      {/* Card 1: Brand Customization */}
      <div className="settings-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="settings-card-title landing_heading2" style={{ margin: 0 }}>Brand Customization</h3>
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
          <span className="settings-label landing_body" style={{ minWidth: '180px' }}>Restaurant Name</span>
          <span className="settings-value landing_body">{restaurantName || 'thevingo.com'}</span>
        </div>

        <div className="settings-row" style={{ marginTop: '12px' }}>
          <span className="settings-label landing_body" style={{ minWidth: '180px' }}>Restaurant tagline</span>
          <span className="settings-value landing_body">{tagline || 'Menu Card every restaurant need'}</span>
        </div>
      </div>

      {/* Card 2: Hotel details */}
      <div className="settings-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="settings-card-title landing_heading2" style={{ margin: 0 }}>Hotel details</h3>
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
          <span className="settings-label landing_body" style={{ minWidth: '180px' }}>Restaurant City</span>
          <span className="settings-value landing_body">{hotelCity || 'Not set'}</span>
        </div>

        <div className="settings-row" style={{ marginTop: '12px' }}>
          <span className="settings-label landing_body" style={{ minWidth: '180px' }}>Restaurant State</span>
          <span className="settings-value landing_body">{hotelState || 'Not set'}</span>
        </div>

        <div className="settings-row" style={{ marginTop: '12px' }}>
          <span className="settings-label landing_body" style={{ minWidth: '180px' }}>Restaurant Address</span>
          <span className="settings-value landing_body">{hotelAddress || 'Not set'}</span>
        </div>
      </div>

      {/* Card 3: User details */}
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="settings-card-title landing_heading2" style={{ margin: 0 }}>User details</h3>
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
        
        <div className="settings-row settings-photo-row">
          <span className="settings-label landing_body" style={{ minWidth: '180px' }}>Profile photo</span>
          <div className="settings-photo">
            <UserAvatar name={displayName} avatar={avatar} isBusy={isAvatarBusy} className="settings-photo__avatar" />
            <div className="settings-photo__actions">
              <button
                type="button"
                className="settings-photo__btn"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isAvatarBusy}
              >
                {isAvatarBusy ? 'Saving…' : 'Upload photo'}
              </button>
              {avatar && (
                <button
                  type="button"
                  className="settings-photo__btn settings-photo__btn--danger"
                  onClick={() => removeAvatar()}
                  disabled={isAvatarBusy}
                >
                  Remove photo
                </button>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept={AVATAR_ACCEPT}
              onChange={handleAvatarFileChange}
              hidden
              data-testid="settings-avatar-input"
            />
          </div>
        </div>
        <p className="settings-photo__hint landing_body">JPG, PNG, GIF or WEBP, up to 2MB.</p>
        {avatarError && <p className="settings-photo__error" role="alert">{avatarError}</p>}

        <div className="settings-row" style={{ marginTop: '12px' }}>
          <span className="settings-label landing_body" style={{ minWidth: '180px' }}>User name</span>
          <span className="settings-value landing_body">{currentUser && currentUser.username ? currentUser.username : 'Not set'}</span>
        </div>
      </div>

      {/* Card 4: Menu download */}
      <div className="settings-card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="settings-card-title landing_heading2" style={{ margin: 0 }}>Menu download</h3>
        </div>

        <div className="settings-row settings-photo-row">
          <span className="settings-label landing_body" style={{ minWidth: '180px' }}>Download menu as</span>
          <div className="settings-photo__actions">
            {MENU_DOWNLOAD_OPTIONS.map(({ format, label }) => (
              <button
                key={format}
                type="button"
                className="settings-photo__btn"
                onClick={() => handleDownloadMenu(format)}
                disabled={!canDownloadMenu || downloadingFormat !== null}
              >
                {downloadingFormat === format ? 'Preparing…' : label}
              </button>
            ))}
          </div>
        </div>
        <p className="settings-photo__hint landing_body">
          {canDownloadMenu ? 'The Excel file can be imported back from Kitchen menu → Import menu.' : 'Add dishes to your menu to download it.'}
        </p>
        {downloadError && <p className="settings-photo__error" role="alert">{downloadError}</p>}
      </div>

      {/* Card 5: Appearance */}
      <div className="settings-card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="settings-card-title landing_heading2" style={{ margin: 0 }}>Appearance</h3>
        </div>

        <div className="settings-row">
          <span className="settings-label landing_body" style={{ minWidth: '180px' }}>Dark mode</span>
          <ThemeToggleSwitch id="settings-theme-toggle" />
        </div>
      </div>

      {/* Settings Edit Modal */}
      {activeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title landing_heading2">
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
                    <label className="form-label landing_body">Restaurant Name</label>
                    <input 
                      type="text" 
                      className="form-input landing_placeholder" 
                      placeholder="e.g. thevingo.com"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label landing_body">Restaurant tagline</label>
                    <input 
                      type="text" 
                      className="form-input landing_placeholder" 
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
                    <label className="form-label landing_body">Restaurant City</label>
                    <input 
                      type="text" 
                      className="form-input landing_placeholder" 
                      placeholder="e.g. Coimbatore"
                      value={tempCity}
                      onChange={(e) => setTempCity(e.target.value)}
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label landing_body">Restaurant State</label>
                    <input 
                      type="text" 
                      className="form-input landing_placeholder" 
                      placeholder="e.g. Tamilnadu"
                      value={tempState}
                      onChange={(e) => setTempState(e.target.value)}
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label landing_body">Restaurant Address</label>
                    <input 
                      type="text" 
                      className="form-input landing_placeholder" 
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
                  <label className="form-label landing_body">User name</label>
                  <input 
                    type="text" 
                    className="form-input landing_placeholder" 
                    placeholder="e.g. Kuppusamy"
                    value={tempUsername}
                    onChange={(e) => setTempUsername(e.target.value)}
                    required 
                  />
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary landing_button" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary landing_button">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
