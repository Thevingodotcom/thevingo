import React from 'react';
import { Link } from 'react-router-dom';
import './LandingFooter.css';

const LandingFooter = () => {
  return (
    <footer className="landing-footer" id="landing-footer">
      <div className="landing-footer__inner">
        {/* Left Column */}
        <div className="landing-footer__left">
          <h4 className="landing-footer__brand landing_heading2">thevingo.com</h4>
          <p className="landing-footer__email landing_body">sales@thevingo.com</p>
        </div>

        {/* Right Column */}
        <div className="landing-footer__right">
          <ul className="landing-footer__links">
            <li><Link to="/" className="landing-footer__link landing_anchor">Home</Link></li>
            <li><Link to="/product" className="landing-footer__link landing_anchor">Product</Link></li>
            <li><Link to="/pricing" className="landing-footer__link landing_anchor">Pricing</Link></li>
            <li><a href="#contact" className="landing-footer__link landing_anchor">Contact</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
