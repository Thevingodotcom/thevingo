import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import LandingHeader from '../landingpage/header/LandingHeader';
import LandingFooter from '../landingpage/footer/LandingFooter';
import { API_URL } from '../../config';
import { haptics } from '../../utils/haptics';
import './TestPage.css';

const TestPage = () => {
  const [apiStatus, setApiStatus] = useState('checking');
  const [clickCount, setClickCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Check API health status
  useEffect(() => {
    const checkApi = async () => {
      try {
        const response = await fetch(`${API_URL}/`);
        const data = await response.json();
        if (data.success) {
          setApiStatus('online');
        } else {
          setApiStatus('error');
        }
      } catch (err) {
        console.error('API check failed:', err);
        setApiStatus('offline');
      }
    };
    checkApi();

    // Set interval for time updates
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleTestClick = () => {
    setClickCount(prev => prev + 1);
    // Trigger selector haptic
    haptics.selection();
  };

  const handleSuccessTrigger = () => {
    haptics.success();
    alert('Haptic feedback success signal sent! (Works on compatible mobile browsers)');
  };

  return (
    <div className="test-page-container">
      <LandingHeader />

      <main className="test-main">
        <div className="gradient-glow"></div>
        
        <div className="test-card">
          <h1 className="test-title">Vingo Diagnostics & Test Hub</h1>
          <p className="test-subtitle">
            An interactive playground to verify system integration, APIs, and client-side utilities.
          </p>

          <div className="test-grid">
            {/* API Status Section */}
            <div className="test-widget">
              <h3>Backend API Status</h3>
              <div className="status-indicator-container">
                <span className={`status-dot ${apiStatus}`}></span>
                <span className="status-text text-uppercase">{apiStatus}</span>
              </div>
              <p className="widget-desc">Connected Endpoint: <code>{API_URL}</code></p>
            </div>

            {/* Time / Clock Widget */}
            <div className="test-widget">
              <h3>System Time</h3>
              <div className="time-display">{currentTime}</div>
              <p className="widget-desc">Standard Local Client Time</p>
            </div>

            {/* Haptics Widget */}
            <div className="test-widget">
              <h3>Haptic Engine</h3>
              <div className="button-group">
                <button className="btn btn-secondary" onClick={handleTestClick}>
                  Click Vibration ({clickCount})
                </button>
                <button className="btn btn-primary" onClick={handleSuccessTrigger}>
                  Success Haptic
                </button>
              </div>
              <p className="widget-desc">Tests <code>haptics.js</code> integration on mobile devices.</p>
            </div>

            {/* Quick Links Widget */}
            <div className="test-widget">
              <h3>Navigation Links</h3>
              <div className="links-group">
                <Link to="/" className="test-link">Landing Page</Link>
                <Link to="/login" className="test-link">Sign In</Link>
                <Link to="/register" className="test-link">Sign Up</Link>
              </div>
              <p className="widget-desc">Quick redirects across application routes.</p>
            </div>
          </div>

          <div className="test-footer-notice">
            <span className="shield-icon">🛡️</span> Environment is ready for manual verification and developer review.
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
};

export default TestPage;
