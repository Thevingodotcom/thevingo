import React from 'react';
import { Link } from 'react-router-dom';
import './LandingFooter.css';

const LandingFooter = () => {
  return (
    <footer className="landing-footer" id="landing-footer">
      <div className="landing-footer__inner">
        {/* Left Column */}
        <div className="landing-footer__left">
          <h4 className="landing-footer__brand">thevingo.com</h4>
          <p className="landing-footer__email">sales@thevingo.com</p>
        </div>

        {/* Right Column */}
        <div className="landing-footer__right">
          <ul className="landing-footer__links">
            <li><Link to="/" className="landing-footer__link">Home</Link></li>
            <li><Link to="/product" className="landing-footer__link">Product</Link></li>
            <li><Link to="/pricing" className="landing-footer__link">Pricing</Link></li>
            <li><a href="#contact" className="landing-footer__link">Contact</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
