import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { APP_URL } from '../../../config';

function Distribution({ restaurantName, setRestaurantName, tagline, setTagline }) {
  const [isCopied, setIsCopied] = useState(false);

  const getSlug = (name) => {
    if (!name) return 'my-restaurant';
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  const slug = getSlug(restaurantName);
  const menuUrl = `${APP_URL}/menu/${slug}`;

  // Link copying
  const handleCopyLink = () => {
    navigator.clipboard.writeText(menuUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // QR Download
  const handleDownloadQR = () => {
    const canvas = document.getElementById('qr-canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${slug}-qr.png`;
    link.href = url;
    link.click();
  };

  return (
    <div className="distribution-page-container">
      <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 32px 0' }}>Distribution</h2>

      <div className="dist-split-layout">
        {/* Left Input Fields Column */}
        <div className="dist-inputs-col">
          {/* Restaurant Name */}
          <div className="dist-input-row">
            <span className="dist-input-label">Restaurant name</span>
            <input 
              type="text" 
              className="dist-input-field" 
              value={restaurantName}
              readOnly
            />
          </div>

          {/* Tagline */}
          <div className="dist-input-row">
            <span className="dist-input-label">Tagline</span>
            <input 
              type="text" 
              className="dist-input-field" 
              value={tagline}
              readOnly
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '32px', width: '130px' }}>
            <button className="dist-action-btn primary" onClick={handleDownloadQR}>
              Download QR
            </button>
            <button className="dist-action-btn secondary" onClick={handleCopyLink}>
              {isCopied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>

        {/* Right Preview Column */}
        <div className="dist-preview-col">
          <h3 className="dist-preview-title">Preview</h3>

          {/* Preview Tent Card */}
          <div className="dist-preview-card">
            <div className="dist-card-header">
              <h4 className="dist-card-name">
                {restaurantName.trim() ? restaurantName : 'RESTAURANT NAME'}
              </h4>
              <p className="dist-card-tagline">
                {tagline.trim() ? tagline : 'Tagline goes here'}
              </p>
            </div>

            <div className="dist-card-body">
              <h5 className="dist-card-menu-title">MENU CARD</h5>
              <div className="dist-card-qrcode-wrapper" style={{ display: 'flex', justifyContent: 'center', padding: '10px' }}>
                <QRCodeCanvas 
                  id="qr-canvas"
                  value={menuUrl} 
                  size={155} 
                  level="H" 
                  includeMargin={true}
                  style={{ display: 'block' }}
                />
              </div>
              <p className="dist-card-scan-text">Scan the qr code for menu card</p>
            </div>

            <div className="dist-card-footer">
              Powered by thevingo.com
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Distribution;
