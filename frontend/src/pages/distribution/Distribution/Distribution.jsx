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
    const qrCanvas = document.getElementById('qr-canvas');
    if (!qrCanvas) return;

    // Create a new canvas for the final composed image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set dimensions for a standard vertical card layout
    canvas.width = 600;
    canvas.height = 850;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle border
    ctx.strokeStyle = '#e5e7eb'; // very light gray
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

    // Helper for centered text
    const drawCenteredText = (text, y, font, color) => {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(text, canvas.width / 2, y);
    };

    // 1. Restaurant Name / Brand
    const brandName = (restaurantName || 'THEVINGO.COM').toUpperCase();
    drawCenteredText(brandName, 120, 'bold 26px Inter, sans-serif', '#111827');

    // 2. Tagline
    const brandTagline = tagline || 'Menu Card every restaurant need';
    drawCenteredText(brandTagline, 160, '18px Inter, sans-serif', '#6b7280');

    // 3. MENU CARD Heading
    drawCenteredText('MENU CARD', 280, 'bold 34px Inter, sans-serif', '#0f172a');

    // 4. QR Code
    const qrSize = 300;
    const qrX = (canvas.width - qrSize) / 2;
    const qrY = 340;
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

    // 5. Scan text
    drawCenteredText('Scan the qr code for menu card', 700, '18px Inter, sans-serif', '#6b7280');

    // 6. Separator line
    ctx.beginPath();
    ctx.moveTo(100, 770);
    ctx.lineTo(500, 770);
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 7. Footer
    drawCenteredText('Powered by thevingo.com', 810, '15px Inter, sans-serif', '#9ca3af');

    // Trigger download
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${slug}-menu-card.png`;
    link.href = url;
    link.click();
  };

  return (
    <div className="distribution-page-container">
      <h2 style={{ fontSize: 'var(--section-subtitle-size)', fontWeight: 'var(--weight-bold)', color: 'var(--text-dark)', margin: '0 0 32px 0' }}>Distribution</h2>

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
